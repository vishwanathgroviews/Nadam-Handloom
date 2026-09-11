import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import HeroCarousel from '../components/HeroCarousel';
import TraditionalBorder from '../components/TraditionalBorder';
import CategoryCard from '../components/CategoryCard';
import ProductCard from '../components/ProductCard';
import StoreLocation from '../components/StoreLocation';
import { api } from '../services/api';
import { mediaUrl } from '../utils/media';
import { fadeInUp, staggerContainer, viewportOnce } from '../utils/motion';
import './Home.css';

const HERO_SLIDES = [
  {
    id: 'pattu-saree',
    image: mediaUrl('hero/hero-pattu-zari-border.jpg'),
    eyebrow: 'New Arrivals',
    title: 'Woven in Zari & Gold',
    subtitle: 'Discover our latest handloom pattu silk sarees, handcrafted by master weavers using time-honoured techniques.',
    ctaText: 'Shop Pattu Sarees',
    ctaLink: '/category/handloom-pattu-saree',
  },
  {
    id: 'lehanga',
    image: mediaUrl('hero/hero-bridal-brocade.jpg'),
    eyebrow: 'The Bridal Edit',
    title: 'Pattu Lehanga Sets, Reimagined',
    subtitle: 'Rich brocade weaves and hand-painted Kalamkari voni for your most special occasions.',
    ctaText: 'Shop Lehanga Sets',
    ctaLink: '/category/pattu-lehanga-sets',
  },
  {
    id: 'cotton-saree',
    image: mediaUrl('hero/hero-cotton-checks.jpg'),
    eyebrow: 'Everyday Handloom',
    title: 'Cotton Checks, Woven by Hand',
    subtitle: 'Breathable handloom cotton sarees for effortless, everyday elegance.',
    ctaText: 'Shop Cotton Sarees',
    ctaLink: '/category/handloom-cotton-saree',
  },
  {
    id: 'kalamkari',
    image: mediaUrl('hero/hero-kalamkari-border.jpg'),
    eyebrow: 'Hand-Painted Heritage',
    title: 'Kalamkari, Border by Border',
    subtitle: 'Pen Kalamkari and hand-painted work on our pattu dress materials, each border painted by hand.',
    ctaText: 'Shop Dress Materials',
    ctaLink: '/category/handloom-pattu-dress-material',
  },
  {
    id: 'craft',
    image: mediaUrl('hero/hero-craft-story.jpg'),
    eyebrow: 'Our Craft',
    title: 'Crafted by Hand, Worn with Pride',
    subtitle: "Every saree begins on a handloom, guided by artisans who've perfected their craft over generations.",
    ctaText: 'Explore the Collection',
    ctaLink: '/shop',
  },
];

const CRAFT_IMAGES = [
  mediaUrl('craft/texture-gold-border-1.jpg'),
  mediaUrl('craft/texture-silver-border-1.jpg'),
  mediaUrl('craft/texture-mint-embroidery.jpg'),
  mediaUrl('craft/texture-mint-border.jpg'),
];

export default function Home() {
  const [categories, setCategories] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getCategories(), api.getProducts({ featured: true, pageSize: 8 })])
      .then(([cats, products]) => {
        setCategories(cats);
        setFeatured(products.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="home-page">
      <HeroCarousel slides={HERO_SLIDES} />
      <TraditionalBorder />

      <section className="section container">
        <motion.div
          className="section-header"
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          <div>
            <h2 className="section-title">Shop by Category</h2>
            <p className="section-subtitle">Curated collections from India's handloom heartlands</p>
          </div>
          <Link to="/shop" className="section-link">
            Explore Collection <ArrowRight size={15} />
          </Link>
        </motion.div>
        {categories.length > 0 && (
          // Mounted only once categories arrive: this container's whileInView
          // uses IntersectionObserver-based visibility measured against its
          // own layout box, and mounting it empty-then-filling it (rather
          // than mounting once real, non-zero-height content is ready) left
          // Framer Motion's initial 0-height measurement stuck, so the
          // reveal never fired even after real content arrived.
          <motion.div
            className="category-grid"
            variants={staggerContainer()}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
          >
            {categories.map((cat) => (
              <CategoryCard key={cat.id} category={cat} />
            ))}
          </motion.div>
        )}
      </section>

      <section className="section container">
        <motion.div
          className="section-header"
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          <div>
            <h2 className="section-title">Bestsellers</h2>
            <p className="section-subtitle">Loved by our customers, woven for you</p>
          </div>
          <Link to="/shop" className="section-link">
            View all <ArrowRight size={15} />
          </Link>
        </motion.div>
        {loading ? (
          <p className="state-block">Loading products…</p>
        ) : featured.length === 0 ? (
          <p className="state-block">New arrivals coming soon.</p>
        ) : (
          <motion.div
            className="product-grid"
            variants={staggerContainer(0.06)}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
          >
            {featured.map((product) => (
              <motion.div key={product.id} variants={fadeInUp}>
                <ProductCard product={product} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      <section className="craft-story">
        <div className="container craft-story-inner">
          <motion.div
            className="craft-story-text"
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
          >
            <span className="hero-eyebrow craft-eyebrow">Our Craft</span>
            <h2 className="section-title">Every Thread Has a Story</h2>
            <p>
              Nandam Handlooms works directly with weaver collectives to bring you pattu and cotton sarees, dress
              materials, and lehanga sets that carry generations of craft — from hand-painted Kalamkari to intricate
              zari brocade. No two pieces are ever quite the same.
            </p>
            <Link to="/shop" className="btn btn-outline">Explore the Collection</Link>
          </motion.div>
          <motion.div
            className="craft-story-collage"
            variants={staggerContainer(0.1)}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
          >
            {CRAFT_IMAGES.map((src) => (
              <motion.img
                key={src}
                src={src}
                alt="Handloom weave detail"
                loading="lazy"
                variants={fadeInUp}
                whileHover={{ scale: 1.05, transition: { duration: 0.4, ease: [0.25, 0.8, 0.25, 1] } }}
              />
            ))}
          </motion.div>
        </div>
      </section>

      <StoreLocation />
    </div>
  );
}
