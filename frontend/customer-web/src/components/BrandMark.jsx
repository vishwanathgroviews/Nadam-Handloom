import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { mediaUrl } from '../utils/media';

// Renders the Nandam Handlooms circular logo, served from S3 (the source
// Images/NH_Logo_HD_Transparent.png was resized/compressed before upload —
// see frontend/customer-web/scripts/resize-logo.mjs). Falls back to the
// Sparkles glyph if the image is ever unreachable, so the header/footer
// never show a broken image.
export default function BrandMark({ size = 32, className = '' }) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return <Sparkles size={size * 0.7} className={`store-brand-icon ${className}`} />;
  }

  return (
    <img
      src={mediaUrl('brand/logo.png')}
      alt="Nandam Handlooms"
      width={size}
      height={size}
      className={`store-brand-logo ${className}`}
      onError={() => setBroken(true)}
    />
  );
}
