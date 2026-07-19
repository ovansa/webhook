export interface CapturedRequest {
  id: string;
  /** Which bin (endpoint) captured this request. */
  binId: string;
  timestamp: string;
  method: string;
  path: string;
  query: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
  ip: string | undefined;
  size: number;
  truncated: boolean;
  contentType: string | null;
  /** Raw body decoded as UTF-8 text. */
  body: string;
  /** Best-effort parsed body (JSON or form-encoded), else null. */
  json: unknown;
  /** What the inspector responded with to this request. */
  response: CapturedResponse;
}

export interface CapturedResponse {
  /** HTTP status code we sent back (200 by default, or a ?status= override). */
  statusCode: number;
  /** Response content-type. */
  contentType: string;
  /** Response body as sent (the JSON ack, or a ?body= override). */
  body: string;
  /** Response delay in ms, if a ?delay= was applied. */
  delayMs: number;
}

export interface Bin {
  id: string;
  name: string | null;
  createdAt: string;
  requestCount: number;
  /** Default response this bin sends to every incoming request. */
  responseConfig: ResponseConfig;
}

/**
 * The configurable response a bin returns. Per-request query params
 * (?status=, ?body=, ?contentType=, ?delay=) still override these.
 */
export interface ResponseConfig {
  statusCode: number;
  /** Content-type header for the response. */
  contentType: string;
  /**
   * Response body. When null, the inspector sends its default JSON ack.
   * When a string (incl. ""), that exact body is sent.
   */
  body: string | null;
  /** Fixed delay in ms before responding (0 = immediate). */
  delayMs: number;
}

export const DEFAULT_RESPONSE_CONFIG: ResponseConfig = {
  statusCode: 200,
  contentType: 'application/json',
  body: null,
  delayMs: 0,
};
