import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { EventList } from "@/components/events/EventList";
import { PageHeader } from "@/components/ui/SectionTitle";
import { getEvents } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await rootLocale());
  return { title: dict["events.title"] };
}

export default async function EventsPage() {
  const locale = await rootLocale();
  const [dict, events] = await Promise.all([getDictionary(locale), getEvents()]);

  return (
    <div>
      <PageHeader icon="📅" title={dict["events.title"]} subtitle={dict["events.subtitle"]} />
      <EventList events={events} dict={dict} locale={locale} />
    </div>
  );
}
