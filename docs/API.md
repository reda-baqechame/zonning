# ZONNING API (Équipe)

Base URL: `https://your-app.vercel.app/api/v1`

## Authentication

```
Authorization: Bearer zn_<your_api_key>
```

Create keys from `/equipe` or `POST /api/org` with `{ "action": "create_api_key", "name": "CRM" }`.

Revoke: `{ "action": "revoke_api_key", "keyId": "..." }`

## Endpoints

### GET /api/v1/permits

Query: `limit` (max 200)

Returns recent construction permits with pipeline metadata.

### GET /api/v1/tenders

Query: `limit` (max 200)

Returns open SEAO tenders.

### GET /api/v1/verdict

Query: `address` (required), `borough` (optional)

Returns PERMIS.AI deterministic tier + labels for lenders/CRM integration.

```json
{
  "address": "1234 rue Example",
  "tier": "eleve",
  "labelFr": "Potentiel élevé",
  "labelEn": "High potential"
}
```

## Rate limits

- **100 requests/minute** per API key (permits, tenders)
- **60 requests/minute** per org (verdict)
- Public `/api/verdict` POST: **10/day** per IP (free tier)

## Data freshness

All v1 routes trigger background sync if government datasets are stale. See `GET /api/sync/health` (requires `Authorization: Bearer $CRON_SECRET` for full detail).

## Webhooks (Équipe)

Create from `/equipe` or `POST /api/org`:

```json
{
  "action": "create_webhook",
  "url": "https://your-crm.example/webhooks/zonning",
  "events": "permit.created,tender.created"
}
```

Response includes `secret` (shown once). Delete: `{ "action": "delete_webhook", "webhookId": "..." }`.

### Payload

```json
{
  "event": "permit.created",
  "data": { "id": "...", "externalId": "...", "address": "...", "city": "Montréal" },
  "ts": 1710000000000
}
```

### Signature verification

Header `X-Zonning-Signature` = HMAC-SHA256 hex of raw JSON body using your webhook secret.

```javascript
const crypto = require("crypto");
const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
```

### Retry policy

3 delivery attempts with exponential backoff (2s, 4s). Failures logged in `WebhookDelivery`.

Events: `permit.created` (after permit sync), `tender.created` (after SEAO sync).
