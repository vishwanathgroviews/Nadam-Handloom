import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProductDetail from './ProductDetail';
import { api } from '../services/api';
import { CartProvider } from '../context/CartContext';
import { DEFAULT_PAGE_TITLE } from '../utils/meta';

describe('ProductDetail metadata and rendering', () => {
  const mockProduct = {
    id: 'prod-001',
    name: 'Rani Pink Kanjivaram Pattu Silk Saree with Peacock Zari Border',
    slug: 'rani-pink-kanjivaram-pattu-silk-saree',
    sku: 'NH-PS-001',
    price: 12999,
    category: { name: 'Handloom Pattu Saree', slug: 'handloom-pattu-saree' },
    subcategory: {
      name: 'Double Zari lines',
      onlinePrice: 12999,
      mrp: 16999,
      description: 'Pure and regular pattu silk sarees with Kanchi border.',
    },
    images: [
      { id: 'img-1', url: 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/products/kanjivaram-rani-pink.jpg' },
      { id: 'img-2', url: 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/products/kanjivaram-rani-pink-detail.jpg' },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    document.title = DEFAULT_PAGE_TITLE;
    document.head.querySelectorAll('meta[data-dynamic-meta="true"]').forEach((el) => el.remove());
  });

  it('updates document.title and Open Graph meta tags when product loads', async () => {
    vi.spyOn(api, 'getProductBySlug').mockResolvedValueOnce(mockProduct);

    const { unmount } = render(
      <CartProvider>
        <MemoryRouter initialEntries={['/product/rani-pink-kanjivaram-pattu-silk-saree']}>
          <Routes>
            <Route path="/product/:slug" element={<ProductDetail />} />
          </Routes>
        </MemoryRouter>
      </CartProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: mockProduct.name })).toBeInTheDocument();
    });

    expect(document.title).toBe(`${mockProduct.name} | Groviews`);

    const ogTitle = document.head.querySelector('meta[property="og:title"]');
    const ogDesc = document.head.querySelector('meta[property="og:description"]');
    const ogImg = document.head.querySelector('meta[property="og:image"]');
    const ogUrl = document.head.querySelector('meta[property="og:url"]');
    const ogType = document.head.querySelector('meta[property="og:type"]');
    const ogSite = document.head.querySelector('meta[property="og:site_name"]');

    expect(ogTitle?.getAttribute('content')).toBe(mockProduct.name);
    expect(ogDesc?.getAttribute('content')).toBe('Pure and regular pattu silk sarees with Kanchi border.');
    expect(ogImg?.getAttribute('content')).toBe('https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/products/kanjivaram-rani-pink.jpg');
    expect(ogUrl?.getAttribute('content')).toBe('https://groviews.com/product/rani-pink-kanjivaram-pattu-silk-saree');
    expect(ogType?.getAttribute('content')).toBe('product');
    expect(ogSite?.getAttribute('content')).toBe('Groviews');

    // Unmount and check cleanup
    unmount();
    expect(document.title).toBe(DEFAULT_PAGE_TITLE);
    expect(document.head.querySelectorAll('meta[data-dynamic-meta="true"]').length).toBe(0);
  });
});
