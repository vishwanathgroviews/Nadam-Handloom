// Text in the design system's type scale and colours.
import { Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function T({ variant = 'body', color = 'text', style, children, ...rest }) {
  const { c, type } = useTheme();
  return (
    <Text style={[type[variant], { color: c[color] || color }, style]} maxFontSizeMultiplier={1.4} {...rest}>
      {children}
    </Text>
  );
}
