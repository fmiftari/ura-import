# Deploying the URA Import API

I can't create hosting accounts on your behalf — that requires your own sign-up/billing decision. This doc gets you from "code in a folder" to "live URL" in each of the three easiest free-tier-friendly options. Pick one; Render is the least fiddly if you've never done this before.

All three need: this `server/` folder pushed to a Git repo (it already lives inside `fmiftari/ura-import` — that's fine, all three platforms let you point at a subdirectory).

**Important — persistent storage.** This service stores data as a single JSON file (`data/db.json`). On most platforms, the filesystem a deploy runs on is **ephemeral** — it resets on every redeploy unless you attach a persistent disk/volume. All three steps below call this out. If you skip it, the service still works, but onboarded consumers and stored leads/rates disappear on the next deploy.

## Option A — Render (recommended for a first deploy)

1. Push this repo to GitHub (already done — it's `fmiftari/ura-import`).
2. On [render.com](https://render.com), New → Web Service → connect the `fmiftari/ura-import` repo.
3. Root directory: `server`
4. Build command: `npm install`
5. Start command: `node src/index.js`
6. Add a **Disk** (Render's persistent volume): mount path `/opt/render/project/src/data`, size 1GB is plenty. Set env var `DATA_DIR` to that same path.
7. Environment variables: `ADMIN_API_KEY` (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), optionally `EXTRA_CORS_ORIGINS`.
8. Deploy. Render gives you a URL like `https://ura-import-api.onrender.com`.
9. Verify: `curl https://ura-import-api.onrender.com/health`

Free tier note: Render's free web services sleep after inactivity and take a few seconds to wake on the next request — fine for a low-traffic integration API, not fine if you need instant always-on responses (upgrade to a paid instance if that matters later).

## Option B — Railway

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub repo → select `fmiftari/ura-import`.
2. Settings → set root directory to `server`.
3. Railway auto-detects Node and runs `npm install` + `npm start`.
4. Add a **Volume**, mount it at `/app/data`, set env var `DATA_DIR=/app/data`.
5. Set `ADMIN_API_KEY` and (optionally) `EXTRA_CORS_ORIGINS` under Variables.
6. Deploy — Railway gives you a `*.up.railway.app` URL (or attach a custom domain).

## Option C — Fly.io (uses the included Dockerfile)

1. Install the [flyctl CLI](https://fly.io/docs/flyctl/install/), `fly auth login`.
2. From the `server/` directory: `fly launch` (it will detect the `Dockerfile`; say no to a Postgres database when asked — not needed).
3. `fly volumes create ura_data --size 1` then in the generated `fly.toml` add:
   ```toml
   [mounts]
     source = "ura_data"
     destination = "/app/data"
   ```
4. `fly secrets set ADMIN_API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")`
5. `fly deploy`
6. Verify: `curl https://<your-app>.fly.dev/health`

## After deploying, anywhere

1. Onboard your first real consumer (see README's "Onboarding" section) using the deployed URL instead of localhost.
2. If you want URA's own frontend to use the opt-in "send to Customs/Partner" button, set `VITE_API_BASE=https://<your-deployed-url>` as a GitHub Actions secret/variable and reference it in the build step — see the frontend's `src/api.js` for what it expects. Until you do this, the frontend stays exactly as it is today: no calls to this service at all.
3. Keep `ADMIN_API_KEY` somewhere safe (e.g. your password manager) — it's the only way to onboard or revoke consumers, and there is no recovery flow if it's lost (you'd just generate and set a new one, which doesn't affect already-issued consumer keys).
