// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { JoinRoomForm } from "@/components/rally-sync/JoinRoomForm";
import { CreateRoomLink, RecentRooms } from "@/components/rally-sync/RecentRooms";
import { PageHeader } from "@/components/ui/SectionTitle";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await rootLocale());
  return { title: dict["sync.title"] };
}

/**
 * Rally Sync: join a room with its ID + password (or open an invite link,
 * which leads straight to the room). Rooms are created by moderators in the
 * admin area. Static shell; the rooms this device opened come from localStorage.
 */
export default async function RallySyncPage() {
  const locale = await rootLocale();
  const dict = await getDictionary(locale);

  return (
    <div>
      <PageHeader icon="⏱️" title={dict["sync.title"]} subtitle={dict["sync.subtitle"]} />
      <div className="mx-auto max-w-3xl space-y-5">
        <section className="card-soft space-y-2 p-5 text-sm text-ink-muted md:p-6">
          <p className="font-bold text-ink">{dict["sync.how.title"]}</p>
          <ol className="list-decimal space-y-1 ps-5">
            <li>{dict["sync.how.1"]}</li>
            <li>{dict["sync.how.2"]}</li>
            <li>{dict["sync.how.3"]}</li>
          </ol>
        </section>
        <JoinRoomForm dict={dict} locale={locale} />
        <RecentRooms dict={dict} locale={locale} />
        <CreateRoomLink dict={dict} locale={locale} />
      </div>
    </div>
  );
}
