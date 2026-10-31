// Frames every screen before sign-in.
// Phone: the chosen "woven header + card" look for Sign in; a plain top bar elsewhere.
// Tablet: a brand panel on the left and the form on the right (max 460 pt wide).
import { Image, ScrollView, StyleSheet, View, KeyboardAvoidingView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useIsTablet } from '../theme/ThemeProvider';
import { WovenPattern } from './WovenPattern';
import { Icon } from './Icon';
import { T } from './T';
import { TopBar } from './Screen';

const logo = require('../../assets/logo.png');

function BrandPanel() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.brand, { paddingTop: insets.top + 40 }]}>
      <WovenPattern />
      <View>
        <Image source={logo} style={styles.brandLogo} accessibilityLabel="Nandam Handlooms" />
        <T variant="display" color="#FFFFFF" style={{ marginTop: 24, maxWidth: 320 }}>Nandam Handlooms Admin</T>
        <T color="rgba(255,255,255,0.82)" style={{ marginTop: 8 }}>Weaving tradition into fashion · Mangalagiri</T>
      </View>
      <View style={{ gap: 12, paddingBottom: 24 }}>
        {[['shield', 'Only people the owner invites can sign in'], ['clock', 'Stays signed in for 7 days, renewed on use'], ['lock', 'Your work is never lost on a re-sign-in']].map(([icon, text]) => (
          <View key={icon} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name={icon} size={18} color="rgba(255,255,255,0.9)" />
            <T variant="small" color="rgba(255,255,255,0.9)">{text}</T>
          </View>
        ))}
      </View>
    </View>
  );
}

export function AuthLayout({ hero = false, title, onBack, children, footer }) {
  const { c } = useTheme();
  const tablet = useIsTablet();
  const insets = useSafeAreaInsets();

  const footerView = footer ? <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 16), gap: 10 }}>{footer}</View> : null;

  if (tablet) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: c.bg }}>
        <StatusBar style="auto" />
        <BrandPanel />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <View style={{ flex: 1, paddingTop: insets.top, width: '100%', maxWidth: 460, alignSelf: 'center' }}>
            {onBack ? <TopBar onBack={onBack} title={title} /> : <View style={{ height: 24 }} />}
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24 }}>{children}</ScrollView>
            {footerView}
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  if (hero) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior="padding">
        <StatusBar style="light" />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom, 16) }}>
          <View style={[styles.hero, { paddingTop: insets.top + 14 }]}>
            <WovenPattern />
            <Image source={logo} style={styles.heroLogo} accessibilityLabel="Nandam Handlooms" />
            <T variant="heading" color="#FFFFFF">Nandam Handlooms</T>
            <T variant="label" color="rgba(255,255,255,0.8)">Admin</T>
          </View>
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, shadowColor: c.shadow }]}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }} behavior="padding">
      <StatusBar style="auto" />
      <TopBar onBack={onBack} title={title} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 }}>{children}</ScrollView>
      {footerView}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  brand: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 40, overflow: 'hidden' },
  brandLogo: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: 'rgba(255,255,255,0.9)' },
  hero: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingBottom: 46, overflow: 'hidden' },
  heroLogo: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: 'rgba(255,255,255,0.92)', marginBottom: 6 },
  card: { marginTop: -30, marginHorizontal: 14, borderRadius: 28, borderWidth: 1, padding: 20, shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
});
