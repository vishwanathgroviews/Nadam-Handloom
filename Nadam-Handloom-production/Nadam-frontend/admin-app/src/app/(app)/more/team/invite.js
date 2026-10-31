// Invite someone (owners only): name, mobile number and role. Nothing is sent by
// SMS; the next screen shares the invite on WhatsApp. Docs Module 2, section 5.2.
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen, TopBar } from '../../../../components/Screen';
import { T } from '../../../../components/T';
import { Button } from '../../../../components/Button';
import { Banner } from '../../../../components/Banner';
import { TextField } from '../../../../components/TextField';
import { MobileField } from '../../../../components/MobileField';
import { RolePicker } from '../../../../components/team/RolePicker';
import { OwnersOnly } from '../../../../components/team/OwnersOnly';
import { useTabBarSpace } from '../../../../hooks/useTabBarSpace';
import { invite } from '../../../../api/team';
import { mobileError } from '../../../../utils/phone';
import { cleanName, firstName, nameError } from '../../../../utils/team';

const theirMobileError = (d) => mobileError(d)?.replace('your', 'their') ?? null;

export default function Invite() {
  const tabSpace = useTabBarSpace().footer;
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState('staff');
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null); // an "already in team / invited" answer, or a network problem
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  async function submit() {
    const e = { name: nameError(name), mobile: theirMobileError(mobile) };
    setErrors(e);
    setResult(null);
    if (e.name || e.mobile) return;
    setBusy(true);
    try {
      const r = await invite({ name: cleanName(name), mobile, role });
      router.replace(`/more/team/invited?id=${r.member.id}${r.invitedAgain ? '&again=1' : ''}${r.keptCustomerAccount ? '&customer=1' : ''}`);
    } catch (err) {
      if (err.code === 'FORBIDDEN') return setForbidden(true);
      if (err.code === 'VALIDATION_FAILED') {
        const field = err.details?.issues?.[0]?.field;
        setErrors({ [field === 'mobile' ? 'mobile' : field === 'role' ? 'role' : 'name']: err.message });
      } else {
        setResult(err);
      }
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) return <OwnersOnly />;
  const who = result?.details?.member;
  return (
    <Screen edges={['top']} top={<TopBar title="Invite someone" onBack={() => router.back()} />} maxWidth={620}
      footer={<View style={{ paddingBottom: tabSpace }}><Button title="Invite" icon="userplus" loading={busy} onPress={submit} /></View>}>
      <T color="text2" style={{ marginBottom: 16 }}>They'll set up the app on their own phone with an SMS code. Next, you send them the invite on WhatsApp.</T>

      {result?.code === 'ALREADY_IN_TEAM' ? (
        <View style={{ gap: 8, marginBottom: 14 }}>
          <Banner tone="error" title={result.message} text={`${firstName(who.name)} is ${who.role === 'owner' ? 'an Owner' : 'Staff'} already.`} />
          <Button title={`Open ${firstName(who.name)}'s page`} kind="secondary" small onPress={() => router.replace(`/more/team/${who.id}`)} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : result?.code === 'ALREADY_INVITED' ? (
        <View style={{ gap: 8, marginBottom: 14 }}>
          <Banner tone="warning" icon="send" title={result.message} text="Send the invite again if they didn't get it." />
          <Button title="Share invite again" kind="secondary" small onPress={() => router.replace(`/more/team/invited?id=${who.id}&again=share`)} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : result ? (
        <Banner tone={result.code === 'NETWORK' || result.code === 'TIMEOUT' ? 'warning' : 'error'} title="Couldn't invite" text={`${result.message} Nothing was saved.`} style={{ marginBottom: 14 }} />
      ) : null}

      <TextField label="Full name" nativeID="invite-name" value={name} onChange={setName} error={errors.name} placeholder="e.g. Suresh Babu" maxLength={80} autoCapitalize="words" returnKeyType="next" />
      <MobileField value={mobile} onChange={setMobile} error={errors.mobile} hint="Their own number. It can't be changed later." />
      <T variant="smallStrong" color="text2" style={{ marginBottom: 6 }}>Role</T>
      <RolePicker value={role} onChange={setRole} />
      {errors.role ? <T variant="caption" color="danger" style={{ marginTop: 6 }}>{errors.role}</T> : null}
      {role === 'owner' ? (
        <Banner tone="warning" title="Owners can do everything" text="Including seeing all sales, changing prices and managing the team (you too, unless you're the main owner). Only choose Owner for someone you fully trust." style={{ marginTop: 12 }} />
      ) : null}
    </Screen>
  );
}
