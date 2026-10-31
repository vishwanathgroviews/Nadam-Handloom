// "+91" mobile number field; keeps only digits and formats as 98765 43210.
import { TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { digitsOnly, formatMobile } from '../utils/phone';
import { Icon } from './Icon';
import { T } from './T';

export function MobileField({ value, onChange, error, hint, autoFocus, onSubmit }) {
  const { c, radius, type } = useTheme();
  return (
    <View style={{ gap: 6, marginBottom: 14 }}>
      <T variant="smallStrong" color="text2" nativeID="mobile-label">Mobile number</T>
      <View style={{ flexDirection: 'row', borderWidth: 1.5, borderColor: error ? c.danger : c.borderStrong, borderRadius: radius.md, backgroundColor: c.surface, overflow: 'hidden' }}>
        <View style={{ justifyContent: 'center', paddingHorizontal: 14, backgroundColor: c.surface2, borderRightWidth: 1.5, borderRightColor: c.border }}>
          <T variant="bodyStrong" color="text2">+91</T>
        </View>
        <TextInput
          accessibilityLabelledBy="mobile-label"
          accessibilityLabel="Mobile number"
          value={formatMobile(value)}
          onChangeText={(t) => onChange(digitsOnly(t).slice(0, 10))}
          keyboardType="number-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          maxLength={11}
          placeholder="98765 43210"
          placeholderTextColor={c.muted}
          autoFocus={autoFocus}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          style={[type.body, { flex: 1, minHeight: 52, paddingHorizontal: 14, color: c.text, fontSize: 18, letterSpacing: 0.6 }]}
        />
      </View>
      {error ? (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Icon name="alertc" size={15} color={c.danger} />
          <T variant="caption" color="danger" accessibilityRole="alert">{error}</T>
        </View>
      ) : hint ? <T variant="caption" color="muted">{hint}</T> : null}
    </View>
  );
}
