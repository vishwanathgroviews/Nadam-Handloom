// Choose Staff or Owner, with what each can do (invite, invite again).
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { T } from '../T';
import { CAN_DO, ROLE_LABEL } from '../../utils/team';

export function RolePicker({ value, onChange }) {
  const { c, radius } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Role" style={{ gap: 10 }}>
      {['staff', 'owner'].map((role) => {
        const on = value === role;
        const d = CAN_DO[role];
        return (
          <Pressable key={role} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={ROLE_LABEL[role]} onPress={() => onChange(role)}
            style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: 1.5, borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primarySoft : c.surface }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? c.primary : c.borderStrong, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
              {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary }} /> : null}
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <T variant="bodyStrong">{ROLE_LABEL[role]}</T>
              {d.can.map((x) => <T key={x} variant="small" color="text2">• {x}</T>)}
              {d.cant.length ? <T variant="small" color="muted">Can't see or change: {d.cant.join(', ').toLowerCase()}</T> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
