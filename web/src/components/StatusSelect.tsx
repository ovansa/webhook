import { useEffect, useRef, useState } from 'react';
import { STATUS_GROUPS, statusLabel } from '../lib/statusCodes';

/** Colored dot per status class, matching StatusBadge tones. */
function toneDot(code: number): string {
  if (code >= 500) return 'bg-rose-500';
  if (code >= 400) return 'bg-amber-500';
  if (code >= 300) return 'bg-indigo-500';
  return 'bg-emerald-500';
}

/**
 * Custom dropdown for picking a major HTTP status code, grouped by class.
 * Selecting a code reports it via onSelect (the editor then pre-fills the
 * sample body). Closes on outside-click or Escape.
 */
export default function StatusSelect({
  value,
  onSelect,
  onOpenChange,
}: {
  value: number;
  onSelect: (code: number) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpenState] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const setOpen = (next: boolean | ((o: boolean) => boolean)) => {
    setOpenState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      onOpenChange?.(value);
      return value;
    });
  };

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

  return (
    <div className={`relative ${open ? 'z-50' : ''}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 transition-colors hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${toneDot(value)}`} />
        <span className="truncate">{statusLabel(value)}</span>
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
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl ring-1 ring-slate-900/5"
        >
          {STATUS_GROUPS.map((group) => (
            <li key={group.title}>
              <div className="px-2.5 pb-0.5 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group.title}
              </div>
              <ul>
                {group.options.map((opt) => {
                  const isActive = opt.code === value;
                  return (
                    <li
                      key={opt.code}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => {
                        onSelect(opt.code);
                        setOpen(false);
                      }}
                      className={`flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${toneDot(opt.code)}`} />
                      <span className="truncate">{opt.label}</span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
