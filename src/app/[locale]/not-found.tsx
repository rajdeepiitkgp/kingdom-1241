import Link from "next/link";
import { locale as rootLocale } from "next/root-params";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { localePath } from "@/lib/i18n/paths";

/** The interface strings this page and its components use; tests/architecture/page-strings.test.ts keeps the list right. */
const PAGE_STRINGS = ["notFound"];

export default async function NotFound() {
  const locale = (await rootLocale()) ?? "en";
  const dict = await getDictionary(locale, PAGE_STRINGS);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-7xl" aria-hidden>
        🗺️
      </p>
      <h1 className="mt-4 text-3xl font-black text-ink">{dict["notFound.title"]}</h1>
      <p className="mt-2 font-semibold text-ink-muted">{dict["notFound.body"]}</p>
      <Link href={localePath(locale, "/")} className="btn-primary mt-6">
        {dict["notFound.home"]}
      </Link>
    </div>
  );
}
