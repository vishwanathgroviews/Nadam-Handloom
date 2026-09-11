import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeInUp, useTilt3D } from '../utils/motion';

const MotionLink = motion.create(Link);
const HOVER = { scale: 1.035 };
const TAP = { scale: 0.97 };

// Mirrors CategoryCard.jsx's look and motion exactly (same tilt, hover, and
// gradient-overlay treatment) — a Category's Subcategory grid is meant to
// read as the same visual pattern as the Home page's "Shop by Category"
// grid, just one level deeper.
export default function SubcategoryCard({ categorySlug, subcategory }) {
  const tilt = useTilt3D(14);

  return (
    <motion.div variants={fadeInUp} className="category-card-motion">
      <MotionLink
        to={`/category/${categorySlug}/${subcategory.id}`}
        className="category-card"
        whileHover={HOVER}
        whileTap={TAP}
        onMouseMove={tilt.onMouseMove}
        onMouseLeave={tilt.onMouseLeave}
        style={{ perspective: 900, rotateX: tilt.rotateX, rotateY: tilt.rotateY }}
      >
        {subcategory.imageUrl && <img src={subcategory.imageUrl} alt={subcategory.name} loading="lazy" />}
        <div className="category-card-overlay">
          <span>{subcategory.name}</span>
        </div>
      </MotionLink>
    </motion.div>
  );
}
