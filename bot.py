
import asyncio
import logging
import os
import secrets
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    Message,
    CallbackQuery,
    PreCheckoutQuery,
    LabeledPrice,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
)
from aiogram.utils.keyboard import InlineKeyboardBuilder
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
WEBAPP_URL = os.getenv("WEBAPP_URL", "").strip()
DATABASE_PATH = os.getenv("DATABASE_PATH", "agency.db")

# 1 Star = 1 внутренний балл. Изменяется при необходимости.
STARS_TO_POINTS = int(os.getenv("STARS_TO_POINTS", "1"))

# Разрешённые суммы пополнения в Telegram Stars.
TOPUP_AMOUNTS = (25, 50, 100, 250, 500)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gift_agency")

dp = Dispatcher()


@contextmanager
def db_connection():
    """Каждый процесс должен использовать один и тот же файл БД."""
    conn = sqlite3.connect(DATABASE_PATH, timeout=20)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA busy_timeout = 20000")
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Создаёт нужные таблицы, не удаляя существующие данные."""
    Path(DATABASE_PATH).parent.mkdir(parents=True, exist_ok=True)

    with db_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                balance INTEGER NOT NULL DEFAULT 0,
                vip_forever INTEGER NOT NULL DEFAULT 0,
                vip_until TEXT,
                next_charge TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS payments (
                charge_id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                amount INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS topup_intents (
                payload TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                stars INTEGER NOT NULL,
                points INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                total INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'created',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)


def ensure_user(user_id: int):
    with db_connection() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO users (id, balance) VALUES (?, 0)",
            (user_id,),
        )


def get_balance(user_id: int) -> int:
    ensure_user(user_id)
    with db_connection() as conn:
        row = conn.execute(
            "SELECT balance FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        return int(row["balance"]) if row else 0


def create_topup(user_id: int, stars: int) -> tuple[str, int]:
    if stars not in TOPUP_AMOUNTS:
        raise ValueError("Недопустимая сумма пополнения.")

    points = stars * STARS_TO_POINTS
    # Payload создаётся сервером и не содержит секретных данных.
    payload = f"topup:{user_id}:{secrets.token_urlsafe(18)}"

    with db_connection() as conn:
        conn.execute(
            """INSERT OR IGNORE INTO users (id, balance)
               VALUES (?, 0)""",
            (user_id,),
        )
        conn.execute(
            """INSERT INTO topup_intents
               (payload, user_id, stars, points)
               VALUES (?, ?, ?, ?)""",
            (payload, user_id, stars, points),
        )

    return payload, points


def credit_successful_payment(
    user_id: int,
    charge_id: str,
    payload: str,
    currency: str,
    paid_stars: int,
) -> bool:
    """
    Зачисляет баллы только при совпадении пользователя, payload,
    валюты и суммы. charge_id защищает от повторного начисления.
    Возвращает False, если платёж уже был обработан.
    """
    if currency != "XTR":
        raise ValueError("Неверная валюта платежа.")

    with db_connection() as conn:
        intent = conn.execute(
            """SELECT user_id, stars, points
               FROM topup_intents WHERE payload = ?""",
            (payload,),
        ).fetchone()

        if not intent:
            raise ValueError("Не найдена заявка на пополнение.")
        if int(intent["user_id"]) != user_id:
            raise ValueError("Пользователь платежа не совпадает.")
        if int(intent["stars"]) != paid_stars:
            raise ValueError("Сумма платежа не совпадает.")

        inserted = conn.execute(
            """INSERT OR IGNORE INTO payments
               (charge_id, user_id, amount)
               VALUES (?, ?, ?)""",
            (charge_id, user_id, paid_stars),
        )

        if inserted.rowcount == 0:
            return False

        conn.execute(
            """UPDATE users
               SET balance = balance + ?
               WHERE id = ?""",
            (int(intent["points"]), user_id),
        )

        conn.execute(
            "DELETE FROM topup_intents WHERE payload = ?",
            (payload,),
        )

    return True


def deduct_balance(user_id: int, amount: int) -> bool:
    """
    Безопасное списание внутреннего баланса.
    Вызывай эту функцию в существующем API оформления заказа.
    amount должен быть рассчитан сервером по каталогу, а не клиентом.
    """
    if amount <= 0:
        raise ValueError("Сумма списания должна быть положительной.")

    with db_connection() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO users (id, balance) VALUES (?, 0)",
            (user_id,),
        )
        result = conn.execute(
            """UPDATE users
               SET balance = balance - ?
               WHERE id = ? AND balance >= ?""",
            (amount, user_id, amount),
        )
        return result.rowcount == 1


def topup_keyboard():
    builder = InlineKeyboardBuilder()
    for stars in TOPUP_AMOUNTS:
        builder.button(
            text=f"⭐ {stars} Stars",
            callback_data=f"topup:{stars}",
        )
    builder.adjust(2)
    return builder.as_markup()


def main_keyboard():
    rows = [
        [InlineKeyboardButton(
            text="💰 Пополнить баланс",
            callback_data="open_topup",
        )],
        [InlineKeyboardButton(
            text="👛 Мой баланс",
            callback_data="show_balance",
        )],
    ]

    if WEBAPP_URL:
        rows.append([InlineKeyboardButton(
            text="🎁 Открыть каталог",
            web_app={"url": WEBAPP_URL},
        )])

    return InlineKeyboardMarkup(inline_keyboard=rows)


async def send_topup_invoice(
    bot: Bot,
    chat_id: int,
    user_id: int,
    stars: int,
):
    payload, points = create_topup(user_id, stars)

    await bot.send_invoice(
        chat_id=chat_id,
        title="Пополнение баланса",
        description=f"{points} баллов для покупок в Агентстве подарков",
        payload=payload,
        provider_token="",
        currency="XTR",
        prices=[
            LabeledPrice(
                label=f"{points} баллов внутреннего баланса",
                amount=stars,
            )
        ],
    )


@dp.message(CommandStart())
async def start(message: Message, bot: Bot):
    ensure_user(message.from_user.id)

    # Поддержка ссылок вида t.me/ИМЯ_БОТА?start=topup_100
    parts = (message.text or "").split(maxsplit=1)
    if len(parts) == 2 and parts[1].startswith("topup_"):
        try:
            stars = int(parts[1].removeprefix("topup_"))
            if stars in TOPUP_AMOUNTS:
                await send_topup_invoice(
                    bot, message.chat.id, message.from_user.id, stars
                )
                return
        except (ValueError, TypeError):
            pass

    await message.answer(
        "🎁 Добро пожаловать в «Агентство подарков»!\n\n"
        f"Баланс: {get_balance(message.from_user.id)} баллов.\n"
        "Здесь можно пополнить баланс и перейти в каталог.",
        reply_markup=main_keyboard(),
    )


@dp.message(Command("balance"))
async def balance_command(message: Message):
    await message.answer(
        f"👛 Твой баланс: {get_balance(message.from_user.id)} баллов."
    )


@dp.message(Command("topup"))
async def topup_command(message: Message):
    await message.answer(
        "Выбери сумму пополнения в Telegram Stars:",
        reply_markup=topup_keyboard(),
    )


@dp.callback_query(F.data == "open_topup")
async def open_topup(callback: CallbackQuery):
    await callback.message.answer(
        "Выбери сумму пополнения в Telegram Stars:",
        reply_markup=topup_keyboard(),
    )
    await callback.answer()


@dp.callback_query(F.data == "show_balance")
async def show_balance(callback: CallbackQuery):
    balance = get_balance(callback.from_user.id)
    await callback.message.answer(f"👛 Твой баланс: {balance} баллов.")
    await callback.answer()


@dp.callback_query(F.data.startswith("topup:"))
async def topup_callback(callback: CallbackQuery, bot: Bot):
    try:
        stars = int(callback.data.split(":", 1)[1])
        if stars not in TOPUP_AMOUNTS:
            raise ValueError
        await send_topup_invoice(
            bot,
            callback.message.chat.id,
            callback.from_user.id,
            stars,
        )
        await callback.answer("Счёт создан.")
    except (ValueError, TypeError):
        await callback.answer("Эта сумма недоступна.", show_alert=True)


@dp.pre_checkout_query()
async def pre_checkout(query: PreCheckoutQuery):
    """
    Telegram ждёт ответ на pre_checkout_query в течение 10 секунд.
    До подтверждения оплаты баланс не начисляется.
    """
    try:
        with db_connection() as conn:
            intent = conn.execute(
                """SELECT user_id, stars
                   FROM topup_intents WHERE payload = ?""",
                (query.invoice_payload,),
            ).fetchone()

        valid = (
            intent is not None
            and int(intent["user_id"]) == query.from_user.id
            and int(intent["stars"]) == query.total_amount
            and query.currency == "XTR"
        )

        await query.answer(
            ok=valid,
            error_message=None if valid else "Не удалось проверить платёж.",
        )
    except Exception:
        logger.exception("Ошибка проверки платежа")
        await query.answer(
            ok=False,
            error_message="Ошибка проверки. Попробуй ещё раз.",
        )


@dp.message(F.successful_payment)
async def successful_payment(message: Message, bot: Bot):
    payment = message.successful_payment

    try:
        credited = credit_successful_payment(
            user_id=message.from_user.id,
            charge_id=payment.telegram_payment_charge_id,
            payload=payment.invoice_payload,
            currency=payment.currency,
            paid_stars=payment.total_amount,
        )
    except Exception:
        logger.exception("Не удалось обработать успешный платёж")
        await message.answer(
            "Платёж получен, но автоматическое зачисление не завершилось. "
            "Не оплачивай повторно — обратись в поддержку и сообщи "
            "идентификатор платежа:\n"
            f"<code>{payment.telegram_payment_charge_id}</code>",
            parse_mode="HTML",
        )
        return

    if not credited:
        await message.answer(
            "Этот платёж уже был обработан. Повторного начисления нет."
        )
        return

    balance = get_balance(message.from_user.id)
    text = (
        "✅ Оплата прошла успешно!\n"
        f"Зачислено: {payment.total_amount * STARS_TO_POINTS} баллов.\n"
        f"Текущий баланс: {balance} баллов."
    )

    if WEBAPP_URL:
        keyboard = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(
                text="🎁 Вернуться в мини-приложение",
                web_app={"url": WEBAPP_URL},
            )
        ]])
        await message.answer(text, reply_markup=keyboard)
    else:
        await message.answer(text)


@dp.message(Command("paysupport"))
async def payment_support(message: Message):
    await message.answer(
        "По вопросам платежей обратись к владельцу Агентства подарков."
    )


async def main():
    if not BOT_TOKEN:
        raise RuntimeError("Укажи BOT_TOKEN в файле .env")

    init_db()
    bot = Bot(BOT_TOKEN)

    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
