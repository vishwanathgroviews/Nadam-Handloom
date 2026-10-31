// The success animation: a circle draws itself, then the tick. Skipped when the
// phone asks for reduced motion.
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

const ACircle = Animated.createAnimatedComponent(Circle);
const APath = Animated.createAnimatedComponent(Path);

export function SuccessMark() {
  const { c } = useTheme();
  const [ring] = useState(() => new Animated.Value(320));
  const [tick] = useState(() => new Animated.Value(60));
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((r) => {
      setReduce(r);
      if (r) { ring.setValue(0); tick.setValue(0); return; }
      Animated.sequence([
        Animated.timing(ring, { toValue: 0, duration: 650, useNativeDriver: false }),
        Animated.timing(tick, { toValue: 0, duration: 350, useNativeDriver: false }),
      ]).start();
    });
  }, [ring, tick]);
  return (
    <View accessible accessibilityLabel="Done" style={{ alignSelf: 'center', marginTop: 32, marginBottom: 18 }}>
      <Svg width={112} height={112} viewBox="0 0 112 112">
        <ACircle cx={56} cy={56} r={50} fill={c.successSoft} stroke={c.success} strokeWidth={3} strokeDasharray="320" strokeDashoffset={reduce ? 0 : ring} />
        <APath d="M36 58l13 13 27-29" fill="none" stroke={c.success} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" strokeDashoffset={reduce ? 0 : tick} />
      </Svg>
    </View>
  );
}
