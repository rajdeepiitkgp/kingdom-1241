import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { EventList } from "@/components/events/EventList";
import { PageHeader } from "@/components/ui/SectionTitle";
import { getEvents } from "@/lib/data";
import { eventView } from "@/lib/events/view";
import { getDictionary } from "@/lib/i18n/get-dictionary";

/** The interface strings this page and its components use; tests/architecture/page-strings.test.ts keeps the list right. */
const PAGE_STRINGS = ["common", "events", "time"];

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await rootLocale(), PAGE_STRINGS);
  return { title: dict["events.title"] };
}

export default async function EventsPage() {
  const locale = await rootLocale();
  const [dict, events] = await Promise.all([getDictionary(locale, PAGE_STRINGS), getEvents()]);

  return (
    <div>
      <PageHeader icon="📅" title={dict["events.title"]} subtitle={dict["events.subtitle"]} />
      <EventList events={events.map((event) => eventView(event, locale))} dict={dict} locale={locale} />
    </div>
  );
}
