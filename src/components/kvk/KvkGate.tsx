import { cookies } from "next/headers";
import { getActiveKvkPlan, getAlliances, getHeroes, getOpenRetrospective } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { localePath } from "@/lib/i18n/paths";
import { isValidKvkToken, KVK_COOKIE } from "@/lib/kvk/access";
import { isOpenNow } from "@/lib/retro/retention";
import { BattlePlan } from "./BattlePlan";
import { KvkTabs } from "./KvkTabs";
import { UnlockCard } from "./UnlockCard";

/**
 * Reads the access cookie (request time → must be rendered inside <Suspense>)
 * and shows either the password form or the plan. The password is stripped
 * before anything is passed to a component, so it never reaches the RSC
 * payload or the browser.
 */
export async function KvkGate({ dict, locale }: { dict: Dictionary; locale: string }) {
  const [plan, cookieStore] = await Promise.all([getActiveKvkPlan(), cookies()]);

  if (!plan) {
    return (
      <p className="card mx-auto max-w-md px-5 py-8 text-center font-semibold text-ink-muted">
        <span className="mb-2 block text-4xl" aria-hidden>
          🏰
        </span>
        {dict["kvk.noPlan"]}
      </p>
    );
  }

  if (!isValidKvkToken(cookieStore.get(KVK_COOKIE)?.value, plan.id, plan.password)) {
    return <UnlockCard dict={dict} />;
  }

  const [heroes, alliances, retro] = await Promise.all([getHeroes(), getAlliances(), getOpenRetrospective()]);
  const { password: _password, ...safePlan } = plan;
  void _password;
  // The feedback form may belong to the previous battle; it is linked whenever one is open.
  const feedbackHref = retro && isOpenNow(retro, new Date()) ? localePath(locale, "/kvk/feedback") : null;
  return (
    <div className="space-y-5">
      {feedbackHref && <KvkTabs locale={locale} dict={dict} current="plan" />}
      <BattlePlan plan={safePlan} heroes={heroes} alliances={alliances} dict={dict} locale={locale} feedbackHref={feedbackHref} />
    </div>
  );
}

export function KvkGateSkeleton() {
  return (
    <div className="mx-auto max-w-md animate-pulse space-y-4" aria-hidden>
      <div className="card h-72 bg-card-soft" />
    </div>
  );
}
