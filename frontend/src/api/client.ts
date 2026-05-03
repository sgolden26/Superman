import { env } from '@/config/env';
import type { ApiError } from '@/types/common';

/**
 * Thin fetch wrapper: JSON encoding and uniform error shape. Endpoint classes
 * call `apiClient.get`/`apiClient.post`; views never touch `fetch` directly.
 */
export interface RequestOptions {
  signal?: AbortSignal;
  query?: Record<string, string | number | boolean | undefined | null>;
}

export class ApiHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError | null,
  ) {
    super(body?.message ?? `HTTP ${status}`);
    this.name = 'ApiHttpError';
  }
}

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  get<T>(path: string, opts?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, opts);
  }

  post<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, body, opts);
  }

  patch<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, body, opts);
  }

  delete<T>(path: string, opts?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, undefined, opts);
  }

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
    opts?: RequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(path, opts?.query);
    const init: RequestInit = { method };
    if (body !== undefined) {
      init.headers = { 'content-type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    if (opts?.signal) init.signal = opts.signal;

    const response = await fetch(url, init);
    if (!response.ok) {
      throw new ApiHttpError(response.status, await this.tryReadError(response));
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const base = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    const suffix = path.startsWith('/') ? path : `/${path}`;
    if (!query) return `${base}${suffix}`;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      params.append(k, String(v));
    }
    const qs = params.toString();
    return qs ? `${base}${suffix}?${qs}` : `${base}${suffix}`;
  }

  private async tryReadError(response: Response): Promise<ApiError | null> {
    try {
      return (await response.json()) as ApiError;
    } catch {
      return null;
    }
  }
}

export const apiClient = new ApiClient(env.apiBaseUrl);
