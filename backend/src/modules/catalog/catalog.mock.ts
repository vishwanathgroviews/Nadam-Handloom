import fs from 'fs';
import path from 'path';
import { NotFoundError } from '../../utils/errors';
import { ListProductsQuery } from './catalog.schema';
import { SUBCATEGORIES_BY_CATEGORY_SLUG } from '../../mockData/subcategorySeedData';

export interface MockCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
}

export interface MockSubcategory {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  onlinePrice: number;
  mrp: number;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface MockProduct {
  id: string;
  slug: string;
  sku: string;
  name: string;
  categoryId: string;
  subcategoryId: string;
  technique: string | null;
  borderStyle: string | null;
  purity: string | null;
  zariTier: string | null;
  blouseType: string | null;
  pattern: string | null;
  color: string | null;
  fabric: string | null;
  occasion: string[];
  channelVisibility: string;
  trackingMode: string;
  stock: number;
  isFeatured: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category: { name: string; slug: string; description: string };
  subcategory: {
    id: string;
    name: string;
    description: string;
    onlinePrice: number;
    mrp: number;
    isActive: boolean;
  };
  images: { id: string; url: string; sortOrder: number; altText?: string }[];
  availableCount: number;
}

export const MOCK_CATEGORIES: MockCategory[] = [
  {
    id: 'cat-handloom-pattu-saree',
    name: 'Handloom Pattu Saree',
    slug: 'handloom-pattu-saree',
    sortOrder: 1,
    imageUrl: 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/categories/handloom-pattu-saree.jpg',
    description: 'Pure and regular pattu silk sarees, handwoven with Kanchi, temple, and scallop zari borders.',
    isActive: true,
  },
  {
    id: 'cat-handloom-cotton-saree',
    name: 'Handloom Cotton Saree',
    slug: 'handloom-cotton-saree',
    sortOrder: 2,
    imageUrl: 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/categories/handloom-cotton-saree.jpg',
    description: 'Breathable handloom cotton sarees in checks, stripes, and block prints for daily and festive wear.',
    isActive: true,
  },
  {
    id: 'cat-handloom-pattu-dress-material',
    name: 'Handloom Pattu Dress Material',
    slug: 'handloom-pattu-dress-material',
    sortOrder: 3,
    imageUrl: 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/categories/handloom-pattu-dress-material.jpg',
    description: 'Pattu silk dress materials with applique, Tanjore painting, Shibori, and Kalamkari work.',
    isActive: true,
  },
  {
    id: 'cat-handloom-cotton-dress-material',
    name: 'Handloom Cotton Dress Material',
    slug: 'handloom-cotton-dress-material',
    sortOrder: 4,
    imageUrl: 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/categories/handloom-cotton-dress-material.jpg',
    description: 'Handloom cotton dress materials in plain weaves, embossed prints, and temple borders.',
    isActive: true,
  },
  {
    id: 'cat-pattu-lehanga-sets',
    name: 'Pattu Lehanga Sets',
    slug: 'pattu-lehanga-sets',
    sortOrder: 5,
    imageUrl: 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/categories/pattu-lehanga-sets.jpg',
    description: 'Pattu lehanga sets with digital prints, Kalamkari voni, Kutch embroidery, and hand-painted work.',
    isActive: true,
  },
  {
    id: 'cat-fabrics',
    name: 'Fabrics',
    slug: 'fabrics',
    sortOrder: 6,
    imageUrl: 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/categories/fabrics.jpg',
    description: 'Handloom fabric yardage — pure and regular pattu and cotton material sold by the piece for tailoring.',
    isActive: true,
  },
];

const CATEGORY_DEFAULT_PRICING: Record<string, { onlinePrice: number; mrp: number }> = {
  'handloom-pattu-saree': { onlinePrice: 12999, mrp: 16999 },
  'handloom-cotton-saree': { onlinePrice: 2999, mrp: 4499 },
  'handloom-pattu-dress-material': { onlinePrice: 6999, mrp: 8999 },
  'handloom-cotton-dress-material': { onlinePrice: 2199, mrp: 2999 },
  'pattu-lehanga-sets': { onlinePrice: 1999, mrp: 2999 },
  fabrics: { onlinePrice: 1499, mrp: 1999 },
};

function resolveJsonPath(fileName: string): string {
  const localPath = path.resolve(__dirname, '../../mockData', fileName);
  if (fs.existsSync(localPath)) return localPath;
  const docsPath = path.resolve(process.cwd(), '../docs/design/ui-mockup/build', fileName);
  if (fs.existsSync(docsPath)) return docsPath;
  return localPath;
}

let loadedSubcategories: MockSubcategory[] = [];
let loadedProducts: MockProduct[] = [];
let initialized = false;

function initMockStore() {
  if (initialized) return;
  initialized = true;

  try {
    const collPath = resolveJsonPath('collections-raw.json');
    if (fs.existsSync(collPath)) {
      const rawColls = JSON.parse(fs.readFileSync(collPath, 'utf8'));
      loadedSubcategories = rawColls.map((c: any, index: number) => ({
        id: c.id || `sub-pattu-${index + 1}`,
        categoryId: 'cat-handloom-pattu-saree',
        name: c.name,
        description: c.description || '',
        onlinePrice: Number(c.onlinePrice) || 2800,
        mrp: Number(c.mrp) || 16999,
        imageUrl: c.imageUrl || null,
        sortOrder: index + 1,
        isActive: true,
      }));
    }
  } catch (err) {
    console.warn('Failed to load collections-raw.json for mock store:', err);
  }

  // Populate any missing subcategories from canonical SUBCATEGORIES_BY_CATEGORY_SLUG
  for (const cat of MOCK_CATEGORIES) {
    const canonicalNames = SUBCATEGORIES_BY_CATEGORY_SLUG[cat.slug] || [];
    const pricing = CATEGORY_DEFAULT_PRICING[cat.slug] || { onlinePrice: 2499, mrp: 3999 };

    canonicalNames.forEach((name, idx) => {
      const exists = loadedSubcategories.some((s) => s.categoryId === cat.id && s.name.toLowerCase() === name.toLowerCase());
      if (!exists) {
        loadedSubcategories.push({
          id: `sub-${cat.slug}-${idx + 1}`,
          categoryId: cat.id,
          name,
          description: `${cat.name} — ${name}`,
          onlinePrice: pricing.onlinePrice,
          mrp: pricing.mrp,
          imageUrl: null,
          sortOrder: loadedSubcategories.length + 1,
          isActive: true,
        });
      }
    });
  }

  try {
    const prodPath = resolveJsonPath('products-raw.json');
    if (fs.existsSync(prodPath)) {
      const rawProducts = JSON.parse(fs.readFileSync(prodPath, 'utf8'));
      loadedProducts = rawProducts.map((p: any, index: number) => {
        const subId = p.subcategoryId || p.subcategory?.id;
        const sub = loadedSubcategories.find((s) => s.id === subId) || loadedSubcategories[0];
        const categorySlug = 'handloom-pattu-saree';
        const category = MOCK_CATEGORIES[0]!;

        return {
          id: p.id || `prod-${index + 1}`,
          slug: p.slug || `product-${index + 1}`,
          sku: p.sku || `NH-${index + 1}`,
          name: p.name,
          categoryId: category.id,
          subcategoryId: sub ? sub.id : 'sub-pattu-1',
          technique: p.technique || null,
          borderStyle: p.borderStyle || null,
          purity: p.purity || null,
          zariTier: p.zariTier || null,
          blouseType: p.blouseType || null,
          pattern: p.pattern || null,
          color: p.color || null,
          fabric: p.fabric || null,
          occasion: Array.isArray(p.occasion) ? p.occasion : [],
          channelVisibility: p.channelVisibility || 'both',
          trackingMode: p.trackingMode || 'serialized',
          stock: p.stock ?? 1,
          isFeatured: index < 16, // Top 16 sarees are featured bestsellers
          isActive: true,
          createdAt: p.createdAt || new Date(Date.now() - index * 3600000).toISOString(),
          updatedAt: p.updatedAt || new Date().toISOString(),
          category: {
            name: category.name,
            slug: category.slug,
            description: category.description,
          },
          subcategory: {
            id: sub ? sub.id : 'sub-pattu-1',
            name: sub ? sub.name : (p.subcategory?.name || 'Handloom Pattu Saree'),
            description: sub ? sub.description : (p.subcategory?.description || ''),
            onlinePrice: sub ? sub.onlinePrice : Number(p.subcategory?.onlinePrice || 2800),
            mrp: sub ? sub.mrp : Number(p.subcategory?.mrp || 16999),
            isActive: true,
          },
          images: (p.images && p.images.length > 0)
            ? p.images.map((img: any, i: number) => ({
                id: img.id || `img-${index}-${i}`,
                url: img.url,
                sortOrder: img.sortOrder ?? i,
                altText: img.altText || p.name,
              }))
            : [],
          availableCount: p.availableCount || 1,
        };
      });
    }
  } catch (err) {
    console.warn('Failed to load products-raw.json for mock store:', err);
  }
}

export const isMockDb = (): boolean =>
  process.env.USE_MOCK_DB === 'true' || process.env.DATABASE_URL === 'mock' || !process.env.DATABASE_URL;

export const mockListCategories = async (): Promise<MockCategory[]> => {
  initMockStore();
  return MOCK_CATEGORIES.filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
};

export const mockGetCategoryBySlug = async (slug: string): Promise<MockCategory> => {
  initMockStore();
  const normalized = slug === 'mangalagiri-handloom-pattu-sarees' ? 'handloom-pattu-saree' : slug;
  const category = MOCK_CATEGORIES.find((c) => c.slug === normalized || c.slug === slug);
  if (!category) throw new NotFoundError('Category not found');
  return category;
};

export const mockListSubcategoriesForCategory = async (categorySlug: string) => {
  initMockStore();
  const normalized = categorySlug === 'mangalagiri-handloom-pattu-sarees' ? 'handloom-pattu-saree' : categorySlug;
  const category = MOCK_CATEGORIES.find((c) => c.slug === normalized || c.slug === categorySlug);
  if (!category) throw new NotFoundError('Category not found');

  const subcategories = loadedSubcategories.filter((s) => s.categoryId === category.id && s.isActive);
  return {
    category: {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
    },
    subcategories: subcategories.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      onlinePrice: s.onlinePrice,
      mrp: s.mrp,
      imageUrl: s.imageUrl,
    })),
  };
};

export const mockListProducts = async (query: ListProductsQuery) => {
  initMockStore();

  let filtered = [...loadedProducts].filter((p) => p.isActive);

  if (query.category) {
    const normalized = query.category === 'mangalagiri-handloom-pattu-sarees' ? 'handloom-pattu-saree' : query.category;
    const cat = MOCK_CATEGORIES.find((c) => c.slug === normalized || c.slug === query.category);
    if (cat) {
      filtered = filtered.filter((p) => p.categoryId === cat.id || p.category.slug === cat.slug);
    }
  }

  if (query.subcategoryId) {
    filtered = filtered.filter((p) => p.subcategoryId === query.subcategoryId || p.subcategory.id === query.subcategoryId);
  }

  if (query.subCategory && query.subCategory.length > 0) {
    const requested = query.subCategory.map((s) => s.toLowerCase());
    filtered = filtered.filter((p) => requested.includes(p.subcategory.name.toLowerCase()));
  }

  if (query.featured !== undefined) {
    const isFeat = String(query.featured) === 'true';
    if (isFeat) {
      filtered = filtered.filter((p) => p.isFeatured);
    }
  }

  if (query.minPrice !== undefined) {
    filtered = filtered.filter((p) => p.subcategory.onlinePrice >= query.minPrice!);
  }

  if (query.maxPrice !== undefined) {
    filtered = filtered.filter((p) => p.subcategory.onlinePrice <= query.maxPrice!);
  }

  if (query.q) {
    const qLower = query.q.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(qLower) ||
        p.sku.toLowerCase().includes(qLower) ||
        (p.technique && p.technique.toLowerCase().includes(qLower)) ||
        (p.pattern && p.pattern.toLowerCase().includes(qLower)) ||
        (p.color && p.color.toLowerCase().includes(qLower)) ||
        p.subcategory.name.toLowerCase().includes(qLower)
    );
  }

  // Sorting
  const sort = query.sort || 'newest';
  if (sort === 'price_asc') {
    filtered.sort((a, b) => a.subcategory.onlinePrice - b.subcategory.onlinePrice);
  } else if (sort === 'price_desc') {
    filtered.sort((a, b) => b.subcategory.onlinePrice - a.subcategory.onlinePrice);
  } else if (sort === 'featured') {
    filtered.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
  } else {
    // newest
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const page = query.page || 1;
  const pageSize = query.pageSize || 20;
  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  return {
    items: paged,
    total: filtered.length,
    page,
    pageSize,
  };
};

export const mockGetProductBySlug = async (slug: string): Promise<MockProduct> => {
  initMockStore();
  const product = loadedProducts.find((p) => p.slug === slug || p.id === slug);
  if (!product) throw new NotFoundError('Product not found');
  return product;
};

export const mockGetAvailabilityForProducts = async (productIds: string[]) => {
  initMockStore();
  const unique = [...new Set(productIds)];
  return unique.map((id) => {
    const p = loadedProducts.find((prod) => prod.id === id);
    if (!p) return { productId: id, name: null, availableCount: 0, isPurchasable: false };
    return {
      productId: id,
      name: p.name,
      availableCount: p.availableCount || 1,
      isPurchasable: true,
    };
  });
};
