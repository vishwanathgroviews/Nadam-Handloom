import React from 'react';
import { Link } from 'react-router-dom';
import { formatPrice, discountPercent } from '../utils/format';

export default function ProductCard({ product }) {
  const image = product.images?.[0]?.url || product.image;
  // Price/MRP are subcategory-level — every product in a subcategory shares them.
  const onlinePrice = product.subcategory?.onlinePrice;
  const mrp = product.subcategory?.mrp;
  const discount = discountPercent(mrp, onlinePrice);

  return (
    <Link
      to={`/product/${product.slug}`}
      className="product-card antigravity-card"
    >
      <div className="product-card-image-wrap">
        {product.isFeatured && <span className="product-card-badge">Bestseller</span>}
        {image && <img src={image} alt={product.name} loading="lazy" />}
        {/* No sold-out overlay: the API only ever returns products that can
            be bought (see IN_STOCK in catalog.service.ts). Every listing is a
            single piece, so a sold one is gone rather than restockable. */}
      </div>
      <div className="product-card-body">
        {product.category?.name && <span className="product-card-category">{product.category.name}</span>}
        <span className="product-card-title">{product.name}</span>
        <div className="price-row">
          <span className="price-current">{formatPrice(onlinePrice)}</span>
          {discount > 0 && (
            <>
              <span className="price-mrp">{formatPrice(mrp)}</span>
              <span className="price-discount">{discount}% off</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
