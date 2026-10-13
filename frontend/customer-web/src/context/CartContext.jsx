import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import CartToast from '../components/CartToast';

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
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  // Keep a synchronous ref to items to immediately guard against rapid duplicate clicks
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2500); // Auto dismiss after 2.5 seconds (within 2–3s requirement)
  }, []);

  const isInCart = useCallback(
    (productId) => {
      if (!productId) return false;
      return items.some((i) => i.productId === productId);
    },
    [items]
  );

  const addItem = useCallback(
    (product) => {
      if (!product || !product.id) return false;

      // Stock and availability validation
      const isAvailable =
        (product.availableCount !== undefined
          ? product.availableCount > 0
          : product.stock === undefined || product.stock > 0) && product.isActive !== false;

      if (!isAvailable) {
        showToast('This item is currently sold out or unavailable.', 'error');
        return false;
      }

      // Check synchronous ref to prevent duplicate additions on rapid clicks
      if (itemsRef.current.some((i) => i.productId === product.id)) {
        return false;
      }

      const onlinePrice = Number(
        product.subcategory?.onlinePrice ?? product.onlinePrice ?? product.price ?? 0
      );
      const newItem = {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price: onlinePrice,
        mrp: Number(product.subcategory?.mrp ?? product.mrp ?? onlinePrice),
        image: product.images?.[0]?.url ?? product.image ?? product.imageUrl,
        stock: product.availableCount ?? product.stock ?? 1,
        quantity: 1,
      };

      itemsRef.current = [...itemsRef.current, newItem];
      setItems(itemsRef.current);
      showToast('Product added to cart successfully!', 'success');
      return true;
    },
    [showToast]
  );

  const removeItem = useCallback((productId) => {
    itemsRef.current = itemsRef.current.filter((i) => i.productId !== productId);
    setItems(itemsRef.current);
  }, []);

  const clearCart = useCallback(() => {
    itemsRef.current = [];
    setItems([]);
  }, []);

  // One line = one piece, so the subtotal is a plain sum of prices and the
  // count is simply how many lines there are.
  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.price, 0), [items]);
  const itemCount = items.length;

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      clearCart,
      subtotal,
      itemCount,
      isInCart,
      toast,
      showToast,
      dismissToast,
    }),
    [items, addItem, removeItem, clearCart, subtotal, itemCount, isInCart, toast, showToast, dismissToast]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <CartToast toast={toast} onDismiss={dismissToast} />
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}

