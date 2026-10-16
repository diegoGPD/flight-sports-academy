# Flight Sports Academy — website + admin

One-page marketing site with class videos, a trial-request form (parents pick the program and the exact class they want to try — no live booking), and a password-protected admin panel.

- **Website:** `/`
- **Admin:** `/admin` — see trial requests (status, notes, WhatsApp/phone links, CSV export) and edit every text, price, schedule slot, video, photo, FAQ and setting on the site. Saving publishes immediately.

## Run locally

```bash
npm install
ADMIN_PASSWORD=admin npm start      # http://localhost:3000  and  /admin
```

## Deploy on Railway

1. In Railway: **New Project → Deploy from GitHub repo** → pick this repo. It builds from the `Dockerfile` automatically.
2. **Add a volume** (right-click the service → *Attach volume*) with mount path **`/data`**. Without it, admin edits and trial requests are lost on every redeploy.
3. **Variables:** `ADMIN_PASSWORD` (required), `SESSION_SECRET` (any long random string), optional `NOTIFY_WEBHOOK_URL`. `DATA_DIR=/data` is already set in the Dockerfile; Railway sets `PORT` for you.
4. **Settings → Networking → Generate Domain** (or add your custom domain), then update **Site settings → Website address** in `/admin`.

**Other hosts:** Render (`render.yaml` included), Fly.io or any VPS with Docker and a persistent volume at `/data`.
> Serverless hosts without a disk (Vercel, Netlify) will lose admin edits and trial requests on redeploy — don't use them for this app.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | yes | Password for `/admin` |
| `SESSION_SECRET` | recommended | Random string to sign admin sessions |
| `DATA_DIR` | yes in prod | Persistent folder for `content.json`, `trials.json`, `uploads/`, `backups/` |
| `NOTIFY_WEBHOOK_URL` | optional | Each new trial request is POSTed here (Zapier/Make → email, SMS, Slack, Google Sheets) |

## After launch (in `/admin` → Edit website → Site settings)

- WhatsApp number (enables WhatsApp buttons everywhere)
- Instagram link, contact email
- Google Analytics ID — tracks visits, `generate_lead` on trial submit, `select_class`, `video_play`
- Replace bracketed placeholders: coach bio, testimonials

## How data is stored

Plain JSON files in `DATA_DIR`. The last 30 versions of the site content are kept in `DATA_DIR/backups/` — copy one back over `content.json` to roll back. Back up the disk periodically (Render does daily disk snapshots).

## Project layout

```
server.js            Express server, API, auth
src/render.js        Renders the page from content.json (server-side, SEO-friendly)
public/              CSS, JS, logos, compressed class videos
admin/               Admin panel (static HTML + JS)
seed/content.json    Initial content, copied to DATA_DIR on first boot
```
