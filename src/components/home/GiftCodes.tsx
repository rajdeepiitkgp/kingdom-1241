"use client";

import { Check, Copy, Gift } from "lucide-react";
import { useEffect, useState } from "react";
import type { GiftCode } from "@/lib/data/types";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { pick } from "@/lib/i18n/localized";
import { useNow } from "../time/useNow";

export function GiftCodes({ codes, dict, locale }: { codes: GiftCode[]; dict: Dictionary; locale: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(null), 1800);
    return () => window.clearTimeout(id);
  }, [copied]);

  // Expired codes are dropped by the data layer when the page is built; this
  // re-checks on the client so a code that expires while the page is open disappears.
  const now = useNow(60_000);
  const active = codes.filter((c) => c.active && (!c.expiresAt || !now || Date.parse(c.expiresAt) > now.getTime()));

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
    } catch {
      // Clipboard blocked — the code is still visible to copy manually.
    }
  }

  return (
    <div className="card p-5">
      <p className="mb-3 flex items-start gap-2 text-sm font-semibold text-ink-muted">
        <Gift className="mt-0.5 size-4 shrink-0 text-gold-strong" aria-hidden />
        {dict["home.giftCodesHint"]}
      </p>
      {active.length === 0 ? (
        <p className="text-sm font-semibold text-ink-muted">{dict["home.noGiftCodes"]}</p>
      ) : (
        <ul className="grid gap-2">
          {active.map((code) => (
            <li
              key={code.id}
              className="grid grid-flow-dense grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 rounded-2xl bg-card-soft px-4 py-3 sm:grid-cols-[auto_1fr_auto]"
            >
              <code className="justify-self-start rounded-lg bg-gold-soft px-3 py-1.5 text-base font-black tracking-wider text-gold-ink" dir="ltr">
                {code.code}
              </code>
              <div className="col-span-2 min-w-0 text-sm sm:col-span-1">
                <p className="text-ink" dir="auto">{pick(code.rewards, locale)}</p>
                <p className="text-xs font-semibold text-ink-faint">
                  {code.expiresAt
                    ? `${dict["home.expires"]}: ${new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(code.expiresAt))}`
                    : dict["home.noExpiry"]}
                </p>
              </div>
              <button type="button" className="btn-gold btn-sm justify-self-end" onClick={() => copy(code.code)}>
                {copied === code.code ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {copied === code.code ? dict["common.copied"] : dict["common.copy"]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
