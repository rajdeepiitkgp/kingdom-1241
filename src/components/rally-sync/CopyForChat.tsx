"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionary";

/** Copies a summary for the game chat (chat.ts); if the browser blocks the clipboard, the text appears to copy by hand. */
export function CopyForChat({ text, label, dict }: { text: string; /** Defaults to "Copy for game chat". */ label?: string; dict: Dictionary }) {
  const [copied, setCopied] = useState(false);
  const [blocked, setBlocked] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setBlocked(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setBlocked(true);
    }
  }
  return (
    <>
      <button type="button" className="btn-ghost btn-sm" onClick={() => void copy()}>
        {copied ? <Check className="size-4 text-success" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied ? dict["common.copied"] : (label ?? dict["sync.copyChat"])}
      </button>
      {blocked && (
        <div className="w-full">
          <p className="text-xs font-bold text-ink-muted">{dict["sync.copyByHand"]}</p>
          <p className="mt-1 rounded-lg bg-card px-3 py-2 text-sm whitespace-pre-line text-ink select-all" dir="auto">
            {text}
          </p>
        </div>
      )}
    </>
  );
}
