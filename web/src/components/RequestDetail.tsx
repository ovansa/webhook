import type { CapturedRequest } from '../types';
import { MethodBadge, PayloadBody, SectionLabel, StatusBadge } from './ui';

function Row({ k, v }: { k: string; v: unknown }) {
  return (
    <div className="flex gap-3 border-b border-slate-100 py-1.5 last:border-0">
      <span className="w-40 shrink-0 text-xs font-medium text-slate-400">{k}</span>
      <span className="min-w-0 break-all font-mono text-xs text-slate-700">
        {String(v)}
      </span>
    </div>
  );
}

export default function RequestDetail({ req }: { req: CapturedRequest | null }) {
  if (!req) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-sm text-slate-400">
        Select a request to inspect its details.
      </div>
    );
  }

  const res = req.response;

  return (
    <div className="space-y-6 p-6">
      {/* Summary row: method, path, and the status we responded with. */}
      <div className="flex flex-wrap items-center gap-3">
        <MethodBadge method={req.method} />
        <span className="font-mono text-sm text-slate-800">{req.path}</span>
        <span className="text-slate-300">→</span>
        <StatusBadge code={res.statusCode} />
        {res.delayMs > 0 && (
          <span className="text-xs text-slate-400">delayed {res.delayMs}ms</span>
        )}
      </div>

      <section>
        <SectionLabel>Overview</SectionLabel>
        <div className="rounded-lg border border-slate-100 bg-white px-3">
          <Row k="Time" v={new Date(req.timestamp).toLocaleString()} />
          <Row k="IP" v={req.ip ?? '—'} />
          <Row k="Content-Type" v={req.contentType ?? '—'} />
          <Row k="Size" v={`${req.size} bytes${req.truncated ? ' (truncated)' : ''}`} />
        </div>
      </section>

      {Object.keys(req.query ?? {}).length > 0 && (
        <section>
          <SectionLabel>Query</SectionLabel>
          <PayloadBody body={JSON.stringify(req.query, null, 2)} />
        </section>
      )}

      <section>
        <SectionLabel>Request headers</SectionLabel>
        <div className="rounded-lg border border-slate-100 bg-white px-3">
          {Object.entries(req.headers).map(([k, v]) => (
            <Row key={k} k={k} v={v} />
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>Request body</SectionLabel>
        {req.body ? (
          <PayloadBody body={req.body} />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-400">
            No request body
          </div>
        )}
      </section>

      {/* What the inspector sent back. */}
      <section>
        <SectionLabel>Response (what we sent)</SectionLabel>
        <div className="mb-2 rounded-lg border border-slate-100 bg-white px-3">
          <Row k="Status" v={res.statusCode} />
          <Row k="Content-Type" v={res.contentType} />
          {res.delayMs > 0 && <Row k="Delay" v={`${res.delayMs}ms`} />}
        </div>
        {res.body ? (
          <PayloadBody body={res.body} />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-400">
            Empty response body
          </div>
        )}
      </section>
    </div>
  );
}
