import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const SESSION_COOKIE = "zonning_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  return process.env.CRON_SECRET ?? "dev-session-secret-change-me";
}

function signSession(userId: string, expiresAt: number): string {
  const payload = `${userId}.${expiresAt}`;
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    if (process.env.NODE_ENV === "production") return null;
    // Legacy raw userId cookie — dev only
    if (parts.length === 1 && parts[0].length > 8) return parts[0];
    return null;
  }

  const [userId, expStr, sig] = parts;
  const expiresAt = parseInt(expStr, 10);
  if (!userId || !Number.isFinite(expiresAt) || !sig) return null;
  if (Date.now() > expiresAt) return null;

  const expected = createHmac("sha256", sessionSecret())
    .update(`${userId}.${expiresAt}`)
    .digest("hex");

  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  return userId;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
  const token = signSession(userId, expiresAt);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const userId = verifySessionToken(raw);
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      companyName: true,
      rbqLicenseClass: true,
      rbqLicenseNumber: true,
      rbqVerified: true,
      rbqVerifiedAt: true,
      trades: true,
      regions: true,
      phone: true,
      phoneVerified: true,
      ampAuthorized: true,
      minProjectCost: true,
      maxProjectCost: true,
      plan: true,
      onboardingComplete: true,
      alertSmsEnabled: true,
      stripeCustomerId: true,
    },
  });
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
