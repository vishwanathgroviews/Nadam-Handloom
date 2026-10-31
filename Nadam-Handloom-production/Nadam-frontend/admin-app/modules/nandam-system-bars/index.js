// Android's own button strip follows light/dark, also when the phone switches while the
// app is open (our own native code; nothing to do on iPhone).
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

const Native = Platform.OS === 'android' ? requireOptionalNativeModule('NandamSystemBars') : null;

export const setNavigationBarLight = (light) => (Native ? Native.setNavigationBarLight(light) : Promise.resolve());
