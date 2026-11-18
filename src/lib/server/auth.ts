import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { ApiError, db, DEFAULT_PREFERENCES, transaction } from "./db";
import type { User } from "../types";
const SESSION_DAYS = 30;
export const COOKIE_NAME = "mqw_session";
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function checkPassword(password: string, hash: string): boolean {
  const [salt, stored] = hash.split(":");
  if (!salt || !stored) return false;
  const actual = scryptSync(password, salt, 64);
  const wanted = Buffer.from(stored, "hex");
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}
function passwordValid(password: unknown): asserts password is string {
  if (
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 256
  )
    throw new ApiError("اختر كلمة مرور بين 10 و256 حرفًا.");
}
function credentials(email: unknown, password: unknown) {
  if (
    typeof email !== "string" ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    email.length > 254
  )
    throw new ApiError("اكتب بريدًا إلكترونيًا صالحًا.");
  passwordValid(password);
  return { email: email.trim().toLowerCase(), password };
}
export function registrationMode(): "open" | "invite" | "closed" {
  const owner = process.env.MQW_OWNER_EMAIL?.trim().toLowerCase();
  const hash = process.env.MQW_SETUP_TOKEN_HASH;
  if (owner && db.prepare("SELECT id FROM users WHERE email=?").get(owner))
    return "closed";
  if (hash) {
    if (
      !owner ||
      !/^\S+@\S+\.\S+$/.test(owner) ||
      !/^[a-f0-9]{64}$/i.test(hash)
    )
      return "closed";
    if (
      db
        .prepare("SELECT token_hash FROM setup_tokens WHERE token_hash=?")
        .get(hash.toLowerCase())
    )
      return "closed";
    return "invite";
  }
  return process.env.NODE_ENV === "production" ? "closed" : "open";
}
function verifySetupToken(email: string, token: unknown): string | undefined {
  const mode = registrationMode();
  if (mode === "closed")
    throw new ApiError("إنشاء حساب جديد غير متاح. استخدم حسابك الموجود.", 403);
  if (mode === "invite") {
    const owner = process.env.MQW_OWNER_EMAIL!.trim().toLowerCase();
    const hash = process.env.MQW_SETUP_TOKEN_HASH!;
    const supplied =
      typeof token === "string" && token.length <= 4096 ? token : "";
    const actual = createHash("sha256").update(supplied).digest();
    const expected = Buffer.from(hash, "hex");
    if (!supplied || email !== owner || !timingSafeEqual(actual, expected))
      throw new ApiError("رابط الإعداد غير صالح أو لم يعد متاحًا.", 403);
    return hash.toLowerCase();
  }
  return undefined;
}
export function signUp(
  email: unknown,
  password: unknown,
  name: unknown,
  setupToken?: unknown,
): { user: User; token: string } {
  const c = credentials(email, password);
  if (
    process.env.MQW_OWNER_EMAIL &&
    c.email !== process.env.MQW_OWNER_EMAIL.trim().toLowerCase()
  )
    throw new ApiError("التسجيل متاح لصاحب هذا التطبيق فقط.", 403);
  if (db.prepare("SELECT id FROM users WHERE email=?").get(c.email))
    throw new ApiError("تعذر إنشاء الحساب بهذا البريد. جرّب تسجيل الدخول.", 409);
  const user = {
    id: randomUUID(),
    email: c.email,
    name: typeof name === "string" ? name.trim().slice(0, 80) : "",
  };
  return transaction(() => {
    const setupHash = verifySetupToken(c.email, setupToken);
    db.prepare(
      "INSERT INTO users(id,email,name,password_hash,preferences,created_at) VALUES(?,?,?,?,?,?)",
    ).run(
      user.id,
      user.email,
      user.name,
      hashPassword(c.password),
      JSON.stringify(DEFAULT_PREFERENCES),
      new Date().toISOString(),
    );
    if (setupHash)
      db.prepare(
        "INSERT INTO setup_tokens(token_hash,consumed_at) VALUES(?,?)",
      ).run(setupHash, new Date().toISOString());
    return { user, token: newSession(user.id) };
  });
}
export function signIn(
  email: unknown,
  password: unknown,
): { user: User; token: string } {
  const c = credentials(email, password);
  const row = db.prepare("SELECT * FROM users WHERE email=?").get(c.email) as
    | { id: string; email: string; name: string; password_hash: string }
    | undefined;
  const hash =
    row?.password_hash ||
    "00000000000000000000000000000000:ea2fe6ebc2f4f3c46f76a89b1e206fd7d036d29eeef739b9d82b7486cbbd41a65019f6a85beb120b6209505838170bf69afdbf9dc665a9ff2ea7204482d84788";
  if (!checkPassword(c.password, hash) || !row)
    throw new ApiError("البريد أو كلمة المرور غير صحيحين.", 401);
  return {
    user: { id: row.id, email: row.email, name: row.name },
    token: newSession(row.id),
  };
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function newSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  db.prepare("DELETE FROM sessions WHERE expires_at<?").run(
    new Date().toISOString(),
  );
  db.prepare(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
  ).run(
    tokenHash(token),
    userId,
    new Date(Date.now() + SESSION_DAYS * 86400000).toISOString(),
  );
  return token;
}
export function getUserByToken(token?: string): User | null {
  if (!token) return null;
  const row = db
    .prepare(
      "SELECT u.id,u.email,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
    )
    .get(tokenHash(token), new Date().toISOString()) as User | undefined;
  return row || null;
}
export function sessionToken(request: Request): string | undefined {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
}
export function requireUser(request: Request): User {
  const user = getUserByToken(sessionToken(request));
  if (!user) throw new ApiError("يرجى تسجيل الدخول للمتابعة.", 401);
  return user;
}
export function sessionCookie(token: string, maxAge = SESSION_DAYS * 86400) {
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export function signOut(token?: string) {
  if (token)
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(tokenHash(token));
}
export function verifyPassword(userId: string, password: unknown) {
  if (typeof password !== "string" || password.length > 256)
    throw new ApiError("كلمة المرور غير صحيحة.", 401);
  const row = db
    .prepare("SELECT password_hash FROM users WHERE id=?")
    .get(userId) as { password_hash: string } | undefined;
  if (!row || !checkPassword(password, row.password_hash))
    throw new ApiError("كلمة المرور غير صحيحة.", 401);
}
export function changePassword(
  userId: string,
  current: unknown,
  next: unknown,
) {
  verifyPassword(userId, current);
  passwordValid(next);
  return transaction(() => {
    db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(
      hashPassword(next),
      userId,
    );
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(userId);
    return newSession(userId);
  });
}
