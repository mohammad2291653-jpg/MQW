import {
  getUserByToken,
  sessionToken,
  signUp,
  signIn,
  signOut,
  sessionCookie,
  registrationMode,
} from "@/lib/server/auth";
import {
  checkOrigin,
  fail,
  json,
  rateLimit,
  readBody,
} from "@/lib/server/http";
import { ApiError } from "@/lib/server/db";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    return json({
      user: getUserByToken(sessionToken(request)),
      capabilities: { registration: registrationMode() },
    });
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const b = await readBody(request);
    if (b.action === "sign-out") {
      signOut(sessionToken(request));
      return json({ user: null }, 200, { "Set-Cookie": sessionCookie("", 0) });
    }
    rateLimit(
      `auth:${request.headers.get("x-forwarded-for")?.split(",")[0] || "local"}`,
      30,
    );
    rateLimit(
      `auth-account:${String(b.email || "")
        .trim()
        .toLowerCase()
        .slice(0, 254)}`,
      12,
    );
    if (b.action === "reset-password" || b.action === "forgot-password")
      throw new ApiError(
        "خدمة البريد غير مهيأة محليًا؛ لم يُرسل رابط. غيّر كلمة مرورك من حسابك أو احتفظ بنسخة بياناتك.",
        503,
      );
    if (b.action !== "sign-up" && b.action !== "sign-in")
      throw new ApiError("عملية الدخول غير معروفة.");
    const result =
      b.action === "sign-up"
        ? signUp(b.email, b.password, b.name, b.setupToken)
        : signIn(b.email, b.password);
    return json({ user: result.user }, 200, {
      "Set-Cookie": sessionCookie(result.token),
    });
  } catch (error) {
    return fail(error);
  }
}
