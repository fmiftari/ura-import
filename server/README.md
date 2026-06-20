# URA Import API

Companion service for [URA](https://fmiftari.github.io/ura-import/), the Kosovo car import cost calculator. This is **not** part of the static frontend deployed to GitHub Pages — it's a separate Node service that exists for one purpose: giving Kosovo Customs (Dogana e Kosovës) and partner companies (transport, customs forwarding, insurance, finance) a real, documented interface to integrate with, whenever that collaboration actually happens.

Until such a collaboration exists, this service can sit unused — it costs nothing extra and changes nothing about URA's current "no data collected" promise. The frontend only ever calls it if explicitly configured to (see [Frontend integration](#frontend-integration) below).

## Why this exists

URA today is a 100% client-side calculator — no server, no stored data, no accounts. That's a deliberate, stated privacy promise and should stay the default. But "leave an interface open for future collaboration" means having a real, working contract ready *before* a partner or government body asks for one — not building it from scratch under time pressure later.

## Design choices, and why

- **One auth scheme for everyone.** Every consumer — a transport company, an insurance partner, or Dogana e Kosovës — authenticates with an `X-API-Key` header and is restricted by `scopes` on their key. There is no special-cased "government" code path; that's what keeps this genuinely reusable instead of a one-off.
- **No database server required.** Storage is a single JSON file (`src/db.js`), guarded by an in-process write queue. This is intentionally simple — fine for the volume an opt-in "share with Customs/partner" button and a handful of integrations will produce. The storage functions are isolated behind one module; swapping to Postgres later means rewriting `src/db.js` only, nothing else.
- **Rates are publicly readable, restricted to write.** `GET /api/v1/rates` needs no key — the numbers it would serve (customs %, VAT %, excise table) are already public law, already sitting in URA's client-side JS today. Read access changes nothing about confidentiality. Write access (`rates:write`) is the actual hook: if Dogana e Kosovës is ever given a key with that scope, they could publish official rate changes directly, and a future version of URA could read live from here instead of waiting for a code deploy.
- **Admin operations are separate from regular API keys.** Onboarding a new consumer (`POST /api/v1/consumers`) requires a distinct `ADMIN_API_KEY` env var, not a scope on a normal key. Only Flamur (or whoever runs this service) can mint new keys.

## Running locally

```bash
cd server
npm install
cp .env.example .env
# edit .env — set ADMIN_API_KEY to something random:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm start
```

Server listens on `PORT` (default `8787`). Data persists to `./data/db.json` (configurable via `DATA_DIR`).

## Onboarding a new partner or government consumer

```bash
curl -X POST http://localhost:8787/api/v1/consumers \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dogana e Kosovës",
    "type": "government",
    "scopes": ["rates:write", "calculations:read"]
  }'
```

The response includes `apiKey` — shown exactly once. Store it now; it cannot be retrieved again (only its hash is kept). Give that key to the partner/government contact; they use it in the `X-API-Key` header on every request.

Valid scopes: `calculations:read`, `calculations:write`, `leads:read`, `leads:write`, `rates:read`, `rates:write`.

To revoke: `DELETE /api/v1/consumers/{id}` with the same `X-Admin-Key` header.

## API reference

See [`openapi.yaml`](./openapi.yaml) for the full machine-readable spec (paste it into https://editor.swagger.io for an interactive view), or the quick summary:

| Endpoint | Method | Scope required | Purpose |
|---|---|---|---|
| `/health` | GET | none | liveness check |
| `/api/v1/calculations` | POST | `calculations:write` | store a calc a user opted to share |
| `/api/v1/calculations` | GET | `calculations:read` | list your own submissions |
| `/api/v1/calculations/:id` | GET | `calculations:read` | fetch one (yours only) |
| `/api/v1/leads` | POST | `leads:write` | submit a partner inquiry |
| `/api/v1/leads` | GET | `leads:read` | list leads addressed to you |
| `/api/v1/rates` | GET | none (public) | current official rates, if published |
| `/api/v1/rates` | PUT | `rates:write` | publish a new rates snapshot |
| `/api/v1/rates/history` | GET | none (public) | full history of published snapshots |
| `/api/v1/consumers` | POST/GET | `X-Admin-Key` | onboard / list consumers |
| `/api/v1/consumers/:id` | DELETE | `X-Admin-Key` | revoke a consumer |

## Frontend integration

**Bundle-size note**: the frontend's build config (`vite.config.js`) disables Rollup tree-shaking specifically for builds where `VITE_API_BASE` is set (worked around a confirmed Rollup tree-shaking bug that incorrectly eliminated the opt-in send button otherwise). This makes that one build ~3x larger (~975KB vs ~335KB). It only affects a deliberate build you trigger once this service is actually deployed and wired up — the default build everyone gets today is unaffected.

## Frontend integration

The URA frontend (`ura-prototype.jsx`) has a thin, **opt-in** client (`src/api.js`) that only activates if a `VITE_API_BASE` build-time env var is set. Without it, the frontend behaves exactly as it does today — zero calls to this service, zero new data collection. See the frontend repo's `src/api.js` and the "Send to Customs/Partner" button in the calculator for how that wiring works once this service is actually deployed somewhere.

## Tests

```bash
npm test
```

16 tests cover auth (missing/invalid/revoked keys), scope enforcement, calculation/lead isolation between consumers, the public-read/scoped-write split on rates, and CORS.

## Deployment

See [`DEPLOY.md`](./DEPLOY.md) for step-by-step instructions for Render, Railway, and Fly.io (all have usable free tiers for this kind of low-traffic service).
