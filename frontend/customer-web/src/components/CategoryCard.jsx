import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeInUp } from '../utils/motion';

export default function CategoryCard({ category }) {
  return (
    <motion.div variants={fadeInUp} className="category-card-motion">
      <Link
        to={`/category/${category.slug}`}
        className="category-card antigravity-card"
      >
        {category.imageUrl ? (
          <img src={category.imageUrl} alt={category.name} loading="lazy" />
        ) : (
          <div className="category-card-placeholder" aria-hidden="true" />
        )}
        <div className="category-card-overlay antigravity-card-overlay">
          <span>{category.name}</span>
        </div>
      </Link>
    </motion.div>
  );
}
