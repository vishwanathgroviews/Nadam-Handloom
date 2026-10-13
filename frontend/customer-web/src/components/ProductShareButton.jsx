import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { shareProductOnWhatsApp } from '../utils/whatsapp';
import './ProductShareButton.css';

/**
 * Small circular Share icon button positioned in the top-right corner of product images.
 * Shares the actual product image and exact product page link through WhatsApp via Web Share API
 * (with fallback to universal WhatsApp link sharing when file sharing is unavailable).
 */
export default function ProductShareButton({
  product,
  activeImageIndex = 0,
  className = '',
  size = 16,
  ariaLabel = 'Share Product',
  title = 'Share this product on WhatsApp',
}) {
  const [isSharing, setIsSharing] = useState(false);

  if (!product) return null;

  const handleShare = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isSharing) return;
    setIsSharing(true);

    try {
      await shareProductOnWhatsApp(product, { activeImageIndex });
    } catch (err) {
      console.error('WhatsApp product share error:', err);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <button
      type="button"
      className={`product-share-btn ${isSharing ? 'sharing' : ''} ${className}`.trim()}
      onClick={handleShare}
      aria-label={ariaLabel}
      title={title}
      disabled={isSharing}
    >
      <Share2 size={size} className="product-share-icon" aria-hidden="true" />
    </button>
  );
}
