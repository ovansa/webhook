import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Primary (indigo) and secondary (dark slate) buttons, matching the invoice app. */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'dark' | 'ghost';
};

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60',
  dark: 'bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40',
  ghost:
    'border border-slate-200 bg-white text-slate-600 hover:border-indigo-400 hover:text-indigo-600',
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition-colors ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-indigo-50 text-indigo-600 ring-indigo-200',
  POST: 'bg-emerald-50 text-emerald-600 ring-emerald-200',
  PUT: 'bg-amber-50 text-amber-600 ring-amber-200',
  PATCH: 'bg-amber-50 text-amber-600 ring-amber-200',
  DELETE: 'bg-rose-50 text-rose-600 ring-rose-200',
};

export function MethodBadge({ method }: { method: string }) {
  const cls = METHOD_COLORS[method] ?? 'bg-slate-100 text-slate-600 ring-slate-200';
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${cls}`}
    >
      {method}
    </span>
  );
}

/** Section label, matching the invoice app's uppercase slate labels. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </h2>
  );
}

/**
 * Renders a payload body. If it parses as JSON we pretty-print with 2-space
 * indent; otherwise show it raw. (Ported from the uptime monitor's ResponseBody.)
 *
 * Heuristic: only attempt JSON.parse when the trimmed body starts with `{`/`[`,
 * so HTML / plain-text payloads aren't needlessly parsed.
 */
export function PayloadBody({
  body,
  className = '',
}: {
  body: string;
  className?: string;
}) {
  return (
    <pre
      className={`max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs leading-relaxed text-slate-700 ${className}`}
    >
      {formatBody(body)}
    </pre>
  );
}

export function formatBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return body;
  const first = trimmed[0];
  if (first !== '{' && first !== '[') return body;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return body;
  }
}

/** Colored HTTP status badge: 2xx green, 3xx indigo, 4xx amber, 5xx red. */
export function StatusBadge({ code }: { code: number }) {
  const tone =
    code >= 500
      ? 'bg-rose-50 text-rose-600 ring-rose-200'
      : code >= 400
        ? 'bg-amber-50 text-amber-600 ring-amber-200'
        : code >= 300
          ? 'bg-indigo-50 text-indigo-600 ring-indigo-200'
          : 'bg-emerald-50 text-emerald-600 ring-emerald-200';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-bold ring-1 ${tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      HTTP {code}
    </span>
  );
}

/** White rounded card with a subtle border + shadow. */
export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}
