import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Keeps edit forms on screen after a save. React resets a form after its
 * action to the values the page was drawn with, and Chromium leaves a
 * dropdown on its old value: Cockpit → Users showed the old role next to
 * "Role updated." until a reload (fixed in #64). A form whose dropdown starts
 * at a stored value (`defaultValue={…}`) must submit through an onSubmit
 * (`useSubmitInTransition`, or `useEditorForm`'s `submit`); a form for adding
 * rows passes `row ? submit : undefined`, which counts, and so does a `key` on
 * the form that changes with its data (it is drawn anew with the new
 * defaults, as Rally Sync's "New room" is after each room).
 */

const SRC = resolve(__dirname, "../../src");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

/** The forms in a component's source that have an action, a dropdown with a stored default and no onSubmit. */
export function formsThatResetDropdowns(source: string): string[] {
  const problems: string[] = [];
  let from = 0;
  for (;;) {
    const start = source.indexOf("<form", from);
    if (start === -1) break;
    const tagEnd = source.indexOf(">", start);
    const end = source.indexOf("</form>", tagEnd);
    from = end === -1 ? tagEnd + 1 : end;
    const tag = source.slice(start, tagEnd + 1);
    const body = source.slice(tagEnd + 1, end === -1 ? undefined : end);
    if (!/\baction=\{/.test(tag) || /\b(onSubmit|key)=/.test(tag)) continue;
    // A select whose default comes from data; a fixed default ("moderator") is fine for an add form.
    const storedDropdown = [...body.matchAll(/<select\b[^>]*>/g)].some((match) => /\bdefaultValue=\{/.test(match[0]));
    if (storedDropdown) problems.push(tag.replace(/\s+/g, " ").slice(0, 80));
  }
  return problems;
}

describe("forms that edit stored values", () => {
  it("submit in a transition, so a saved dropdown doesn't snap back", () => {
    const offenders = tsxFiles(SRC).flatMap((file) =>
      formsThatResetDropdowns(readFileSync(file, "utf8")).map((tag) => `${relative(SRC, file)}: ${tag}`),
    );
    expect(offenders).toEqual([]);
  });

  it("recognises the pattern (so a green run means something)", () => {
    const broken = `<form action={action} className="x"><select name="role" defaultValue={role}></select></form>`;
    expect(formsThatResetDropdowns(broken)).toHaveLength(1);
    expect(formsThatResetDropdowns(broken.replace("<form action={action}", "<form action={action} onSubmit={submit}"))).toEqual([]);
    expect(formsThatResetDropdowns(broken.replace("<form action={action}", "<form action={action} onSubmit={rule ? submit : undefined}"))).toEqual([]);
    expect(formsThatResetDropdowns(broken.replace("<form action={action}", "<form action={action} key={version}"))).toEqual([]);
    expect(formsThatResetDropdowns(`<form action={action}><select defaultValue="moderator"></select></form>`)).toEqual([]);
  });
});
