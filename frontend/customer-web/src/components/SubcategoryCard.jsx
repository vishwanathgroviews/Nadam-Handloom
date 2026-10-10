import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeInUp } from '../utils/motion';

export default function SubcategoryCard({ categorySlug, subcategory }) {
  return (
    <motion.div variants={fadeInUp} className="category-card-motion">
      <Link
        to={`/category/${categorySlug}/${subcategory.id}`}
        className="category-card antigravity-card"
      >
        {subcategory.imageUrl ? (
          <img src={subcategory.imageUrl} alt={subcategory.name} loading="lazy" />
        ) : (
          <div className="category-card-placeholder" aria-hidden="true" />
        )}
        <div className="category-card-overlay antigravity-card-overlay">
          <span>{subcategory.name}</span>
        </div>
      </Link>
    </motion.div>
  );
}
