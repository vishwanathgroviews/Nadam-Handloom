import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Search, LayoutGrid, ShoppingBag, X, ChevronRight, ChevronDown, ArrowRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { api } from '../services/api';
import './MobileBottomNav.css';

const POPULAR_SEARCHES = [
  'Pattu Sarees',
  'Cotton Sarees',
  'Dress Materials',
  'Lehanga Sets',
  'Kalamkari',
  'Zari Border',
  'Temple Border',
  'Bandini',
];

export default function MobileBottomNav({ categories = [] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { itemCount } = useCart();

  const [searchOpen, setSearchOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCat, setExpandedCat] = useState(null);
  const [subcategoriesMap, setSubcategoriesMap] = useState({});
  const [loadingSubcat, setLoadingSubcat] = useState(false);
  const searchInputRef = useRef(null);

  // Close modals on route change
  useEffect(() => {
    setSearchOpen(false);
    setCategoriesOpen(false);
  }, [location.pathname, location.search]);

  // Lock body scroll when a drawer/modal is open
  useEffect(() => {
    if (searchOpen || categoriesOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [searchOpen, categoriesOpen]);

  // Focus search input when search sheet opens
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
    }
  }, [searchOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setCategoriesOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch subcategories when expanding a category in the drawer
  const handleToggleExpand = async (slug, e) => {
    e.stopPropagation();
    if (expandedCat === slug) {
      setExpandedCat(null);
      return;
    }
    setExpandedCat(slug);
    if (!subcategoriesMap[slug]) {
      setLoadingSubcat(true);
      try {
        const data = await api.getSubcategories(slug);
        setSubcategoriesMap((prev) => ({
          ...prev,
          [slug]: data.subcategories || [],
        }));
      } catch {
        setSubcategoriesMap((prev) => ({
          ...prev,
          [slug]: [],
        }));
      } finally {
        setLoadingSubcat(false);
      }
    }
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      navigate(`/shop?q=${encodeURIComponent(q)}`);
      setSearchOpen(false);
      setSearchQuery('');
    } else {
      navigate('/shop');
      setSearchOpen(false);
    }
  };

  const handlePopularSearch = (term) => {
    setSearchQuery(term);
    navigate(`/shop?q=${encodeURIComponent(term)}`);
    setSearchOpen(false);
    setSearchQuery('');
  };

  // Do not render bottom nav on checkout / payment routes
  const isCheckout = location.pathname.startsWith('/checkout') || location.pathname.startsWith('/order-confirmation');
  if (isCheckout) {
    return null;
  }

  // Active state calculations
  const queryParam = new URLSearchParams(location.search).get('q');
  const isHomeActive = location.pathname === '/' && !searchOpen && !categoriesOpen;
  const isSearchActive = searchOpen || (location.pathname === '/shop' && Boolean(queryParam));
  const isCategoriesActive = categoriesOpen || location.pathname.startsWith('/category');
  const isCartActive = location.pathname === '/cart' && !searchOpen && !categoriesOpen;

  return (
    <>
      {/* Fixed Sticky Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <button
          type="button"
          className={`mobile-nav-item ${isHomeActive ? 'active' : ''}`}
          onClick={() => {
            setSearchOpen(false);
            setCategoriesOpen(false);
            navigate('/');
          }}
          aria-label="Home"
        >
          <Home size={20} className="mobile-nav-icon" />
          <span className="mobile-nav-label">Home</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-item ${isSearchActive ? 'active' : ''}`}
          onClick={() => {
            setCategoriesOpen(false);
            setSearchOpen((prev) => !prev);
          }}
          aria-label="Search"
          aria-expanded={searchOpen}
        >
          <Search size={20} className="mobile-nav-icon" />
          <span className="mobile-nav-label">Search</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-item ${isCategoriesActive ? 'active' : ''}`}
          onClick={() => {
            setSearchOpen(false);
            setCategoriesOpen((prev) => !prev);
          }}
          aria-label="Categories"
          aria-expanded={categoriesOpen}
        >
          <LayoutGrid size={20} className="mobile-nav-icon" />
          <span className="mobile-nav-label">Categories</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-item ${isCartActive ? 'active' : ''}`}
          onClick={() => {
            setSearchOpen(false);
            setCategoriesOpen(false);
            navigate('/cart');
          }}
          aria-label={`Cart with ${itemCount} items`}
        >
          <div className="mobile-nav-icon-wrap">
            <ShoppingBag size={20} className="mobile-nav-icon" />
            {itemCount > 0 && (
              <span className="mobile-cart-badge">{itemCount > 99 ? '99+' : itemCount}</span>
            )}
          </div>
          <span className="mobile-nav-label">Cart</span>
        </button>
      </nav>

      {/* Search Sheet Overlay */}
      <AnimatePresence>
        {searchOpen && (
          <div className="mobile-overlay-root">
            <motion.div
              className="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSearchOpen(false)}
            />
            <motion.div
              className="mobile-sheet mobile-search-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            >
              <div className="mobile-sheet-header">
                <h3>Search Products</h3>
                <button
                  type="button"
                  className="mobile-sheet-close"
                  onClick={() => setSearchOpen(false)}
                  aria-label="Close search"
                >
                  <X size={20} />
                </button>
              </div>

              <form className="mobile-search-form" onSubmit={handleSearchSubmit}>
                <div className="mobile-search-input-wrap">
                  <Search size={18} className="mobile-search-input-icon" />
                  <input
                    ref={searchInputRef}
                    type="search"
                    placeholder="Search sarees, dress materials..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mobile-search-input"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="mobile-search-clear"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear query"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <button type="submit" className="mobile-search-btn">
                  Search
                </button>
              </form>

              <div className="mobile-search-suggestions">
                <span className="mobile-search-section-title">Popular Searches</span>
                <div className="mobile-search-tags">
                  {POPULAR_SEARCHES.map((term) => (
                    <button
                      key={term}
                      type="button"
                      className="mobile-search-tag"
                      onClick={() => handlePopularSearch(term)}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Categories Drawer Overlay */}
      <AnimatePresence>
        {categoriesOpen && (
          <div className="mobile-overlay-root">
            <motion.div
              className="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setCategoriesOpen(false)}
            />
            <motion.div
              className="mobile-sheet mobile-categories-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            >
              <div className="mobile-sheet-header">
                <h3>Categories</h3>
                <button
                  type="button"
                  className="mobile-sheet-close"
                  onClick={() => setCategoriesOpen(false)}
                  aria-label="Close categories"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mobile-categories-content">
                <button
                  type="button"
                  className="mobile-cat-all-btn"
                  onClick={() => {
                    navigate('/shop');
                    setCategoriesOpen(false);
                  }}
                >
                  <span>Explore All Sarees & Products</span>
                  <ArrowRight size={17} />
                </button>

                <div className="mobile-categories-list">
                  {categories.map((cat) => {
                    const isExpanded = expandedCat === cat.slug;
                    const subcats = subcategoriesMap[cat.slug] || [];

                    return (
                      <div key={cat.id} className="mobile-cat-group">
                        <div className="mobile-cat-row">
                          <button
                            type="button"
                            className="mobile-cat-link"
                            onClick={() => {
                              navigate(`/category/${cat.slug}`);
                              setCategoriesOpen(false);
                            }}
                          >
                            {cat.imageUrl && (
                              <img
                                src={cat.imageUrl}
                                alt={cat.name}
                                className="mobile-cat-thumb"
                                loading="lazy"
                              />
                            )}
                            <span className="mobile-cat-name">{cat.name}</span>
                          </button>
                          <button
                            type="button"
                            className={`mobile-cat-expand-btn ${isExpanded ? 'expanded' : ''}`}
                            onClick={(e) => handleToggleExpand(cat.slug, e)}
                            aria-label={`Toggle ${cat.name} subcategories`}
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? <ChevronDown size={19} /> : <ChevronRight size={19} />}
                          </button>
                        </div>

                        {/* Nested Subcategories Accordion */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              className="mobile-subcat-list"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.22 }}
                            >
                              <button
                                type="button"
                                className="mobile-subcat-link mobile-subcat-viewall"
                                onClick={() => {
                                  navigate(`/category/${cat.slug}`);
                                  setCategoriesOpen(false);
                                }}
                              >
                                View all {cat.name}
                              </button>
                              {loadingSubcat && subcats.length === 0 ? (
                                <p className="mobile-subcat-loading">Loading subcategories…</p>
                              ) : (
                                subcats.map((sub) => (
                                  <button
                                    key={sub.id}
                                    type="button"
                                    className="mobile-subcat-link"
                                    onClick={() => {
                                      navigate(`/category/${cat.slug}/${sub.id}`);
                                      setCategoriesOpen(false);
                                    }}
                                  >
                                    {sub.name}
                                  </button>
                                ))
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
