import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeInUp, useTilt3D } from '../utils/motion';

const MotionLink = motion.create(Link);
const HOVER = { scale: 1.035 };
const TAP = { scale: 0.97 };

// A separate component (rather than inline in Home.jsx's .map()) because
// useTilt3D is a hook — it needs one call per card instance, which a loop
// body can't do directly. variants={fadeInUp} still comes from the parent
// grid's scroll-reveal context exactly as before; the pointer tilt is fully
// independent of that (see ProductCard.jsx's note on why hover/tilt props
// must stay separate from variants-driven state).
export default function CategoryCard({ category }) {
  const tilt = useTilt3D(14);

  return (
    <motion.div variants={fadeInUp} className="category-card-motion">
      <MotionLink
        to={`/category/${category.slug}`}
        className="category-card"
        whileHover={HOVER}
        whileTap={TAP}
        onMouseMove={tilt.onMouseMove}
        onMouseLeave={tilt.onMouseLeave}
        style={{ perspective: 900, rotateX: tilt.rotateX, rotateY: tilt.rotateY }}
      >
        <img src={category.imageUrl} alt={category.name} loading="lazy" />
        <div className="category-card-overlay">
          <span>{category.name}</span>
        </div>
      </MotionLink>
    </motion.div>
  );
}
