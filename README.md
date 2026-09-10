# Nels

Personal planner, notes, tasks, and calendar. Data stays in this browser and the app works offline after the first visit. Deploy it to Vercel with no environment variables.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- **Today** — due tasks, today’s events, pinned notes
- **Notes** — search, tags, pin, preview (`**bold**`, lists, headings)
- **Tasks** — due dates, priority, complete
- **Calendar** — month view and per-day events
- **Planner** — week and day views
- **Assistant** — press `/` and type:
  - `note #ideas weekend trip`
  - `task submit report friday`
  - `event dentist tomorrow 3pm`
  - `remind me tomorrow to call Jan`

Settings exports and imports a JSON backup. Clearing data only affects this device.

## Offline and install

1. Open the site once while online (so the service worker can cache the app).
2. Install: Chrome/Edge address-bar install, or iOS Share → Add to Home Screen.
3. After that, previously opened pages load without a network. Notes, tasks, and events are stored in IndexedDB on the device.

## Deploy to Vercel

No env vars. Framework preset: Next.js.

1. Push this repo to GitHub (keep `k8s_health_check.py` and the Task files if you still want them).
2. Import the project at [vercel.com/new](https://vercel.com/new).
3. Deploy. Root directory is the repo root.

Or with the Vercel CLI:

```bash
npx vercel
```

## Stack

Next.js App Router, Tailwind CSS, Dexie (IndexedDB), Serwist (service worker).
