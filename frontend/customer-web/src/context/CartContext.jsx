import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CART_STORAGE_KEY = 'NANDAM_CART_V1';
const CartContext = createContext(undefined);

const readCart = () => {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // A cart saved before quantities were removed can still hold lines with
    // quantity > 1, or two lines for one product. Left alone those would be
    // priced as one piece but reserved as several at checkout, so they are
    // normalised on the way in: one line per product, one piece each.
    const seen = new Set();
    return parsed
      .filter((item) => {
        if (!item || seen.has(item.productId)) return false;
        seen.add(item.productId);
        return true;
      })
      .map((item) => ({ ...item, quantity: 1 }));
  } catch {
    return [];
  }
};

// Guest-friendly cart: lives entirely in localStorage so browsing and adding
// to cart never requires login. Checkout submits this list to the backend,
// which revalidates stock/price server-side before creating the order.
//
// There is no quantity anywhere on the storefront. Every listing is a single
// handloom piece, so a cart line is one piece and adding something already
// in the cart is a no-op rather than a second unit. Lines still carry
// `quantity: 1` because that is the shape the checkout API takes — it is a
// constant, never a control.
export function CartProvider({ children }) {
  const [items, setItems] = useState(readCart);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((product) => {
    setItems((prev) => {
      // Already in the cart — nothing to add, and nothing to increment.
      if (prev.some((i) => i.productId === product.id)) return prev;
      // Price/MRP are subcategory-level — every product in a subcategory shares them.
      const onlinePrice = Number(product.subcategory?.onlinePrice);
      return [
        ...prev,
        {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          price: onlinePrice,
          mrp: Number(product.subcategory?.mrp ?? onlinePrice),
          image: product.images?.[0]?.url ?? product.image,
          stock: product.availableCount,
          quantity: 1,
        },
      ];
    });
  }, []);

  const removeItem = useCallback((productId) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  // One line = one piece, so the subtotal is a plain sum of prices and the
  // count is simply how many lines there are.
  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.price, 0), [items]);
  const itemCount = items.length;

  const value = useMemo(
    () => ({ items, addItem, removeItem, clearCart, subtotal, itemCount }),
    [items, addItem, removeItem, clearCart, subtotal, itemCount]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
