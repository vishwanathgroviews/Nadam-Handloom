// Why the sign-in ended: 7 days unused, signed out from another device, PIN reset
// elsewhere, signed out for safety, or access removed.
import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { AuthLayout } from '../../components/AuthLayout';
import { T } from '../../components/T';
import { Button } from '../../components/Button';
import { MessageIcon, Facts } from '../../components/Bits';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon } from '../../components/Icon';
import { session, getRemembered } from '../../auth/session';
import { getDrafts } from '../../auth/drafts';

const CONTENT = {
  expired: { icon: 'clock', tone: 'primary', title: 'Please sign in again', text: 'For your safety, you\'re signed out after 7 days without using the app.' },
  remote: { icon: 'phone', tone: 'warning', title: 'This phone was signed out', text: 'Your account was signed out on this phone from another device. If that wasn\'t you, reset your PIN now.', reset: true },
  pinchanged: { icon: 'key', tone: 'warning', title: 'Your PIN was changed', text: 'Your PIN was reset on another device, so this phone was signed out. Sign in with the new PIN.', reset: true },
  safety: { icon: 'shield', tone: 'danger', title: 'Signed out for safety', text: 'Your sign-in was used from two places at once, which can mean someone copied it. To protect the shop, we signed you out on every device.', reset: true,
    facts: ['Sign in again with your PIN', 'If you didn\'t expect this, change your PIN after signing in', 'The owner can see this in the Activity log'] },
  removed: { icon: 'alert', tone: 'danger', title: 'Your access has been removed', text: 'The owner removed this account from the Nandam Handlooms team. If you think this is a mistake, please contact the owner.', facts: ['Sign-in keys were removed from this phone'] },
};

export default function Notice() {
  const { kind } = useLocalSearchParams();
  const { c, radius } = useTheme();
  const info = CONTENT[kind] || CONTENT.expired;
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    (async () => {
      const r = await getRemembered();
      if (r?.accountId) setDraftCount((await getDrafts(r.accountId)).length);
    })();
  }, []);

  const go = (path) => { session.clearNotice(); router.replace(path); };

  return (
    <AuthLayout footer={<>
      <Button title={kind === 'removed' ? 'OK' : 'Sign in'} onPress={() => go('/sign-in')} />
      {info.reset ? <Button title="Reset PIN" kind="secondary" onPress={() => go('/forgot')} /> : null}
    </>}>
      <MessageIcon name={info.icon} tone={info.tone} />
      <T variant="title" style={{ textAlign: 'center' }}>{info.title}</T>
      <T color="text2" style={{ textAlign: 'center', marginTop: 8, marginBottom: 18 }}>{info.text}</T>
      {draftCount > 0 && kind !== 'removed' ? (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderStrong, backgroundColor: c.surface, marginBottom: 14 }}>
          <Icon name="orders" color={c.accent} />
          <View style={{ flex: 1 }}>
            <T variant="smallStrong">Your unsaved work is safe on this phone</T>
            <T variant="caption" color="muted">It comes back as soon as you sign in.</T>
          </View>
        </View>
      ) : null}
      {info.facts ? <Facts items={info.facts} /> : null}
    </AuthLayout>
  );
}
