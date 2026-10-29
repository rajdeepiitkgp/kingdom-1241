// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { rememberAlliance } from "./alliance-memory";

/** A guide link on an alliance page: the guide then opens on this alliance's tab. */
export function AllianceGuideLink({ href, tag, className, children }: { href: string; tag: string; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={className} onClick={() => rememberAlliance(tag)}>
      {children}
    </Link>
  );
}
