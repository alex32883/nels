import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="max-w-lg py-10">
      <h1 className="font-serif text-4xl">You’re offline</h1>
      <p className="mt-4 text-[var(--muted)]">
        Nels keeps notes, tasks, and events in this browser. Open a page you’ve already
        visited, or reconnect to load a fresh copy of the app.
      </p>
      <Link href="/" className="btn-primary mt-6 inline-block">
        Back to Today
      </Link>
    </div>
  );
}
