# Field Claim Server API (Mock Spec)

## Base URL
```
http://localhost:4000
```

All requests/ responses use JSON. Authentication uses a static bearer token for now.

## Endpoints

### `GET /api/claims`
Returns the latest classified claims with metadata.

**Query params**
- `since` (optional ISO timestamp, uses `updatedAt`) – when provided, returns only records updated after that timestamp.

**Response**
```jsonc
{
  "data": [ { /* CleanedClaim + updatedAt */ } ],
  "lastUpdated": "2023-11-01T12:00:00Z",
  "version": "df1a2c"
}
```

### `POST /api/claims/upload`
Uploads the most recent classification result.

**Body**
```jsonc
{
  "data": [ { /* CleanedClaim */ } ],
  "source": "web-app",
  "uploadedAt": "2024-01-13T03:20:00Z"
}
```

**Response**
```json
{ "status": "ok", "version": "df1a2c", "lastUpdated": "2024-01-13T03:25:00Z" }
```

### `GET /api/notifications/stream`
Server-Sent Events (SSE) channel for real-time updates. In the mock we simulate this with POSTing to `/api/push`.

**Event Payload**
```json
{
  "type": "claims.updated",
  "version": "df1a2c",
  "lastUpdated": "2024-01-13T03:25:00Z"
}
```

### Error Format
```json
{
  "error": {
    "message": "string",
    "code": "string"
  }
}
```

## Mock Server

See `scripts/mockServer.ts`. It stores data under `mock-data/claims.json`, handles upload/list, and broadcasts SSE notifications. Use:

```bash
npm run mock:server
```
