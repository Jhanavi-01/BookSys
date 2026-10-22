# bookSys — Event Ticket Booking System with Seat Maps

A production-ready bilingual (English/Vietnamese) event ticketing platform with interactive seat selection, real-time availability, QR ticket generation, and offline entry scanning.

## Architecture

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS, next-intl (EN/VI)
- **Backend**: NestJS, TypeScript, Prisma ORM, REST API
- **Database**: PostgreSQL 15 (primary data store)
- **Cache/Queue**: Redis 7 (caching, rate limiting, login lockout, waiting room)
- **Background Jobs**: @nestjs/schedule for seat hold expiry, order timeout, notifications

## User Roles

| Role | Access |
|------|--------|
| **Customer** | Browse events, select seats, book tickets, view QR tickets |
| **Organizer** | Create events & showtimes, upload seat maps, manage sales, view reports |
| **Entry Staff** | Scan QR tickets at gates (online + offline), manage scan sessions |
| **Accountant** | View financial reports, reconcile payments with gateway statements |
| **Admin** | Manage users & roles, view audit logs, system health |

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose

### 1. Clone and setup
```bash
cp .env.example .env
# Edit .env if needed (defaults work for local development)
```

### 2. Start with Docker Compose
```bash
docker-compose up -d --build
```

### 3. Access the application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000/api
- **API Documentation**: http://localhost:4000/api/docs
- **Health Check**: http://localhost:4000/api/health

### Alternative: Run without Docker (for development)
```bash
# Start infrastructure
docker-compose up -d postgres redis

# Backend
cd backend
npm install
npx prisma generate
npx prisma db push
npx ts-node prisma/seed.ts
npm run start:dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@booksys.local | Admin@123! |
| Organizer | organizer@booksys.local | Organizer@123! |
| Customer | customer@booksys.local | Customer@123! |
| Entry Staff | staff@booksys.local | Staff@123! |
| Accountant | accountant@booksys.local | Accountant@123! |

⚠️ Development only. Never use in production.

## Key Features

### Seat Management
- Upload seat maps from JSON files (validated before import, single transaction)
- SVG-based interactive seat map (handles 2000+ seats, < 2s render)
- Real-time seat availability with color-coded status
- Colorblind-accessible patterns + colors

### Booking & Concurrency
- Atomic seat holds with configurable 10-minute expiry
- Database-level constraints prevent double-booking
- 200 concurrent requests on 100 seats → exactly 100 holds (tested)
- Auto-expire holds and orders via background jobs
- Server-side price calculation (never trust client)

### Payments
- Payment gateway interface (swap providers via env var)
- Built-in mock gateway for development
- Webhook idempotency (deduplicated by transaction ID)
- Timing-safe signature verification
- Race condition handling between webhook and order expiry

### QR Tickets
- HMAC-SHA256 signed QR codes
- Tamper-proof: modified QR fails verification
- One ticket per seat, unique random codes

### Entry Scanning
- Online scan with real-time validation
- Database constraint ensures single-use
- Offline mode: download ticket list, scan locally, sync later
- Conflict detection for same ticket at different gates
- Override entry with staff authorization

### Bilingual Support
- Complete EN/VI translations (450+ keys)
- Language switcher persists across sessions
- Vietnamese date/time/currency formatting
- VND prices with thousands separators

## Seat Map JSON Format

```json
{
  "sections": [
    {
      "name": "VIP",
      "nameVi": "Khu VIP",
      "color": "#FFD700",
      "seats": [
        {"row": "A", "number": "1", "x": 0, "y": 0},
        {"row": "A", "number": "2", "x": 40, "y": 0}
      ]
    }
  ]
}
```

### Generate large seat maps for testing:
```bash
cd backend
npx ts-node scripts/generate-seatmap.ts 2000
```

## Running Tests

```bash
# Backend unit tests
cd backend && npm test

# Backend e2e tests
cd backend && npm run test:e2e

# Concurrency tests (200 requests on 100 seats)
cd backend && npm run test:concurrency

# Full test suite via Docker
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

## Environment Variables

See [.env.example](.env.example) for all configuration options.

Key variables:
- `PAYMENT_PROVIDER`: `mock` (dev) or `sandbox` (production sandbox)
- `HOLD_DURATION_MINUTES`: Seat hold expiry (default: 10)
- `PAYMENT_TIMEOUT_MINUTES`: Payment deadline (default: 15)
- `TICKET_SIGNING_SECRET`: HMAC key for QR signatures

## Security

- Passwords hashed with argon2id
- JWT authentication with configurable expiry
- Login lockout: 5 failed attempts → 15 min lock (Redis-backed)
- Default-deny RBAC: undeclared routes return 403
- Rate limiting on sensitive endpoints
- Webhook signature verification (timing-safe comparison)
- No secrets in source code; no PII in logs
- Audit trail for all sensitive operations (append-only)
- GDPR/Decree 13 compliance: consent tracking, data anonymization

## Compliance

- **Decree 13/2023/NĐ-CP**: Personal data consent tracking, right to deletion (anonymize PII while preserving financial records)
- **Payment safety**: Sandbox only, no real card data stored
- **Audit**: Append-only logs for all order/ticket/payment operations

## Performance Targets

| Metric | Target |
|--------|--------|
| Seat map render (2000 seats) | < 2 seconds p95 |
| Seat hold API | < 300ms p95 |
| Event listing page | < 500ms p95 |
| Webhook processing | < 200ms p95 |
| Concurrent holds (200 req / 100 seats) | Exactly 100 success |

## License

Proprietary. All rights reserved.
