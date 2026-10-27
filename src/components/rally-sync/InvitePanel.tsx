"use client";

import { Check, Copy, Eye, Share2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { coordinate } from "@/lib/rally-sync/actions";
import { coordinatorLinkPath, inviteLinkPath, updateDeviceRoom } from "@/lib/rally-sync/device";
import { formatRoomCode, PASSWORD_MAX, PASSWORD_MIN, parsePassword } from "@/lib/rally-sync/room";
import { useDevice, useRunner } from "./hooks";
import { ErrorLine } from "./LeaderForm";

/**
 * The two ways in, as in Zoom: the invite link (opens the room directly; its
 * key is in the #fragment) or the room ID + password. The coordinator link
 * adds this device's coordinator token, for a second coordinator. Links use
 * the page's own origin, so they work on any domain.
 */
export function InvitePanel({ code, token, dict }: { code: string; token: string; dict: Dictionary }) {
  const device = useDevice();
  const mine = device.rooms[code];
  const { pending, run, errorFor, fail } = useRunner(() => undefined);
  const [showPassword, setShowPassword] = useState(false);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const invite = mine?.invite ?? null;

  async function loadInvite() {
    const result = await run("invite", () => coordinate(code, token, { type: "invite" }));
    if (result?.inviteKey) updateDeviceRoom(code, (room) => ({ ...room, invite: result.inviteKey }));
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const password = parsePassword(new FormData(form).get("password"));
    if (!password.ok) return fail("password", "invalid");
    const result = await run("password", () => coordinate(code, token, { type: "password", password: password.value }));
    if (result?.inviteKey) {
      updateDeviceRoom(code, (room) => ({ ...room, invite: result.inviteKey, password: password.value }));
      form.reset();
    }
  }

  const passwordLine = mine?.password ? (showPassword ? mine.password : "•".repeat(Math.min(12, mine.password.length))) : null;
  const inviteText = mine?.password
    ? format(dict["sync.invite.text"], { code: formatRoomCode(code), password: mine.password, url: `${origin}/tools/rally-sync` })
    : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="label">{dict["sync.roomId"]}</p>
          <div className="flex items-center gap-2">
            <p className="input flex-1 font-black" dir="ltr">
              {formatRoomCode(code)}
            </p>
            <CopyButton text={code} dict={dict} />
          </div>
        </div>
        <div className="min-w-0">
          <p className="label">{dict["kvk.password"]}</p>
          {passwordLine ? (
            <div className="flex items-center gap-2">
              <p className="input flex-1 break-all" dir="ltr">
                {passwordLine}
              </p>
              <button type="button" className="btn-ghost btn-sm shrink-0" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword} aria-label={dict["sync.invite.show"]}>
                <Eye className="size-4" aria-hidden />
              </button>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">{dict["sync.invite.passwordUnknown"]}</p>
          )}
        </div>
      </div>
      {inviteText && (
        <div className="flex flex-wrap gap-2">
          <CopyButton text={inviteText} dict={dict} label={dict["sync.invite.copyText"]} />
        </div>
      )}

      <div>
        <p className="label">{dict["sync.invite.link"]}</p>
        <p className="mb-2 text-xs text-ink-faint">{dict["sync.invite.linkHint"]}</p>
        {invite ? (
          <LinkRow url={`${origin}${inviteLinkPath(code, invite)}`} dict={dict} share />
        ) : (
          <button type="button" className="btn-ghost btn-sm" onClick={() => void loadInvite()} disabled={pending !== null}>
            {dict["sync.invite.makeLink"]}
          </button>
        )}
        {errorFor("invite") && <ErrorLine dict={dict} error="failed" />}
      </div>

      {invite && (
        <div>
          <p className="label">{dict["sync.invite.coordLink"]}</p>
          <p className="mb-2 text-xs font-bold text-danger">{dict["sync.invite.coordLinkHint"]}</p>
          <LinkRow url={`${origin}${coordinatorLinkPath(code, invite, token)}`} dict={dict} />
        </div>
      )}

      <form onSubmit={changePassword} className="border-t border-line pt-4">
        <label htmlFor="sync-new-password" className="label">
          {dict["sync.invite.newPassword"]}
        </label>
        <p className="mb-2 text-xs text-ink-faint">{dict["sync.invite.newPasswordHint"]}</p>
        <div className="flex gap-2">
          <input id="sync-new-password" name="password" className="input" minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} autoComplete="off" dir="ltr" />
          <button type="submit" className="btn-primary shrink-0" disabled={pending !== null}>
            {dict["sync.invite.change"]}
          </button>
        </div>
        {errorFor("password") && <ErrorLine dict={dict} error={errorFor("password") ?? "failed"} invalidText={format(dict["sync.error.password"], { min: PASSWORD_MIN })} />}
      </form>
    </div>
  );
}

function LinkRow({ url, dict, share }: { url: string; dict: Dictionary; share?: boolean }) {
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="input min-w-0 flex-1 basis-56 text-sm break-all" dir="ltr">
        {url}
      </p>
      <CopyButton text={url} dict={dict} />
      {share && canShare && (
        <button type="button" className="btn-ghost btn-sm" onClick={() => void navigator.share({ url }).catch(() => undefined)}>
          <Share2 className="size-4" aria-hidden />
          {dict["sync.invite.share"]}
        </button>
      )}
    </div>
  );
}

function CopyButton({ text, dict, label }: { text: string; dict: Dictionary; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the text is on screen to copy by hand.
    }
  }
  return (
    <button type="button" className="btn-ghost btn-sm shrink-0" onClick={() => void copy()}>
      {copied ? <Check className="size-4 text-success" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {copied ? dict["common.copied"] : (label ?? dict["common.copy"])}
    </button>
  );
}
