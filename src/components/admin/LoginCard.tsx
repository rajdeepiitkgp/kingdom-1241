import { signInWithDiscord, signOut } from "@/lib/auth/actions";
import { devLoginEnabled } from "@/lib/auth/dev-login";
import { ROLE_LABELS } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/server";
import { getAlliances } from "@/lib/data";
import { DevLoginForm } from "./DevLoginForm";
import { ProfileForm } from "./ProfileForm";

const ERRORS: Record<string, string> = {
  oauth: "Discord sign-in didn't complete. Please try again.",
  missing_code: "Discord sent us back without a sign-in code. Please try again.",
  config: "Sign-in isn't configured on this server yet (see SETUP.md).",
};

export function LoginCard({
  locale,
  next,
  error,
  user,
}: {
  locale: string;
  next: string;
  error: string | null;
  user: CurrentUser | null;
}) {
  return (
    <div className="card p-6">
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">
          {ERRORS[error] ?? "Something went wrong. Please try again."}
        </p>
      )}
      {user ? (
        <NoAccess locale={locale} user={user} path={`/${locale}/admin/login`} />
      ) : (
        <>
          <p className="text-sm font-semibold text-ink-muted">
            Only council members with an admin or moderator role can edit the site. Sign in with the Discord account the
            council knows you by.
          </p>
          <form action={signInWithDiscord} className="mt-5">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="next" value={next} />
            <button type="submit" className="btn-primary w-full">
              Continue with Discord
            </button>
          </form>
          {devLoginEnabled() && <DevLoginForm locale={locale} next={next} />}
        </>
      )}
    </div>
  );
}

/** Signed in, but the account has no role yet. */
export async function NoAccess({ locale, user, path }: { locale: string; user: CurrentUser; path: string }) {
  const alliances = await getAlliances();
  return (
    <div>
      <p className="font-bold text-ink">
        Signed in as {user.displayName} <span className="chip ms-1">{ROLE_LABELS[user.role]}</span>
      </p>
      <div className="mt-4 rounded-2xl bg-card-soft p-3">
        <p className="mb-2 text-sm font-semibold text-ink-muted">
          Set your in-game name so the council recognises you in the user list.
        </p>
        <ProfileForm gameName={user.gameName} allianceTag={user.allianceTag} alliances={alliances} path={path} />
      </div>
      <p className="mt-4 text-sm font-semibold text-ink-muted">
        This account has no admin access yet. Ask an administrator to pre-authorise
        {user.discordUsername ? (
          <>
            {" "}
            your Discord username <code className="rounded-sm bg-card-soft px-1" dir="ltr">{user.discordUsername}</code>
          </>
        ) : user.email ? (
          <>
            {" "}
            your e-mail <code className="rounded-sm bg-card-soft px-1" dir="ltr">{user.email}</code>
          </>
        ) : (
          " you"
        )}
        , then sign in again.
      </p>
      <form action={signOut} className="mt-4">
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" className="btn-ghost btn-sm">
          Sign out
        </button>
      </form>
    </div>
  );
}
