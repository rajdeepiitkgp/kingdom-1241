// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import clsx from "clsx";
import { Bold, Heading2, ImagePlus, Italic, Link, List, ListOrdered, OctagonAlert, Quote, Table } from "lucide-react";
import { type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { SanitizedHtml } from "@/components/content/SanitizedHtml";
import { previewMarkdown, uploadContentImage } from "@/lib/admin/content-actions";
import { IMAGE_MAX_BYTES, IMAGE_MAX_HEIGHT, IMAGE_MAX_WIDTH, type ImageKind, IMAGES_PER_TEXT, imageUrls } from "@/lib/content/images";
import { imageMarkdown, insertBlock, insertLink, TABLE_TEMPLATE, type TextEdit, toggleDangerBox, toggleLinePrefix, toggleWrap } from "@/lib/content/markdown-edit";
import { canShrinkImages, ShrinkError, shrinkImage } from "@/lib/content/shrink";

/**
 * The content editor's text field: Markdown with formatting buttons, and a
 * Preview tab that shows the text through the same Markdown and sanitiser as
 * the live page (a Server Action renders it). The textarea stays the form's
 * field (uncontrolled, read through FormData), hidden while previewing. With
 * `images`, images can be added with the button, pasted or dropped: each is
 * shrunk in the browser (`shrinkImage`), uploaded, and written into the text
 * at the cursor; the button is missing where the browser can't shrink images.
 */

const never = () => () => {};

type Make = (text: string, selection: { start: number; end: number }) => TextEdit;

/** The formatting buttons, and Ctrl/Cmd + B, I and K. */
const TOOLS: Array<{ label: string; icon: ReactNode; make: Make }> = [
  { label: "Bold (Ctrl+B)", icon: <Bold aria-hidden className="size-4" />, make: (t, s) => toggleWrap(t, s, "**", "bold text") },
  { label: "Italics (Ctrl+I)", icon: <Italic aria-hidden className="size-4" />, make: (t, s) => toggleWrap(t, s, "*", "italic text") },
  { label: "Heading", icon: <Heading2 aria-hidden className="size-4" />, make: (t, s) => toggleLinePrefix(t, s, "## ") },
  { label: "List", icon: <List aria-hidden className="size-4" />, make: (t, s) => toggleLinePrefix(t, s, "- ") },
  { label: "Numbered list", icon: <ListOrdered aria-hidden className="size-4" />, make: (t, s) => toggleLinePrefix(t, s, "1. ") },
  { label: "Quote (gold box)", icon: <Quote aria-hidden className="size-4" />, make: (t, s) => toggleLinePrefix(t, s, "> ") },
  {
    label: "Danger (red box)",
    icon: <OctagonAlert aria-hidden className="size-4" />,
    make: (t, s) => toggleDangerBox(t, s, "Don't do this, or you will be burned."),
  },
  { label: "Link (Ctrl+K)", icon: <Link aria-hidden className="size-4" />, make: (t, s) => insertLink(t, s, "link text") },
  { label: "Table", icon: <Table aria-hidden className="size-4" />, make: (t, s) => insertBlock(t, s, TABLE_TEMPLATE, { start: 2, end: 8 }) },
];
const toolMake = (label: string) => TOOLS.find((tool) => tool.label.startsWith(label))!.make;
const SHORTCUTS: Record<string, Make> = { b: toolMake("Bold"), i: toolMake("Italics"), k: toolMake("Link") };

export function MarkdownEditor({
  id,
  name,
  defaultValue,
  images = null,
  locked = false,
  dir = "ltr",
  disabled = false,
  maxLength,
  className,
  ...aria
}: {
  id: string;
  name: string;
  defaultValue: string;
  /** Which text the images go into (it sets how many it may hold); null: no images. */
  images?: ImageKind | null;
  /** A password-locked page: says why there is no image button. */
  locked?: boolean;
  dir?: "ltr" | "auto";
  disabled?: boolean;
  maxLength?: number;
  /** Height of the writing area. */
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [preview, setPreview] = useState<{ html: string } | { error: string } | null>(null);
  const [previewing, startPreview] = useTransition();
  const [imageCount, setImageCount] = useState(() => imageUrls(defaultValue).length);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const [uploading, setUploading] = useState(false);
  const canUpload = useSyncExternalStore(never, canShrinkImages, () => false) && images !== null;
  const maxImages = images ? IMAGES_PER_TEXT[images] : 0;

  /** Applies a button's change as typing, so the browser's undo takes it back. */
  const apply = (edit: TextEdit) => {
    const field = textarea.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(edit.from, edit.to);
    let typed = false;
    try {
      typed = document.execCommand("insertText", false, edit.insert);
    } catch {
      typed = false;
    }
    if (!typed) field.setRangeText(edit.insert, edit.from, edit.to, "end");
    field.setSelectionRange(edit.select.start, edit.select.end);
    setImageCount(imageUrls(field.value).length);
  };

  const run = (make: Make) => {
    const field = textarea.current;
    if (!field || disabled) return;
    apply(make(field.value, { start: field.selectionStart, end: field.selectionEnd }));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    const make = SHORTCUTS[event.key.toLowerCase()];
    if (!make) return;
    event.preventDefault();
    run(make);
  };

  const showPreview = () => {
    setTab("preview");
    const markdown = textarea.current?.value ?? "";
    startPreview(async () => {
      try {
        setPreview(await previewMarkdown(markdown));
      } catch {
        setPreview({ error: "The preview couldn't be loaded. Check your connection and try again." });
      }
    });
  };

  const addImages = async (files: File[]) => {
    const field = textarea.current;
    if (!field || !images || uploading) return;
    const pictures = files.filter((file) => file.type.startsWith("image/"));
    if (pictures.length === 0) return;
    setUploading(true);
    try {
      for (const [index, file] of pictures.entries()) {
        const count = imageUrls(field.value).length;
        if (count >= maxImages) {
          setStatus({ text: `This text already has ${count} images, the most it can hold. Take one out to add another.`, error: true });
          return;
        }
        const of = pictures.length > 1 ? ` (${index + 1} of ${pictures.length})` : "";
        setStatus({ text: `Shrinking the image${of}…`, error: false });
        const shrunk = await shrinkImage(file);
        setStatus({ text: `Uploading the image${of}…`, error: false });
        const form = new FormData();
        form.set("file", new File([shrunk.blob], `image.${shrunk.type === "webp" ? "webp" : "jpg"}`, { type: shrunk.blob.type }));
        form.set("kind", images);
        const result = await uploadContentImage(form);
        if (result.status === "error") {
          setStatus({ text: result.message, error: true });
          return;
        }
        const { block, select } = imageMarkdown(result.url);
        apply(insertBlock(field.value, { start: field.selectionStart, end: field.selectionEnd }, block, select));
        setStatus({
          text: `Image added (${shrunk.width} × ${shrunk.height}, ${Math.round(shrunk.blob.size / 1024)} KB). Type what it shows in place of the selected words.`,
          error: false,
        });
      }
    } catch (error) {
      setStatus({ text: error instanceof ShrinkError ? error.message : "Adding the image failed. Check your connection and try again.", error: true });
    } finally {
      setUploading(false);
    }
  };

  const filesOf = (list: FileList | null | undefined) => (list ? Array.from(list).filter((file) => file.type.startsWith("image/")) : []);
  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = canUpload ? filesOf(event.clipboardData?.files) : [];
    if (files.length === 0) return; // plain text pastes as usual
    event.preventDefault();
    void addImages(files);
  };
  const onDragOver = (event: DragEvent<HTMLTextAreaElement>) => {
    if (canUpload && event.dataTransfer?.types.includes("Files")) event.preventDefault();
  };
  const onDrop = (event: DragEvent<HTMLTextAreaElement>) => {
    const files = canUpload ? filesOf(event.dataTransfer?.files) : [];
    if (files.length === 0) return;
    event.preventDefault();
    void addImages(files);
  };


  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line bg-card-soft px-2 py-1.5">
        <div role="tablist" aria-label="Write or preview" className="flex gap-1">
          {(["write", "preview"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              aria-controls={value === "write" ? id : `${id}-preview`}
              onClick={value === "write" ? () => setTab("write") : showPreview}
              className={clsx("rounded-lg px-3 py-1 text-sm font-extrabold", tab === value ? "bg-card text-ink shadow-sm" : "text-ink-muted hover:text-ink")}
            >
              {value === "write" ? "Write" : "Preview"}
            </button>
          ))}
        </div>
        {tab === "write" && !disabled && (
          <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5">
            {TOOLS.map((tool) => (
              <button
                key={tool.label}
                type="button"
                title={tool.label}
                aria-label={tool.label}
                onClick={() => run(tool.make)}
                className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-card hover:text-ink"
              >
                {tool.icon}
              </button>
            ))}
            {canUpload && (
              <>
                <button
                  type="button"
                  title={`Add an image (${imageCount} of ${maxImages})`}
                  aria-label={`Add an image, ${imageCount} of ${maxImages} used`}
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading}
                  data-tour="editor-image"
                  className="flex h-8 items-center gap-1 rounded-lg px-2 text-ink-muted hover:bg-card hover:text-ink disabled:opacity-50"
                >
                  <ImagePlus aria-hidden className="size-4" />
                  <span className="text-xs font-bold tabular-nums" dir="ltr">
                    {imageCount}/{maxImages}
                  </span>
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(event) => {
                    const files = filesOf(event.currentTarget.files);
                    event.currentTarget.value = "";
                    void addImages(files);
                  }}
                />
              </>
            )}
          </div>
        )}
      </div>

      <textarea
        ref={textarea}
        id={id}
        name={name}
        defaultValue={defaultValue}
        dir={dir}
        disabled={disabled}
        maxLength={maxLength}
        hidden={tab !== "write"}
        aria-invalid={aria["aria-invalid"]}
        aria-describedby={aria["aria-describedby"]}
        onKeyDown={onKeyDown}
        onInput={(event) => setImageCount(imageUrls(event.currentTarget.value).length)}
        onPaste={onPaste}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={clsx("block w-full resize-y bg-transparent px-3 py-2 font-mono text-sm text-ink outline-none", className ?? "min-h-56")}
      />
      {tab === "preview" && (
        <div id={`${id}-preview`} role="tabpanel" aria-busy={previewing} className={clsx("px-4 py-3", className ?? "min-h-56")}>
          {previewing || !preview ? (
            <p className="text-sm font-semibold text-ink-muted">Loading the preview…</p>
          ) : "error" in preview ? (
            <p className="text-sm font-bold text-danger">{preview.error}</p>
          ) : preview.html ? (
            <SanitizedHtml html={preview.html} />
          ) : (
            <p className="text-sm font-semibold text-ink-muted">Nothing to preview yet.</p>
          )}
        </div>
      )}
      {status && (
        <p role="status" className={clsx("border-t border-line px-3 py-2 text-xs font-bold", status.error ? "text-danger" : "text-ink-muted")}>
          {status.text}
        </p>
      )}
      {canUpload ? (
        <p className="border-t border-line bg-card-soft px-3 py-1.5 text-xs text-ink-faint">
          Images: up to {maxImages}. Any screenshot or photo works: it is shrunk to at most {IMAGE_MAX_WIDTH} × {IMAGE_MAX_HEIGHT} pixels and under{" "}
          {Math.round(IMAGE_MAX_BYTES / 1024)} KB before it uploads. Images from other sites aren&apos;t shown.
        </p>
      ) : (
        locked && (
          <p className="border-t border-line bg-card-soft px-3 py-1.5 text-xs text-ink-faint">
            No images on password-locked pages: images are stored where anyone with the link could open them.
          </p>
        )
      )}
    </div>
  );
}
