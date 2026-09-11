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
      <div className="breadcrumb">
        <Link to="/">Home</Link> <span>/</span> <span>{category?.name || 'Category'}</span>
      </div>

      <div className="category-page-header">
        <div>
          <h1 className="section-title">{category?.name || 'Category'}</h1>
          {category?.description && <p className="section-subtitle">{category.description}</p>}
        </div>
      </div>

      {loading ? (
        <p className="state-block">Loading…</p>
      ) : error ? (
        <p className="state-block">{error}</p>
      ) : subcategories.length === 0 ? (
        <p className="state-block">No subcategories available yet.</p>
      ) : (
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
      )}
    </div>
  );
}
