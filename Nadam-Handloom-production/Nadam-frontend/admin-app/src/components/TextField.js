// A labelled text box with an error or hint line under it.
import { TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { T } from './T';

// autoComplete="off": not a sign-in field, so the phone's password manager leaves it alone.
export function TextField({ label, value, onChange, error, hint, placeholder, autoFocus, maxLength, autoCapitalize = 'sentences', onSubmit, returnKeyType = 'done', nativeID, multiline = false, keyboardType = 'default', prefix, autoComplete, style }) {
  const { c, radius, type } = useTheme();
  return (
    <View style={[{ gap: 6, marginBottom: 14 }, style]}>
      <T variant="smallStrong" color="text2" nativeID={nativeID}>{label}</T>
      <View style={{ flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', borderWidth: 1.5, borderColor: error ? c.danger : c.borderStrong, borderRadius: radius.md, backgroundColor: c.surface }}>
      {prefix ? <T variant="bodyStrong" color="muted" style={{ paddingLeft: 14 }}>{prefix}</T> : null}
      <TextInput
        accessibilityLabel={label}
        accessibilityLabelledBy={nativeID}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        autoFocus={autoFocus}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        returnKeyType={multiline ? 'default' : returnKeyType}
        onSubmitEditing={multiline ? undefined : onSubmit}
        multiline={multiline}
        keyboardType={keyboardType}
        autoComplete={autoComplete}
        importantForAutofill={autoComplete === 'off' ? 'no' : 'auto'}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[type.body, { flex: 1, minHeight: multiline ? 110 : 52, paddingHorizontal: prefix ? 8 : 14, paddingVertical: multiline ? 12 : 0, color: c.text, fontSize: 17 }]}
      />
      </View>
      {error ? (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Icon name="alertc" size={15} color={c.danger} />
          <T variant="caption" color="danger" accessibilityRole="alert" style={{ flex: 1 }}>{error}</T>
        </View>
      ) : hint ? <T variant="caption" color="muted">{hint}</T> : null}
    </View>
  );
}
