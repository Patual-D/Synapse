import { useState } from 'react';

export function usePagination(items, pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(Math.ceil(items.length / pageSize), 1);
  const current = Math.min(page, totalPages);
  const slice = items.slice((current - 1) * pageSize, current * pageSize);
  return { page: current, totalPages, setPage, slice };
}

export function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex-between mt-8">
      <span className="text-muted" style={{ fontSize: 14 }}>
        Página {page} de {totalPages}
      </span>
      <div className="flex" style={{ gap: 8 }}>
        <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          ← Anterior
        </button>
        <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Siguiente →
        </button>
      </div>
    </div>
  );
}