import { useEffect, useState } from "react";

export const PAGE_SIZE = 25;

export function usePagination<T>(items: T[], pageSize = PAGE_SIZE, resetKey?: unknown) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  function goTo(p: number) {
    setPage(Math.max(1, Math.min(p, totalPages)));
  }

  return { page: safePage, totalPages, pageItems, goTo };
}
