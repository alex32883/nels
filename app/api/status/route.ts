import { NextResponse } from "next/server";
import { authConfigured } from "@/lib/auth";
import { cloudStorageConfigured, storageReady } from "@/lib/server-store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    authConfigured: authConfigured(),
    storageConfigured: cloudStorageConfigured(),
    storageReady: storageReady(),
  });
}
