# 📊 MadPro API

> A robust REST API for tracking survey issues with real-time Google Sheets synchronization, built with modern TypeScript stack.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.3.5-black?logo=bun)](https://bun.sh)
[![Hono](https://img.shields.io/badge/Hono-4.6-orange)](https://hono.dev)
[![Prisma](https://img.shields.io/badge/Prisma-7.3-2D3748?logo=prisma)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## ✨ Features

- 🔄 **Real-time Google Sheets Sync** - Bidirectional sync with Google Sheets
- 📝 **OpenAPI Documentation** - Auto-generated Swagger UI documentation
- 🎯 **Type-safe** - Full TypeScript support with Prisma ORM
- ⚡ **High Performance** - Built with Bun runtime and Hono framework
- 🔍 **Advanced Filtering** - Powerful query capabilities with pagination
- 📧 **Email Notifications** - OTP-based password reset via Brevo/SMTP
- 🎨 **Clean Architecture** - Domain-driven design with clear separation of concerns
- 🚀 **Production Ready** - Docker support, Railway deployment, comprehensive logging

## 🛠️ Tech Stack

### Core
- **Runtime**: [Bun](https://bun.sh) - Fast all-in-one JavaScript runtime
- **Framework**: [Hono](https://hono.dev) - Ultrafast web framework
- **Language**: [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- **Database**: [PostgreSQL](https://www.postgresql.org/) - Reliable relational database
- **ORM**: [Prisma](https://www.prisma.io/) - Next-generation ORM
 Secure password encryption

### External Services
- **Google Sheets**: [googleapis](https://github.com/googleapis/google-api-nodejs-client) - Google Sheets API integration
- **Email**: SMTP/[Brevo](https://www.brevo.com) - Transactional email delivery

### API Documentation
- **OpenAPI**: [@hono/zod-openapi](https://github.com/honojs/middleware) - Type-safe OpenAPI spec
- **Swagger UI**: [@hono/swagger-ui](https://github.com/honojs/middleware) - Interactive API docs
- **Validation**: [Zod](https://zod.dev) - TypeScript-first schema validation

### Logging & Monitoring
- **Logger**: [Pino](https://getpino.io/) - Fast JSON logger
- **Pretty Logs**: [pino-pretty](https://github.com/pinojs/pino-pretty) - Human-readable logs

### Development Tools
- **Package Manager**: Bun - Fast package installation
- **Database Client**: [@prisma/client](https://www.prisma.io/docs/concepts/components/prisma-client) - Auto-generated type-safe client
- **Testing**: Bun test - Built-in test runner

## 📋 Prerequisites

- [Bun](https://bun.sh) >= 1.3.5
- [PostgreSQL](https://www.postgresql.org/) >= 14
- [Google Cloud Project](https://console.cloud.google.com) with Sheets API enabled
- SMTP Server or [Brevo Account](https://www.brevo.com) (for email features)

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/survey-issue-tracker-api.git
cd survey-issue-tracker-api
```

### 2. Install dependencies

```bash
bun install
```

### 3. Setup environment variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/survey_db"

# JWT
JWT_SECRET="your-super-secret-jwt-key"

# Google Sheets
GOOGLE_SPREADSHEET_ID="your-spreadsheet-id"
GOOGLE_SUMMARY_SHEET_NAME="NDE USULAN B2B"
GOOGLE_DETAIL_SHEET_NAME="NEW BGES B2B & OLO"
GOOGLE_SERVICE_ACCOUNT_BASE64="base64-encoded-service-account-json"

# Email (SMTP or Brevo API)
SMTP_HOST="smtp-relay.brevo.com"
SMTP_PORT="587"
SMTP_USER="your-brevo-email@example.com"
SMTP_PASS="your-brevo-smtp-key"
SMTP_FROM="noreply@yourdomain.com"

# Or use Brevo API (faster, more reliable)
# BREVO_API_KEY="your-brevo-api-key"
# BREVO_SENDER_EMAIL="noreply@yourdomain.com"
# BREVO_SENDER_NAME="Survey Issue Tracker"

# Server
PORT=5000
NODE_ENV=development
```

### 4. Setup Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable Google Sheets API
4. Create a Service Account
5. Download the JSON key file
6. Convert to base64: `cat service-account.json | base64 -w 0`
7. Add to `GOOGLE_SERVICE_ACCOUNT_BASE64` in `.env.local`
8. Share your Google Sheet with the service account email

### 5. Setup database

Generate Prisma client:
```bash
bun run db:generate
```

Push schema to database:
```bash
bun run db:push
```

Seed initial data (optional):
```bash
bun run db:seed
```

### 6. Run development server

```bash
bun dev
```

Server will start at `http://localhost:5000`

## 📚 API Documentation

Once the server is running, visit:

- **Swagger UI**: http://localhost:5000/docs
- **OpenAPI JSON**: http://localhost:5000/docs/openapi.json

## 🏗️ Project Structure

```
survey-issue-tracker-api/
├── src/
│   ├── app.ts                         # App initialization
│   ├── main.ts                        # Entry point
│   ├── openapi.ts                     # OpenAPI configuration
│   │
│   ├── core/
│   │   └── prisma/
│   │       ├── schema.prisma          # Database schema
│   │       ├── migrations/            # Database migrations
│   │       └── seed/
│   │           └── index.ts           # Seed data
│   │
│   ├── infrastructure/
│   │   ├── database/
│   │   │   └── prisma.ts              # Database connection
│   │   └── logging/
│   │       └── logger.ts              # Pino logger config
│   │
│   ├── modules/
│   │   ├── auth/                      # Authentication module
│   │   │   ├── application/
│   │   │   │   └── auth.service.ts    # Auth business logic
│   │   │   ├── domain/
│   │   │   │   ├── auth.entity.ts     # Auth entities
│   │   │   │   └── auth.repository.ts # Auth repository interface
│   │   │   ├── infrastructure/
│   │   │   │   └── auth.prisma.repository.ts
│   │   │   ├── presentation/
│   │   │   │   ├── auth.controller.ts # Auth endpoints
│   │   │   │   ├── auth.openapi.ts    # OpenAPI specs
│   │   │   │   └── auth.route.ts      # Route definitions
│   │   │   └── auth.schema.ts         # Zod schemas
│   │   │
│   │   ├── survey/                    # Survey module
│   │   │   ├── application/
│   │   │   │   ├── admin.service.ts   # Admin operations
│   │   │   │   ├── dashboard.service.ts # Dashboard data
│   │   │   │   ├── enum.service.ts    # Enum operations
│   │   │   │   ├── enum-value.service.ts # Enum value management
│   │   │   │   └── sync.service.ts    # Sync orchestration
│   │   │   ├── domain/
│   │   │   │   ├── enum.entity.ts     # Enum entities
│   │   │   │   ├── sync.entity.ts     # Survey entities
│   │   │   │   └── sync.repository.ts # Repository interface
│   │   │   ├── infrastructure/
│   │   │   │   ├── google-sheets.service.ts # Google Sheets API
│   │   │   │   ├── sync-incremental.ts # Incremental sync logic
│   │   │   │   ├── sync-fix-dates.ts  # Date fixing utility
│   │   │   │   ├── sync-optimized.ts  # Optimized sync (legacy)
│   │   │   │   ├── sync-simple.ts     # Simple sync (legacy)
│   │   │   │   └── sync.prisma.repository.ts
│   │   │   ├── presentation/
│   │   │   │   ├── enum.controller.ts # Enum endpoints
│   │   │   │   ├── enum.openapi.ts    # Enum OpenAPI specs
│   │   │   │   ├── enum.route.ts      # Enum routes
│   │   │   │   ├── sync.controller.ts # Survey endpoints
│   │   │   │   ├── sync.openapi.ts    # Survey OpenAPI specs
│   │   │   │   └── sync.route.ts      # Survey routes
│   │   │   └── sync.schema.ts         # Zod schemas
│   │   │
│   │   └── user/                      # User module
│   │       ├── application/
│   │       │   └── user.service.ts    # User business logic
│   │       ├── domain/
│   │       │   ├── user.entity.ts     # User entities
│   │       │   ├── user.query.ts      # Query types
│   │       │   └── user.repository.ts # Repository interface
│   │       ├── infrastructure/
│   │       │   └── user.prisma.repository.ts
│   │       ├── presentation/
│   │       │   ├── user.controller.ts # User endpoints
│   │       │   ├── user.openapi.ts    # User OpenAPI specs
│   │       │   └── user.route.ts      # User routes
│   │       └── user.schema.ts         # Zod schemas
│   │
│   ├── routes/
│   │   └── index.ts                   # Route aggregation
│   │
│   ├── shared/
│   │   ├── middlewares/
│   │   │   └── auth.middleware.ts     # JWT auth middleware
│   │   ├── services/
│   │   │   ├── email.service.ts       # SMTP email service
│   │   │   └── resend-email.service.ts # Resend API service
│   │   └── utils/
│   │       ├── bigint.ts              # BigInt serialization
│   │       ├── number.ts              # Number utilities
│   │       ├── response.ts            # API response helper
│   │       ├── sync-validation.ts     # Sync data validation
│   │       └── zod.ts                 # Zod error handling
│   │
│   ├── types/
│   │   └── env.d.ts                   # Environment types
│   │
│   └── generated/
│       └── prisma/                    # Generated Prisma client
│
├── .env.example                       # Environment template
├── .env.local                         # Local environment (gitignored)
├── .env.production                    # Production environment (gitignored)
├── bun.lock                           # Bun lockfile
├── Dockerfile                         # Docker configuration
├── google-service-account.json        # Google credentials (gitignored)
├── nixpacks.toml                      # Nixpacks config
├── package.json                       # Dependencies
├── prisma.config.ts                   # Prisma Studio config
├── railway.json                       # Railway config
├── railway.toml                       # Railway build config
├── tsconfig.json                      # TypeScript config
└── README.md                          # Documentation
```

### Architecture Patterns

**Clean Architecture / Domain-Driven Design**
- **Presentation Layer**: Controllers, routes, OpenAPI specs
- **Application Layer**: Services, business logic orchestration
- **Domain Layer**: Entities, repository interfaces, business rules
- **Infrastructure Layer**: External services (DB, Google Sheets, Email)

**Module Structure**
Each module follows the same pattern:
```
module/
├── application/     # Use cases & business logic
├── domain/          # Core business entities & interfaces
├── infrastructure/  # External service implementations
├── presentation/    # HTTP layer (controllers, routes, OpenAPI)
└── *.schema.ts      # Validation schemas
```

## 🐳 Docker Deployment

Build the image:
```bash
docker build -t survey-api .
```

Run the container:
```bash
docker run -p 5000:5000 --env-file .env.production survey-api
```

## 🚂 Railway Deployment

1. Install Railway CLI:
```bash
npm i -g @railway/cli
```

2. Login to Railway:
```bash
railway login
```

3. Initialize project:
```bash
railway init
```

4. Add environment variables:
```bash
railway variables set DATABASE_URL="your-database-url"
railway variables set JWT_SECRET="your-jwt-secret"
# ... add other variables
```

5. Deploy:
```bash
railway up
```

Or connect your GitHub repository to Railway for automatic deployments.

## 🧪 Testing

Run tests:
```bash
bun test
```

Run tests with production environment:
```bash
bun run test:prod
```

## 📝 Scripts

```bash
# Development
bun dev                    # Start dev server with hot reload
bun prod                   # Start production server

# Database
bun run db:generate        # Generate Prisma client
bun run db:push            # Push schema to database
bun run db:pull            # Pull schema from database
bun run db:studio          # Open Prisma Studio
bun run db:migrate         # Run migrations
bun run db:seed            # Seed database

# Production Database
bun run db:prod:push       # Push to production DB
bun run db:prod:pull       # Pull from production DB
bun run db:prod:studio     # Open production DB in Studio
bun run db:prod:seed       # Seed production DB
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Aby Danu** - *Initial work* - [abydanu](https://github.com/abydanu)

Made with ❤️ using TypeScript and Bun
