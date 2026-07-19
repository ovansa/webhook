import { useEffect, useRef, useState } from 'react';
import type { Bin } from '../types';

/**
 * Custom dropdown for choosing the active bin, replacing the native <select>.
 * Shows each bin's name and request count, highlights the active one, and
 * offers a per-bin delete (native selects can't do either). Closes on outside
 * click or Escape.
 */
export default function BinSelect({
  bins,
  currentBin,
  onSelect,
  onDelete,
}: {
  bins: Bin[];
  currentBin: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = bins.find((b) => b.id === currentBin);
  const activeLabel = active ? (active.name ?? active.id) : currentBin;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex min-w-[180px] items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
      >
        <span className="truncate">{activeLabel}</span>
        {active && (
          <span className="rounded bg-slate-100 px-1.5 text-xs font-medium text-slate-500">
            {active.requestCount}
          </span>
        )}
        <svg
          viewBox="0 0 24 24"
          className={`ml-auto h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-40 mt-1.5 max-h-80 w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          {bins.map((b) => {
            const isActive = b.id === currentBin;
            const canDelete = b.id !== 'default';
            return (
              <li key={b.id} role="option" aria-selected={isActive}>
                <div
                  onClick={() => {
                    onSelect(b.id);
                    setOpen(false);
                  }}
                  className={`group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors ${
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {b.name ?? b.id}
                    {!b.name && <span className="ml-1 text-xs text-slate-400">(unnamed)</span>}
                  </span>
                  <span
                    className={`rounded px-1.5 text-xs font-medium ${
                      isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {b.requestCount}
                  </span>
                  {canDelete && (
                    <button
                      type="button"
                      aria-label={`Delete ${b.name ?? b.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(b.id);
                      }}
                      className="grid h-5 w-5 shrink-0 place-items-center rounded text-slate-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
                    >
                      <svg
                        viewBox="0 0 14 14"
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      >
                        <path d="M3 3l8 8M11 3l-8 8" />
                      </svg>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
