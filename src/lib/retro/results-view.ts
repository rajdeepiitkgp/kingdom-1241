/**
 * How the admin results page and its print view are shown (pure, unit-tested):
 * which page of answers and how many per page, whether the owner hid the names
 * (for screenshots and printouts), and the print view's paper. All of it
 * travels in the URL (`?page=3&size=25&names=hidden&paper=dark`), so a delete
 * returns to the same view.
 */

export const PAGE_SIZES = [5, 15, 25] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 15;

export interface ResultsView {
  /** 1-based page of the answer list, before clamping to the pages that exist. */
  page: number;
  size: PageSize;
  /** The owner asked for names and Governor IDs to be left out. Means nothing for anyone else, who never gets them. */
  namesHidden: boolean;
  /** The print view on dark paper (a PDF to read on a screen) instead of white. */
  darkPaper: boolean;
}

type Query = Record<string, string | string[] | undefined> | FormData;

function single(query: Query, key: string): string | undefined {
  const value = query instanceof FormData ? query.get(key) : query[key];
  return typeof value === "string" ? value : undefined;
}

/** Reads the view from the page's search params or from a form's hidden fields; anything odd falls back to the default. */
export function parseResultsView(query: Query): ResultsView {
  const rawPage = single(query, "page") ?? "";
  const page = /^\d{1,4}$/.test(rawPage) ? Math.max(1, Number(rawPage)) : 1;
  const size = PAGE_SIZES.find((s) => String(s) === single(query, "size")) ?? DEFAULT_PAGE_SIZE;
  return { page, size, namesHidden: single(query, "names") === "hidden", darkPaper: single(query, "paper") === "dark" };
}

export interface PageWindow {
  page: number;
  pages: number;
  /** Index of the first answer on the page (into the newest-first list). */
  from: number;
  /** Index after the last one. */
  to: number;
}

/** The page that exists closest to the asked one (a deleted answer can leave the last page empty). */
export function pageWindow(page: number, total: number, size: number = DEFAULT_PAGE_SIZE): PageWindow {
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pages);
  const from = (current - 1) * size;
  return { page: current, pages, from, to: Math.min(total, from + size) };
}

/** The page of a new page size that still shows the answer at index `from`, so switching sizes doesn't jump back to the start. */
export function pageAfterResize(from: number, size: number): number {
  return Math.floor(Math.max(0, from) / size) + 1;
}

/** Query string for a view (no leading "?"), leaving defaults out so the plain URL stays plain. */
export function resultsQuery(view: Partial<ResultsView>): string {
  const params = new URLSearchParams();
  if (view.page && view.page > 1) params.set("page", String(view.page));
  if (view.size && view.size !== DEFAULT_PAGE_SIZE) params.set("size", String(view.size));
  if (view.namesHidden) params.set("names", "hidden");
  if (view.darkPaper) params.set("paper", "dark");
  return params.toString();
}

/** `path` with the view's query appended. */
export function withView(path: string, view: Partial<ResultsView>): string {
  const query = resultsQuery(view);
  return query ? `${path}?${query}` : path;
}
