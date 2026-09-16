import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CartProvider, useCart } from './CartContext';

const wrapper = ({ children }) => <CartProvider>{children}</CartProvider>;

// Price/MRP are subcategory-level now — CartContext reads them off product.subcategory.
const PRODUCT_A = { id: 'prod-a', slug: 'saree-a', name: 'Saree A', subcategory: { onlinePrice: 1000, mrp: 1500 }, images: [{ url: '/a.jpg' }], availableCount: 5 };
const PRODUCT_B = { id: 'prod-b', slug: 'saree-b', name: 'Saree B', subcategory: { onlinePrice: 2500, mrp: 2500 }, images: [{ url: '/b.jpg' }], availableCount: 2 };

beforeEach(() => {
  localStorage.clear();
});

describe('CartContext', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toHaveLength(0);
    expect(result.current.itemCount).toBe(0);
    expect(result.current.subtotal).toBe(0);
  });

  it('adds a new product to the cart as a single piece', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(PRODUCT_A));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({ productId: 'prod-a', quantity: 1, price: 1000 });
    expect(result.current.itemCount).toBe(1);
    expect(result.current.subtotal).toBe(1000);
  });

  // The storefront has no quantity control at all — adding the same listing
  // twice must not quietly turn into two pieces of it.
  it('adding the same product again leaves the cart unchanged', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(PRODUCT_A));
    act(() => result.current.addItem(PRODUCT_A));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(1);
    expect(result.current.itemCount).toBe(1);
    expect(result.current.subtotal).toBe(1000);
  });

  it('does not expose a way to change quantity', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.updateQuantity).toBeUndefined();
  });

  it('computes subtotal correctly across multiple distinct products', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(PRODUCT_A)); // 1000
    act(() => result.current.addItem(PRODUCT_B)); // 2500

    expect(result.current.items).toHaveLength(2);
    expect(result.current.itemCount).toBe(2);
    expect(result.current.subtotal).toBe(3500);
  });

  it('removes an item explicitly', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(PRODUCT_A));
    act(() => result.current.addItem(PRODUCT_B));
    act(() => result.current.removeItem('prod-a'));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].productId).toBe('prod-b');
  });

  it('clears the cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(PRODUCT_A));
    act(() => result.current.clearCart());

    expect(result.current.items).toHaveLength(0);
  });

  it('persists to localStorage and restores on next mount (guest cart survives reload)', () => {
    const { result, unmount } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(PRODUCT_A));
    unmount();

    const stored = JSON.parse(localStorage.getItem('NANDAM_CART_V1'));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ productId: 'prod-a', quantity: 1 });

    const { result: result2 } = renderHook(() => useCart(), { wrapper });
    expect(result2.current.items).toHaveLength(1);
    expect(result2.current.itemCount).toBe(1);
  });

  // A cart saved by the previous build could hold multi-unit lines. Priced as
  // one piece but reserved as three, they would have oversold stock at
  // checkout, so they are flattened the moment they are read back.
  it('normalises a cart saved before quantities were removed', () => {
    localStorage.setItem(
      'NANDAM_CART_V1',
      JSON.stringify([
        { productId: 'prod-a', slug: 'saree-a', name: 'Saree A', price: 1000, quantity: 3 },
        { productId: 'prod-a', slug: 'saree-a', name: 'Saree A', price: 1000, quantity: 1 },
        { productId: 'prod-b', slug: 'saree-b', name: 'Saree B', price: 2500, quantity: 2 },
      ])
    );

    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items.every((i) => i.quantity === 1)).toBe(true);
    expect(result.current.itemCount).toBe(2);
    expect(result.current.subtotal).toBe(3500);
  });

  it('ignores corrupted localStorage data instead of crashing', () => {
    localStorage.setItem('NANDAM_CART_V1', '{not valid json');
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toHaveLength(0);
  });
});
