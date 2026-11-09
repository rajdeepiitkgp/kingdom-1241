// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import clsx from "clsx";
import { Crown, Eraser, MessageCircle, Pin, PinOff, SendHorizontal, X } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { coordinate, sendMessage } from "@/lib/rally-sync/actions";
import { CHAT_BODY_MAX, type MessageView, parseMessageBody } from "@/lib/rally-sync/room-chat";
import { type RoomChatSync, useRunner } from "./hooks";
import { shown } from "./LeaderCards";
import { ErrorLine } from "./LeaderForm";

/**
 * The room chat, like a messenger: a floating button in the corner (above the
 * bottom bar on a phone) with the count of new messages, which opens a docked
 * window on a laptop and a sheet from the bottom on a phone, with the messages,
 * who sent them and when, a field to write, and for the coordinator a two-tap
 * Clear and a Pin per message (the pinned one stays on top of the chat and
 * under the room's status line). Plain text in the language it was written in: no translation here,
 * the browser's own page translation may do it (the texts are ordinary nodes).
 * Nothing of it sits in the leaders' line of sight: the button is small and
 * the window is theirs to open.
 */
export function RoomChat({
  code,
  chat,
  open,
  onToggle,
  canWrite,
  coordinatorToken,
  unread,
  dict,
}: {
  code: string;
  chat: RoomChatSync;
  open: boolean;
  onToggle: (open: boolean) => void;
  /** This browser is an instance of the room (a cookie from before instances can only read). */
  canWrite: boolean;
  coordinatorToken: string | null;
  /** Messages from others since the chat was last looked at (0 while open). */
  unread: number;
  dict: Dictionary;
}) {
  const { pending, run, errorFor, fail } = useRunner(chat.refresh);
  const [confirmClear, setConfirmClear] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const field = useRef<HTMLInputElement>(null);

  // The newest message in view whenever the list changes while open (a DOM scroll, no state).
  const count = chat.messages.length;
  useEffect(() => {
    if (open && list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [open, count]);

  // Opening on a laptop puts the cursor in the field; on a phone that would raise the keyboard over the messages.
  useEffect(() => {
    if (open && window.matchMedia("(min-width: 64rem)").matches) field.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onToggle(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onToggle]);

  if (chat.status === "unavailable") return null;
  const title = dict["sync.chat.title"];
  const newLabel = unread > 0 ? format(dict["sync.chat.new"], { n: unread }) : null;

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = parseMessageBody(new FormData(form).get("body"));
    if (!body) return fail("send", "invalid");
    if (await run("send", () => sendMessage(code, body, coordinatorToken ?? undefined))) {
      form.reset();
      field.current?.focus();
    }
  }

  async function clear() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    if (!coordinatorToken) return;
    await run("clear", () => coordinate(code, coordinatorToken, { type: "chatClear" }));
    setConfirmClear(false);
  }

  function pin(messageId: number | null) {
    if (!coordinatorToken) return;
    void run("pin", () => coordinate(code, coordinatorToken, messageId === null ? { type: "chatPin" } : { type: "chatPin", messageId }));
  }
  const pinned = chat.pinned;
  const authorOf = (message: { author: string | null; tag: string }) => message.author ?? format(dict["sync.instances.watcher"], { tag: message.tag });

  if (!open) {
    return (
      <button
        type="button"
        className="fixed inset-e-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-ink shadow-lift lg:inset-e-6 lg:bottom-6 lg:h-12 lg:w-auto lg:gap-2 lg:px-5 print:hidden"
        aria-label={newLabel ? `${title} · ${newLabel}` : title}
        title={title}
        onClick={() => onToggle(true)}
        data-tour="sync-chat"
      >
        <MessageCircle className="size-6 lg:size-5" aria-hidden />
        <span className="hidden text-base font-extrabold lg:inline">{title}</span>
        {unread > 0 && (
          <span
            className="absolute -inset-e-1 -top-1 min-w-5.5 rounded-full bg-danger px-1.5 text-center text-xs/5.5 font-black text-primary-ink tabular lg:static lg:ms-1"
            aria-hidden
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
    );
  }

  const sendError = errorFor("send");

  return (
    <div className="fixed inset-0 z-50 lg:pointer-events-none lg:inset-auto lg:inset-e-6 lg:bottom-6 print:hidden">
      {/* A phone's sheet dims the page behind it; a tap there closes the chat. A laptop's window leaves the page alone. */}
      <button type="button" className="absolute inset-0 bg-ink/40 lg:hidden" aria-label={dict["sync.chat.close"]} onClick={() => onToggle(false)} />
      <section
        role="dialog"
        aria-labelledby="sync-chat-title"
        className="card pointer-events-auto absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-b-none lg:static lg:h-[min(70vh,34rem)] lg:w-96 lg:rounded-card lg:shadow-lift"
      >
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <MessageCircle className="size-5 shrink-0 text-primary" aria-hidden />
          <h2 id="sync-chat-title" className="min-w-0 flex-1 text-base font-extrabold text-ink">
            {title}
          </h2>
          <button type="button" className="grid size-9 shrink-0 place-items-center rounded-xl text-ink-muted hover:bg-card-soft hover:text-ink" aria-label={dict["sync.chat.close"]} title={dict["sync.chat.close"]} onClick={() => onToggle(false)}>
            <X className="size-5" aria-hidden />
          </button>
        </header>

        {pinned && (
          <div className="flex items-start gap-2 border-b border-gold-strong/40 bg-gold-soft px-4 py-2 text-sm text-gold-ink" data-tour="sync-pinned">
            <Pin className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="min-w-0 flex-1 wrap-break-word" dir="auto">
              <span className="font-bold">{authorOf(pinned)}: </span>
              <span className="line-clamp-3 whitespace-pre-line">{pinned.body}</span>
            </p>
            {coordinatorToken && (
              <button type="button" className="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-card/60" aria-label={dict["sync.chat.unpin"]} title={dict["sync.chat.unpin"]} disabled={pending !== null} onClick={() => pin(null)}>
                <PinOff className="size-4" aria-hidden />
              </button>
            )}
          </div>
        )}
        <ol ref={list} className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-3" aria-live="polite">
          {chat.status === "loading" && count === 0 ? (
            <li className="py-8 text-center text-sm text-ink-faint">…</li>
          ) : count === 0 ? (
            <li className="py-8 text-center text-sm text-ink-muted">{dict["sync.chat.empty"]}</li>
          ) : (
            chat.messages.map((message) => (
              <li key={message.id} className={clsx("rounded-xl px-3 py-2", message.pinned ? "bg-gold-soft" : message.mine ? "bg-primary-soft" : "bg-card-soft")}>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-ink-muted">
                  <span className="wrap-break-word text-ink" dir="auto">
                    {authorOf(message)}
                  </span>
                  {message.mine && <span className="chip bg-primary text-primary-ink">{dict["sync.you"]}</span>}
                  {message.coordinator && (
                    <span className="chip inline-flex items-center gap-1 bg-gold-soft text-gold-ink">
                      <Crown className="size-3" aria-hidden />
                      {dict["sync.coord.title"]}
                    </span>
                  )}
                  {message.pinned && !coordinatorToken && <Pin className="size-3.5 text-gold-ink" aria-label={dict["sync.chat.pinned"]} />}
                  <time className="ms-auto tabular" dir="ltr" dateTime={message.at}>
                    {shown(Date.parse(message.at)).slice(0, 5)}
                  </time>
                  {coordinatorToken && (
                    <button
                      type="button"
                      className="-my-1 -me-1 grid size-7 place-items-center rounded-lg text-ink-faint hover:bg-card hover:text-ink"
                      aria-label={message.pinned ? dict["sync.chat.unpin"] : dict["sync.chat.pin"]}
                      title={message.pinned ? dict["sync.chat.unpin"] : dict["sync.chat.pin"]}
                      disabled={pending !== null}
                      onClick={() => pin(message.pinned ? null : message.id)}
                    >
                      {message.pinned ? <PinOff className="size-3.5" aria-hidden /> : <Pin className="size-3.5" aria-hidden />}
                    </button>
                  )}
                </p>
                <p className="mt-0.5 text-sm wrap-break-word whitespace-pre-line text-ink" dir="auto">
                  {message.body}
                </p>
              </li>
            ))
          )}
        </ol>

        <div className="border-t border-line px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:pb-3">
          {canWrite && (
            <form onSubmit={(event) => void send(event)} className="flex gap-2" noValidate>
              <label htmlFor="sync-chat-body" className="sr-only">
                {dict["sync.chat.placeholder"]}
              </label>
              <input
                ref={field}
                id="sync-chat-body"
                name="body"
                className="input min-w-0 flex-1"
                placeholder={dict["sync.chat.placeholder"]}
                maxLength={CHAT_BODY_MAX}
                autoComplete="off"
                enterKeyHint="send"
                dir="auto"
              />
              <button type="submit" className="btn-primary shrink-0" disabled={pending === "send"} aria-label={dict["sync.chat.send"]} title={dict["sync.chat.send"]}>
                <SendHorizontal className="size-4 rtl:rotate-180" aria-hidden />
              </button>
            </form>
          )}
          {sendError &&
            (sendError === "throttled" ? (
              <p role="alert" className="mt-2 rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">
                {dict["sync.chat.tooFast"]}
              </p>
            ) : (
              <ErrorLine dict={dict} error={sendError} />
            ))}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="min-w-0 flex-1 basis-48 text-xs text-ink-faint">{dict["sync.chat.hint"]}</p>
            {coordinatorToken && count > 0 && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
                <button type="button" className={clsx("btn-sm", confirmClear ? "btn-primary bg-danger" : "btn-ghost text-danger")} onClick={() => void clear()} disabled={pending !== null}>
                  <Eraser className="size-4" aria-hidden />
                  {confirmClear ? dict["sync.chat.clearConfirm"] : dict["sync.chat.clear"]}
                </button>
                {confirmClear && (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirmClear(false)}>
                    {dict["sync.cancel"]}
                  </button>
                )}
              </div>
            )}
          </div>
          {errorFor("clear") && <ErrorLine dict={dict} error={errorFor("clear") ?? "failed"} />}
          {errorFor("pin") && <ErrorLine dict={dict} error={errorFor("pin") ?? "failed"} />}
        </div>
      </section>
    </div>
  );
}

/**
 * The coordinator's pinned message as one slim line under the room's status
 * line (every mode), a tap away from the chat: the one thing of the chat that
 * sits in everyone's line of sight, because the coordinator put it there.
 */
export function PinnedLine({ pinned, dict, onOpen }: { pinned: MessageView | null; dict: Dictionary; onOpen: () => void }) {
  if (!pinned) return null;
  return (
    <button type="button" className="flex w-full items-start gap-2 rounded-card border border-gold-strong/40 bg-gold-soft px-4 py-2 text-start text-sm text-gold-ink" onClick={onOpen} data-tour="sync-pinned-line">
      <Pin className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 wrap-break-word" dir="auto">
        <span className="font-bold">{pinned.author ?? format(dict["sync.instances.watcher"], { tag: pinned.tag })}: </span>
        <span className="line-clamp-2 whitespace-pre-line">{pinned.body}</span>
      </span>
    </button>
  );
}
