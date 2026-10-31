// Shown when a catalogue screen is the copy saved on the phone (no internet).
import { Banner } from '../Banner';

export function OfflineCopy({ savedAt, style }) {
  if (!savedAt) return null;
  const when = new Date(savedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  return <Banner tone="warning" icon="wifioff" title="Offline: the copy saved on this phone" text={`Saved ${when}. Changes need internet.`} style={[{ marginBottom: 12 }, style]} />;
}
