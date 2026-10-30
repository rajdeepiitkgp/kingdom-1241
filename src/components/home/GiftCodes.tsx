"use client";

import { Check, Copy, ExternalLink, Gift } from "lucide-react";
import { useEffect, useState } from "react";
import { KINGSHOT_GIFT_CODES_PAGE, KINGSHOT_SITE, OFFICIAL_REDEEM_PAGE } from "@/lib/gift-codes/kingshot";
import type { GiftCodeView } from "@/lib/gift-codes/view";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { useNow } from "../time/useNow";

export function GiftCodes({ codes, dict, locale }: { codes: GiftCodeView[]; dict: Dictionary; locale: string }) {
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

  // The site's name is a link, so the sentence is split around it (word order differs per language).
  const [before, after = ""] = dict["home.giftCodesSource"].split("{site}");

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
        <ul className="grid grid-cols-1 gap-2">
          {active.map((code) => (
            <li
              key={code.id}
              className="grid grid-flow-dense grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-2xl bg-card-soft px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
            >
              <code className="max-w-full min-w-0 justify-self-start rounded-lg bg-gold-soft px-3 py-1.5 text-sm font-black tracking-wider break-all text-gold-ink sm:text-base" dir="ltr">
                {code.code}
              </code>
              <div className="col-span-2 min-w-0 text-sm sm:col-span-1">
                {code.rewards && (
                  <p className="text-ink" dir="auto">
                    {code.rewards}
                  </p>
                )}
                <p className="text-xs font-semibold text-ink-faint" suppressHydrationWarning>
                  {code.expiresAt
                    ? // UTC on purpose: the server (UTC) and the visitor's browser must render the same day. A browser with older
                      // locale data may still spell the month differently, so the element keeps the server's text (suppressHydrationWarning).
                      `${dict["home.expires"]}: ${new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(code.expiresAt))}`
                    : dict["home.noExpiry"]}
                </p>
              </div>
              <button
                type="button"
                className="btn-gold btn-sm justify-self-end"
                onClick={() => copy(code.code)}
                aria-label={copied === code.code ? dict["common.copied"] : dict["common.copy"]}
                title={dict["common.copy"]}
              >
                {copied === code.code ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                <span className="hidden sm:inline">{copied === code.code ? dict["common.copied"] : dict["common.copy"]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line pt-3">
        <p className="min-w-0 text-xs font-semibold text-ink-faint">
          {before}
          <a href={KINGSHOT_GIFT_CODES_PAGE} target="_blank" rel="noopener noreferrer" className="font-bold text-ink-muted underline underline-offset-2 hover:text-ink" dir="ltr">
            {KINGSHOT_SITE}
          </a>
          {after}
        </p>
        <a href={OFFICIAL_REDEEM_PAGE} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
          {dict["home.giftCodesRedeem"]}
          <ExternalLink className="size-4 rtl:-scale-x-100" aria-hidden />
        </a>
      </div>
    </div>
  );
}
