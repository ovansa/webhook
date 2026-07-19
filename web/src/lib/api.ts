import type { Bin, CapturedRequest, ResponseConfig } from '../types';

/** Token pulled from ?token= in the URL; forwarded on every API call. */
const token = new URLSearchParams(location.search).get('token') ?? '';

function withAuth(path: string): string {
  if (!token) return path;
  return path + (path.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(withAuth(path), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new ApiError(res.status, await safeText(res));
  return res.json() as Promise<T>;
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.json())?.error ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const api = {
  token,
  /** Public origin for a bin's capture URL. */
  binUrl: (binId: string) => `${location.origin}/b/${binId}`,

  listBins: () => req<{ bins: Bin[] }>('/api/bins').then((r) => r.bins),

  createBin: (name?: string) =>
    req<Bin>('/api/bins', { method: 'POST', body: JSON.stringify({ name }) }),

  deleteBin: (binId: string) =>
    req<{ ok: boolean }>(`/api/bins/${binId}`, { method: 'DELETE' }),

  listRequests: (binId: string) =>
    req<{ count: number; requests: CapturedRequest[] }>(
      `/api/bins/${binId}/requests`,
    ),

  clearBin: (binId: string) =>
    req<{ ok: boolean }>(`/api/bins/${binId}/requests`, { method: 'DELETE' }),

  updateResponse: (binId: string, cfg: Partial<ResponseConfig>) =>
    req<Bin>(`/api/bins/${binId}/response`, {
      method: 'PATCH',
      body: JSON.stringify(cfg),
    }),
};
