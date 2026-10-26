
import asyncio
import logging
import os
import secrets
import sqlite3
from contextlib import contextmanager

from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    Message,
    CallbackQuery,
    PreCheckoutQuery,
    LabeledPrice,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
)
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
WEBAPP_URL = os.getenv("WEBAPP_URL", "").strip()
OWNER_URL = os.getenv(
    "OWNER_URL", "https://t.me/Iliya_Mironov_33"
).strip()
DATABASE_PATH = os.getenv("DATABASE_PATH", "agency.db")
STARS_TO_POINTS = int(os.getenv("STARS_TO_POINTS", "1"))

TOPUP_AMOUNTS = (25, 50, 100, 250, 500)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
dp = Dispatcher()


@contextmanager
def db():
    conn = sqlite3.connect(DATABASE_PATH, timeout=20)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 20000")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with db() as conn:
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
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS topup_intents (
                payload TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                stars INTEGER NOT NULL,
                points INTEGER NOT NULL
            )
        """)


def ensure_user(user_id: int):
    with db() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO users (id, balance) VALUES (?, 0)",
            (user_id,),
        )


def get_balance(user_id: int) -> int:
    ensure_user(user_id)
    with db() as conn:
        row = conn.execute(
            "SELECT balance FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        return int(row["balance"])


def main_menu():
    rows = []

    if WEBAPP_URL:
        rows.extend([
            [InlineKeyboardButton(
                text="🎁 Открыть мини-приложение",
                web_app=WebAppInfo(url=WEBAPP_URL),
            )],
            [InlineKeyboardButton(
                text="🛍 Каталог товаров",
                web_app=WebAppInfo(url=WEBAPP_URL),
            )],
        ])

    rows.extend([
        [
            InlineKeyboardButton(
                text="👛 Мой баланс",
                callback_data="balance",
            ),
            InlineKeyboardButton(
                text="⭐ Пополнить",
                callback_data="topup",
            ),
        ],
        [
            InlineKeyboardButton(
                text="📦 Мои заказы",
                callback_data="orders",
            ),
        ],
        [
            InlineKeyboardButton(
                text="✏️ Индивидуальный заказ",
                url=OWNER_URL,
            ),
            InlineKeyboardButton(
                text="💬 Поддержка",
                url=OWNER_URL,
            ),
        ],
    ])

    return InlineKeyboardMarkup(inline_keyboard=rows)


def topup_menu():
    rows = []
    row = []

    for stars in TOPUP_AMOUNTS:
        row.append(InlineKeyboardButton(
            text=f"⭐ {stars}",
            callback_data=f"pay:{stars}",
        ))
        if len(row) == 2:
            rows.append(row)
            row = []

    if row:
        rows.append(row)

    rows.append([InlineKeyboardButton(
        text="⬅️ В меню",
        callback_data="menu",
    )])

    return InlineKeyboardMarkup(inline_keyboard=rows)


async def create_invoice(bot: Bot, user_id: int, chat_id: int, stars: int):
    if stars not in TOPUP_AMOUNTS:
        raise ValueError("Недопустимая сумма")

    payload = f"topup:{user_id}:{secrets.token_urlsafe(18)}"
    points = stars * STARS_TO_POINTS

    with db() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO users (id, balance) VALUES (?, 0)",
            (user_id,),
        )
        conn.execute(
            """INSERT INTO topup_intents
               (payload, user_id, stars, points)
               VALUES (?, ?, ?, ?)""",
            (payload, user_id, stars, points),
        )

    await bot.send_invoice(
        chat_id=chat_id,
        title="Пополнение баланса",
        description=f"Зачисление {points} баллов в Агентстве подарков",
        payload=payload,
        provider_token="",
        currency="XTR",
        prices=[LabeledPrice(label=f"{points} баллов", amount=stars)],
    )


@dp.message(CommandStart())
async def start(message: Message):
    ensure_user(message.from_user.id)

    # Поддержка ссылки ?start=topup_100
    parts = (message.text or "").split(maxsplit=1)
    if len(parts) == 2 and parts[1].startswith("topup_"):
        try:
            stars = int(parts[1][6:])
            if stars in TOPUP_AMOUNTS:
                await create_invoice(
                    message.bot,
                    message.from_user.id,
                    message.chat.id,
                    stars,
                )
                return
        except ValueError:
            pass

    await message.answer(
        "🎁 Добро пожаловать в «Агентство подарков»!\n\n"
        "Здесь можно открыть каталог, оформить заказ, "
        "посмотреть баланс и пополнить его через Telegram Stars.",
        reply_markup=main_menu(),
    )


@dp.message(Command("menu"))
async def menu_command(message: Message):
    await message.answer("🎁 Главное меню:", reply_markup=main_menu())


@dp.message(Command("balance"))
async def balance_command(message: Message):
    await message.answer(
        f"👛 Твой баланс: {get_balance(message.from_user.id)} баллов."
    )


@dp.message(Command("topup"))
async def topup_command(message: Message):
    await message.answer(
        "Выбери сумму пополнения в Telegram Stars:",
        reply_markup=topup_menu(),
    )


@dp.callback_query(F.data == "menu")
async def menu_callback(callback: CallbackQuery):
    await callback.message.answer(
        "🎁 Главное меню:", reply_markup=main_menu()
    )
    await callback.answer()


@dp.callback_query(F.data == "balance")
async def balance_callback(callback: CallbackQuery):
    balance = get_balance(callback.from_user.id)
    await callback.message.answer(
        f"👛 Твой баланс: {balance} баллов."
    )
    await callback.answer()


@dp.callback_query(F.data == "topup")
async def topup_callback(callback: CallbackQuery):
    await callback.message.answer(
        "Выбери сумму пополнения:",
        reply_markup=topup_menu(),
    )
    await callback.answer()


@dp.callback_query(F.data.startswith("pay:"))
async def pay_callback(callback: CallbackQuery, bot: Bot):
    try:
        stars = int(callback.data.split(":", 1)[1])
        await create_invoice(
            bot,
            callback.from_user.id,
            callback.message.chat.id,
            stars,
        )
        await callback.answer("Счёт создан!")
    except ValueError:
        await callback.answer("Недопустимая сумма.", show_alert=True)
    except Exception:
        logger.exception("Не удалось создать счёт")
        await callback.answer("Ошибка создания счёта.", show_alert=True)


@dp.callback_query(F.data == "orders")
async def orders_callback(callback: CallbackQuery):
    # Предполагается, что в таблице orders есть эти поля.
    try:
        with db() as conn:
            rows = conn.execute(
                """SELECT id, total, status, created_at
                   FROM orders WHERE user_id = ?
                   ORDER BY id DESC LIMIT 10""",
                (callback.from_user.id,),
            ).fetchall()

        if not rows:
            text = (
                "📦 Пока заказов нет.\n"
                "Открой мини-приложение и выбери товары."
            )
        else:
            text = "📦 Последние заказы:\n\n"
            for order in rows:
                text += (
                    f"Заказ №{order['id']} — {order['total']} баллов\n"
                    f"Статус: {order['status']}\n\n"
                )

        await callback.message.answer(text)
    except sqlite3.Error:
        logger.exception("Не удалось прочитать заказы")
        await callback.message.answer(
            "Не удалось загрузить заказы. "
            "Нужно сверить структуру таблицы orders."
        )

    await callback.answer()


@dp.pre_checkout_query()
async def pre_checkout(query: PreCheckoutQuery):
    try:
        with db() as conn:
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
            error_message=None if valid else "Не удалось проверить счёт.",
        )
    except Exception:
        logger.exception("Ошибка проверки оплаты")
        await query.answer(
            ok=False,
            error_message="Ошибка проверки оплаты.",
        )


@dp.message(F.successful_payment)
async def successful_payment(message: Message):
    payment = message.successful_payment

    if payment.currency != "XTR":
        await message.answer("Ошибка: неверная валюта платежа.")
        return

    try:
        with db() as conn:
            intent = conn.execute(
                """SELECT user_id, stars, points
                   FROM topup_intents WHERE payload = ?""",
                (payment.invoice_payload,),
            ).fetchone()

            if (
                not intent
                or int(intent["user_id"]) != message.from_user.id
                or int(intent["stars"]) != payment.total_amount
            ):
                raise ValueError("Платёж не совпадает со счётом")

            inserted = conn.execute(
                """INSERT OR IGNORE INTO payments
                   (charge_id, user_id, amount)
                   VALUES (?, ?, ?)""",
                (
                    payment.telegram_payment_charge_id,
                    message.from_user.id,
                    payment.total_amount,
                ),
            )

            if inserted.rowcount == 0:
                await message.answer(
                    "Этот платёж уже обработан."
                )
                return

            conn.execute(
                """UPDATE users SET balance = balance + ?
                   WHERE id = ?""",
                (int(intent["points"]), message.from_user.id),
            )
            conn.execute(
                "DELETE FROM topup_intents WHERE payload = ?",
                (payment.invoice_payload,),
            )

        balance = get_balance(message.from_user.id)
        text = (
            "✅ Оплата прошла успешно!\n"
            f"Зачислено: {payment.total_amount * STARS_TO_POINTS} баллов.\n"
            f"Баланс: {balance} баллов."
        )

        if WEBAPP_URL:
            await message.answer(
                text,
                reply_markup=InlineKeyboardMarkup(inline_keyboard=[[
                    InlineKeyboardButton(
                        text="🎁 Вернуться в каталог",
                        web_app=WebAppInfo(url=WEBAPP_URL),
                    )
                ]]),
            )
        else:
            await message.answer(text)

    except Exception:
        logger.exception("Ошибка зачисления платежа")
        await message.answer(
            "Не удалось завершить зачисление автоматически. "
            "Не оплачивай повторно; обратись в поддержку."
        )


async def main():
    if not BOT_TOKEN:
        raise RuntimeError("В .env не указан BOT_TOKEN")

    if not WEBAPP_URL.startswith("https://"):
        raise RuntimeError(
            "Укажи WEBAPP_URL с HTTPS-адресом опубликованного сайта"
        )

    init_db()
    bot = Bot(BOT_TOKEN)

    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
