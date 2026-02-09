# Vercel Deployment Guide

## Vercel-Optimized Endpoints

### 1. Sync Endpoint (`POST /sync`)

**Timeout Protection:**
- Hobby Plan: 10s timeout → Safe limit: 8s
- Pro Plan: 60s timeout → Safe limit: 55s

**Features:**
- ✅ Automatic timeout handling
- ✅ Streaming support (Server-Sent Events)
- ✅ Batch processing with early termination
- ✅ 202 Accepted response for background processing

**Usage:**

#### Regular Request (JSON Response):
```bash
curl -X POST https://your-app.vercel.app/sync \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response (Success within timeout):**
```json
{
  "success": true,
  "message": "Sync completed! 50 created, 100 updated",
  "data": {
    "totalRecords": 599,
    "processedRecords": 150,
    "syncStats": {
      "created": 50,
      "updated": 100,
      "skipped": 0,
      "errors": 0
    },
    "processingTime": "7.85s",
    "note": "Sync completed within timeout"
  }
}
```

**Response (Timeout - Background Processing):**
```json
{
  "success": true,
  "message": "Sync started - processing continues in background",
  "data": {
    "status": "processing",
    "note": "Due to Vercel timeout limits, sync is processing. Check /sync/status for updates."
  }
}
```
**Status Code:** `202 Accepted`

#### Streaming Request (Real-time Progress):
```bash
curl -X POST https://your-app.vercel.app/sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: text/event-stream"
```

**Response (Server-Sent Events):**
```
data: {"type":"start","message":"Starting sync..."}

data: {"type":"complete","data":{"created":50,"updated":100},"message":"Sync completed!"}
```

### 2. Update Endpoint (`PUT /survey/:nomorNcx`)

**Timeout Protection:**
- Safe limit: 8s for database + sheet sync

**Features:**
- ✅ Non-blocking sheet sync
- ✅ 202 Accepted for slow operations
- ✅ Database updated immediately

**Usage:**
```bash
curl -X PUT https://your-app.vercel.app/survey/530270110 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "statusJt": "APPROVED",
    "c2r": 85.5
  }'
```

**Response (Success):**
```json
{
  "success": true,
  "message": "User successfully updated 530270110",
  "data": {
    "id": "...",
    "nomorNcx": "530270110",
    "statusJt": "APPROVED",
    "c2r": 85.5
  }
}
```

**Response (Timeout - Background Sync):**
```json
{
  "success": true,
  "message": "Update processing - may take a moment to sync to sheets",
  "data": {
    "status": "processing"
  }
}
```
**Status Code:** `202 Accepted`

### 3. Delete Endpoint (`DELETE /survey/:nomorNcx`)

**Timeout Protection:**
- Safe limit: 8s for database + sheet sync

**Features:**
- ✅ Non-blocking sheet sync
- ✅ 202 Accepted for slow operations
- ✅ Database deleted immediately

**Usage:**
```bash
curl -X DELETE https://your-app.vercel.app/survey/530270110 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response (Success):**
```json
{
  "success": true,
  "message": "User successfully deleted 530270110",
  "data": null
}
```

**Response (Timeout - Background Sync):**
```json
{
  "success": true,
  "message": "Delete processing - may take a moment to sync to sheets",
  "data": {
    "status": "processing"
  }
}
```
**Status Code:** `202 Accepted`

## Environment Variables for Vercel

Add these to your Vercel project settings:

```env
# Database
DATABASE_URL=your_postgres_connection_string

# JWT
JWT_SECRET=your-super-secret-jwt-key

# Google Sheets (IMPORTANT: Use JSON string for Vercel)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
GOOGLE_SPREADSHEET_ID=1bv_hXgD3q5SYUG6Y70wEKeaMQu4Rk8frAIgVA-HxbvQ
GOOGLE_SUMMARY_SHEET_NAME=NDE USULAN B2B
GOOGLE_DETAIL_SHEET_NAME=NEW BGES B2B & OLO

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com

# Node Environment
NODE_ENV=production
```

## Vercel Configuration

Create `vercel.json`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/main.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/main.ts"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "src/main.ts": {
      "maxDuration": 10
    }
  }
}
```

## Optimization Tips

### 1. Database Connection Pooling
Already configured in `prisma.config.ts`:
```typescript
connection_limit: 5  // Vercel-friendly limit
```

### 2. Batch Size
Optimized for Vercel timeout:
```typescript
const BATCH_SIZE = 25;  // Smaller batches
const MAX_EXECUTION_TIME = 8500;  // 8.5s max
```

### 3. Non-Blocking Sheet Sync
Sheet sync runs in background (fire-and-forget):
```typescript
this.syncService.syncToSheets(...)
  .catch((error) => {
    logger.error('Non-blocking sync failed:', error);
  });
```

### 4. Streaming for Long Operations
Use `Accept: text/event-stream` header for real-time progress.

## Monitoring

### Check Sync Status
```bash
curl https://your-app.vercel.app/sync/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "lastSync": {
      "id": "...",
      "status": "SUCCESS",
      "message": "Sync completed! 50 created, 100 updated",
      "syncedAt": "2025-02-06T10:30:00.000Z"
    }
  }
}
```

## Troubleshooting

### Timeout Issues
1. Check Vercel plan limits (Hobby: 10s, Pro: 60s)
2. Reduce batch size in `sync.prisma.repository.ts`
3. Use streaming endpoint for progress updates

### Sheet Sync Delays
- Sheet sync is non-blocking and may take a few seconds
- Check logs in Vercel dashboard
- Verify Google Service Account permissions

### Database Connection Errors
- Check connection pool limit (max 5 for Vercel)
- Verify DATABASE_URL is correct
- Check Prisma connection timeout settings

## Performance Metrics

Expected performance on Vercel:
- **Sync 100 records:** ~3-5s
- **Sync 500 records:** ~7-9s (may timeout on Hobby)
- **Update single record:** ~0.5-1s
- **Delete single record:** ~0.5-1s

## Upgrade to Pro Plan

For better performance:
- ✅ 60s timeout (vs 10s)
- ✅ More concurrent connections
- ✅ Better cold start performance
- ✅ Priority support

## Testing Locally

Test Vercel-like environment:
```bash
# Install Vercel CLI
npm i -g vercel

# Run locally
vercel dev

# Test with timeout simulation
curl -X POST http://localhost:3000/sync \
  -H "Authorization: Bearer YOUR_TOKEN"
```
