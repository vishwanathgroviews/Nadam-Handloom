// The woven texture: warp and weft threads over the palette's deep teal, with a
// copper border band like a saree border.
import Svg, { Defs, LinearGradient, Stop, Pattern, Rect, Line } from 'react-native-svg';
import { StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function WovenPattern({ border = true }) {
  const { c } = useTheme();
  return (
    <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={c.weaveB} />
          <Stop offset="0.7" stopColor={c.weaveA} />
        </LinearGradient>
        <Pattern id="warp" width="7" height="7" patternUnits="userSpaceOnUse">
          <Line x1="1" y1="0" x2="1" y2="7" stroke="#FFFFFF" strokeOpacity="0.07" strokeWidth="2" />
          <Line x1="0" y1="1" x2="7" y2="1" stroke="#000000" strokeOpacity="0.18" strokeWidth="2" />
        </Pattern>
        <Pattern id="band" width="19" height="8" patternUnits="userSpaceOnUse">
          <Rect x="0" y="0" width="10" height="8" fill={c.weaveThread} />
          <Rect x="13" y="0" width="2" height="8" fill={c.weaveThread} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#g)" />
      <Rect width="100%" height="100%" fill="url(#warp)" />
      {border ? <Rect y="100%" height="8" width="100%" fill="url(#band)" transform="translate(0,-8)" opacity="0.9" /> : null}
    </Svg>
  );
}
