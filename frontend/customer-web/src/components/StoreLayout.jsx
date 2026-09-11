import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, ShoppingBag, User, Menu, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import BrandMark from './BrandMark';
import './StoreLayout.css';

const NAV_SPRING = { type: 'spring', stiffness: 220, damping: 20, mass: 0.6 };

export default function StoreLayout() {
  const [categories, setCategories] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { isAuthenticated, user } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const navRef = useRef(null);
  const linkRefs = useRef({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Same sliding-indicator mechanism as the admin app's GlassTabBar (a
  // single spring-animated element tracking the active tab), adapted for a
  // variable-width, variable-count nav: rather than dividing the bar into
  // equal slots, this measures the active link's own box and slides the
  // pill to match. Recomputed on route change, once the category links
  // exist, and on resize (widths shift at the 1620px/900px breakpoints).
  const navItems = useMemo(
    () => [{ path: '/', label: 'Home' }, ...categories.map((cat) => ({ path: `/category/${cat.slug}`, label: cat.name }))],
    [categories]
  );

  const updateIndicator = useCallback(() => {
    const container = navRef.current;
    if (!container) return;
    const active = navItems.find((item) => (item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)));
    const el = active ? linkRefs.current[active.path] : null;
    if (!el) {
      setIndicator((prev) => (prev.opacity === 0 ? prev : { ...prev, opacity: 0 }));
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setIndicator({ left: elRect.left - containerRect.left + container.scrollLeft, width: elRect.width, opacity: 1 });
  }, [navItems, location.pathname]);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useEffect(() => {
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchTerm.trim();
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
  };

  return (
    <div className="store-shell">
      <header className="store-header">
        <div className="container store-header-inner">
          <button className="store-menu-toggle" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle menu">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <Link to="/" className="store-brand">
            <BrandMark size={38} />
            <span>Nandam Handlooms</span>
          </Link>

          <nav ref={navRef} className={`store-nav ${menuOpen ? 'open' : ''}`}>
            <motion.span
              className="store-nav-indicator"
              animate={{ x: indicator.left, width: indicator.width, opacity: indicator.opacity }}
              transition={NAV_SPRING}
            />
            <Link ref={(el) => { linkRefs.current['/'] = el; }} to="/" onClick={() => setMenuOpen(false)}>Home</Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                ref={(el) => { linkRefs.current[`/category/${cat.slug}`] = el; }}
                to={`/category/${cat.slug}`}
                onClick={() => setMenuOpen(false)}
              >
                {cat.name}
              </Link>
            ))}
            <div className="store-nav-mobile-only">
              {isAuthenticated ? (
                <>
                  <Link to="/account" onClick={() => setMenuOpen(false)}>My Account</Link>
                  <Link to="/account/orders" onClick={() => setMenuOpen(false)}>My Orders</Link>
                </>
              ) : (
                <Link to="/login" onClick={() => setMenuOpen(false)}>Login / Sign Up</Link>
              )}
            </div>
          </nav>

          <form className="store-search" onSubmit={handleSearch}>
            <Search size={17} className="store-search-icon" />
            <input
              type="search"
              placeholder="Search for sarees, shawls..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </form>

          <div className="store-header-actions">
            <Link to={isAuthenticated ? '/account' : '/login'} className="store-icon-link" title={isAuthenticated ? user?.userProfile?.firstName || 'Account' : 'Login'}>
              <User size={21} />
            </Link>
            <Link to="/cart" className="store-icon-link store-cart-link" title="Cart">
              <ShoppingBag size={21} />
              {itemCount > 0 && <span className="store-cart-badge">{itemCount}</span>}
            </Link>
          </div>
        </div>
      </header>

      <main className="store-main">
        <Outlet />
      </main>

      <footer className="store-footer">
        <div className="container store-footer-grid">
          <div>
            <div className="store-brand store-footer-brand">
              <BrandMark size={34} />
              <span>Nandam Handlooms</span>
            </div>
            <p className="store-footer-tagline">
              Handcrafted sarees and handloom textiles, woven by master artisans and delivered to your doorstep.
            </p>
          </div>

          <div>
            <h4>Shop</h4>
            <Link to="/shop">All Products</Link>
            {categories.map((cat) => (
              <Link key={cat.id} to={`/category/${cat.slug}`}>{cat.name}</Link>
            ))}
          </div>

          <div>
            <h4>Account</h4>
            <Link to="/account/orders">Track Order</Link>
            <Link to="/account">My Account</Link>
            <Link to="/cart">My Cart</Link>
          </div>

          <div>
            <h4>Visit Our Store</h4>
            <p className="store-footer-muted">
              #10-23, Opp. Brahmam Gari Temple, Hussain Katta<br />
              Old Mangalagiri, Guntur Dist<br />
              Andhra Pradesh – 522 503
            </p>
            <a className="store-footer-link" href="tel:+917382968566">Call Store: +91 73829 68566</a>
            <p className="store-footer-muted">Mon–Sun, 9:30 AM–8:30 PM IST</p>
            <a
              className="store-footer-link"
              href="https://maps.app.goo.gl/qK54PztChaCdGzMz6"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get Directions
            </a>
          </div>
        </div>
        <div className="store-footer-bottom">
          © {new Date().getFullYear()} Nandam Handlooms. Authenticity guaranteed.
        </div>
      </footer>
    </div>
  );
}
