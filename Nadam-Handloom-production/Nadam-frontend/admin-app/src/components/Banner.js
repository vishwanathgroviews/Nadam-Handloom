// Inline message: title says what happened, the line under it says what to do.
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { T } from './T';

const ICON = { info: 'info', success: 'check', warning: 'alert', error: 'alertc' };

export function Banner({ tone = 'info', title, text, icon, style }) {
  const { c, radius } = useTheme();
  const fg = { info: c.info, success: c.success, warning: c.warning, error: c.danger }[tone];
  const bg = { info: c.infoSoft, success: c.successSoft, warning: c.warningSoft, error: c.dangerSoft }[tone];
  return (
    <View accessibilityRole={tone === 'error' ? 'alert' : 'summary'} style={[{ flexDirection: 'row', gap: 10, padding: 13, borderRadius: radius.md, backgroundColor: bg }, style]}>
      <Icon name={icon || ICON[tone]} size={20} color={fg} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <T variant="smallStrong" color={fg}>{title}</T> : null}
        {text ? <T variant="small" color="text">{text}</T> : null}
      </View>
    </View>
  );
}
