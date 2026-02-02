# survey-issue-tracker-api

API untuk tracking survey issue dengan sinkronisasi dari Google Sheets.

## Setup

### Install Dependencies

```bash
bun install
```

### Setup Environment Variables

Untuk local development, copy `.env.example` ke `.env.local` dan isi dengan konfigurasi yang sesuai:

```bash
cp .env.example .env.local
```

Untuk production (mis. deploy Vercel), simpan env di platform terkait, atau pull ke file `.env.production`:

```bash
vercel env pull .env.production
```

Environment variables yang diperlukan:
- `DATABASE_URL`: Connection string untuk database PostgreSQL (Supabase)
- `JWT_SECRET`: Secret key untuk JWT token
- `GSHEETS_SPREADSHEET_ID`: ID Google Spreadsheet
- `GOOGLE_SUMMARY_SHEET_NAME`: Nama sheet summary (default: "NDE USULAN B2B")
- `GOOGLE_DETAIL_SHEET_NAME`: Nama sheet detail (default: "NEW BGES B2B & OLO")
- `PORT`: Port untuk server (default: 5000)

### Setup Database

1. Generate Prisma Client:
```bash
bun run db:generate
```

2. Push schema ke database:
```bash
bun run db:push
```

Untuk target database production:

```bash
bun run db:prod:push
```

3. (Optional) Seed database:
```bash
bun run db:seed
```

Untuk seed ke production:

```bash
bun run db:prod:seed
```

### Run Development Server

```bash
bun dev
```

### Run Production-mode (pakai `.env.production`)

```bash
bun run prod
```

Server akan berjalan di `http://localhost:5000`
API Documentation tersedia di `http://localhost:5000/docs`

### Run Tests (pakai env production)

```bash
bun test --no-env-file --env-file .env.production
```

Atau via script:

```bash
bun run test:prod
```

## Deployment ke Vercel dengan Supabase

### Prerequisites

1. Akun Vercel
2. Akun Supabase
3. Google Service Account untuk akses Google Sheets

### Langkah-langkah Deployment

#### 1. Setup Supabase Database

1. Buat project baru di [Supabase](https://supabase.com)
2. Dapatkan connection string dari Settings > Database > Connection string
3. Format connection string: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require`

#### 2. Setup Google Service Account

1. Buat Service Account di [Google Cloud Console](https://console.cloud.google.com)
2. Download JSON key file
3. Upload file `google-service-account.json` ke root project (untuk local development)
4. Untuk production, simpan credentials sebagai environment variable atau gunakan Vercel Secrets

#### 3. Deploy ke Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login ke Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

Atau push ke GitHub dan connect repository ke Vercel dari dashboard.

#### 4. Setup Environment Variables di Vercel

Di Vercel Dashboard > Project Settings > Environment Variables, tambahkan:

- `DATABASE_URL`: Connection string dari Supabase
- `JWT_SECRET`: Secret key untuk JWT
- `GSHEETS_SPREADSHEET_ID`: ID Google Spreadsheet
- `GOOGLE_SUMMARY_SHEET_NAME`: "NDE USULAN B2B"
- `GOOGLE_DETAIL_SHEET_NAME`: "NEW BGES B2B & OLO"
- `NODE_ENV`: "production"

**Untuk Google Service Account:**
- Upload `google-service-account.json` sebagai Vercel Secret, atau
- Convert JSON ke environment variables (tidak disarankan untuk production)

#### 5. Run Database Migrations

Setelah deploy, jalankan migration:

```bash
vercel env pull .env.production
bun run db:prod:push
```

Atau gunakan Prisma Migrate di Supabase Dashboard.

### Catatan Penting

1. **Database Connection**: Pastikan Supabase database sudah di-setup dengan benar dan connection string valid
2. **Google Sheets Access**: Pastikan Service Account memiliki akses ke Google Spreadsheet
3. **CORS**: Update CORS origin di `src/app.ts` untuk production domain
4. **Environment Variables**: Jangan commit `.env` atau `google-service-account.json` ke repository

### Troubleshooting

- **Database Connection Error**: Pastikan connection string benar dan database accessible dari Vercel
- **Google Sheets Error**: Pastikan Service Account memiliki permission yang tepat
- **Build Error**: Pastikan semua dependencies terinstall dan build command berhasil

## API Endpoints

- `GET /`: Health check
- `GET /docs`: API Documentation (Swagger UI)
- `POST /api/auth/login`: Login
- `GET /api/survey`: Get survey data (with filters)
- `GET /api/survey/{nomorNc}`: Get survey by nomor NCX
- `POST /api/admin/sync/sheets`: Sync from Google Sheets (Admin only)
- `GET /api/admin/sync`: Get sync status (Admin only)
- `POST /api/admin/survey`: Create survey (Admin only)
- `PUT /api/admin/survey/{nomorNc}`: Update survey (Admin only)
- `DELETE /api/admin/survey/{nomorNc}`: Delete survey (Admin only)

## Struktur Data

**Panduan mapping kolom Sheet → field DB:** lihat [`docs/MAPPING.md`](docs/MAPPING.md).  
Di situ dijelaskan di mana mengubah mapping (`mapRowToSummary`, `mapRowToDetail`) dan tabel kolom → field DB.

### Sheet "NEW BGES B2B & OLO" (Source Data Utama)
Kolom: UMUR, BLN, TGL INPUT USULAN, ID KENDALA, JENIS ORDER, DATEL, STO, NAMA PELANGGAN, LATITUDE, LONGITUDE, JENIS KENDALA, PLAN TEMATIK, RAB HLD, IHLD, STATUS USULAN, STATUS IHLD, ID EPROP, STATUS INSTALASI, KETERANGAN, NEW SC

### Sheet "NDE USULAN B2B" (Dependent Sheet)
Kolom: NO, Status JT, C2R, Nomer NCX/Starclick, DATEL, STO, NAMA PELANGGAN, LATITUDE, LONGITUDE, Alamat Instalasi, Jenis Layanan, Nilai Kontrak, IHLD LOP ID, PLAN TEMATIK, RAB HLD, RAB SURVEY, NOMOR NDE, STATUS USULAN, STATUS INSTALASI, Progress JT, NAMA ODP, Jarak ODP Ke Pelanggan, Keterangan

**Note**: Sheet "NDE USULAN B2B" bergantung pada "NEW BGES B2B & OLO" melalui formula yang menggunakan nomor NCX sebagai key untuk match data.

This project was created using `bun init` in bun v1.3.5. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
