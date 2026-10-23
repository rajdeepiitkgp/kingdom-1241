"use client";

import { RotateCcw } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Error boundary for every page under /[locale]. Error boundaries can't read
 * the server-side dictionary, so the few words here are inlined. The digest
 * matches the `digest` Next prints in the server log, so a player's screenshot
 * can be traced.
 */
const TEXT: Record<string, { title: string; body: string; retry: string; ref: string }> = {
  en: { title: "Something went wrong", body: "Please try again. If it keeps happening, tell an admin on Discord and include the reference code.", retry: "Try again", ref: "Reference" },
  de: { title: "Etwas ist schiefgelaufen", body: "Bitte versuch es noch einmal. Wenn es weiterhin passiert, sag einem Admin auf Discord Bescheid und nenne den Referenzcode.", retry: "Erneut versuchen", ref: "Referenz" },
  ko: { title: "문제가 발생했습니다", body: "다시 시도해 주세요. 계속되면 디스코드에서 관리자에게 참조 코드와 함께 알려주세요.", retry: "다시 시도", ref: "참조 코드" },
  pl: { title: "Coś poszło nie tak", body: "Spróbuj ponownie. Jeśli problem się powtarza, napisz do admina na Discordzie i podaj kod referencyjny.", retry: "Spróbuj ponownie", ref: "Kod" },
  ar: { title: "حدث خطأ ما", body: "يرجى المحاولة مرة أخرى. إذا استمرت المشكلة، أخبر أحد المشرفين على ديسكورد مع ذكر رمز المرجع.", retry: "حاول مرة أخرى", ref: "المرجع" },
};

export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ locale?: string }>();
  const t = TEXT[params?.locale ?? "en"] ?? TEXT.en;

  useEffect(() => {
    // Client-side trace; the server already logged the failure with the same digest.
    console.error("[page] render error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-6xl" aria-hidden>
        ⚠️
      </p>
      <h1 className="mt-4 text-2xl font-black text-ink">{t.title}</h1>
      <p className="mt-2 font-semibold text-ink-muted">{t.body}</p>
      {error.digest && (
        <p className="mt-3 text-xs font-bold text-ink-faint">
          {t.ref}: <code className="rounded-md bg-card-soft px-1.5 py-0.5 text-ink" dir="ltr">{error.digest}</code>
        </p>
      )}
      <button type="button" onClick={reset} className="btn-primary mt-6">
        <RotateCcw className="size-4" aria-hidden />
        {t.retry}
      </button>
    </div>
  );
}
