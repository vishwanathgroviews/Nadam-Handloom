// Shown if Staff ever reach an owner-only screen (an old link, or a role changed
// while the screen was open). Calm, not an error.
import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../Screen';
import { T } from '../T';
import { Button } from '../Button';
import { MessageIcon } from '../Bits';
import { checkIn } from '../../auth/checkIn';
import { useSession } from '../../auth/session';
import { ROLE_LABEL } from '../../utils/team';
import { useTabBarSpace } from '../../hooks/useTabBarSpace';

export function OwnersOnly() {
  const s = useSession();
  const tabSpace = useTabBarSpace().footer;
  useEffect(() => { checkIn({ force: true }); }, []);
  return (
    <Screen edges={['top']} footer={<View style={{ paddingBottom: tabSpace }}><Button title="Go to Home" onPress={() => router.dismissTo('/home')} /></View>} contentStyle={{ alignItems: 'center', justifyContent: 'center' }}>
      <MessageIcon name="lock" />
      <T variant="title" style={{ textAlign: 'center' }}>Only owners can open this</T>
      <T color="text2" style={{ textAlign: 'center', marginTop: 8 }}>Your role is {ROLE_LABEL[s.user?.role] || 'Staff'}. If you need this, ask an owner.</T>
    </Screen>
  );
}
