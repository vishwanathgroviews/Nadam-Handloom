import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// Keep the native launch screen up until the app is actually ready to draw —
// otherwise it drops to a blank frame while fonts load and the session is
// restored. Called at import time, before the first render.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden (e.g. a fast refresh in development) — nothing to hold.
});

const BRAND = '#5C1420';
const GOLD = '#E4C58A';
/** Must match imageWidth for expo-splash-screen in app.json, so the hand-over doesn't jump. */
const LOGO_SIZE = 180;

interface Props {
  /** True once fonts are loaded and the saved session has been checked. */
  ready: boolean;
}

/**
 * The launch animation.
 *
 * The phone shows the native launch screen (the logo on maroon) while the
 * JavaScript loads. This component draws exactly the same picture over the
 * app, so when the native screen is hidden nothing visibly changes. Then it
 * animates: the logo settles in with a soft gold ring, the name fades up
 * beneath it, and the whole layer lifts away to reveal the screen underneath.
 *
 * It waits for `ready` rather than a fixed timer, so it never uncovers a
 * half-loaded screen, and it is short (about 1.2s) so it never delays anyone.
 * If the phone has Reduce Motion on, it simply fades.
 */
export default function AppSplash({ ready }: Props) {
  const [visible, setVisible] = useState(true);
  const logoScale = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameShift = useRef(new Animated.Value(10)).current;
  const layerOpacity = useRef(new Animated.Value(1)).current;
  const layerScale = useRef(new Animated.Value(1)).current;
  const started = useRef(false);

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;

    let cancelled = false;
    (async () => {
      // This layer is now on screen and identical to the native one, so
      // hiding the native one is invisible.
      await SplashScreen.hideAsync().catch(() => {});
      const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      if (cancelled) return;

      const finish = () => setVisible(false);

      if (reduceMotion) {
        Animated.timing(layerOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(finish);
        return;
      }

      const ease = Easing.bezier(0.22, 1, 0.36, 1);
      Animated.sequence([
        Animated.parallel([
          Animated.sequence([
            Animated.timing(logoScale, { toValue: 0.92, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
          ]),
          Animated.timing(ring, { toValue: 1, duration: 650, easing: ease, useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(180),
            Animated.parallel([
              Animated.timing(nameOpacity, { toValue: 1, duration: 380, easing: ease, useNativeDriver: true }),
              Animated.timing(nameShift, { toValue: 0, duration: 380, easing: ease, useNativeDriver: true }),
            ]),
          ]),
        ]),
        Animated.delay(260),
        Animated.parallel([
          Animated.timing(layerOpacity, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(layerScale, { toValue: 1.06, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      ]).start(finish);
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, logoScale, ring, nameOpacity, nameShift, layerOpacity, layerScale]);

  if (!visible) return null;

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.45] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0.55, 0] });

  return (
    <Animated.View
      style={[styles.layer, { opacity: layerOpacity, transform: [{ scale: layerScale }] }]}
      // Taps pass straight through once it starts leaving, and screen
      // readers skip it — it carries nothing to read or press.
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.center}>
        <Animated.View
          style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
        />
        <Animated.Image
          source={require('../../assets/splash-logo.png')}
          style={[styles.logo, { transform: [{ scale: logoScale }] }]}
          resizeMode="contain"
        />
      </View>
      <Animated.View style={[styles.nameWrap, { opacity: nameOpacity, transform: [{ translateY: nameShift }] }]}>
        <Text style={styles.name}>NANDAM HANDLOOMS</Text>
        <Text style={styles.tagline}>Staff</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  center: { width: LOGO_SIZE, height: LOGO_SIZE, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    borderWidth: 2,
    borderColor: GOLD,
  },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  // Positioned below the centred logo without moving it, so the logo stays
  // exactly where the native launch screen drew it.
  nameWrap: { position: 'absolute', top: '50%', marginTop: LOGO_SIZE / 2 + 28, alignItems: 'center' },
  name: { color: GOLD, fontSize: 15, letterSpacing: 4, fontFamily: 'Outfit_600SemiBold' },
  tagline: { color: 'rgba(228,197,138,0.7)', fontSize: 11.5, letterSpacing: 3, marginTop: 6, fontFamily: 'Outfit_500Medium' },
});
