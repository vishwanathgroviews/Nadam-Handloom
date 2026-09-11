import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/format';
import './CartPage.css';

export default function CartPage() {
  const { items, updateQuantity, removeItem, subtotal } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="container state-block cart-empty">
        <ShoppingBag size={44} />
        <h3>Your cart is empty</h3>
        <p>Browse our collections and add something you love.</p>
        <Link to="/shop" className="btn btn-primary">Start Shopping</Link>
      </div>
    );
  }

  // Nothing is added on top of the items — no shipping fee is ever charged.
  const total = subtotal;

  return (
    <div className="container cart-page">
      <h1 className="section-title">Your Cart</h1>

      <div className="cart-layout">
        <div className="cart-items">
          {items.map((item) => (
            <div className="cart-item" key={item.productId}>
              <Link to={`/product/${item.slug}`} className="cart-item-image">
                <img src={item.image} alt={item.name} />
              </Link>
              <div className="cart-item-details">
                <Link to={`/product/${item.slug}`} className="cart-item-name">{item.name}</Link>
                <span className="price-current">{formatPrice(item.price)}</span>

                <div className="cart-item-controls">
                  <div className="quantity-stepper">
                    <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} aria-label="Decrease quantity">
                      <Minus size={14} />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      aria-label="Increase quantity"
                      disabled={item.stock !== undefined && item.quantity >= item.stock}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <button className="cart-item-remove" onClick={() => removeItem(item.productId)}>
                    <Trash2 size={15} /> Remove
                  </button>
                </div>
              </div>
              <span className="cart-item-line-total">{formatPrice(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>

        <aside className="cart-summary">
          <h3>Order Summary</h3>
          <div className="cart-summary-row">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="cart-summary-row cart-summary-total">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
          <button className="btn btn-primary btn-block" onClick={() => navigate('/checkout')}>
            Proceed to Checkout
          </button>
          <Link to="/shop" className="cart-continue-link">Continue Shopping</Link>
        </aside>
      </div>
    </div>
  );
}
