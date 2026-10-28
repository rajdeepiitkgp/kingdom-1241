// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { RallySyncAdmin } from "@/components/admin/RallySyncAdmin";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { listRallyRooms } from "@/lib/admin/rally-sync-data";
import { requireEditor } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Rally Sync" };

export default async function AdminRallySyncPage() {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <RoomList locale={locale} />
    </Suspense>
  );
}

async function RoomList({ locale }: { locale: string }) {
  const user = await requireEditor(locale);
  if (!user) return null;
  const { available, rooms, capacity } = await listRallyRooms();

  return (
    <div className="space-y-5">
      <SectionTitle icon="⏱️" title="Rally Sync rooms" />
      <p className="text-sm font-semibold text-ink-muted">
        Create a room for each group of rally leaders (how many of each kind can be open at once is shown under Rooms; the owner sets it). Share the invite
        link, or the room ID with its password; whoever has the coordinator link sets the hit time. A room closes by itself after 30 minutes with nobody on the
        page, and 24 hours after it was created at the latest.
      </p>
      {available ? (
        <RallySyncAdmin rooms={rooms} capacity={capacity} locale={locale} />
      ) : (
        <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">Rally Sync needs the database (migration 0012) and could not read it.</p>
      )}
    </div>
  );
}
