import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { ItemIcon } from "@/components/kvk/ItemIcon";
import { PrepBoard } from "@/components/kvk/PrepBoard";
import { KVK_EVENT_IMAGE } from "@/components/kvk/prep-labels";
import { PageGuide } from "@/components/tour/PageGuide";
import { PageHeader } from "@/components/ui/SectionTitle";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { KVK_TOURS } from "@/lib/kvk/tours";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await rootLocale());
  return { title: dict["prep.title"] };
}

/**
 * Public KvK prep week (no password: every player should know it). Fully
 * static: the schedule and the table live in `src/lib/kvk/prep.ts`, and the
 * client picks today and fills in the countdown.
 */
export default async function PrepPage() {
  const locale = await rootLocale();
  const dict = await getDictionary(locale);

  return (
    <div>
      <PageHeader icon={<ItemIcon image={KVK_EVENT_IMAGE} emoji="📅" className="size-10" />} title={dict["prep.title"]} subtitle={dict["prep.subtitle"]} guide={<PageGuide tour={KVK_TOURS.prep} dict={dict} />} />
      <PrepBoard dict={dict} locale={locale} />
    </div>
  );
}
