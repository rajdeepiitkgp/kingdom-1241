import { cookies } from "next/headers";
import { getActiveKvkPlan, getAlliances, getHeroes } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { isValidKvkToken, KVK_COOKIE } from "@/lib/kvk/access";
import { BattlePlan } from "./BattlePlan";
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

  const [heroes, alliances] = await Promise.all([getHeroes(), getAlliances()]);
  const { password: _password, ...safePlan } = plan;
  void _password;
  return <BattlePlan plan={safePlan} heroes={heroes} alliances={alliances} dict={dict} locale={locale} />;
}

export function KvkGateSkeleton() {
  return (
    <div className="mx-auto max-w-md animate-pulse space-y-4" aria-hidden>
      <div className="card h-72 bg-card-soft" />
    </div>
  );
}
