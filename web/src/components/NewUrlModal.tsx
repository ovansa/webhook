import { useState } from 'react';
import type { Bin } from '../types';
import { api } from '../lib/api';
import { Button } from './ui';
import Modal from './Modal';

const inputCls =
  'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 ' +
  'transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none ' +
  'focus:ring-2 focus:ring-indigo-500/15';

/** Modal to create a new webhook URL (bin) with an optional name. */
export default function NewUrlModal({
  onCreated,
  onClose,
}: {
  onCreated: (bin: Bin) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const bin = await api.createBin(name.trim() || undefined);
      onCreated(bin);
      onClose();
    } catch {
      setError('Could not create the URL. Please try again.');
      setCreating(false);
    }
  }

  return (
    <Modal title="New webhook URL" onClose={onClose}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        Name <span className="font-normal normal-case text-slate-400">(optional)</span>
      </label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') create();
        }}
        placeholder="e.g. stripe-webhooks"
        className={inputCls}
      />
      <p className="mt-2 text-xs text-slate-400">
        A unique URL is generated for this endpoint. Name it to tell your bins apart.
      </p>

      {error && <p className="mt-3 text-xs font-medium text-rose-600">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={create} disabled={creating}>
          {creating ? 'Creating…' : 'Create URL'}
        </Button>
      </div>
    </Modal>
  );
}
