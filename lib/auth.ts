const COOKIE = "nels_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function encoder() {
  return new TextEncoder();
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

export function authConfigured(): boolean {
  return Boolean(process.env.NELS_PASSWORD);
}

function sessionSecret(): string {
  return process.env.NELS_SESSION_SECRET || process.env.NELS_PASSWORD || "nels-dev-secret";
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder().encode(value));
  return toHex(signature);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder().encode(value));
  return toHex(digest);
}

export async function passwordMatches(input: string): Promise<boolean> {
  const expected = process.env.NELS_PASSWORD;
  if (!expected) return false;
  const left = await sha256Hex(input);
  const right = await sha256Hex(expected);
  return timingSafeEqual(left, right);
}

export async function createSessionToken(): Promise<string> {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  const body = `v1.${exp}`;
  const signature = await hmacHex(sessionSecret(), body);
  return `${body}.${signature}`;
}

export async function sessionTokenValid(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [version, exp, signature] = parts;
  if (version !== "v1") return false;
  const expires = Number(exp);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const body = `${version}.${exp}`;
  const expected = await hmacHex(sessionSecret(), body);
  return timingSafeEqual(expected, signature);
}

export function sessionCookie(token: string) {
  return {
    name: COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

export function clearSessionCookie() {
  return {
    name: COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

export function readSessionCookie(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE) return rest.join("=");
  }
  return undefined;
}

export { COOKIE as SESSION_COOKIE };
