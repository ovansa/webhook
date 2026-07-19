import { useEffect, useState } from 'react';
import type { Bin, ResponseConfig } from '../types';
import { api } from '../lib/api';
import { Button, SectionLabel } from './ui';
import StatusSelect from './StatusSelect';
import { statusOption } from '../lib/statusCodes';

const labelCls =
  'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500';
const inputCls =
  'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 ' +
  'transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none ' +
  'focus:ring-2 focus:ring-indigo-500/15';

/**
 * Editor for a bin's default response — status, content-type, body, delay.
 * Lets you configure how the inspector replies to every incoming webhook, so
 * you can test services that depend on the webhook response.
 */
export default function ResponseEditor({
  bin,
  onSaved,
  onClose,
}: {
  bin: Bin;
  onSaved: (bin: Bin) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState(bin.responseConfig.statusCode);
  const [contentType, setContentType] = useState(bin.responseConfig.contentType);
  const [useDefaultBody, setUseDefaultBody] = useState(bin.responseConfig.body === null);
  const [body, setBody] = useState(bin.responseConfig.body ?? '');
  const [delayMs, setDelayMs] = useState(bin.responseConfig.delayMs);
  const [saving, setSaving] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  // Re-sync only when a DIFFERENT bin is selected — keyed on bin.id, not the
  // bin object. The 2s polling loop replaces the bin object every cycle; if we
  // depended on `bin` we'd clobber the user's in-progress edits each poll.
  useEffect(() => {
    setStatus(bin.responseConfig.statusCode);
    setContentType(bin.responseConfig.contentType);
    setUseDefaultBody(bin.responseConfig.body === null);
    setBody(bin.responseConfig.body ?? '');
    setDelayMs(bin.responseConfig.delayMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bin.id]);

  /**
   * Pick a status code and pre-fill its sample body. If the user hasn't typed a
   * custom body yet (still on the default ack, or body matches the previous
   * code's sample), we swap in the new sample; otherwise we keep their edits and
   * only change the status.
   */
  function pickStatus(code: number) {
    const sample = statusOption(code)?.sampleBody ?? null;
    const prevSample = statusOption(status)?.sampleBody ?? null;
    const bodyIsUntouched = useDefaultBody || body === prevSample || body === '';

    setStatus(code);
    if (sample !== null && bodyIsUntouched) {
      setUseDefaultBody(false);
      setBody(sample);
    } else if (sample === '' && bodyIsUntouched) {
      // 204/304 etc. — an empty body sample.
      setUseDefaultBody(false);
      setBody('');
    }
  }

  const sampleForStatus = statusOption(status)?.sampleBody ?? null;
  const canResetSample = sampleForStatus !== null && body !== sampleForStatus;

  async function save() {
    setSaving(true);
    try {
      const cfg: Partial<ResponseConfig> = {
        statusCode: status,
        contentType,
        body: useDefaultBody ? null : body,
        delayMs,
      };
      const updated = await api.updateResponse(bin.id, cfg);
      onSaved(updated);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative w-[380px] max-w-full space-y-4 p-5">
      {/* Dim the form while the status dropdown is open so the floating menu
          reads as a layer on top, not overlapping/broken content. */}
      {statusOpen && (
        <div className="pointer-events-none absolute inset-0 z-40 rounded-xl bg-white/70" />
      )}
      <div className="flex items-center justify-between">
        <SectionLabel>Configure response</SectionLabel>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <p className="-mt-2 text-xs text-slate-400">
        Sent to every request on <span className="font-mono">{bin.name ?? bin.id}</span>.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className={`relative ${statusOpen ? 'z-50' : ''}`}>
          <label className={labelCls}>Status code</label>
          <StatusSelect
            value={status}
            onSelect={pickStatus}
            onOpenChange={setStatusOpen}
          />
        </div>
        <div>
          <label className={labelCls}>Delay (ms)</label>
          <input
            type="number"
            min={0}
            max={10000}
            value={delayMs}
            onChange={(e) => setDelayMs(Number(e.target.value))}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Content-Type</label>
        <input
          value={contentType}
          onChange={(e) => setContentType(e.target.value)}
          placeholder="application/json"
          className={inputCls}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className={labelCls}>Response body</label>
          <div className="flex items-center gap-3">
            {!useDefaultBody && canResetSample && (
              <button
                type="button"
                onClick={() => setBody(sampleForStatus ?? '')}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
              >
                Reset to sample
              </button>
            )}
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={useDefaultBody}
                onChange={(e) => setUseDefaultBody(e.target.checked)}
                className="accent-indigo-600"
              />
              Default ack
            </label>
          </div>
        </div>
        {useDefaultBody ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-400">
            {'{ "ok": true, "id": …, "received": … }'}
          </div>
        ) : (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder='{"received": true}'
            className={`${inputCls} resize-y font-mono leading-relaxed`}
          />
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save response'}
        </Button>
      </div>
    </div>
  );
}
