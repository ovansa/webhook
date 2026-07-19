import type { Request, Response, NextFunction } from 'express';

/** Extends Express Request with the raw captured body. */
export interface RawBodyRequest extends Request {
  rawBody?: Buffer;
  bodyTruncated?: boolean;
}

const BODY_LIMIT = 5 * 1024 * 1024; // 5MB cap to avoid memory abuse

/**
 * Captures the RAW request body bytes without a content-type-specific parser,
 * so the inspector shows exactly what was sent.
 */
export function captureRawBody(
  req: RawBodyRequest,
  _res: Response,
  next: NextFunction,
): void {
  const chunks: Buffer[] = [];
  let size = 0;
  let truncated = false;

  req.on('data', (chunk: Buffer) => {
    size += chunk.length;
    if (size <= BODY_LIMIT) chunks.push(chunk);
    else truncated = true;
  });
  req.on('end', () => {
    req.rawBody = Buffer.concat(chunks);
    req.bodyTruncated = truncated;
    next();
  });
  req.on('error', next);
}

export interface ParsedBody {
  parsed: unknown;
  text: string;
}

/** Best-effort parse of the raw body based on content-type / shape. */
export function tryParse(raw: Buffer, contentType = ''): ParsedBody {
  const text = raw.toString('utf8');
  if (!text) return { parsed: null, text: '' };
  const ct = contentType.toLowerCase();
  const trimmed = text.trim();
  try {
    if (ct.includes('application/json') || trimmed[0] === '{' || trimmed[0] === '[') {
      return { parsed: JSON.parse(text), text };
    }
    if (ct.includes('application/x-www-form-urlencoded')) {
      return { parsed: Object.fromEntries(new URLSearchParams(text)), text };
    }
  } catch {
    // fall through — keep the text, no parsed form
  }
  return { parsed: null, text };
}
