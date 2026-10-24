"""Агентство подарков — Telegram bot + API.

Required environment variables: BOT_TOKEN, WEBAPP_URL, ADMIN_ID
Optional: SUPPORT_URL, DATABASE_PATH, PORT
"""
import asyncio
import json
import logging
import os
import secrets
import sqlite3
import time
from contextlib import closing
from typing import Any

import uvicorn
from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton,
    KeyboardButton, ReplyKeyboardMarkup, LabeledPrice, PreCheckoutQuery,
    WebAppInfo
)
from fastapi import FastAPI, HTTPException, Request

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s"
)
log = logging.getLogger("gift-agency")

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
WEBAPP_URL = os.getenv("WEBAPP_URL", "").strip()
ADMIN_ID = int(os.getenv("ADMIN_ID", "0") or 0)
SUPPORT_URL = os.getenv(
    "SUPPORT_URL", "https://t.me/Iliya_Mironov_33"
).strip()
DB_PATH = os.getenv("DATABASE_PATH", "data.sqlite3")
DISCOUNT_PERCENT = 10

# Каталог товаров. Цены указаны в Telegram Stars (XTR).
PRODUCTS = [
    (0, "Зима в горах", 200, "🏔️"),
    (1, "Тёплая зима", 90, "⛄"),
    (2, "Новогодний ананас", 260, "🍍"),
    (3, "Тыква", 50, "🎃"),
    (4, "Мышь на лыжах", 150, "🐭"),
    (5, "Белая башня", 200, "🏰"),
    (6, "Довольная собака", 400, "🐶"),
    (7, "Пляжная картина", 70, "🏖️"),
    (8, "Татошка", 400, "🧸"),
    (9, "Летнее здание", 400, "🏡"),
    (10, "Сомы в пруду", 400, "🐟"),
    (11, "Доисторическое искусство", 680, "🦕"),
    (12, "Попугай", 250, "🦜"),
    (13, "Александр Сергеевич Пушкин", 400, "📜"),
    (14, "Здание в перспективе", 500, "🏛️"),
    (15, "Тропический дракон", 600, "🐉"),
    (16, "Картина в перспективе", 560, "🖼️"),
    (17, "Кит", 200, "🐋"),
    (18, "Арбузный дом", 200, "🍉"),
    (19, "Ротонда", 280, "🏛️"),
    (20, "Ночной маяк", 210, "🗼"),
    (21, "Арбузный лес", 170, "🌳"),
    (22, "Гусь в поле", 220, "🪿"),
    (23, "Ночной цветок", 180, "🌺"),
    (24, "Редкая птица", 230, "🦚"),
    (25, "Сахарница с чайником", 250, "🫖"),
    (26, "Петушок", 300, "🐓"),
    (27, "Голубь", 180, "🕊️"),
    (28, "Жаворонок", 200, "🐦"),
    (29, "Ворона индеец", 190, "🐦‍⬛"),
    (30, "Город у моря", 210, "🌆"),
    (31, "Ёлочное украшение", 90, "🔔"),
    (32, "Довольный морж", 260, "🦭"),
    (33, "Фермерский дом", 140, "🏠"),
    (34, "Новогодняя снежинка", 90, "❄️"),
    (35, "Новогодний фонарь", 240, "🏮"),
    (36, "Дом на холмах", 220, "⛰️"),
    (37, "Морской отдых", 150, "🌊"),
    (38, "Мальчик в деревне", 230, "🧑‍🌾"),
    (39, "Торговый центр рыба", 190, "🐠"),
    (40, "Большой новогодний шар", 150, "🔮"),
    (41, "Таинственный лес", 200, "🌲"),
    (42, "Сырная планета", 200, "🧀"),
]

PRODUCT_MAP = {
    p[0]: {"id": p[0], "name": p[1], "price": p[2], "emoji": p[3]}
    for p in PRODUCTS
}


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    with closing(db()) as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS users(
          user_id INTEGER PRIMARY KEY,
          username TEXT,
          first_name TEXT,
          points INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS orders(
          order_id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          items_json TEXT NOT NULL,
          amount INTEGER NOT NULL,
          currency TEXT NOT NULL DEFAULT 'XTR',
          status TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          telegram_payment_charge_id TEXT UNIQUE,
          FOREIGN KEY(user_id) REFERENCES users(user_id)
        );
        CREATE TABLE IF NOT EXISTS support_messages(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          message TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS point_ledger(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          delta INTEGER NOT NULL,
          reason TEXT NOT NULL,
          ref TEXT UNIQUE,
          created_at INTEGER NOT NULL
        );
        """)
        c.commit()


def upsert_user(
    user_id: int, username: str | None, first_name: str | None
) -> None:
    with closing(db()) as c:
        c.execute(
            "INSERT INTO users(user_id,username,first_name,created_at) "
            "VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET "
            "username=excluded.username, first_name=excluded.first_name",
            (user_id, username, first_name, int(time.time()))
        )
        c.commit()


def user_points(user_id: int) -> int:
    with closing(db()) as c:
        row = c.execute(
            "SELECT points FROM users WHERE user_id=?", (user_id,)
        ).fetchone()
        return int(row[0]) if row else 0


def main_keyboard() -> ReplyKeyboardMarkup:
    rows = []
    if WEBAPP_URL.startswith("https://"):
        rows.append([
            KeyboardButton(
                text="🛍️ Магазин",
                web_app=WebAppInfo(url=WEBAPP_URL)
            )
        ])
    rows += [
        [
            KeyboardButton(text="🎨 Создать своё"),
            KeyboardButton(text="✨ Помоги выбрать")
        ],
        [
            KeyboardButton(text="📦 Мои заказы"),
            KeyboardButton(text="⭐ Мой баланс")
        ],
        [
            KeyboardButton(text="💬 Поддержка"),
            KeyboardButton(text="ℹ️ О проекте")
        ]
    ]
    return ReplyKeyboardMarkup(
        keyboard=rows,
        resize_keyboard=True,
        input_field_placeholder="Выбери действие 🎁"
    )


def inline_webapp_button() -> InlineKeyboardMarkup | None:
    if WEBAPP_URL.startswith("https://"):
        return InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(
                text="Открыть мини-магазин 🛍️",
                web_app=WebAppInfo(url=WEBAPP_URL)
            )
        ]])
    return None


router = Router()
bot = Bot(BOT_TOKEN) if BOT_TOKEN else None
dp = Dispatcher()
api = FastAPI(title="Агентство подарков API", version="1.0")


@router.message(CommandStart())
async def start(message: Message):
    u = message.from_user
    upsert_user(u.id, u.username, u.first_name)
    text = (
        f"Привет, {u.first_name or 'друг'}! 🎁\n\n"
        "Добро пожаловать в «Агентство подарков»! Здесь можно выбрать "
        "подарок, оформить индивидуальный заказ, проверить баллы и "
        "обратиться в поддержку.\n\n"
        "Осенняя акция: скидка 10% — итоговую цену подтвердим перед оплатой."
    )
    await message.answer(text, reply_markup=main_keyboard())
    if not WEBAPP_URL.startswith("https://"):
        await message.answer(
            "⚙️ Магазин пока не опубликован. После размещения HTML укажем "
            "его HTTPS-адрес в переменной WEBAPP_URL."
        )


@router.message(F.text == "🛍️ Магазин")
async def shop(message: Message):
    if not WEBAPP_URL.startswith("https://"):
        await message.answer(
            "Магазин ещё не опубликован. Сначала разместим HTML на "
            "HTTPS-хостинге, затем добавим адрес в WEBAPP_URL."
        )
    else:
        await message.answer(
            "Открывай наш каталог 👇",
            reply_markup=inline_webapp_button()
        )


@router.message(F.text == "⭐ Мой баланс")
async def balance(message: Message):
    await message.answer(
        f"⭐ Твой баланс: {user_points(message.from_user.id)} баллов\n\n"
        "Баллы хранятся в базе данных. Пополнение и списание подключаются "
        "только после подтверждения сервером."
    )


@router.message(F.text == "📦 Мои заказы")
async def orders(message: Message):
    with closing(db()) as c:
        rows = c.execute(
            "SELECT order_id,items_json,amount,status,created_at FROM orders "
            "WHERE user_id=? ORDER BY created_at DESC LIMIT 10",
            (message.from_user.id,)
        ).fetchall()
    if not rows:
        await message.answer(
            "Пока заказов нет. Загляни в мини-магазин, чтобы выбрать подарок 🎁"
        )
        return
    lines = ["📦 Твои последние заказы:"]
    for r in rows:
        lines.append(
            f"\n• {r['order_id']} — {r['amount']} XTR — статус: {r['status']}"
        )
    await message.answer("\n".join(lines))


@router.message(F.text == "🎨 Создать своё")
async def custom_order(message: Message):
    await message.answer(
        "🎨 Индивидуальный заказ\n\nНапиши одним сообщением, что хочешь "
        "заказать: идею, размер, цвета и к какому сроку нужен подарок. "
        "Я передам заявку администратору. Чтобы отменить, напиши /cancel."
    )
    with closing(db()) as c:
        c.execute(
            "CREATE TABLE IF NOT EXISTS user_modes("
            "user_id INTEGER PRIMARY KEY, mode TEXT NOT NULL)"
        )
        c.execute(
            "INSERT INTO user_modes(user_id,mode) VALUES(?, 'custom') "
            "ON CONFLICT(user_id) DO UPDATE SET mode='custom'",
            (message.from_user.id,)
        )
        c.commit()


@router.message(F.text == "✨ Помоги выбрать")
async def choose(message: Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="🎨 Рисунок", callback_data="pick:art"),
            InlineKeyboardButton(text="🏡 Дом/здание", callback_data="pick:building")
        ],
        [
            InlineKeyboardButton(text="🐾 Животное", callback_data="pick:animal"),
            InlineKeyboardButton(text="🎄 Новый год", callback_data="pick:newyear")
        ],
        [
            InlineKeyboardButton(
                text="🌟 Необычный подарок", callback_data="pick:surprise"
            )
        ]
    ])
    await message.answer(
        "Что примерно ищем? Выбери направление — подберу варианты из каталога.",
        reply_markup=kb
    )


@router.callback_query(F.data.startswith("pick:"))
async def pick(callback: CallbackQuery):
    key = callback.data.split(":", 1)[1]
    words = {
        "art": ["Картина в перспективе", "Пляжная картина", "Здание в перспективе"],
        "building": ["Белая башня", "Фермерский дом", "Дом на холмах", "Ротонда"],
        "animal": ["Довольная собака", "Попугай", "Кит", "Гусь в поле", "Довольный морж"],
        "newyear": ["Зима в горах", "Тёплая зима", "Ёлочное украшение", "Новогодняя снежинка"],
        "surprise": ["Тропический дракон", "Сырная планета", "Таинственный лес", "Новогодний ананас"]
    }
    chosen = words.get(key, [])
    lines = []
    for name in chosen:
        product = next(p for p in PRODUCTS if p[1] == name)
        lines.append(f"• {product[3]} {name} — {product[2]} XTR")
    await callback.message.answer(
        "✨ Идеи для тебя:\n" + "\n".join(lines) +
        "\n\nОткрой магазин, чтобы добавить выбранное в корзину.",
        reply_markup=inline_webapp_button()
    )
    await callback.answer()
  @router.message(F.text == "💬 Поддержка")
async def support(message: Message):
    await message.answer(
        f"💬 Поддержка Агентства подарков\n\n"
        f"Напиши сюда вопрос одним сообщением — я передам его администратору. "
        f"Также можно написать лично: {SUPPORT_URL}\n\n"
        "Для отмены режима напиши /cancel."
    )
    with closing(db()) as c:
        c.execute(
            "CREATE TABLE IF NOT EXISTS user_modes("
            "user_id INTEGER PRIMARY KEY, mode TEXT NOT NULL)"
        )
        c.execute(
            "INSERT INTO user_modes(user_id,mode) VALUES(?, 'support') "
            "ON CONFLICT(user_id) DO UPDATE SET mode='support'",
            (message.from_user.id,)
        )
        c.commit()


@router.message(F.text == "ℹ️ О проекте")
async def about(message: Message):
    await message.answer(
        "🎁 Агентство подарков\n"
        "Авторские поделки, рисунки на бумаге, открытки и индивидуальные заказы.\n\n"
        "🍂 Осенняя акция: −10% на товары. Финальную сумму покажем до оплаты.\n"
        "💬 Поддержка: " + SUPPORT_URL,
        reply_markup=main_keyboard()
    )


@router.message(Command("cancel"))
async def cancel(message: Message):
    with closing(db()) as c:
        c.execute(
            "DELETE FROM user_modes WHERE user_id=?",
            (message.from_user.id,)
        )
        c.commit()
    await message.answer(
        "Хорошо, действие отменено. Возвращаю главное меню.",
        reply_markup=main_keyboard()
    )


@router.message(Command("paytest"))
async def paytest(message: Message):
    """Тестовый счёт на 1 Star. Удали или ограничь команду перед запуском."""
    if not bot:
        return
    payload = "test:" + secrets.token_urlsafe(12)
    with closing(db()) as c:
        c.execute(
            "INSERT OR IGNORE INTO orders("
            "order_id,user_id,items_json,amount,currency,status,created_at"
            ") VALUES(?,?,?,?,?,?,?)",
            (
                payload,
                message.from_user.id,
                json.dumps(
                    [{"name": "Тестовый платёж", "qty": 1}],
                    ensure_ascii=False
                ),
                1, "XTR", "pending", int(time.time())
            )
        )
        c.commit()
    await bot.send_invoice(
        chat_id=message.chat.id,
        title="Тестовый платёж Агентства",
        description="Проверка оплаты Telegram Stars на 1 ⭐",
        payload=payload,
        provider_token="",
        currency="XTR",
        prices=[LabeledPrice(label="Тест", amount=1)]
    )


@router.pre_checkout_query()
async def pre_checkout(query: PreCheckoutQuery):
    with closing(db()) as c:
        row = c.execute(
            "SELECT amount,currency,status FROM orders "
            "WHERE order_id=? AND user_id=?",
            (query.invoice_payload, query.from_user.id)
        ).fetchone()

    if (
        not row
        or row["status"] != "pending"
        or row["currency"] != query.currency
        or int(row["amount"]) != int(query.total_amount)
    ):
        await query.answer(
            ok=False,
            error_message="Не удалось проверить заказ. Создай новый счёт, пожалуйста."
        )
    else:
        await query.answer(ok=True)


@router.message(F.successful_payment)
async def successful_payment(message: Message):
    payment = message.successful_payment
    payload = payment.invoice_payload

    with closing(db()) as c:
        row = c.execute(
            "SELECT user_id,status,amount,currency FROM orders WHERE order_id=?",
            (payload,)
        ).fetchone()

        if not row:
            log.error("Unknown successful payment payload: %s", payload)
            await message.answer(
                "Оплата получена, но заказ требует ручной проверки. "
                "Напиши в поддержку: " + SUPPORT_URL
            )
            return

        if row["status"] == "paid":
            await message.answer("Этот платёж уже был подтверждён. Спасибо! ⭐")
            return

        if (
            payment.currency != "XTR"
            or int(payment.total_amount) != int(row["amount"])
        ):
            log.error("Payment mismatch for %s", payload)
            await message.answer(
                "Платёж требует ручной проверки. Обратись в поддержку: "
                + SUPPORT_URL
            )
            return

        c.execute(
            "UPDATE orders SET status='paid', telegram_payment_charge_id=? "
            "WHERE order_id=? AND status='pending'",
            (payment.telegram_payment_charge_id, payload)
        )
        c.execute(
            "INSERT OR IGNORE INTO point_ledger("
            "user_id,delta,reason,ref,created_at) VALUES(?,?,?,?,?)",
            (
                message.from_user.id,
                1,
                "successful_stars_payment",
                payment.telegram_payment_charge_id,
                int(time.time())
            )
        )
        c.execute(
            "UPDATE users SET points=points+1 WHERE user_id=?",
            (message.from_user.id,)
        )
        c.commit()

    await message.answer(
        "⭐ Оплата подтверждена Telegram! Спасибо за поддержку Агентства подарков.\n\n"
        "Оплата обычного заказа из корзины требует подключения мини-магазина к API."
    )

    if ADMIN_ID and bot:
        try:
            await bot.send_message(
                ADMIN_ID,
                f"✅ Получен платёж Telegram Stars\n"
                f"Пользователь: {message.from_user.id}\n"
                f"Сумма: {payment.total_amount} XTR\n"
                f"Payload: {payload}"
            )
        except Exception:
            log.exception("Could not notify admin")


@router.message(F.text)
async def free_text(message: Message):
    if not message.from_user:
        return

    with closing(db()) as c:
        c.execute(
            "CREATE TABLE IF NOT EXISTS user_modes("
            "user_id INTEGER PRIMARY KEY, mode TEXT NOT NULL)"
        )
        mode_row = c.execute(
            "SELECT mode FROM user_modes WHERE user_id=?",
            (message.from_user.id,)
        ).fetchone()

        if not mode_row:
            return

        mode = mode_row["mode"]
        c.execute(
            "DELETE FROM user_modes WHERE user_id=?",
            (message.from_user.id,)
        )

        if mode == "support":
            c.execute(
                "INSERT INTO support_messages(user_id,message,created_at) "
                "VALUES(?,?,?)",
                (
                    message.from_user.id,
                    message.text[:4000],
                    int(time.time())
                )
            )
        c.commit()

    if mode == "custom":
        await message.answer(
            "Спасибо! 🎨 Заявка сохранена и отправлена администратору.",
            reply_markup=main_keyboard()
        )
        if ADMIN_ID and bot:
            await bot.send_message(
                ADMIN_ID,
                f"🎨 Индивидуальный заказ\n"
                f"От: {message.from_user.full_name} "
                f"(ID {message.from_user.id})\n\n"
                f"{message.text[:3500]}"
            )

    elif mode == "support":
        await message.answer(
            "Сообщение сохранено. Спасибо! Поддержка ответит, когда сможет. 💬",
            reply_markup=main_keyboard()
        )
        if ADMIN_ID and bot:
            await bot.send_message(
                ADMIN_ID,
                f"💬 Обращение в поддержку\n"
                f"От: {message.from_user.full_name} "
                f"(ID {message.from_user.id})\n\n"
                f"{message.text[:3500]}"
            )


def validate_init_data(init_data: str) -> dict[str, Any]:
    """Проверяет подпись initData по алгоритму Telegram."""
    if not BOT_TOKEN or not init_data:
        raise HTTPException(401, "Telegram initData is required")

    from urllib.parse import parse_qsl
    import hashlib
    import hmac

    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = pairs.pop("hash", None)

    if not received_hash:
        raise HTTPException(401, "Missing initData hash")

    data_check_string = "\n".join(
        f"{key}={value}" for key, value in sorted(pairs.items())
    )
    secret_key = hmac.new(
        b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256
    ).digest()
    calculated = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(calculated, received_hash):
        raise HTTPException(401, "Invalid initData signature")

    auth_date = int(pairs.get("auth_date", "0") or 0)
    if not auth_date or time.time() - auth_date > 86400:
        raise HTTPException(401, "Expired Telegram initData")

    try:
        user = json.loads(pairs.get("user", "{}"))
        user_id = int(user["id"])
    except Exception as exc:
        raise HTTPException(401, "Invalid Telegram user data") from exc

    upsert_user(user_id, user.get("username"), user.get("first_name"))
    return {"user_id": user_id, "user": user}
  @api.get("/health")
async def health():
    return {
        "ok": True,
        "service": "agentstvo-podarkov",
        "mini_app_url_configured": WEBAPP_URL.startswith("https://")
    }


@api.get("/api/catalog")
async def catalog():
    return {
        "currency": "XTR",
        "discount_percent": DISCOUNT_PERCENT,
        "products": [
            {"id": i, "name": n, "price": p, "emoji": e}
            for i, n, p, e in PRODUCTS
        ]
    }


@api.get("/api/me")
async def me(request: Request):
    auth = validate_init_data(
        request.headers.get("X-Telegram-Init-Data", "")
    )

    with closing(db()) as c:
        row = c.execute(
            "SELECT points FROM users WHERE user_id=?",
            (auth["user_id"],)
        ).fetchone()

        orders_rows = c.execute(
            "SELECT order_id,amount,currency,status,created_at "
            "FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 20",
            (auth["user_id"],)
        ).fetchall()

    return {
        "user_id": auth["user_id"],
        "points": int(row[0]) if row else 0,
        "orders": [dict(r) for r in orders_rows]
    }


@api.post("/api/orders")
async def create_order(request: Request):
    if not bot:
        raise HTTPException(503, "Bot is not configured")

    auth = validate_init_data(
        request.headers.get("X-Telegram-Init-Data", "")
    )
    body = await request.json()
    items = body.get("items")

    if not isinstance(items, list) or not items or len(items) > 50:
        raise HTTPException(400, "Cart is empty or invalid")

    clean = []
    subtotal = 0

    for item in items:
        try:
            product_id = int(item["id"])
            qty = int(item["qty"])
        except (KeyError, TypeError, ValueError) as exc:
            raise HTTPException(400, "Invalid cart item") from exc

        if product_id not in PRODUCT_MAP or qty < 1 or qty > 20:
            raise HTTPException(400, "Unknown product or invalid quantity")

        product = PRODUCT_MAP[product_id]
        subtotal += product["price"] * qty

        clean.append({
            "id": product_id,
            "name": product["name"],
            "qty": qty,
            "unit_price": product["price"]
        })

    amount = max(
        1,
        int(subtotal * (100 - DISCOUNT_PERCENT) / 100)
    )
    order_id = "ord_" + secrets.token_urlsafe(12)

    with closing(db()) as c:
        c.execute(
            "INSERT INTO orders("
            "order_id,user_id,items_json,amount,currency,status,created_at"
            ") VALUES(?,?,?,?,?,?,?)",
            (
                order_id,
                auth["user_id"],
                json.dumps(clean, ensure_ascii=False),
                amount,
                "XTR",
                "pending",
                int(time.time())
            )
        )
        c.commit()

    try:
        invoice_url = await bot.create_invoice_link(
            title="Заказ — Агентство подарков",
            description=f"{len(clean)} позиций. Скидка 10% уже учтена.",
            payload=order_id,
            provider_token="",
            currency="XTR",
            prices=[
                LabeledPrice(
                    label="Заказ со скидкой 10%",
                    amount=amount
                )
            ]
        )
    except Exception as exc:
        with closing(db()) as c:
            c.execute(
                "UPDATE orders SET status='invoice_error' WHERE order_id=?",
                (order_id,)
            )
            c.commit()

        log.exception("Invoice creation failed")
        raise HTTPException(
            502, "Could not create Telegram Stars invoice"
        ) from exc

    return {
        "order_id": order_id,
        "currency": "XTR",
        "subtotal": subtotal,
        "discount_percent": DISCOUNT_PERCENT,
        "total": amount,
        "invoice_url": invoice_url
    }


@api.post("/api/custom-order")
async def api_custom_order(request: Request):
    auth = validate_init_data(
        request.headers.get("X-Telegram-Init-Data", "")
    )
    body = await request.json()
    message = str(body.get("message", "")).strip()

    if len(message) < 5 or len(message) > 4000:
        raise HTTPException(
            400,
            "Please provide a custom order description (5–4000 characters)"
        )

    with closing(db()) as c:
        c.execute(
            "INSERT INTO support_messages(user_id,message,created_at) "
            "VALUES(?,?,?)",
            (
                auth["user_id"],
                "CUSTOM ORDER: " + message,
                int(time.time())
            )
        )
        c.commit()

    if ADMIN_ID and bot:
        await bot.send_message(
            ADMIN_ID,
            "🎨 Индивидуальный заказ через мини-магазин\n"
            f"Пользователь ID {auth['user_id']}\n\n"
            f"{message[:3500]}"
        )

    return {"ok": True, "message": "Заявка отправлена"}


async def run_api():
    config = uvicorn.Config(
        api,
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        log_level="info"
    )
    server = uvicorn.Server(config)
    await server.serve()


async def run_bot():
    if not bot:
        raise RuntimeError(
            "Set BOT_TOKEN environment variable before running"
        )

    dp.include_router(router)
    await dp.start_polling(
        bot,
        allowed_updates=dp.resolve_used_update_types()
    )


async def main():
    init_db()

    if not BOT_TOKEN:
        raise SystemExit(
            "ERROR: BOT_TOKEN is missing. Add it as a secret "
            "environment variable; never paste it into this file."
        )

    if not WEBAPP_URL.startswith("https://"):
        log.warning(
            "WEBAPP_URL is not configured with a public HTTPS URL; "
            "shop button will be unavailable until deployed."
        )

    await asyncio.gather(run_bot(), run_api())


if __name__ == "__main__":
    asyncio.run(main())
