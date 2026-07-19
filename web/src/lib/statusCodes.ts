/**
 * Major HTTP status codes offered in the response-config dropdown, each with a
 * sensible sample JSON body. Picking a code pre-fills the body so you can test a
 * realistic response without hand-writing it (you can still edit it after).
 */
export interface StatusOption {
  code: number;
  label: string;
  /** Sample response body for this status (null = use the default JSON ack). */
  sampleBody: string | null;
}

/** Grouped by class so the dropdown can show section headers. */
export interface StatusGroup {
  title: string;
  options: StatusOption[];
}

const j = (o: unknown) => JSON.stringify(o, null, 2);

export const STATUS_GROUPS: StatusGroup[] = [
  {
    title: '2xx Success',
    options: [
      { code: 200, label: '200 OK', sampleBody: j({ ok: true }) },
      {
        code: 201,
        label: '201 Created',
        sampleBody: j({ id: 'res_123', created: true }),
      },
      {
        code: 202,
        label: '202 Accepted',
        sampleBody: j({ accepted: true, status: 'queued' }),
      },
      { code: 204, label: '204 No Content', sampleBody: '' },
    ],
  },
  {
    title: '3xx Redirect',
    options: [
      {
        code: 301,
        label: '301 Moved Permanently',
        sampleBody: j({ moved: true, location: 'https://example.com/new' }),
      },
      {
        code: 302,
        label: '302 Found',
        sampleBody: j({ location: 'https://example.com/tmp' }),
      },
      { code: 304, label: '304 Not Modified', sampleBody: '' },
    ],
  },
  {
    title: '4xx Client Error',
    options: [
      {
        code: 400,
        label: '400 Bad Request',
        sampleBody: j({ error: 'bad_request', message: 'Invalid payload' }),
      },
      {
        code: 401,
        label: '401 Unauthorized',
        sampleBody: j({ error: 'unauthorized', message: 'Missing or invalid credentials' }),
      },
      {
        code: 403,
        label: '403 Forbidden',
        sampleBody: j({ error: 'forbidden', message: 'Access denied' }),
      },
      {
        code: 404,
        label: '404 Not Found',
        sampleBody: j({ error: 'not_found', message: 'Resource not found' }),
      },
      {
        code: 409,
        label: '409 Conflict',
        sampleBody: j({ error: 'conflict', message: 'Duplicate request' }),
      },
      {
        code: 422,
        label: '422 Unprocessable Entity',
        sampleBody: j({
          error: 'validation_failed',
          fields: { email: 'is required' },
        }),
      },
      {
        code: 429,
        label: '429 Too Many Requests',
        sampleBody: j({ error: 'rate_limited', retry_after: 30 }),
      },
    ],
  },
  {
    title: '5xx Server Error',
    options: [
      {
        code: 500,
        label: '500 Internal Server Error',
        sampleBody: j({ error: 'internal_error', message: 'Something went wrong' }),
      },
      {
        code: 502,
        label: '502 Bad Gateway',
        sampleBody: j({ error: 'bad_gateway' }),
      },
      {
        code: 503,
        label: '503 Service Unavailable',
        sampleBody: j({ error: 'service_unavailable', retry_after: 60 }),
      },
      {
        code: 504,
        label: '504 Gateway Timeout',
        sampleBody: j({ error: 'gateway_timeout' }),
      },
    ],
  },
];

const BY_CODE = new Map<number, StatusOption>(
  STATUS_GROUPS.flatMap((g) => g.options).map((o) => [o.code, o]),
);

export function statusOption(code: number): StatusOption | undefined {
  return BY_CODE.get(code);
}

/** Human label for a code, falling back to just the number for unknown codes. */
export function statusLabel(code: number): string {
  return BY_CODE.get(code)?.label ?? `${code}`;
}
