export interface CapturedRequest {
  id: string;
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
  body: string;
  json: unknown;
  response: CapturedResponse;
}

export interface CapturedResponse {
  statusCode: number;
  contentType: string;
  body: string;
  delayMs: number;
}

export interface ResponseConfig {
  statusCode: number;
  contentType: string;
  body: string | null;
  delayMs: number;
}

export interface Bin {
  id: string;
  name: string | null;
  createdAt: string;
  requestCount: number;
  responseConfig: ResponseConfig;
}
