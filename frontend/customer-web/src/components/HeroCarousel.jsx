import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EASE } from '../utils/motion';
import './HeroCarousel.css';

const AUTO_PLAY_MS = 5500;

export default function HeroCarousel({ slides }) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);

  const goTo = useCallback((i) => setIndex((i + slides.length) % slides.length), [slides.length]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  // Previously paused for as long as the cursor stayed anywhere over the
  // section (image, caption, nav buttons, dots all included) — since the
  // hero fills the viewport width, a user's mouse resting there to read the
  // caption, or hovering the nav button to click "Next", kept it paused
  // indefinitely, which read as the carousel having stopped. Always
  // re-arming on `index` change (including a manual next/prev/dot click) is
  // enough on its own to keep it advancing.
  useEffect(() => {
    if (slides.length <= 1) return undefined;
    timerRef.current = setTimeout(() => setIndex((i) => (i + 1) % slides.length), AUTO_PLAY_MS);
    return () => clearTimeout(timerRef.current);
  }, [index, slides.length]);

  if (!slides?.length) return null;

  return (
    <section className="hero-carousel" aria-roledescription="carousel">
      <div className="hero-carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((slide, i) => (
          <div className="hero-slide" key={slide.id ?? i} aria-hidden={i !== index}>
            <motion.img
              src={slide.image}
              alt={slide.title}
              className="hero-slide-image"
              loading={i === 0 ? 'eager' : 'lazy'}
              animate={{ scale: i === index ? 1.08 : 1 }}
              transition={{ duration: 6, ease: 'linear' }}
            />
            <div className="hero-slide-overlay" />
            <motion.div
              className="hero-slide-content"
              initial={false}
              animate={i === index ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
              transition={{ duration: 0.6, ease: EASE, delay: i === index ? 0.2 : 0 }}
            >
              {slide.eyebrow && <span className="hero-eyebrow">{slide.eyebrow}</span>}
              <h1 className="hero-title">{slide.title}</h1>
              {slide.subtitle && <p className="hero-subtitle">{slide.subtitle}</p>}
              {slide.ctaText && slide.ctaLink && (
                <Link to={slide.ctaLink} className="btn btn-secondary hero-cta">
                  {slide.ctaText}
                </Link>
              )}
            </motion.div>
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <>
          <button className="hero-nav hero-nav-prev" onClick={prev} aria-label="Previous slide">
            <ChevronLeft size={22} />
          </button>
          <button className="hero-nav hero-nav-next" onClick={next} aria-label="Next slide">
            <ChevronRight size={22} />
          </button>

          <div className="hero-dots">
            {slides.map((slide, i) => (
              <button
                key={slide.id ?? i}
                className={`hero-dot ${i === index ? 'active' : ''}`}
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
