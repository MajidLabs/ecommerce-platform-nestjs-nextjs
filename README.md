# E-commerce Platform

یک پروژه‌ی نمونه‌ی فروشگاه آنلاین با Backend واقعی و کارکردی. برای معماری و تصمیم‌های فنی، فایل [ARCHITECTURE.md](./ARCHITECTURE.md) را ببینید.

## وضعیت پروژه

| بخش | وضعیت |
|---|---|
| Backend (NestJS + PostgreSQL) | ✅ کامل. `tsc --noEmit` بدون خطا. ۱۰۱ تست unit + ۳۰ تست e2e، همه pass |
| Frontend (Next.js) | ✅ کامل، `tsc` و `next build` بدون خطا، رفتار graceful-degradation (بدون بک‌اند) با curl تست شده |
| Admin Panel | ✅ کامل، بخشی از Frontend (`/admin/*`) |
| تست خودکار | ✅ ۱۳۱ تست. جزئیات در [ARCHITECTURE.md](./ARCHITECTURE.md#تست) |
| چند-session (چند دستگاه هم‌زمان) | ✅ جدول `Session` + rotation توکن + مدیریت دستگاه‌ها |
| Monitoring | ✅ Sentry (backend). با `SENTRY_DSN` خالی غیرفعال است |

## Tech Stack (Backend)

- **NestJS 10** — فریم‌ورک سمت سرور
- **PostgreSQL 16** — دیتابیس
- **Prisma 5** — ORM
- **Passport + JWT** — احراز هویت (access token ۱۵ دقیقه‌ای + refresh token ۷ روزه)
- **Stripe** — پرداخت (حالت Test)
- **class-validator** — اعتبارسنجی ورودی
- **Swagger** — مستندات خودکار API

## پیش‌نیازها

- Node.js 20+
- PostgreSQL 16 (یا Docker)

## راه‌اندازی

```bash
cd backend
npm install
cp .env.example .env   # مقادیر واقعی رو توش بذار

# دیتابیس (یا از docker-compose.yml روت پروژه استفاده کن)
docker compose -f ../docker-compose.yml up -d

npx prisma generate
npx prisma migrate dev --name init
npm run seed

npm run start:dev
```

سرور روی `http://localhost:4000/api/v1` بالا میاد. مستندات Swagger روی `http://localhost:4000/api/docs`.

### اجرای تست‌ها

```bash
npm run test       # ۱۰۱ تست unit
npm run test:e2e   # ۳۰ تست e2e
npm run test:cov   # با گزارش coverage
```

هیچ‌کدوم به دیتابیس یا سرور در حال اجرا نیاز ندارن — لایه‌ی Prisma موک شده. چیزی که این تست‌ها پوشش *نمی‌دن* (rollback تراکنش، constraintهای دیتابیس) در [ARCHITECTURE.md](./ARCHITECTURE.md#تست) توضیح داده شده.

## اکانت‌های نمونه (بعد از seed)

| نقش | ایمیل | پسورد |
|---|---|---|
| Admin | admin@example.com | Admin@12345 |
| Customer | customer@example.com | Customer@12345 |

کد تخفیف نمونه: `WELCOME10` (۱۰٪ تخفیف، حداقل خرید ۵۰ دلار)

## تست Webhook پرداخت (Stripe)

برای تست لوکالِ webhook، از Stripe CLI استفاده کن:

```bash
stripe listen --forward-to localhost:4000/api/v1/payments/webhook
```

مقدار `whsec_...` که چاپ می‌شه رو در `STRIPE_WEBHOOK_SECRET` بذار.

## ساختار پوشه‌ها

```
backend/
├── prisma/
│   ├── schema.prisma      # مدل کامل دیتابیس
│   └── seed.ts
└── src/
    ├── auth/               # ثبت‌نام، ورود، JWT
    ├── users/               # پروفایل و مدیریت نقش (Role)
    ├── categories/
    ├── products/            # شامل جستجو و فیلتر
    ├── inventory/            # موجودی + تاریخچه‌ی تغییرات
    ├── cart/
    ├── orders/               # سبد خرید → سفارش، اعمال تخفیف، رزرو موجودی
    ├── coupons/
    ├── payments/              # Stripe PaymentIntent + Webhook
    ├── reports/                 # گزارش فروش برای پنل ادمین
    ├── common/                   # guard، decorator، exception filter
    └── prisma/                    # PrismaService
```

## اسکریپت‌ها

| دستور | کار |
|---|---|
| `npm run start:dev` | اجرا با watch mode |
| `npm run build` | build نهایی |
| `npm run prisma:migrate` | ساخت migration جدید |
| `npm run seed` | پر کردن دیتابیس با داده‌ی نمونه |
| `npm run test` | تست‌های unit |
| `npm run test:e2e` | تست‌های e2e |
| `npm run test:cov` | تست با گزارش coverage |

## Tech Stack (Frontend)

- **Next.js 14 (App Router)** — SSR برای صفحات نیازمند auth، ISR برای صفحات محصول، `force-dynamic` برای لیست فیلترشده
- **Zustand** — فقط برای شمارنده‌ی سبد خرید (badge)؛ بقیه‌ی state از سرور میاد
- **jose** — تایید امضای JWT در middleware (لبه‌ی شبکه/Edge) و Server Component ها
- **Stripe Elements** — فرم پرداخت
- **Tailwind** — استایل، بدون کتابخانه‌ی کامپوننت اضافه

## راه‌اندازی Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # JWT_ACCESS_SECRET باید دقیقاً با backend یکی باشه

npm run dev
```

روی `http://localhost:3000` بالا میاد. برای اجرای کامل، backend هم باید همزمان روی پورت ۴۰۰۰ بالا باشه (بخش قبلی همین فایل).

### معماری احراز هویت در Frontend

توکن‌ها (`accessToken`, `refreshToken`) به‌صورت کوکی `httpOnly` ذخیره می‌شن — یعنی جاوااسکریپت سمت مرورگر اصلاً بهشون دسترسی نداره (محافظت در برابر حملات XSS). درخواست‌های سمت کلاینت هیچ‌وقت مستقیم به backend نمی‌رن؛ همه از `/api/proxy/*` عبور می‌کنن که کوکی رو می‌خونه، هدر `Authorization` واقعی رو می‌سازه، و اگه access token منقضی شده بود، خودش یه‌بار refresh رو امتحان می‌کنه.

`middleware.ts` مسیرهای `/cart`, `/checkout`, `/account`, `/admin` رو در لبه‌ی شبکه (Edge) محافظت می‌کنه — قبل از رندر شدن صفحه، امضای JWT رو چک می‌کنه.

## امکانات عملیاتی (Operational features)

- **آپلود عکس محصول**: در پنل ادمین، فرم محصول یک بخش آپلود داره. فایل‌ها در `backend/uploads/products/` ذخیره و از مسیر `/uploads/...` سرو می‌شن. فقط JPEG/PNG/WebP تا سقف ۵ مگابایت. این پوشه در `.gitignore` هست، پس عکس‌های آپلودشده commit نمی‌شن.
- **Rate limiting دو لایه**: کل API محدود به ۱۰۰ درخواست در دقیقه، ولی `login` و `register` محدودیت سخت‌گیرانه‌تر ۵ در دقیقه (per-IP) دارن تا حمله‌ی brute-force روی پسورد کند بشه.
- **لاگ ساختاریافته**: هر درخواست به شکل یک خط JSON (متد، مسیر، status، مدت‌زمان، userId، IP) لاگ می‌شه — قابل پردازش با ابزارهایی مثل Datadog یا CloudWatch، برخلاف لاگ متنی ساده. سطح لاگ خطاها هوشمنده: ۵xx با stack trace کامل در سطح `error`، ولی ۴xx (مثل ۴۰۱ یا ۴۰۴ که جریان عادی برنامه‌ان) فقط یک خط `warn` — وگرنه خطاهای واقعی زیر انبوه نویز گم می‌شن.
- **Monitoring با Sentry**: خطاهای غیرمنتظره به Sentry گزارش می‌شن. فقط کافیه `SENTRY_DSN` رو در `.env` بذاری؛ خالی گذاشتنش (پیش‌فرض) یعنی کاملاً غیرفعال، بدون نیاز به تغییر کد. خطاهای عادی ۴xx گزارش نمی‌شن.
- **چند دستگاه هم‌زمان**: هر ورود یک session مستقل می‌سازه، پس ورود از موبایل، نشست لپ‌تاپ رو قطع نمی‌کنه. کاربر می‌تونه دستگاه‌های فعالش رو ببینه (`GET /auth/sessions`)، یکی رو ببنده (`DELETE /auth/sessions/:id`) یا از همه‌جا خارج بشه (`POST /auth/logout-all`). refresh token در هر بار استفاده rotate می‌شه، و استفاده‌ی دوباره از توکن قدیمی کل اون session رو باطل می‌کنه.

## نکات مهم قبل از استفاده‌ی واقعی

جزئیات کامل در [ARCHITECTURE.md](./ARCHITECTURE.md#محدودیت‌های-فعلی-و-قدم-بعدی-برای-production). سه قدم باقی‌مونده:

۱. **`npx prisma generate && npm run build`** را یک بار روی سیستم خودت اجرا کن. من تایپ‌چک را با یک shim دستی برای Prisma Client انجام دادم (چون `binaries.prisma.sh` در sandbox من مسدود است). آن shim اسم فیلدهای Prisma را اعتبارسنجی نمی‌کند، پس این یک بار اجرا واقعاً لازم است — دلیلش [اینجا](./ARCHITECTURE.md#محدودیت-prisma-و-راهی-که-دورش-زدم) توضیح داده شده.
۲. **`npx prisma migrate dev`** برای ساخت جدول `Session`. اسکیما تغییر کرده و فیلد `hashedRefreshToken` از `User` حذف شده.
۳. **کلیدهای Stripe** را با کلیدهای Test واقعی حساب خودت جایگزین کن.
