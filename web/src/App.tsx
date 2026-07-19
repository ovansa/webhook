import { useCallback, useEffect, useRef, useState } from 'react';
import type { Bin, CapturedRequest } from './types';
import { api, ApiError } from './lib/api';
import { Button, Card, MethodBadge, StatusBadge } from './components/ui';
import RequestDetail from './components/RequestDetail';
import ResponseEditor from './components/ResponseEditor';
import NewUrlModal from './components/NewUrlModal';
import BinSelect from './components/BinSelect';

const BIN_KEY = 'webhook-inspector:binId';
const POLL_MS = 2000;

export default function App() {
  const [bins, setBins] = useState<Bin[]>([]);
  const [currentBin, setCurrentBin] = useState<string>(
    () => localStorage.getItem(BIN_KEY) ?? 'default',
  );
  const [requests, setRequests] = useState<CapturedRequest[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingResponse, setEditingResponse] = useState(false);
  const [showNewUrl, setShowNewUrl] = useState(false);

  const currentBinObj = bins.find((b) => b.id === currentBin);

  // Keep the latest currentBin available to the polling loop without
  // re-subscribing the interval on every change.
  const binRef = useRef(currentBin);
  binRef.current = currentBin;

  const refreshBins = useCallback(async () => {
    try {
      const list = await api.listBins();
      setBins(list);
      setUnauthorized(false);
      return list;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setUnauthorized(true);
      return [];
    }
  }, []);

  const refreshRequests = useCallback(async () => {
    try {
      const { requests } = await api.listRequests(binRef.current);
      setRequests(requests);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        // Bin vanished (e.g. cleared server) — resync bin list.
        await refreshBins();
      }
    }
  }, [refreshBins]);

  // Initial load.
  useEffect(() => {
    (async () => {
      const list = await refreshBins();
      if (list.length && !list.find((b) => b.id === currentBin)) {
        setCurrentBin(list[0].id);
      }
      refreshRequests();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live polling.
  useEffect(() => {
    const t = setInterval(() => {
      refreshRequests();
      refreshBins();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [refreshRequests, refreshBins]);

  // Re-fetch when switching bins.
  useEffect(() => {
    localStorage.setItem(BIN_KEY, currentBin);
    setActiveId(null);
    refreshRequests();
  }, [currentBin, refreshRequests]);

  const active = requests.find((r) => r.id === activeId) ?? null;

  async function handleBinCreated(bin: Bin) {
    await refreshBins();
    setCurrentBin(bin.id);
  }

  async function handleDeleteBin(id: string) {
    await api.deleteBin(id);
    if (id === currentBin) setCurrentBin('default');
    refreshBins();
  }

  async function handleClear() {
    if (!window.confirm('Clear all captured requests in this bin?')) return;
    await api.clearBin(currentBin);
    setActiveId(null);
    refreshRequests();
  }

  function copyUrl() {
    navigator.clipboard.writeText(api.binUrl(currentBin));
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  }

  if (unauthorized) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="max-w-sm p-6 text-center">
          <h1 className="text-lg font-semibold text-slate-800">Unauthorized</h1>
          <p className="mt-2 text-sm text-slate-500">
            This inspector is token-protected. Append{' '}
            <code className="rounded bg-slate-100 px-1 text-slate-700">?token=…</code>{' '}
            to the URL.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-3.5">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-indigo-600 text-sm font-bold text-white">
            W
          </span>
          <h1 className="text-base font-semibold text-slate-800">Webhook Inspector</h1>
          <span
            className="ml-1 h-2 w-2 rounded-full bg-emerald-500"
            title="Live — polling every 2s"
          />
        </div>

        <div className="flex items-center gap-2">
          <BinSelect
            bins={bins}
            currentBin={currentBin}
            onSelect={setCurrentBin}
            onDelete={handleDeleteBin}
          />
          <Button variant="primary" onClick={() => setShowNewUrl(true)}>
            + New URL
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="dark" onClick={() => setEditingResponse(true)}>
            Configure response
            {currentBinObj && <StatusBadge code={currentBinObj.responseConfig.statusCode} />}
          </Button>
          <Button variant="ghost" onClick={handleClear}>
            Clear
          </Button>
        </div>
      </header>

      {/* URL bar */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white/60 px-6 py-2.5">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Webhook URL
        </span>
        <button
          onClick={copyUrl}
          title="Click to copy"
          className="max-w-full truncate rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-indigo-600 transition-colors hover:border-indigo-400"
        >
          {copied ? 'Copied!' : api.binUrl(currentBin)}
        </button>
      </div>

      {/* New URL modal */}
      {showNewUrl && (
        <NewUrlModal
          onCreated={handleBinCreated}
          onClose={() => setShowNewUrl(false)}
        />
      )}

      {/* Response config panel (slides in from the right when open) */}
      {editingResponse && currentBinObj && (
        <div className="fixed inset-0 z-20 flex justify-end bg-slate-900/20">
          <div
            className="absolute inset-0"
            onClick={() => setEditingResponse(false)}
          />
          <Card className="relative m-3 h-fit">
            <ResponseEditor
              bin={currentBinObj}
              onSaved={(updated) =>
                setBins((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
              }
              onClose={() => setEditingResponse(false)}
            />
          </Card>
        </div>
      )}

      {/* Body: list + detail */}
      <div className="grid min-h-0 flex-1 grid-cols-[340px_1fr]">
        <div className="overflow-y-auto border-r border-slate-200 bg-white">
          {requests.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">
              Waiting for requests…
              <p className="mt-1 text-xs text-slate-300">
                Send one to the URL above.
              </p>
            </div>
          ) : (
            requests.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveId(r.id)}
                className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                  r.id === activeId
                    ? 'border-l-2 border-l-indigo-500 bg-indigo-50/50'
                    : 'border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MethodBadge method={r.method} />
                  <span className="truncate font-mono text-sm text-slate-700">
                    {r.path}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {new Date(r.timestamp).toLocaleTimeString()} · {r.size} bytes
                </div>
              </button>
            ))
          )}
        </div>

        <div className="min-w-0 overflow-y-auto">
          <RequestDetail req={active} />
        </div>
      </div>
    </div>
  );
}
