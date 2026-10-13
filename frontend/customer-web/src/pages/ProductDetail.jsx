import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ShoppingBag, Zap, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { useCart } from '../context/CartContext';
import { formatPrice, discountPercent } from '../utils/format';
import WhatsAppShareButton from '../components/WhatsAppShareButton';
import ProductShareButton from '../components/ProductShareButton';
import ProductCard from '../components/ProductCard';
import { updateProductMeta, resetProductMeta } from '../utils/meta';
import './ProductDetail.css';


export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem, isInCart } = useCart();

  const [product, setProduct] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState([]);

  useEffect(() => {
    setProduct(null);
    setActiveImage(0);
    api
      .getProductBySlug(slug)
      .then(setProduct)
      .catch(() => setNotFound(true));
  }, [slug]);

  useEffect(() => {
    if (product) {
      updateProductMeta(product, activeImage);
    }
    return () => {
      resetProductMeta();
    };
  }, [product, activeImage]);

  useEffect(() => {
    if (product?.category?.slug) {
      api.getProducts({ category: product.category.slug, pageSize: 5 })
        .then((res) => {
          setRelatedProducts((res.items || []).filter((p) => p.id !== product.id).slice(0, 4));
        })
        .catch(() => setRelatedProducts([]));
    }
  }, [product]);

  if (notFound) {
    return (
      <div className="container state-block">
        <h3>No longer available</h3>
        <p>This is a one-of-a-kind handloom piece, and it has been sold.</p>
        <Link to="/shop" className="btn btn-outline">Continue Shopping</Link>
      </div>
    );
  }

  if (!product) {
    return <p className="container state-block">Loading…</p>;
  }

  const inCart = isInCart(product.id);

  // Price/MRP/description are subcategory-level — shared by every product in it.
  const onlinePrice = product.subcategory.onlinePrice;
  const mrp = product.subcategory.mrp;
  const discount = discountPercent(mrp, onlinePrice);
  // A unit received via the admin app's barcode intake flow only ever
  // creates a Piece row and never touches the legacy `stock` counter —
  // The API 404s a sold product rather than returning it, so reaching this
  // page at all means it is available — the not-found branch above is what
  // an old link or a stale tab now lands on.

  const isAvailable =
    (product.availableCount !== undefined
      ? product.availableCount > 0
      : product.stock === undefined || product.stock > 0) && product.isActive !== false;

  const handleAddToCart = () => {
    if (!isAvailable) return;
    if (inCart) {
      navigate('/cart');
      return;
    }
    addItem(product);
  };

  const handleBuyNow = () => {
    if (!isAvailable) return;
    if (!inCart) {
      addItem(product);
    }
    navigate('/checkout');
  };

  return (
    <div className="container product-detail">
      <div className="product-detail-grid">
        <div className="product-gallery">
          <div className="product-gallery-main">
            <img src={product.images[activeImage]?.url} alt={product.name} />
            <ProductShareButton product={product} activeImageIndex={activeImage} />
          </div>
        </div>

        <div className="product-info">
          <span className="product-card-category">{product.category.name}</span>
          <h1 className="product-title">{product.name}</h1>

          <div className="price-row product-price-row">
            <span className="price-current">{formatPrice(onlinePrice)}</span>
            {discount > 0 && (
              <>
                <span className="price-mrp">{formatPrice(mrp)}</span>
                <span className="pdp-savings-badge">
                  Save {formatPrice(mrp - onlinePrice)} ({discount}% OFF)
                </span>
              </>
            )}
          </div>

          <div className="pdp-status-row">
            {isAvailable ? (
              <span className="badge badge-success">
                <span className="status-dot green" /> In Stock &amp; Ready to Ship
              </span>
            ) : (
              <span className="badge badge-danger">
                <span className="status-dot red" /> Currently Sold Out
              </span>
            )}
          </div>

          <p className="product-description">{product.subcategory.description}</p>

          {/* Genuine Trust Assurance Card */}
          <div className="pdp-trust-box">
            <div className="pdp-trust-item">
              <span className="pdp-trust-icon">🪡</span>
              <div className="pdp-trust-text">
                <strong>100% Authentic Handloom</strong>
                <p>Individually handwoven on pitlooms by Mangalagiri master weavers</p>
              </div>
            </div>
            <div className="pdp-trust-item">
              <span className="pdp-trust-icon">📦</span>
              <div className="pdp-trust-text">
                <strong>Insured Express Delivery</strong>
                <p>Carefully inspected, securely packaged, and shipped pan-India</p>
              </div>
            </div>
            <div className="pdp-trust-item">
              <span className="pdp-trust-icon">🏷️</span>
              <div className="pdp-trust-text">
                <strong>Direct Weaver Pricing</strong>
                <p>Certified pure silk and cotton with zero middleman markup</p>
              </div>
            </div>
          </div>

          {isAvailable ? (
            <div className="product-actions">
              <button
                type="button"
                className={`btn btn-block ${inCart ? 'btn-in-cart' : 'btn-outline'}`}
                onClick={handleAddToCart}
                aria-label={inCart ? 'Already in Cart' : 'Add to Cart'}
              >
                {inCart ? (
                  <>
                    <CheckCircle2 size={17} /> Already in Cart
                  </>
                ) : (
                  <>
                    <ShoppingBag size={17} /> Add to Cart
                  </>
                )}
              </button>
              <button className="btn btn-primary btn-block" onClick={handleBuyNow}>
                <Zap size={17} /> Buy Now
              </button>
              <WhatsAppShareButton product={product} activeImageIndex={activeImage} />
            </div>
          ) : (
            <div className="product-actions">
              <button
                type="button"
                className="btn btn-block"
                disabled
                style={{
                  opacity: 0.65,
                  cursor: 'not-allowed',
                  background: 'var(--bg-muted, #f3f3f3)',
                  color: 'var(--text-muted, #777)',
                  border: '1px solid var(--border-color, #e0e0e0)',
                }}
              >
                Sold Out / Unavailable for Purchase
              </button>
              <Link to="/shop" className="btn btn-outline btn-block" style={{ textAlign: 'center' }}>
                Browse Available Handlooms
              </Link>
              <WhatsAppShareButton product={product} activeImageIndex={activeImage} />
            </div>
          )}
        </div>
      </div>

      {/* Related Collection Recommendations */}
      {relatedProducts.length > 0 && (
        <section className="pdp-related-section">
          <div className="section-header">
            <div>
              <h2 className="section-title">You May Also Love</h2>
              <p className="section-subtitle">More handcrafted pieces from the same collection</p>
            </div>
            <Link to={`/category/${product.category.slug}`} className="section-link">
              View All in {product.category.name}
            </Link>
          </div>
          <div className="product-grid">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

