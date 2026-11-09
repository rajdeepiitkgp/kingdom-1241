// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { RoomGate, RoomGateSkeleton } from "@/components/rally-sync/RoomGate";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { getDictionary } from "@/lib/i18n/get-dictionary";

/** Room codes are random, so none exist at build time; the placeholder only lets the build check the route (it shows "no such room"). */
/** The interface strings this page and its components use; tests/architecture/page-strings.test.ts keeps the list right. */
const PAGE_STRINGS = ["common", "kvk", "sync", "tour.*", "tour.counter", "tour.gar", "tour.sync"];

export function generateStaticParams() {
  return [{ code: "_" }];
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await rootLocale(), PAGE_STRINGS);
  return { title: dict["sync.title"] };
}

/**
 * One Rally Sync room. No page header on purpose: during a rally the page
 * should show the start time and little else. The gate reads the room and the
 * visitor's cookie at request time.
 */
export default async function RallyRoomPage({ params }: PageProps<"/[locale]/tools/rally-sync/[code]">) {
  const locale = await rootLocale();
  const dict = await getDictionary(locale, PAGE_STRINGS);

  return (
    <Suspense fallback={<RoomGateSkeleton />}>
      <RoomFromParams params={params} dict={dict} locale={locale} />
    </Suspense>
  );
}

async function RoomFromParams({ params, dict, locale }: Pick<PageProps<"/[locale]/tools/rally-sync/[code]">, "params"> & { dict: Dictionary; locale: string }) {
  const { code } = await params;
  return <RoomGate code={code} dict={dict} locale={locale} />;
}
