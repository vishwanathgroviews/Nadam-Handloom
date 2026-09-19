import { Platform } from 'react-native';
import { File, UploadType } from 'expo-file-system';
import { apiRequest, API_BASE_URL, fetchWithTimeout, UPLOAD_TIMEOUT_MS } from './client';

export interface UploadImageInput {
  uri: string;
  name: string;
  type: string;
}

// Image uploads deliberately avoid `fetch` + `FormData` on device.
//
// Which `fetch` is installed globally depends on EXPO_PUBLIC_USE_RN_FETCH
// (see expo/src/winter/runtime.native.ts), and the two implementations accept
// mutually exclusive multipart file parts:
//
//   - React Native's fetch only understands its proprietary
//     `{ uri, name, type }` shorthand. A real Blob part reaches Android's
//     NetworkingModule with neither a `string` nor a `uri` key, which it
//     rejects as "Unrecognized FormData part." — surfacing in JS as the
//     misleading "Network request failed", before the request ever leaves
//     the device.
//   - expo/fetch is the exact opposite: it handles Blob (and `bytes()`)
//     parts and throws "Unsupported FormDataPart implementation" for the
//     React Native shorthand.
//
// So whichever shape this code picks is broken under the other fetch — and
// the flag decided it per-environment, which is how uploads could fail on a
// device while everything else on the same connection worked.
//
// expo-file-system's upload removes the choice: the file streams from disk
// through the platform's own HTTP stack, identically in Expo Go, dev clients
// and release builds. Web has no native module and no file:// URIs, so it
// keeps the browser-correct Blob path, where FormData behaves per spec.
const uploadImage = async <T>(
  path: string,
  token: string,
  image: UploadImageInput
): Promise<T> => {
  const url = `${API_BASE_URL}${path}`;
  let status: number;
  let rawBody: string;

  if (Platform.OS === 'web') {
    const raw = await (await fetch(image.uri)).blob();
    // The type is forced rather than trusting what the browser infers for the
    // uri (often generic/empty for a local object URL) — the backend strictly
    // allowlists image/jpeg|png|webp by mimetype and would reject the upload
    // even with a real file attached.
    const blob = raw.type === image.type ? raw : new Blob([raw], { type: image.type });
    const form = new FormData();
    form.append('image', blob, image.name);

    const response = await fetchWithTimeout(
      url,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form },
      UPLOAD_TIMEOUT_MS
    );
    status = response.status;
    rawBody = await response.text();
  } else {
    const result = await new File(image.uri).upload(url, {
      httpMethod: 'POST',
      uploadType: UploadType.MULTIPART,
      // Must match multer's upload.single('image') field name, and the
      // mimetype the backend allowlists (it never infers one from the name).
      fieldName: 'image',
      mimeType: image.type,
      headers: { Authorization: `Bearer ${token}` },
    });
    status = result.status;
    rawBody = result.body;
  }

  let data: any = {};
  try {
    data = JSON.parse(rawBody);
  } catch {
    // Non-JSON body (a proxy error page, say) — fall through to the
    // status-code message below rather than masking it with a parse error.
  }

  if (status < 200 || status >= 300) {
    const error = new Error(data.message || `Image upload failed (HTTP ${status})`) as Error & { code?: string };
    error.code = data.code;
    throw error;
  }
  return data.data as T;
};

export type ChannelVisibility = 'online_only' | 'store_only' | 'both' | 'hidden';
export type TrackingMode = 'quantity' | 'serialized';

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: { products: number; subcategories: number };
}

export interface CategoryInput {
  name: string;
  description: string;
  sortOrder?: number;
}

export interface AdminSubcategory {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  onlinePrice: string;
  storePrice: string;
  mrp: string | null;
  // Resolved the same way the customer storefront picks a cover image: this
  // subcategory's own upload, else the oldest visible product's photo, else
  // the parent category's photo. `hasOwnImage` is false when `imageUrl` is
  // one of those borrowed fallbacks rather than a real upload for this row.
  imageUrl: string | null;
  hasOwnImage: boolean;
  isActive: boolean;
  sortOrder: number;
  _count?: { products: number };
}

export interface SubcategoryInput {
  name: string;
  description: string;
  onlinePrice: number;
  storePrice: number;
  mrp?: number;
  sortOrder?: number;
  isActive?: boolean;
}

export interface AdminProductImage {
  id: string;
  url: string;
  altText: string | null;
}

export interface AdminProductSummary {
  id: string;
  slug: string;
  sku: string;
  name: string;
  technique: string | null;
  borderStyle: string | null;
  purity: string | null;
  zariTier: string | null;
  blouseType: string | null;
  pattern: string | null;
  color: string | null;
  fabric: string | null;
  occasion: string[];
  stock: number;
  // Legacy pre-barcode backlog (`stock`) plus in-stock scanned pieces —
  // the real number of sellable units regardless of tracking mode.
  availableCount: number;
  isFeatured: boolean;
  isActive: boolean;
  channelVisibility: ChannelVisibility;
  trackingMode: TrackingMode;
  category: { id: string; name: string; slug: string; isActive: boolean };
  subcategory: { id: string; name: string; onlinePrice: string; storePrice: string; isActive: boolean };
  images: AdminProductImage[];
}

export interface ProductInput {
  // Optional — a blank name defaults to the subcategory's name server-side.
  name?: string;
  categoryId: string;
  subcategoryId: string;
  technique?: string;
  borderStyle?: string;
  purity?: string;
  zariTier?: string;
  blouseType?: string;
  pattern?: string;
  color?: string;
  fabric?: string;
  occasion?: string[];
  channelVisibility?: ChannelVisibility;
  trackingMode?: TrackingMode;
  isFeatured?: boolean;
  isActive?: boolean;
  // Create only: the units scanned while filling in the form. The server
  // assigns them in the same transaction that creates the product, so the
  // product and its stock either both exist or neither does.
  barcodes?: string[];
}

export interface ProductStats {
  activeCount: number;
  cap: number;
  remaining: number;
}

export const listCategories = (token: string) =>
  apiRequest<{ data: AdminCategory[] }>('/admin/categories', { token });

export const createCategory = (token: string, data: CategoryInput) =>
  apiRequest<{ data: AdminCategory }>('/admin/categories', { method: 'POST', token, body: data as any });

export const updateCategory = (token: string, categoryId: string, data: Partial<CategoryInput>) =>
  apiRequest<{ data: AdminCategory }>(`/admin/categories/${categoryId}`, { method: 'PATCH', token, body: data as any });

export const listSubcategories = (token: string, categoryId: string) =>
  apiRequest<{ data: AdminSubcategory[] }>(`/admin/categories/${categoryId}/subcategories`, { token });

/**
 * One page of a category's subcategories, optionally filtered by name.
 * listSubcategories above (the whole list at once) stays for the pickers
 * that genuinely need every row, like the product form.
 */
export const listSubcategoriesPage = (
  token: string,
  categoryId: string,
  params: { page: number; pageSize: number; q?: string }
) => {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  if (params.q) qs.set('q', params.q);
  return apiRequest<{ data: { items: AdminSubcategory[]; total: number; page: number; pageSize: number } }>(
    `/admin/categories/${categoryId}/subcategories?${qs.toString()}`,
    { token }
  );
};

export const createSubcategory = (token: string, categoryId: string, data: SubcategoryInput) =>
  apiRequest<{ data: AdminSubcategory }>(`/admin/categories/${categoryId}/subcategories`, {
    method: 'POST',
    token,
    body: data as any,
  });

export const updateSubcategory = (token: string, subcategoryId: string, data: Partial<SubcategoryInput>) =>
  apiRequest<{ data: AdminSubcategory }>(`/admin/subcategories/${subcategoryId}`, {
    method: 'PATCH',
    token,
    body: data as any,
  });

export const listProducts = (
  token: string,
  params: { category?: string; q?: string; page?: number; pageSize?: number } = {}
) => {
  const qs = new URLSearchParams();
  if (params.category) qs.set('category', params.category);
  if (params.q) qs.set('q', params.q);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest<{
    data: { items: AdminProductSummary[]; total: number; page: number; pageSize: number; activeCount: number; cap: number; remaining: number };
  }>(`/admin/products${suffix}`, { token });
};

export const getProductStats = (token: string) =>
  apiRequest<{ data: ProductStats }>('/admin/products/stats', { token });

export const getProduct = (token: string, productId: string) =>
  apiRequest<{ data: AdminProductSummary }>(`/admin/products/${productId}`, { token });

export const createProduct = (token: string, data: ProductInput) =>
  apiRequest<{ data: AdminProductSummary }>('/admin/products', { method: 'POST', token, body: data as any });

export const updateProduct = (token: string, productId: string, data: Partial<ProductInput>) =>
  apiRequest<{ data: AdminProductSummary }>(`/admin/products/${productId}`, { method: 'PATCH', token, body: data as any });

export const uploadProductImage = (token: string, productId: string, image: UploadImageInput) =>
  uploadImage<AdminProductImage>(`/admin/products/${productId}/image`, token, image);

export const uploadCategoryImage = (token: string, categoryId: string, image: UploadImageInput) =>
  uploadImage<AdminCategory>(`/admin/categories/${categoryId}/image`, token, image);

export interface DeleteSubcategoryResult {
  id: string;
  name: string;
  productsDeleted: number;
  abandonedOrdersDeleted: number;
}

/**
 * Permanent removal — the server refuses with 409 if anything in the
 * subcategory has actually been sold, or if a checkout is holding its stock
 * right now. Hiding (updateSubcategory with isActive:false) is the
 * reversible, everyday alternative.
 */
export const deleteSubcategory = (token: string, subcategoryId: string) =>
  apiRequest<{ data: DeleteSubcategoryResult }>(`/admin/subcategories/${subcategoryId}`, {
    method: 'DELETE',
    token,
  });

export const uploadSubcategoryImage = (token: string, subcategoryId: string, image: UploadImageInput) =>
  uploadImage<AdminSubcategory>(`/admin/subcategories/${subcategoryId}/image`, token, image);
