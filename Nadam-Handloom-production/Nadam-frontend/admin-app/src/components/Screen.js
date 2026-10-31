// Screen frame: safe areas, keyboard handling, scrolling body, sticky footer for
// the main button, optional top bar with a back button.
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { T } from './T';

export function TopBar({ title, onBack, right }) {
  const { c } = useTheme();
  return (
    <View style={styles.top}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={8} style={styles.iconBtn} android_ripple={{ borderless: true, radius: 22 }}>
          <Icon name="back" color={c.text} />
        </Pressable>
      ) : <View style={{ width: 12 }} />}
      <T variant="barTitle" style={{ flex: 1 }} numberOfLines={1}>{title}</T>
      {right}
    </View>
  );
}

// onScroll: e.g. to load the next 20 of a list near the end.
export function Screen({ children, footer, top, scroll = true, padded = true, background, contentStyle, maxWidth, edges = ['top', 'bottom'], onScroll }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;
  const widthStyle = maxWidth ? { width: '100%', maxWidth, alignSelf: 'center' } : null;
  return (
    <View style={{ flex: 1, backgroundColor: background || c.bg, paddingTop: edges.includes('top') ? insets.top : 0 }}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {top ? <View style={widthStyle}>{top}</View> : null}
        <Body
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          {...(scroll && onScroll ? { onScroll, scrollEventThrottle: 200 } : {})}
          contentContainerStyle={scroll ? [{ flexGrow: 1, paddingHorizontal: padded ? 20 : 0, paddingBottom: 24 }, widthStyle, contentStyle] : undefined}
        >
          {scroll ? children : <View style={[{ flex: 1, paddingHorizontal: padded ? 20 : 0 }, widthStyle, contentStyle]}>{children}</View>}
        </Body>
        {footer ? (
          <View style={[{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: edges.includes('bottom') ? Math.max(insets.bottom, 16) : 16, gap: 10, backgroundColor: background || c.bg }, widthStyle]}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
