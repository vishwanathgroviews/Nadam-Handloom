import { apiRequest, API_BASE_URL, fetchWithTimeout, refreshAccessToken } from './client';

export interface CatalogPdfStatus {
  id: string;
  subcategoryId: string;
  url: string;
  productCount: number;
  generatedAt: string;
  generatedBy: string;
}

export interface CatalogPdfResult {
  bytes: Uint8Array;
  productCount?: number;
}

export const getCatalogPdfStatus = (token: string, subcategoryId: string) =>
  apiRequest<{ data: CatalogPdfStatus | null }>(`/admin/subcategories/${subcategoryId}/catalog-pdf`, { token });

/**
 * The response is a PDF, not JSON, so this can't go through apiRequest — but
 * it still has to behave like every other authenticated call.
 *
 * It previously used a bare fetch(), which cost it two things that caused
 * real trouble on this screen. It had no 401 refresh, so leaving the catalog
 * screen open past the 15-minute access-token lifetime and then tapping
 * Generate failed with a raw auth error. And it had no timeout at all, so a
 * request that never came back hung the button forever. Building a catalog
 * means fetching every product photo and laying out a page each, so it gets
 * the upload-sized budget rather than the 20s one meant for small JSON.
 */
const CATALOG_TIMEOUT_MS = 90000;

const requestCatalogPdf = async (token: string, subcategoryId: string): Promise<Response> =>
  fetchWithTimeout(
    `${API_BASE_URL}/admin/subcategories/${subcategoryId}/catalog-pdf`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
    CATALOG_TIMEOUT_MS
  );

export const generateCatalogPdf = async (token: string, subcategoryId: string): Promise<CatalogPdfResult> => {
  let response = await requestCatalogPdf(token, subcategoryId);

  // Same one-shot refresh-and-retry apiRequest does for JSON calls.
  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    response = await requestCatalogPdf(newToken, subcategoryId);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.message || 'Failed to generate catalog PDF') as Error & { code?: string; status?: number };
    error.code = data.code;
    error.status = response.status;
    throw error;
  }

  const buffer = await response.arrayBuffer();
  return {
    bytes: new Uint8Array(buffer),
    productCount: response.headers.get('X-Product-Count') ? Number(response.headers.get('X-Product-Count')) : undefined,
  };
};
