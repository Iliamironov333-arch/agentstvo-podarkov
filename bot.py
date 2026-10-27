import asyncio
import hashlib
import hmac
import json
import logging
import os
import random
import sqlite3
import time
from pathlib import Path
from urllib.parse import parse_qsl

from aiohttp import web
from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    Message, CallbackQuery, PreCheckoutQuery,
    LabeledPrice, InlineKeyboardMarkup, InlineKeyboardButton,
    WebAppInfo
)
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
WEBAPP_URL = os.getenv("WEBAPP_URL", "").strip()
DATABASE_PATH = os.getenv("DATABASE_PATH", "agency.db")
OWNER_CHAT_ID = int(os.getenv("OWNER_CHAT_ID", "0") or "0")
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8080"))
STARS_TO_POINTS = int(os.getenv("STARS_TO_POINTS", "1"))
DIGITAL_FILE = Path(os.getenv("DIGITAL_PRODUCT_PATH", "files/painting.jpg"))

if not BOT_TOKEN:
    raise RuntimeError("Укажи BOT_TOKEN в .env")

bot = Bot(BOT_TOKEN)
dp = Dispatcher()
CASE_NAMES = ["Деревянный", "Серебряный", "Золотой", "Рубиновый"]

PRODUCTS = {
    0: ("Зима в горах", 200), 1: ("Тёплая зима", 90),
    2: ("Новогодний ананас", 260), 3: ("Тыква", 50),
    4: ("Мышь на лыжах", 150), 5: ("Белая башня", 200),
    6: ("Довольная собака", 400), 7: ("Пляжная картина", 70),
    8: ("Татошка", 400), 9: ("Летнее здание", 400),
    10: ("Сомы в пруду", 400), 11: ("Доисторическое искусство", 680),
    12: ("Попугай", 250), 13: ("Александр Сергеевич Пушкин", 400),
    14: ("Здание в перспективе", 500), 15: ("Тропический дракон", 600),
    16: ("Картина в перспективе", 560), 17: ("Кит", 200),
    18: ("Арбузный дом", 200), 19: ("Ротонда", 280),
    20: ("Ночной маяк", 210), 21: ("Арбузный лес", 170),
    22: ("Гусь в поле", 220), 23: ("Ночной цветок", 180),
    24: ("Редкая птица", 230), 25: ("Сахарница с чайником", 250),
    26: ("Петушок", 300), 27: ("Голубь", 180),
    28: ("Жаворонок", 200), 29: ("Ворона индеец", 190),
    30: ("Город у моря", 210), 31: ("Ёлочное украшение", 90),
    32: ("Довольный морж", 260), 33: ("Фермерский дом", 140),
    34: ("Новогодняя снежинка", 90), 35: ("Новогодний фонарь", 240),
    36: ("Дом на холмах", 220), 37: ("Морской отдых", 150),
    38: ("Мальчик в деревне", 230), 39: ("Торговый центр рыба", 190),
    40: ("Большой новогодний шар", 150), 41: ("Таинственный лес", 200),
    42: ("Сырная планета", 200),
}

def connect():
    db = sqlite3.connect(DATABASE_PATH)
    db.row_factory = sqlite3.Row
    return db

def init_db():
    with connect() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users(
            id INTEGER PRIMARY KEY,
            balance INTEGER NOT NULL DEFAULT 0,
            vip_forever INTEGER NOT NULL DEFAULT 0,
            vip_until INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS payments(
            charge_id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            amount INTEGER NOT NULL,
            kind TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS intents(
            payload TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            kind TEXT NOT NULL,
            amount INTEGER NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS orders(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            total INTEGER NOT NULL,
            status TEXT NOT NULL,
            details TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS games(
            user_id INTEGER PRIMARY KEY,
            case_index INTEGER NOT NULL,
            stage INTEGER NOT NULL,
            marks TEXT NOT NULL,
            blocked INTEGER NOT NULL DEFAULT 0,
            prizes TEXT NOT NULL DEFAULT '[]',
            started_at INTEGER NOT NULL
        );
        """)
        db.commit()

def ensure_user(user_id):
    with connect() as db:
        db.execute(
            "INSERT OR IGNORE INTO users(id,created_at) VALUES(?,?)",
            (user_id, int(time.time()))
        )
        db.commit()

def user_row(user_id):
    ensure_user(user_id)
    with connect() as db:
        return db.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()

def add_points(user_id, amount):
    ensure_user(user_id)
    with connect() as db:
        db.execute("UPDATE users SET balance=balance+? WHERE id=?", (amount, user_id))
        db.commit()

async def owner_notice(text):
    if not OWNER_CHAT_ID:
        logging.warning("OWNER_CHAT_ID не настроен. Уведомление: %s", text)
        return
    try:
        await bot.send_message(OWNER_CHAT_ID, text)
    except Exception:
        logging.exception("Не удалось отправить сообщение владельцу")

def validate_init_data(init_data):
    if not init_data:
        return None
    try:
        data = dict(parse_qsl(init_data, keep_blank_values=True))
        received_hash = data.pop("hash", "")
        auth_date = int(data.get("auth_date", "0"))
        if not received_hash or abs(time.time() - auth_date) > 86400:
            return None
        check_string = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))
        secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
        calculated = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(calculated, received_hash):
            return None
        user = json.loads(data.get("user", "{}"))
        return int(user["id"]) if user.get("id") else None
    except Exception:
        return None

@web.middleware
async def auth_middleware(request, handler):
    if request.path.startswith("/api/"):
        uid = validate_init_data(request.headers.get("X-Telegram-Init-Data", ""))
        if not uid:
            return web.json_response(
                {"ok": False, "error": "Открой мини-апп через Telegram-бота."},
                status=401
            )
        request["user_id"] = uid
        ensure_user(uid)
    return await handler(request)

def ok(**kwargs):
    return web.json_response({"ok": True, **kwargs})

async def read_json(request):
    try:
        return await request.json()
    except Exception:
        raise web.HTTPBadRequest(text="Некорректный JSON")

async def api_me(request):
    uid = request["user_id"]
    u = user_row(uid)
    with connect() as db:
        count = db.execute("SELECT COUNT(*) FROM orders WHERE user_id=?", (uid,)).fetchone()[0]
    return ok(
        user_id=uid, balance=u["balance"],
        vip_forever=bool(u["vip_forever"]),
        vip_until=time.strftime("%Y-%m-%d", time.localtime(u["vip_until"]))
            if u["vip_until"] and u["vip_until"] > int(time.time()) else None,
        orders_count=count
    )

async def api_order(request):
    uid = request["user_id"]
    data = await read_json(request)
    kind = data.get("type")
    if kind == "physical_order":
        items = data.get("items", [])
        if not isinstance(items, list) or not items:
            return web.json_response({"ok": False, "error": "Корзина пуста."}, status=400)
        lines, total = [], 0
        for item in items:
            try:
                pid, qty = int(item["id"]), int(item["qty"])
            except (KeyError, ValueError, TypeError):
                return web.json_response({"ok": False, "error": "Некорректная позиция."}, status=400)
            if pid not in PRODUCTS or qty < 1 or qty > 50:
                return web.json_response({"ok": False, "error": "Некорректный товар или количество."}, status=400)
            name, price = PRODUCTS[pid]
            total += price * qty
            lines.append(f"• {name} × {qty} — {price * qty} баллов")
        details = {
            "type": kind, "items": lines, "contact": str(data.get("contact", ""))[:300],
            "comment": str(data.get("comment", ""))[:2000]
        }
    elif kind == "custom_order":
        details = {
            k: str(data.get(k, ""))[:1000]
            for k in ("kind", "theme", "style", "colors", "size", "budget",
                      "deadline", "recipient", "details", "name", "contact")
        }
        if not details["details"].strip() and not details["kind"].strip():
            return web.json_response({"ok": False, "error": "Опиши идею подарка."}, status=400)
        total = 0
    else:
        return web.json_response({"ok": False, "error": "Неизвестный тип заказа."}, status=400)

    with connect() as db:
        cur = db.execute(
            "INSERT INTO orders(user_id,total,status,details,created_at) VALUES(?,?,?,?,?)",
            (uid, total, "new", json.dumps(details, ensure_ascii=False), int(time.time()))
        )
        order_id = cur.lastrowid
        db.commit()

    await owner_notice(
        f"🎁 НОВЫЙ ЗАКАЗ №{order_id}\nTelegram ID: {uid}\n"
        f"Тип: {kind}\nСумма каталога: {total} баллов\n"
        f"{json.dumps(details, ensure_ascii=False, indent=2)}"
    )
    try:
        await bot.send_message(uid, f"✅ Заявка №{order_id} принята. Владелец получил уведомление.")
    except Exception:
        pass
    return ok(order_id=order_id, total=total)

def new_payload():
    return "ag_" + hashlib.sha256(os.urandom(32)).hexdigest()[:32]

async def make_invoice(uid, kind, stars):
    payload = new_payload()
    with connect() as db:
        db.execute(
            "INSERT INTO intents(payload,user_id,kind,amount,created_at) VALUES(?,?,?,?,?)",
            (payload, uid, kind, stars, int(time.time()))
        )
        db.commit()
    title = {
        "topup": f"Пополнение на {stars * STARS_TO_POINTS} баллов",
        "vip_monthly": "VIP на 30 дней",
        "vip_lifetime": "VIP навсегда",
    }[kind]
    description = {
        "topup": "Баллы для мини-приложения Агентства подарков",
        "vip_monthly": "VIP-доступ на 30 дней",
        "vip_lifetime": "Постоянный VIP-доступ",
    }[kind]
    return await bot.create_invoice_link(
        title=title, description=description, payload=payload,
        currency="XTR", prices=[LabeledPrice(label=title, amount=stars)]
    )

async def api_topup_invoice(request):
    data = await read_json(request)
    stars = int(data.get("stars", 0))
    if stars not in (25, 50, 100, 250, 500):
        return web.json_response({"ok": False, "error": "Недопустимая сумма."}, status=400)
    url = await make_invoice(request["user_id"], "topup", stars)
    return ok(invoice_url=url)

async def api_vip_invoice(request):
    data = await read_json(request)
    kind = data.get("kind")
    prices = {"monthly": ("vip_monthly", 40), "lifetime": ("vip_lifetime", 400)}
    if kind not in prices:
        return web.json_response({"ok": False, "error": "Неизвестный вариант VIP."}, status=400)
    internal_kind, stars = prices[kind]
    url = await make_invoice(request["user_id"], internal_kind, stars)
    return ok(invoice_url=url)

def black_mark_count(case_index):
    return [1, random.randint(1, 2), random.randint(2, 3), random.randint(2, 3)][case_index]

def game_view(row):
    if not row:
        return None
    return {
        "case_index": row["case_index"],
        "case_name": CASE_NAMES[row["case_index"]],
        "stage": row["stage"],
        "blocked": bool(row["blocked"]),
        "prizes": json.loads(row["prizes"])
    }

async def api_case_status(request):
    with connect() as db:
        row = db.execute("SELECT * FROM games WHERE user_id=?", (request["user_id"],)).fetchone()
    return ok(game=game_view(row))

async def api_case_start(request):
    uid = request["user_id"]
    u = user_row(uid)
    with connect() as db:
        existing = db.execute("SELECT * FROM games WHERE user_id=?", (uid,)).fetchone()
        if existing:
            return ok(game=game_view(existing), message="У тебя уже есть активная игра.")
        if u["balance"] < 100:
            return web.json_response({"ok": False, "error": "Для входа нужно 100 баллов."}, status=400)
        db.execute("UPDATE users SET balance=balance-100 WHERE id=?", (uid,))
        count = black_mark_count(0)
        marks = sorted(random.sample(range(1, 5), count))
        db.execute(
            "INSERT INTO games(user_id,case_index,stage,marks,blocked,prizes,started_at) VALUES(?,?,?,?,?,?,?)",
            (uid, 0, 1, json.dumps(marks), 0, "[]", int(time.time()))
        )
        db.commit()
        row = db.execute("SELECT * FROM games WHERE user_id=?", (uid,)).fetchone()
    await owner_notice(f"🎮 Игрок {uid} начал кейсы за 100 баллов.")
    return ok(game=game_view(row), message="Игра началась!")

async def api_case_step(request):
    uid = request["user_id"]
    with connect() as db:
        row = db.execute("SELECT * FROM games WHERE user_id=?", (uid,)).fetchone()
        if not row:
            return web.json_response({"ok": False, "error": "Сначала начни игру."}, status=400)
        if row["blocked"]:
            return web.json_response({"ok": False, "error": "Сначала реши, продолжать ли игру."}, status=400)
        case_index, stage = row["case_index"], row["stage"]
        marks = json.loads(row["marks"])
        prizes = json.loads(row["prizes"])
        if stage in marks:
            db.execute("UPDATE games SET blocked=1 WHERE user_id=?", (uid,))
            db.commit()
            row = db.execute("SELECT * FROM games WHERE user_id=?", (uid,)).fetchone()
            await owner_notice(f"⚫ Чёрная метка в игре игрока {uid}: {CASE_NAMES[case_index]}, этап {stage}.")
            return ok(game=game_view(row), message="⚫ Чёрная метка! Продолжить за 200 баллов или выйти?")
        reward = random.choice([10, 15, 20, 25, 30])
        add_points(uid, reward)
        prizes.append(f"+{reward} баллов")
        stage += 1
        if stage > 4:
            if case_index == 3:
                # Главный приз в финальном кейсе
                grand = random.choice(["600 баллов", "Дом Севастьянова"])
                if grand == "600 баллов":
                    add_points(uid, 600)
                prizes.append("🏆 Главный приз: " + grand)
                db.execute("DELETE FROM games WHERE user_id=?", (uid,))
                db.commit()
                await owner_notice(
                    f"🏆 ФИНАЛ ИГРЫ! Игрок {uid} выиграл главный приз: {grand}.\n"
                    "Если это физический приз, согласуй выдачу с игроком."
                )
                await bot.send_message(uid, f"🏆 Поздравляем! Главный приз: {grand}.")
                return ok(game=None, message=f"Победа! Главный приз: {grand}.")
            case_index += 1
            stage = 1
            marks = sorted(random.sample(range(1, 5), black_mark_count(case_index)))
        db.execute(
            "UPDATE games SET case_index=?,stage=?,marks=?,blocked=0,prizes=? WHERE user_id=?",
            (case_index, stage, json.dumps(marks), json.dumps(prizes, ensure_ascii=False), uid)
        )
        db.commit()
        row = db.execute("SELECT * FROM games WHERE user_id=?", (uid,)).fetchone()
    return ok(game=game_view(row), message=f"🎉 Награда этапа: +{reward} баллов!")

async def api_case_continue(request):
    uid = request["user_id"]
    with connect() as db:
        row = db.execute("SELECT * FROM games WHERE user_id=?", (uid,)).fetchone()
        if not row or not row["blocked"]:
            return web.json_response({"ok": False, "error": "Сейчас продолжение недоступно."}, status=400)
        u = user_row(uid)
        if u["balance"] < 200:
            return web.json_response({"ok": False, "error": "Нужно 200 баллов для продолжения."}, status=400)
        # Пропускаем этап с чёрной меткой, чтобы не зациклиться.
        stage = row["stage"] + 1
        case_index = row["case_index"]
        marks = json.loads(row["marks"])
        prizes = json.loads(row["prizes"])
        db.execute("UPDATE users SET balance=balance-200 WHERE id=?", (uid,))
        if stage > 4:
            if case_index == 3:
                db.execute("DELETE FROM games WHERE user_id=?", (uid,))
                db.commit()
                await owner_notice(f"🎮 Игрок {uid} завершил последний этап после продолжения.")
                return ok(game=None, message="Игра завершена. Спасибо за участие!")
            case_index += 1
            stage = 1
            marks = sorted(random.sample(range(1, 5), black_mark_count(case_index)))
        db.execute(
            "UPDATE games SET case_index=?,stage=?,marks=?,blocked=0 WHERE user_id=?",
            (case_index, stage, json.dumps(marks), uid)
        )
        db.commit()
        row = db.execute("SELECT * FROM games WHERE user_id=?", (uid,)).fetchone()
    await owner_notice(f"➡️ Игрок {uid} заплатил 200 баллов и продолжил игру.")
    return ok(game=game_view(row), message="Продолжаем! Следующий этап открыт.")

async def api_case_stop(request):
    uid = request["user_id"]
    with connect() as db:
        row = db.execute("SELECT * FROM games WHERE user_id=?", (uid,)).fetchone()
        if row:
            prizes = json.loads(row["prizes"])
            db.execute("DELETE FROM games WHERE user_id=?", (uid,))
            db.commit()
        else:
            prizes = []
    await owner_notice(
        f"🚪 Игрок {uid} завершил игру. Накопленные награды забега сгорели.\n"
        f"Награды до выхода: {', '.join(prizes) or 'нет'}"
    )
    return ok(game=None, message="Игра завершена. Награды текущего забега потеряны.")

async def pre_checkout(query: PreCheckoutQuery):
    with connect() as db:
        intent = db.execute("SELECT * FROM intents WHERE payload=?", (query.invoice_payload,)).fetchone()
    if not intent or intent["user_id"] != query.from_user.id or intent["amount"] != query.total_amount:
        await query.answer(ok=False, error_message="Счёт не найден или уже недействителен.")
        return
    await query.answer(ok=True)

@dp.pre_checkout_query()
async def on_pre_checkout(query: PreCheckoutQuery):
    await pre_checkout(query)

@dp.message(F.successful_payment)
async def on_successful_payment(message: Message):
    payment = message.successful_payment
    uid = message.from_user.id
    payload = payment.invoice_payload
    with connect() as db:
        intent = db.execute("SELECT * FROM intents WHERE payload=?", (payload,)).fetchone()
        if not intent or intent["user_id"] != uid:
            await message.answer("Платёж получен, но счёт не найден. Напиши в поддержку.")
            await owner_notice(f"⚠️ Платёж без найденного счёта. ID {uid}, payload {payload}")
            return
        if db.execute("SELECT 1 FROM payments WHERE charge_id=?", (payment.telegram_payment_charge_id,)).fetchone():
            await message.answer("Этот платёж уже учтён.")
            return
        kind, amount = intent["kind"], intent["amount"]
        db.execute(
            "INSERT INTO payments(charge_id,user_id,amount,kind,created_at) VALUES(?,?,?,?,?)",
            (payment.telegram_payment_charge_id, uid, amount, kind, int(time.time()))
        )
        db.execute("DELETE FROM intents WHERE payload=?", (payload,))
        if kind == "topup":
            db.execute("UPDATE users SET balance=balance+? WHERE id=?", (amount * STARS_TO_POINTS, uid))
        elif kind == "vip_monthly":
            current = db.execute("SELECT vip_until FROM users WHERE id=?", (uid,)).fetchone()["vip_until"]
            db.execute("UPDATE users SET vip_until=? WHERE id=?", (max(int(current), int(time.time())) + 30*86400, uid))
        elif kind == "vip_lifetime":
            db.execute("UPDATE users SET vip_forever=1 WHERE id=?", (uid,))
        db.commit()

    if kind == "topup":
        await message.answer(f"✅ Начислено {amount * STARS_TO_POINTS} баллов. Баланс сохранён в боте.")
    elif kind == "vip_monthly":
        await message.answer("👑 VIP активирован на 30 дней!")
    elif kind == "vip_lifetime":
        await message.answer("👑 Поздравляем! VIP навсегда активирован.")
    await owner_notice(f"💳 Оплата Stars: пользователь {uid}, тип {kind}, сумма {amount} ⭐.")

@dp.message(CommandStart())
async def start(message: Message):
    ensure_user(message.from_user.id)
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🎁 Открыть мини-приложение", web_app=WebAppInfo(url=WEBAPP_URL))]
    ]) if WEBAPP_URL.startswith("https://") else None
    await message.answer(
        "Добро пожаловать в «Агентство подарков»! 🎁\n\n"
        "Здесь можно посмотреть каталог, оформить заказ, открыть кейсы и проверить баллы.\n"
        "Баланс и игровой прогресс хранятся в аккаунте Telegram.",
        reply_markup=kb
    )

@dp.message(Command("myid"))
async def myid(message: Message):
    await message.answer(f"Твой Telegram ID: `{message.from_user.id}`", parse_mode="Markdown")

@dp.message(Command("balance"))
async def balance(message: Message):
    u = user_row(message.from_user.id)
    await message.answer(f"🪙 Баланс: {u['balance']} баллов")

@dp.message(Command("paysupport"))
async def paysupport(message: Message):
    await message.answer("По вопросам оплаты напиши владельцу: https://t.me/Iliya_Mironov_33")

async def api_root(request):
    return web.json_response({"ok": True, "service": "agency-gifts-api"})

def create_app():
    app = web.Application(middlewares=[auth_middleware])
    app.router.add_get("/", api_root)
    app.router.add_post("/api/me", api_me)
    app.router.add_post("/api/order", api_order)
    app.router.add_post("/api/topup-invoice", api_topup_invoice)
    app.router.add_post("/api/vip-invoice", api_vip_invoice)
    app.router.add_post("/api/cases/status", api_case_status)
    app.router.add_post("/api/cases/start", api_case_start)
    app.router.add_post("/api/cases/step", api_case_step)
    app.router.add_post("/api/cases/continue", api_case_continue)
    app.router.add_post("/api/cases/stop", api_case_stop)
    return app

async def main():
    init_db()
    runner = web.AppRunner(create_app())
    await runner.setup()
    site = web.TCPSite(runner, API_HOST, API_PORT)
    await site.start()
    logging.info("API запущен на %s:%s", API_HOST, API_PORT)
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
