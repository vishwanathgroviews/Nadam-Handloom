import React, { useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_LOGO_URL } from '../utils/media';
import { colors } from '../utils/theme';

// The Nandam Handlooms logo mark, with a graceful glyph fallback if the S3
// image is ever unreachable.
export default function BrandMark({ size }: { size: number }) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <Ionicons name="sparkles" size={size * 0.6} color={colors.secondary} style={[styles.fallbackIcon, { width: size }]} />
    );
  }
  return (
    <Image
      source={{ uri: BRAND_LOGO_URL }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.background }}
      onError={() => setBroken(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallbackIcon: { textAlign: 'center' },
});
