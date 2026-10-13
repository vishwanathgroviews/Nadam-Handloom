import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import SubcategoryCard from '../components/SubcategoryCard';
import { api } from '../services/api';
import { staggerContainer } from '../utils/motion';
import './CategoryPage.css';

// A Category page is one level of navigation, not a product listing — it
// shows that category's Subcategories as a card grid (same visual pattern as
// the Home page's "Shop by Category" grid). Picking a Subcategory is what
// leads to an actual product listing; see SubcategoryPage.jsx.
export default function CategoryPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .getSubcategories(slug)
      .then(setData)
      .catch(() => setError('Failed to load this category'))
      .finally(() => setLoading(false));
  }, [slug]);

  const category = data?.category;
  const subcategories = data?.subcategories ?? [];

  return (
    <div className="container category-page">
      <div className="category-page-header">
        <div>
          <h1 className="section-title">{category?.name || 'Category'}</h1>
          {category?.description && <p className="section-subtitle">{category.description}</p>}
          {!category?.description && (
            <p className="section-subtitle">Select a weave style below to explore our authentic handloom collections</p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="category-grid">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="skeleton-card" style={{ aspectRatio: '3 / 4', height: 'auto' }}>
              <div className="skeleton-card-img" style={{ height: '100%' }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="state-block">
          <p className="alert alert-error">{error}</p>
          <Link to="/shop" className="btn btn-outline" style={{ marginTop: '14px' }}>
            Browse All Products
          </Link>
        </div>
      ) : subcategories.length === 0 ? (
        <div className="state-block category-empty-state">
          <div className="category-empty-icon">🪡</div>
          <h3>No collections available yet</h3>
          <p>Our weavers are currently crafting new designs for this category.</p>
          <Link to="/shop" className="btn btn-outline" style={{ marginTop: '16px' }}>
            Browse All Handlooms
          </Link>
        </div>
      ) : (
        <>
          <p className="category-result-count">
            {subcategories.length} handcrafted collection{subcategories.length !== 1 ? 's' : ''} available
          </p>
          <motion.div
            className="category-grid"
            variants={staggerContainer()}
            initial="hidden"
            animate="visible"
          >
            {subcategories.map((sub) => (
              <SubcategoryCard key={sub.id} categorySlug={slug} subcategory={sub} />
            ))}
          </motion.div>
        </>
      )}
    </div>
  );
}
