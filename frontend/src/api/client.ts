import { env } from '@/config/env';
import type { ApiError } from '@/types/common';

/**
 * Thin fetch wrapper: JSON encoding and uniform error shape. Endpoint modules
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
  }
}

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  async get<T>(path: string, opts?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, opts);
  }

  async post<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, body, opts);
  }

  async patch<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, body, opts);
  }

  async delete<T>(path: string, opts?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, undefined, opts);
  }

  private async request<T>(
    _method: string,
    _path: string,
    _body: unknown,
    _opts?: RequestOptions,
  ): Promise<T> {
    throw new Error('Not implemented');
  }
}

export const apiClient = new ApiClient(env.apiBaseUrl);
