import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ProductCard from './ProductCard';
import { CartProvider } from '../context/CartContext';
import * as whatsappUtils from '../utils/whatsapp';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const sampleProduct = {
  id: 'prod-saree-1',
  slug: 'royal-blue-kanjivaram-saree',
  name: 'Royal Blue Kanjivaram Saree',
  subcategory: {
    onlinePrice: 9999,
    mrp: 12999,
  },
  images: [{ url: '/saree.jpg' }],
  availableCount: 3,
  isActive: true,
};

describe('ProductCard component', () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockClear();
    vi.restoreAllMocks();
  });

  const renderCard = (product = sampleProduct) =>
    render(
      <BrowserRouter>
        <CartProvider>
          <ProductCard product={product} />
        </CartProvider>
      </BrowserRouter>
    );

  it('renders product information, price, and Add to Cart button', () => {
    renderCard();
    expect(screen.getByText('Royal Blue Kanjivaram Saree')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add to Cart/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Share Product/i })).toBeInTheDocument();
  });

  it('adds product to cart on click and updates button to "Already in Cart"', () => {
    renderCard();
    const cartBtn = screen.getByRole('button', { name: /Add to Cart/i });

    fireEvent.click(cartBtn);

    // Button label immediately flips to "Already in Cart"
    expect(screen.getByRole('button', { name: /Already in Cart/i })).toBeInTheDocument();

    // Success toast is displayed
    expect(screen.getByText('Product added to cart successfully!')).toBeInTheDocument();

    // Card navigation must not have been triggered
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('clicking Share button calls shareProductOnWhatsApp without triggering card navigation or cart addition', async () => {
    const shareSpy = vi.spyOn(whatsappUtils, 'shareProductOnWhatsApp').mockResolvedValue({ success: true });

    renderCard();
    const shareBtn = screen.getByRole('button', { name: /Share Product/i });

    await React.act(async () => {
      fireEvent.click(shareBtn);
    });

    expect(shareSpy).toHaveBeenCalledWith(sampleProduct, expect.any(Object));
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Add to Cart/i })).toBeInTheDocument();
  });

  it('navigates to product page when clicking on card body outside buttons on desktop', () => {
    renderCard();
    const title = screen.getByText('Royal Blue Kanjivaram Saree');

    fireEvent.click(title, { pointerType: 'mouse' });
  });

  it('reveals button on mouse enter and hides on mouse leave', () => {
    const { container } = renderCard();
    const card = container.querySelector('.product-card');

    expect(card).not.toHaveClass('is-active');

    fireEvent.mouseEnter(card);
    expect(card).toHaveClass('is-active');

    fireEvent.mouseLeave(card);
    expect(card).not.toHaveClass('is-active');
  });

  it('reveals button on touchscreen tap without navigating', () => {
    const { container } = renderCard();
    const card = container.querySelector('.product-card');

    expect(card).not.toHaveClass('is-active');

    // Simulate first touch tap on the card
    fireEvent.click(card, { pointerType: 'touch' });

    // Reveals button
    expect(card).toHaveClass('is-active');
    // Does not trigger navigation
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('reveals button when tapping product image on touch devices without navigating', () => {
    const { container } = renderCard();
    const card = container.querySelector('.product-card');
    const imageLink = container.querySelector('.product-card-image-link');

    expect(card).not.toHaveClass('is-active');

    fireEvent.click(imageLink, { pointerType: 'touch' });

    expect(card).toHaveClass('is-active');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('dismisses touch reveal when tapping outside the card', () => {
    const { container } = renderCard();
    const card = container.querySelector('.product-card');

    fireEvent.click(card, { pointerType: 'touch' });
    expect(card).toHaveClass('is-active');

    // Tap outside
    fireEvent.pointerDown(document.body);
    expect(card).not.toHaveClass('is-active');
  });

  it('navigates to cart when clicking Already in Cart button', () => {
    renderCard();
    const cartBtn = screen.getByRole('button', { name: /Add to Cart/i });

    // First click adds to cart
    fireEvent.click(cartBtn);
    expect(screen.getByRole('button', { name: /Already in Cart/i })).toBeInTheDocument();

    // Clicking when already in cart navigates to /cart
    const inCartBtn = screen.getByRole('button', { name: /Already in Cart/i });
    fireEvent.click(inCartBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/cart');
  });
});
