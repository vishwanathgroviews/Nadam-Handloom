import { apiRequest, API_BASE_URL } from './client';

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

export const generateCatalogPdf = async (token: string, subcategoryId: string): Promise<CatalogPdfResult> => {
  const response = await fetch(`${API_BASE_URL}/admin/subcategories/${subcategoryId}/catalog-pdf`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.message || 'Failed to generate catalog PDF') as Error & { code?: string };
    error.code = data.code;
    throw error;
  }

  const buffer = await response.arrayBuffer();
  return {
    bytes: new Uint8Array(buffer),
    productCount: response.headers.get('X-Product-Count') ? Number(response.headers.get('X-Product-Count')) : undefined,
  };
};
