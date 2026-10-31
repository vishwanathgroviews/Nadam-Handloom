// Small pieces shared by the catalogue screens.
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon } from '../Icon';
import { T } from '../T';

// A dashed card for "nothing here" states.
export function EmptyCard({ icon, title, text, children }) {
  const { c, radius } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 6, padding: 22, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderStrong, marginTop: 4 }}>
      <Icon name={icon} size={36} color={c.muted} strokeWidth={1.5} />
      <T variant="bodyStrong" style={{ textAlign: 'center' }}>{title}</T>
      {text ? <T variant="small" color="muted" style={{ textAlign: 'center' }}>{text}</T> : null}
      {children}
    </View>
  );
}

// For Staff: what they can and can't do here (Module 2: catalogue is view-only for Staff).
export function ReadOnlyNote() {
  const { c, radius } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', padding: 10, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong, marginBottom: 12 }}>
      <Icon name="lock" size={16} color={c.muted} />
      <T variant="small" color="muted" style={{ flex: 1 }}>Only owners can change the catalogue. You can search, view prices and share PDFs.</T>
    </View>
  );
}
