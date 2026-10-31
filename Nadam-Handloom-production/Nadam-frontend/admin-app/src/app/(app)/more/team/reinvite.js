// Invite a removed person again (owners only): choose their role. They set up
// again with an SMS code and a new PIN. Docs Module 2, section 5.3.
import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, TopBar } from '../../../../components/Screen';
import { T } from '../../../../components/T';
import { Button } from '../../../../components/Button';
import { Banner } from '../../../../components/Banner';
import { RolePicker } from '../../../../components/team/RolePicker';
import { OwnersOnly } from '../../../../components/team/OwnersOnly';
import { useTabBarSpace } from '../../../../hooks/useTabBarSpace';
import { inviteAgain } from '../../../../api/team';
import { firstName } from '../../../../utils/team';

export default function Reinvite() {
  const { id, name = '' } = useLocalSearchParams();
  const tabSpace = useTabBarSpace().footer;
  const [role, setRole] = useState('staff');
  const [problem, setProblem] = useState(null);
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const who = firstName(name) || 'them';

  async function go() {
    setBusy(true);
    setProblem(null);
    try {
      await inviteAgain(id, role);
      router.replace(`/more/team/invited?id=${id}&again=1`);
    } catch (err) {
      if (err.code === 'FORBIDDEN') setForbidden(true);
      else setProblem(err);
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) return <OwnersOnly />;
  return (
    <Screen edges={['top']} top={<TopBar title={`Invite ${who} again`} onBack={() => router.back()} />} maxWidth={620}
      footer={<View style={{ paddingBottom: tabSpace }}><Button title="Invite again" icon="userplus" loading={busy} onPress={go} /></View>}>
      <T color="text2" style={{ marginBottom: 16 }}>Choose their role. {who} sets up again with an SMS code and a new PIN.</T>
      {problem ? <Banner tone="error" title="Couldn't invite" text={problem.message} style={{ marginBottom: 14 }} /> : null}
      <RolePicker value={role} onChange={setRole} />
    </Screen>
  );
}
