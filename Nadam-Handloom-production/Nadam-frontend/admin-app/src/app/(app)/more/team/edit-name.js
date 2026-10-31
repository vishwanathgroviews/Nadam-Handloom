// Edit a team member's name (owners only). The mobile number can't be changed.
import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, TopBar } from '../../../../components/Screen';
import { Button } from '../../../../components/Button';
import { Banner } from '../../../../components/Banner';
import { TextField } from '../../../../components/TextField';
import { useFeedback } from '../../../../components/Feedback';
import { OwnersOnly } from '../../../../components/team/OwnersOnly';
import { useTabBarSpace } from '../../../../hooks/useTabBarSpace';
import { rename } from '../../../../api/team';
import { cleanName, nameError } from '../../../../utils/team';

export default function EditName() {
  const { id, name: current = '' } = useLocalSearchParams();
  const { showToast } = useFeedback();
  const tabSpace = useTabBarSpace().footer;
  const [name, setName] = useState(current);
  const [error, setError] = useState(null);
  const [problem, setProblem] = useState(null);
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  async function save() {
    const e = nameError(name);
    setError(e);
    setProblem(null);
    if (e) return;
    if (cleanName(name) === cleanName(current)) return router.back();
    setBusy(true);
    try {
      await rename(id, cleanName(name));
      router.back();
      showToast('Name saved', 'success');
    } catch (err) {
      if (err.code === 'FORBIDDEN') setForbidden(true);
      else if (err.code === 'VALIDATION_FAILED') setError(err.message);
      else setProblem(err);
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) return <OwnersOnly />;
  return (
    <Screen edges={['top']} top={<TopBar title="Edit name" onBack={() => router.back()} />} maxWidth={620}
      footer={<View style={{ paddingBottom: tabSpace }}><Button title="Save" loading={busy} onPress={save} /></View>}>
      {problem ? <Banner tone="error" title="Couldn't save" text={problem.message} style={{ marginBottom: 14 }} /> : null}
      <TextField label="Full name" nativeID="edit-name" value={name} onChange={setName} error={error} maxLength={80} autoCapitalize="words" autoFocus onSubmit={save} />
    </Screen>
  );
}
