/**
 * Universal API client — works in both React (web) and React Native.
 * No framework-specific imports (no react-native Alert, no DOM APIs).
 */

const BASE_URL = 'http://localhost:3000';
const TIMEOUT_MS = 15000;

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  details?: string[];
}

export async function api<T = any>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: Record<string, unknown>;
    token?: string;
    timeoutMs?: number;
  } = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, token, timeoutMs = TIMEOUT_MS } = options;
  const url = `${BASE_URL}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timer);

    let json: any;
    try {
      json = await response.json();
    } catch {
      json = {};
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: json.error || json.message || `Request failed (${response.status})`,
        details: json.details ?? [],
      };
    }

    return { ok: true, status: response.status, data: json as T };
  } catch (err: any) {
    clearTimeout(timer);

    if (err.name === 'AbortError') {
      return {
        ok: false,
        status: 0,
        error: `Request timed out after ${timeoutMs / 1000}s. Check your network or server.`,
      };
    }

    if (
      err.message?.includes('Network request failed') ||
      err.message?.includes('Failed to fetch') ||
      err.message?.includes('ECONNREFUSED')
    ) {
      return {
        ok: false,
        status: 0,
        error: `Cannot reach the server at ${BASE_URL}. Verify the API URL and that the backend is running.`,
      };
    }

    return { ok: false, status: 0, error: err.message || 'An unexpected error occurred.' };
  }
}

/**
 * Extract a human-readable error string from an ApiResponse.
 */
export function getApiErrorMessage(res: ApiResponse): string {
  if (res.details && res.details.length > 0) return res.details.join('\n');
  return res.error ?? 'Something went wrong.';
}
