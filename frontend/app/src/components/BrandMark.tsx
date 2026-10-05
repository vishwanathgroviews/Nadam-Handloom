import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors } from '../utils/theme';

const BULB_MARK = require('../../assets/bulb-mark.png');

// The Groviews brand mark, rendered from local bundled asset for instant,
// crisp rendering with no remote network dependency.
export default function BrandMark({ size }: { size: number }) {
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image
        source={BULB_MARK}
        style={{ width: size * 0.75, height: size * 0.75 }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
});
