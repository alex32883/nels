import { NextResponse } from "next/server";
import { parseBackup } from "@/lib/backup";
import { loadSnapshot, replaceSnapshot, saveMerged, storageReady } from "@/lib/server-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshot = await loadSnapshot();
    return NextResponse.json({ ok: true, ...snapshot });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not load data." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  if (!storageReady()) {
    return NextResponse.json(
      { ok: false, error: "Shared storage is not configured. Add Upstash Redis on Vercel." },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json()) as { payload?: unknown; mode?: string };
    const payload = parseBackup(body.payload);
    const snapshot =
      body.mode === "replace" ? await replaceSnapshot(payload) : await saveMerged(payload);
    return NextResponse.json({
      ok: true,
      ...snapshot,
      storage: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL ? "cloud" : "local-file",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not save data." },
      { status: 400 },
    );
  }
}
