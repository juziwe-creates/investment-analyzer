type Page<T, E> = { data: T[] | null; error: E | null; count?: number | null };

// Bound database concurrency and never return a silently truncated history.
export async function readPages<T, E>(
  fetchPage: (offset: number, count: boolean) => PromiseLike<Page<T, E>>,
  pageSize = 1000,
) {
  const first = await fetchPage(0, true);
  if (first.error) return { data: [] as T[], error: first.error };
  const rows = [...(first.data ?? [])];
  if (rows.length < pageSize) return { data: rows, error: null };
  if (first.count == null) {
    for (let offset = pageSize; ; offset += pageSize) {
      const page = await fetchPage(offset, false);
      if (page.error) return { data: [] as T[], error: page.error };
      rows.push(...(page.data ?? []));
      if (!page.data || page.data.length < pageSize) return { data: rows, error: null };
    }
  }
  for (let offset = pageSize; offset < first.count; offset += pageSize * 3) {
    const offsets = [offset, offset + pageSize, offset + pageSize * 2].filter((value) => value < first.count!);
    const pages = await Promise.all(offsets.map((value) => fetchPage(value, false)));
    for (const page of pages) {
      if (page.error) return { data: [] as T[], error: page.error };
      rows.push(...(page.data ?? []));
    }
  }
  return { data: rows, error: null };
}
