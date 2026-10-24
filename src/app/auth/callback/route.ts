import { NextResponse, type NextRequest } from "next/server";
import { loginPath, safeNextPath } from "@/lib/auth/paths";
import { createSessionClient, syncProfile } from "@/lib/auth/server";
import { createLogger, requestId } from "@/lib/log";

/**
 * Where Supabase Auth sends the visitor after Discord: exchanges the one-time
 * code for a session (written to HttpOnly cookies) and continues to `next`.
 */
export async function GET(request: NextRequest) {
  const reqId = requestId(request);
  const log = createLogger("auth").child({ reqId });
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"), "/en/admin");
  const locale = next.split("/")[1] || "en";

  const fail = (reason: string) => {
    const response = NextResponse.redirect(new URL(`${loginPath(locale)}?error=${reason}`, origin));
    response.headers.set("x-request-id", reqId);
    return response;
  };

  const code = searchParams.get("code");
  if (!code) {
    log.warn("Callback without a code", { error: searchParams.get("error_description") ?? searchParams.get("error") });
    return fail("missing_code");
  }

  const supabase = await createSessionClient();
  if (!supabase) return fail("config");

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    log.warn("Code exchange failed", { error: error?.message });
    return fail("oauth");
  }

  const user = await syncProfile(data.user, { signedIn: true });
  log.info("Signed in", { userId: user.id, role: user.role, provider: user.provider });

  const response = NextResponse.redirect(new URL(next, origin));
  response.headers.set("x-request-id", reqId);
  return response;
}
