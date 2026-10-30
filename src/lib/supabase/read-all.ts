/**
 * Reads a whole table page by page. Supabase answers at most `max_rows` rows
 * per request (1000, `supabase/config.toml`), silently: a script that reads a
 * table in one call sees the first thousand rows and takes the rest for
 * missing. `fetchPage` runs one `.range(from, to)` query on a stable order
 * (the primary key), so a row never falls between two pages.
 */
export const READ_PAGE = 1000;

type Page = { data: unknown[] | null; error: { message: string } | null };

/**
 * `fetchPage` may be a Supabase query builder (a thenable, not a Promise). The
 * rows are typed by the caller: a column list built at run time (the seed's
 * `select(key)`) gets no row type from the client.
 */
export async function readAll<T>(fetchPage: (from: number, to: number) => PromiseLike<Page>, pageSize = READ_PAGE): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
