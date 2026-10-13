import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, CheckCircle2 } from 'lucide-react';
import { formatPrice, discountPercent } from '../utils/format';
import { useCart } from '../context/CartContext';
import ProductShareButton from './ProductShareButton';

export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const { isInCart, addItem } = useCart();
  const inCart = isInCart(product.id);

  const [isRevealed, setIsRevealed] = useState(false);
  const cardRef = useRef(null);
  const hideTimerRef = useRef(null);

  const image = product.images?.[0]?.url || product.image;
  // Price/MRP are subcategory-level — every product in a subcategory shares them.
  const onlinePrice = product.subcategory?.onlinePrice;
  const mrp = product.subcategory?.mrp;
  const discount = discountPercent(mrp, onlinePrice);

  const isAvailable =
    (product.availableCount !== undefined
      ? product.availableCount > 0
      : product.stock === undefined || product.stock > 0) && product.isActive !== false;

  // Clear auto-hide timer on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Dismiss touch activation when tapping outside the card
  useEffect(() => {
    if (!isRevealed) return;

    const handlePointerDownOutside = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        setIsRevealed(false);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      }
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [isRevealed]);

  const scheduleAutoHide = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setIsRevealed(false);
    }, 4500);
  };

  const isTouchInteraction = (e) => {
    if (e?.nativeEvent?.pointerType === 'touch') return true;
    if (typeof window !== 'undefined' && 'ontouchstart' in window) {
      if (typeof window.matchMedia === 'function') {
        return !window.matchMedia('(hover: hover)').matches;
      }
      return true;
    }
    return false;
  };

  const handleCardClick = (e) => {
    // If click originated from a button (e.g. Add to Cart or Share), let the button handle it
    if (e.target.closest('button')) {
      return;
    }

    const isTouch = isTouchInteraction(e);

    // On touchscreen devices: if the button is not yet revealed, reveal it without navigating
    if (isTouch && !isRevealed) {
      e.preventDefault();
      setIsRevealed(true);
      scheduleAutoHide();
      return;
    }

    // If already revealed or desktop mouse click on card outside link elements, navigate to PDP
    if (!e.target.closest('a')) {
      navigate(`/product/${product.slug}`);
    }
  };

  const handleImageClick = (e) => {
    const isTouch = isTouchInteraction(e);

    // On mobile touch: tapping the image reveals the button rather than immediately navigating
    if (isTouch && !isRevealed) {
      e.preventDefault();
      e.stopPropagation();
      setIsRevealed(true);
      scheduleAutoHide();
    }
  };

  const handleMouseEnter = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setIsRevealed(true);
  };

  const handleMouseLeave = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setIsRevealed(false);
  };

  const handleFocus = () => {
    setIsRevealed(true);
  };

  const handleBlur = (e) => {
    if (cardRef.current && !cardRef.current.contains(e.relatedTarget)) {
      setIsRevealed(false);
    }
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAvailable) return;

    if (inCart) {
      navigate('/cart');
      return;
    }

    addItem(product);
    // Keep revealed so user sees the immediate transition to "Already in Cart"
    setIsRevealed(true);
    scheduleAutoHide();
  };

  return (
    <div
      ref={cardRef}
      className={`product-card antigravity-card ${isRevealed ? 'is-active' : ''}`}
      onClick={handleCardClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      role="group"
      aria-label={product.name}
    >
      <div className="product-card-image-wrap">
        <Link
          to={`/product/${product.slug}`}
          className="product-card-image-link"
          onClick={handleImageClick}
          tabIndex="-1"
          aria-hidden="true"
        >
          {image && <img src={image} alt={product.name} loading="lazy" />}
        </Link>
        {product.isFeatured && <span className="product-card-badge">Bestseller</span>}
        <ProductShareButton product={product} />
      </div>
      <div className="product-card-body">
        {product.category?.name && <span className="product-card-category">{product.category.name}</span>}
        <Link to={`/product/${product.slug}`} className="product-card-title-link">
          <span className="product-card-title">{product.name}</span>
        </Link>
        <div className="price-row">
          <span className="price-current">{formatPrice(onlinePrice)}</span>
          {discount > 0 && (
            <>
              <span className="price-mrp">{formatPrice(mrp)}</span>
              <span className="price-discount">{discount}% off</span>
            </>
          )}
        </div>
        <div className="product-card-actions">
          <button
            type="button"
            className={`product-card-cart-btn ${inCart ? 'in-cart' : ''}`}
            onClick={handleAddToCart}
            disabled={!isAvailable}
            aria-label={inCart ? 'Already in Cart' : 'Add to Cart'}
          >
            {inCart ? (
              <>
                <CheckCircle2 size={14} className="cart-btn-icon" aria-hidden="true" />
                <span>Already in Cart</span>
              </>
            ) : (
              <>
                <ShoppingBag size={14} className="cart-btn-icon" aria-hidden="true" />
                <span>Add to Cart</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
