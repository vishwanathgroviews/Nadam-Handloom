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

  it('adds a new product to the cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(PRODUCT_A, 1));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({ productId: 'prod-a', quantity: 1, price: 1000 });
    expect(result.current.itemCount).toBe(1);
    expect(result.current.subtotal).toBe(1000);
  });

  it('increments quantity when the same product is added again', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(PRODUCT_A, 1));
    act(() => result.current.addItem(PRODUCT_A, 2));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(3);
    expect(result.current.itemCount).toBe(3);
    expect(result.current.subtotal).toBe(3000);
  });

  it('computes subtotal correctly across multiple distinct products', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(PRODUCT_A, 2)); // 2000
    act(() => result.current.addItem(PRODUCT_B, 1)); // 2500

    expect(result.current.items).toHaveLength(2);
    expect(result.current.itemCount).toBe(3);
    expect(result.current.subtotal).toBe(4500);
  });

  it('updates quantity directly', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(PRODUCT_A, 1));
    act(() => result.current.updateQuantity('prod-a', 4));

    expect(result.current.items[0].quantity).toBe(4);
    expect(result.current.subtotal).toBe(4000);
  });

  it('removes the item when quantity is updated to zero or below', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(PRODUCT_A, 1));
    act(() => result.current.updateQuantity('prod-a', 0));

    expect(result.current.items).toHaveLength(0);
  });

  it('removes an item explicitly', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(PRODUCT_A, 1));
    act(() => result.current.addItem(PRODUCT_B, 1));
    act(() => result.current.removeItem('prod-a'));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].productId).toBe('prod-b');
  });

  it('clears the cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(PRODUCT_A, 1));
    act(() => result.current.clearCart());

    expect(result.current.items).toHaveLength(0);
  });

  it('persists to localStorage and restores on next mount (guest cart survives reload)', () => {
    const { result, unmount } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(PRODUCT_A, 2));
    unmount();

    const stored = JSON.parse(localStorage.getItem('NANDAM_CART_V1'));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ productId: 'prod-a', quantity: 2 });

    const { result: result2 } = renderHook(() => useCart(), { wrapper });
    expect(result2.current.items).toHaveLength(1);
    expect(result2.current.itemCount).toBe(2);
  });

  it('ignores corrupted localStorage data instead of crashing', () => {
    localStorage.setItem('NANDAM_CART_V1', '{not valid json');
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toHaveLength(0);
  });
});
