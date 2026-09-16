import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ShoppingBag, Zap, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { useCart } from '../context/CartContext';
import { formatPrice, discountPercent } from '../utils/format';
import './ProductDetail.css';

const ATTRIBUTE_LABELS = [
  ['technique', 'Work / Technique'],
  ['borderStyle', 'Border Style'],
  ['purity', 'Purity / Grade'],
  ['zariTier', 'Zari Tier'],
  ['blouseType', 'Blouse Type'],
  ['pattern', 'Pattern'],
  ['color', 'Color'],
  ['fabric', 'Fabric'],
];

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [product, setProduct] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setProduct(null);
    setActiveImage(0);
    setAdded(false);
    api
      .getProductBySlug(slug)
      .then(setProduct)
      .catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) {
    return (
      <div className="container state-block">
        <h3>Product not found</h3>
        <p>This saree may no longer be available.</p>
        <Link to="/shop" className="btn btn-outline">Continue Shopping</Link>
      </div>
    );
  }

  if (!product) {
    return <p className="container state-block">Loading…</p>;
  }

  // Price/MRP/description are subcategory-level — shared by every product in it.
  const onlinePrice = product.subcategory.onlinePrice;
  const mrp = product.subcategory.mrp;
  const discount = discountPercent(mrp, onlinePrice);
  // A unit received via the admin app's barcode intake flow only ever
  // creates a Piece row and never touches the legacy `stock` counter —
  // availableCount (stock + in-stock pieces) is what "in stock" means.
  const outOfStock = product.availableCount <= 0;

  // Each listing is a single piece — one tap puts that piece in the cart,
  // there is no amount to choose.
  const handleAddToCart = () => {
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    addItem(product);
    navigate('/checkout');
  };

  return (
    <div className="container product-detail">
      <div className="breadcrumb">
        <Link to="/">Home</Link> <span>/</span>{' '}
        <Link to={`/category/${product.category.slug}`}>{product.category.name}</Link> <span>/</span>{' '}
        <span>{product.name}</span>
      </div>

      <div className="product-detail-grid">
        <div className="product-gallery">
          <div className="product-gallery-main">
            <img src={product.images[activeImage]?.url} alt={product.name} />
          </div>
          {product.images.length > 1 && (
            <div className="product-gallery-thumbs">
              {product.images.map((img, i) => (
                <button
                  key={img.id}
                  className={`product-gallery-thumb ${i === activeImage ? 'active' : ''}`}
                  onClick={() => setActiveImage(i)}
                >
                  <img src={img.url} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="product-info">
          <span className="product-card-category">{product.category.name}</span>
          <h1 className="product-title">{product.name}</h1>

          <div className="price-row product-price-row">
            <span className="price-current">{formatPrice(onlinePrice)}</span>
            {discount > 0 && (
              <>
                <span className="price-mrp">{formatPrice(mrp)}</span>
                <span className="price-discount">{discount}% off</span>
              </>
            )}
          </div>

          {outOfStock ? (
            <span className="badge badge-danger">Out of Stock</span>
          ) : product.availableCount <= 5 ? (
            <span className="badge badge-danger">Only {product.availableCount} left</span>
          ) : (
            <span className="badge badge-success">In Stock</span>
          )}

          <p className="product-description">{product.subcategory.description}</p>

          <table className="product-attributes">
            <tbody>
              {ATTRIBUTE_LABELS.filter(([key]) => product[key]).map(([key, label]) => (
                <tr key={key}>
                  <td>{label}</td>
                  <td>{product[key]}</td>
                </tr>
              ))}
              {product.occasion?.length > 0 && (
                <tr>
                  <td>Occasion</td>
                  <td>{product.occasion.join(', ')}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="product-actions">
            <button className="btn btn-outline btn-block" onClick={handleAddToCart} disabled={outOfStock}>
              {added ? <><CheckCircle2 size={17} /> Added to Cart</> : <><ShoppingBag size={17} /> Add to Cart</>}
            </button>
            <button className="btn btn-primary btn-block" onClick={handleBuyNow} disabled={outOfStock}>
              <Zap size={17} /> Buy Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
