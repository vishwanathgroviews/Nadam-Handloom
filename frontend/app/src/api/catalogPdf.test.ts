import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-constants', () => ({ default: { expoConfig: { hostUri: '10.0.0.5:8081' } } }));

const store = new Map<string, string>();
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => store.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void store.set(k, v),
  deleteItemAsync: async (k: string) => void store.delete(k),
}));

import {
  getCatalogPreviewProducts,
  generateCatalogPdf,
  getCatalogPdfStatus,
} from './catalogPdf';

const json = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: new Map(),
  }) as unknown as Response;

beforeEach(() => {
  store.clear();
  store.set('nandam_refresh_token', 'stored-refresh');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('catalogPdf api', () => {
  it('fetches catalog preview products via apiRequest', async () => {
    const mockData = {
      subcategory: {
        id: 'sub-1',
        name: 'Kalamkari',
        storePrice: '2500',
        onlinePrice: '2500',
      },
      products: [
        {
          id: 'prod-1',
          name: 'Handloom Saree',
          sku: 'NH-101',
          imageUrl: 'https://cdn.example.com/p1.jpg',
          price: '2500',
          mrp: null,
          catalogId: '101',
          availableCount: 2,
        },
      ],
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json(200, { success: true, data: mockData }))
    );

    const res = await getCatalogPreviewProducts('test-token', 'sub-1');
    expect(res.data.products).toHaveLength(1);
    expect(res.data.products[0].name).toBe('Handloom Saree');
    expect(res.data.subcategory.name).toBe('Kalamkari');
  });

  it('posts selected productIds when generating catalog PDF', async () => {
    let capturedBody: any;
    let capturedHeaders: any;

    const fakePdfBytes = new Uint8Array([37, 80, 68, 70]); // %PDF
    const headersMap = new Map<string, string>();
    headersMap.set('X-Product-Count', '2');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url, init) => {
        capturedBody = init?.body ? JSON.parse(init.body) : undefined;
        capturedHeaders = init?.headers;
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: {
            get: (key: string) => headersMap.get(key) ?? null,
          },
          arrayBuffer: async () => fakePdfBytes.buffer,
        });
      })
    );

    const result = await generateCatalogPdf('test-token', 'sub-1', ['prod-1', 'prod-2']);

    expect(capturedBody).toEqual({ productIds: ['prod-1', 'prod-2'] });
    expect(capturedHeaders['Content-Type']).toBe('application/json');
    expect(result.productCount).toBe(2);
    expect(result.bytes).toEqual(fakePdfBytes);
  });

  it('generates catalog PDF without productIds when not provided', async () => {
    let capturedBody: any;
    const fakePdfBytes = new Uint8Array([37, 80, 68, 70]);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url, init) => {
        capturedBody = init?.body;
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: {
            get: () => '5',
          },
          arrayBuffer: async () => fakePdfBytes.buffer,
        });
      })
    );

    const result = await generateCatalogPdf('test-token', 'sub-1');
    expect(capturedBody).toBeUndefined();
    expect(result.productCount).toBe(5);
  });

  it('throws helpful error message on generation failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          message: 'One or more selected products are out of stock',
          code: 'OUT_OF_STOCK',
        }),
      })
    );

    await expect(
      generateCatalogPdf('test-token', 'sub-1', ['prod-out'])
    ).rejects.toThrow('One or more selected products are out of stock');
  });
});
