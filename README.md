# Nels

Personal planner, notes, tasks, and calendar. Sign in with a password. Data is stored on the device for offline use and synced so every browser sees the same list.

## Run locally

```bash
npm install
```

Copy [`.env.example`](.env.example) to `.env.local` and set a password:

```
NELS_PASSWORD=your-password
```

Then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in.

Without Redis, local sync uses a file in `.data/` on that computer. Add the same Upstash Redis env vars as Vercel if you want localhost to match production.

## Deploy to Vercel

1. Push the repo and import it at [vercel.com/new](https://vercel.com/new) (Next.js preset).
2. In the Vercel project: **Storage → Create Database → Upstash Redis** (this sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`).
3. In **Settings → Environment Variables**, add:
   - `NELS_PASSWORD` — the login password (all devices use this)
   - optional `NELS_SESSION_SECRET` — a long random string
4. Redeploy.

After that, Chrome, Edge, phone, and desktop all share the same notes, tasks, and events once they sign in with that password.

## Offline

Open the site once while online. Edits made offline upload the next time the device is connected.

## Stack

Next.js App Router, Tailwind CSS, Dexie (IndexedDB), Serwist (service worker), Upstash Redis (shared store).
