// The invite is ready: share it on WhatsApp from the owner's own phone (free), or
// any other way. Also used for "Share invite again". Docs Module 2, section 5.2.
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen, TopBar } from '../../../../components/Screen';
import { T } from '../../../../components/T';
import { Button } from '../../../../components/Button';
import { Banner } from '../../../../components/Banner';
import { Facts, MessageIcon } from '../../../../components/Bits';
import { SuccessMark } from '../../../../components/SuccessMark';
import { useFeedback } from '../../../../components/Feedback';
import { OwnersOnly } from '../../../../components/team/OwnersOnly';
import { shareOnWhatsApp, shareAnotherWay } from '../../../../components/team/shareInvite';
import { useTheme } from '../../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../../hooks/useTabBarSpace';
import { getMember } from '../../../../api/team';
import { maskMobile } from '../../../../utils/phone';
import { firstName, ROLE_LABEL } from '../../../../utils/team';

export default function Invited() {
  const { id, again, customer } = useLocalSearchParams();
  const { c, radius } = useTheme();
  const { showToast } = useFeedback();
  const tabSpace = useTabBarSpace().footer;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try { setData(await getMember(id)); } catch (e) { setError(e); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (error?.code === 'FORBIDDEN') return <OwnersOnly />;
  const m = data?.member;
  const inv = data?.invite;
  const name = m ? firstName(m.name) : '';
  const title = again === 'share' ? `Share ${name}'s invite` : `${name} is invited${again === '1' ? ' again' : ''}`;

  async function whatsapp() {
    try { await shareOnWhatsApp(inv); } catch { showToast('Couldn\'t open WhatsApp. Use "Share another way".'); }
  }
  async function other() {
    try { await shareAnotherWay(inv); } catch { showToast('Couldn\'t open the share menu.'); }
  }

  return (
    <Screen edges={['top']} maxWidth={620}
      top={<TopBar title="" onBack={() => router.back()} right={<Button title="Done" kind="ghost" small onPress={() => router.back()} style={{ marginRight: 8 }} />} />}
      footer={inv ? (
        <View style={{ gap: 10, paddingBottom: tabSpace }}>
          <Button title="Share invite on WhatsApp" kind="whatsapp" icon="whatsapp" onPress={whatsapp} />
          <Button title="Share another way" kind="secondary" icon="share" onPress={other} />
        </View>
      ) : null}>
      {error ? (
        <View style={{ gap: 10, marginTop: 12 }}>
          <Banner tone="error" title="Couldn't load the invite" text={error.message} />
          <Button title="Retry" kind="secondary" icon="refresh" small onPress={load} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : !m ? null : !inv ? (
        <View style={{ alignItems: 'center' }}>
          <MessageIcon name="check" tone="success" />
          <T variant="title" style={{ textAlign: 'center' }}>{name} has already set up</T>
          <T color="text2" style={{ textAlign: 'center', marginTop: 8 }}>There's no invite to send. {name} can sign in now.</T>
        </View>
      ) : (
        <View style={{ alignItems: 'center' }}>
          {again === 'share' ? <MessageIcon name="send" /> : <SuccessMark />}
          <T variant="title" style={{ textAlign: 'center' }}>{title}</T>
          <T color="text2" style={{ textAlign: 'center', marginTop: 8, marginBottom: 18 }}>Send the invite on WhatsApp. It opens on your phone with the message ready; you press Send. It's free.</T>
          <Facts items={[
            `In your team as ${ROLE_LABEL[m.role]}, waiting to set up`,
            `They get an SMS code at ${maskMobile(m.mobile)} when they set up`,
            ...(customer === '1' || m.isCustomer ? ['This number shops on the website too. That account stays as it is.'] : []),
          ]} />
          <T variant="label" color="muted" style={{ alignSelf: 'flex-start', marginTop: 20, marginBottom: 8, marginLeft: 4 }}>The message</T>
          <View style={{ alignSelf: 'stretch', padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
            <T variant="small" selectable>{inv.message}</T>
          </View>
        </View>
      )}
    </Screen>
  );
}
