import { cookies } from "next/headers";
import { getActiveChecklistPlan } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { isValidAreaToken, KVK_AREA_COOKIES } from "@/lib/kvk/access";
import { ChecklistPlan } from "./ChecklistPlan";
import { UnlockCard } from "./UnlockCard";

/**
 * The commander checklist's gate: its own password and cookie, independent of
 * the battle plan's and the leaders' (request time → rendered inside
 * <Suspense>). The password is stripped before the page data reaches a component.
 */
export async function ChecklistGate({ dict, locale }: { dict: Dictionary; locale: string }) {
  const [plan, cookieStore] = await Promise.all([getActiveChecklistPlan(), cookies()]);

  if (!plan) {
    return (
      <p className="card mx-auto max-w-md px-5 py-8 text-center font-semibold text-ink-muted">
        <span className="mb-2 block text-4xl" aria-hidden>
          🎖️
        </span>
        {dict["checklist.noPlan"]}
      </p>
    );
  }

  if (!isValidAreaToken("checklist", cookieStore.get(KVK_AREA_COOKIES.checklist)?.value, plan.planId, plan.password)) {
    return <UnlockCard dict={dict} area="checklist" />;
  }

  const { password: _password, ...safePlan } = plan;
  void _password;
  return <ChecklistPlan plan={safePlan} dict={dict} locale={locale} />;
}
