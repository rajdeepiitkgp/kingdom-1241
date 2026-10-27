import { cookies } from "next/headers";
import { getActiveLeaderPlan, getAlliances, getHeroes } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { isValidAreaToken, KVK_AREA_COOKIES } from "@/lib/kvk/access";
import { LeaderPlan } from "./LeaderPlan";
import { UnlockCard } from "./UnlockCard";

/**
 * The rally-leader page's gate: its own password and cookie, independent of
 * the battle plan's (request time → rendered inside <Suspense>). The password
 * is stripped before the page data reaches a component.
 */
export async function LeaderGate({ dict, locale }: { dict: Dictionary; locale: string }) {
  const [plan, cookieStore] = await Promise.all([getActiveLeaderPlan(), cookies()]);

  if (!plan) {
    return (
      <p className="card mx-auto max-w-md px-5 py-8 text-center font-semibold text-ink-muted">
        <span className="mb-2 block text-4xl" aria-hidden>
          👑
        </span>
        {dict["leaders.noPlan"]}
      </p>
    );
  }

  if (!isValidAreaToken("leaders", cookieStore.get(KVK_AREA_COOKIES.leaders)?.value, plan.planId, plan.password)) {
    return <UnlockCard dict={dict} area="leaders" />;
  }

  const [heroes, alliances] = await Promise.all([getHeroes(), getAlliances()]);
  const { password: _password, ...safePlan } = plan;
  void _password;
  return <LeaderPlan plan={safePlan} heroes={heroes} alliances={alliances} dict={dict} locale={locale} />;
}
