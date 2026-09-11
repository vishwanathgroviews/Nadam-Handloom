import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatPrice, discountPercent } from '../utils/format';
import { useTilt3D } from '../utils/motion';

const MotionLink = motion.create(Link);

// whileHover/whileTap take plain objects (not variant labels) so this stays
// fully independent of the scroll-reveal `variants={fadeInUp}` applied by
// the parent wrapper in Home.jsx — a variant label + its own `initial` here
// would make this element its own animation root and block the parent's
// reveal state from ever reaching it (this is what silently kept the
// category cards stuck at opacity:0 until the hover-tilt was simplified the
// same way).
const HOVER = { y: -10, scale: 1.03 };
const TAP = { scale: 0.97 };

export default function ProductCard({ product }) {
  const image = product.images?.[0]?.url || product.image;
  // Price/MRP are subcategory-level — every product in a subcategory shares them.
  const onlinePrice = product.subcategory?.onlinePrice;
  const mrp = product.subcategory?.mrp;
  const discount = discountPercent(mrp, onlinePrice);
  // availableCount (stock + in-stock barcoded pieces) is what "in stock"
  // means — the raw `stock` counter alone misses units received by scanning
  // a barcode, which never touch it (see catalog.availability.ts).
  const outOfStock = product.availableCount <= 0;
  const tilt = useTilt3D(12);

  return (
    <MotionLink
      to={`/product/${product.slug}`}
      className="product-card"
      whileHover={HOVER}
      whileTap={TAP}
      onMouseMove={tilt.onMouseMove}
      onMouseLeave={tilt.onMouseLeave}
      style={{ perspective: 900, rotateX: tilt.rotateX, rotateY: tilt.rotateY }}
    >
      <div className="product-card-image-wrap">
        {product.isFeatured && <span className="product-card-badge">Bestseller</span>}
        {image && <img src={image} alt={product.name} loading="lazy" />}
        {outOfStock && <div className="product-card-out-of-stock">Out of Stock</div>}
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
    </MotionLink>
  );
}
