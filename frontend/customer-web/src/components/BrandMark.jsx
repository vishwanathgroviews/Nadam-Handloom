import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

// Renders the Groviews circular/bulb mark. Falls back to the
// Sparkles glyph if the image is ever unreachable, so the header/footer
// never show a broken image.
export default function BrandMark({ size = 32, className = '' }) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return <Sparkles size={size * 0.7} className={`store-brand-icon ${className}`} />;
  }

  return (
    <img
      src="/bulb-mark.png"
      alt="Groviews"
      width={size}
      height={size}
      className={`store-brand-logo ${className}`}
      onError={() => setBroken(true)}
    />
  );
}
