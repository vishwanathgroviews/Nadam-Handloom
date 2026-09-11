import { useMotionValue, useSpring } from 'framer-motion';

// Shared Framer Motion vocabulary — kept small and reused everywhere so the
// site's motion reads as one deliberate system rather than one-off effects.
// Easing mirrors the existing --transition-smooth CSS token; every variant
// animates only `transform`/`opacity`, so it stays GPU-friendly and never
// triggers layout.
export const EASE = [0.25, 0.8, 0.25, 1];

// A pointer-tracked 3D tilt — the card leans toward wherever the cursor is,
// spring-damped for a smooth, physical feel, and glides back to flat on
// mouse leave. This is the actual "3D" read a fixed few-degree hover lacks:
// the rotation direction and amount respond continuously to pointer
// position, not just an on/off hover state. Only meaningful with a mouse —
// touch devices never fire continuous mousemove, so it's a no-op there and
// falls back to whatever whileHover/whileTap the caller adds separately.
export function useTilt3D(strength = 16) {
  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);
  const spring = { stiffness: 300, damping: 22, mass: 0.6 };
  const rotateX = useSpring(rawRotateX, spring);
  const rotateY = useSpring(rawRotateY, spring);

  const onMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rawRotateY.set(px * strength * 2);
    rawRotateX.set(py * -strength * 2);
  };

  const onMouseLeave = () => {
    rawRotateX.set(0);
    rawRotateY.set(0);
  };

  return { rotateX, rotateY, onMouseMove, onMouseLeave };
}

export const viewportOnce = { once: true, amount: 0.2 };

export const fadeInUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

export const staggerContainer = (staggerChildren = 0.09, delayChildren = 0) => ({
  hidden: {},
  visible: { transition: { staggerChildren, delayChildren } },
});
