// One team member (owners only): name, role, phones, invite, remove, invite again,
// main owner. The server says which actions this owner may take here
// (member.actions); the screen shows exactly those. Docs Module 2, section 5.3.
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../../components/Screen';
import { T } from '../../../../components/T';
import { Button, LinkButton } from '../../../../components/Button';
import { Banner } from '../../../../components/Banner';
import { Avatar, Badge, Card, Row, SectionLabel } from '../../../../components/Bits';
import { Icon } from '../../../../components/Icon';
import { useFeedback } from '../../../../components/Feedback';
import { OwnersOnly } from '../../../../components/team/OwnersOnly';
import { shareOnWhatsApp, shareAnotherWay } from '../../../../components/team/shareInvite';
import { useTheme } from '../../../../theme/ThemeProvider';
import * as team from '../../../../api/team';
import { formatMobile } from '../../../../utils/phone';
import { lastActiveText } from '../../../../utils/time';
import { canDoText, firstName, memberFacts, ROLE_LABEL, STATUS_BADGE } from '../../../../utils/team';
import { useTabBarSpace } from '../../../../hooks/useTabBarSpace';

const phoneIcon = (d) => (/ipad|tab/i.test(d.name) ? 'tablet' : 'phone');

export default function Member() {
  const { id } = useLocalSearchParams();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const { confirm, showToast } = useFeedback();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // which action is running
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try { setData(await team.getMember(id)); } catch (e) { setError(e); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Runs a change, shows the result, and refreshes the page from the server's answer.
  async function run(key, fn, success) {
    setBusy(key);
    try {
      const r = await fn();
      if (r?.member) setData((d) => ({ ...d, ...r }));
      if (success) showToast(typeof success === 'function' ? success(r) : success, 'success');
      return r;
    } catch (e) {
      if (e.code === 'FORBIDDEN' || e.code === 'MAIN_OWNER_PROTECTED' || e.code === 'CANNOT_CHANGE_SELF') load();
      showToast(e.message);
      return null;
    } finally {
      setBusy(null);
    }
  }

  if (error?.code === 'FORBIDDEN') return <OwnersOnly />;
  const m = data?.member;
  const a = m?.actions || {};
  const name = m ? firstName(m.name) : '';

  function roleDialog() {
    const toOwner = m.role === 'staff';
    confirm({
      tone: toOwner ? 'warning' : 'info', icon: 'shield',
      title: toOwner ? `Make ${name} an Owner?` : `Make ${name} Staff?`,
      text: toOwner
        ? `${name} will see sales and analytics, manage the team, change categories and prices, and open settings. Only choose this for someone you fully trust. ${name} stays signed in.`
        : `${name} will no longer see sales totals, analytics, the team, the activity log or settings. ${name} stays signed in; their app updates the next time it checks in.`,
      actions: [
        { label: toOwner ? 'Make Owner' : 'Make Staff', kind: 'primary', onPress: () => run('role', () => team.changeRole(id, toOwner ? 'owner' : 'staff'), `${name} is now ${toOwner ? 'an Owner' : 'Staff'}`) },
        { label: 'Cancel' },
      ],
    });
  }

  function mainDialog() {
    confirm({
      tone: 'warning', icon: 'crown', title: `Make ${name} the main owner?`,
      text: `${name} becomes the main owner: nobody can remove them or make them Staff. You stay an Owner but lose that protection, and only ${name} can hand it back.`,
      actions: [{ label: 'Make main owner', kind: 'primary', onPress: () => run('main', () => team.makeMainOwner(id), `${name} is now the main owner`) }, { label: 'Cancel' }],
    });
  }

  function removeDialog() {
    const invited = m.status === 'invited';
    const n = m.phones.length;
    confirm({
      tone: 'danger', icon: 'alert',
      title: invited ? `Cancel ${name}'s invite?` : `Remove ${name}'s access?`,
      text: invited
        ? `The invite stops working. ${name} moves to Removed, and you can invite them again later.`
        : `${name} is signed out on every phone${n ? ` (${n})` : ''} straight away and can't sign in again. Their sales, invoices and history are kept. You can invite them again later.`,
      actions: [
        { label: invited ? 'Cancel invite' : 'Remove access', kind: 'dangerSolid', onPress: async () => {
          const r = await run('remove', () => team.removeAccess(id));
          if (r) {
            router.back();
            showToast(invited ? `${name}'s invite cancelled` : `${name}'s access removed${r.devicesSignedOut ? ` · signed out of ${r.devicesSignedOut} phone${r.devicesSignedOut > 1 ? 's' : ''}` : ''}`, 'success');
          }
        } },
        { label: invited ? 'Keep invite' : 'Cancel' },
      ],
    });
  }

  function signOutOne(d) {
    confirm({
      tone: 'danger', icon: 'logout', title: `Sign out ${d.name}?`,
      text: `It will need ${name}'s PIN and an SMS code to sign in again. Anything unsaved on it stays on that phone.`,
      actions: [{ label: 'Sign out', kind: 'dangerSolid', onPress: () => run(`out-${d.id}`, () => team.signOutPhone(id, d.id), `${d.name} signed out`) }, { label: 'Cancel' }],
    });
  }

  function signOutAll() {
    const n = m.phones.length;
    confirm({
      tone: 'danger', icon: 'logout', title: `Sign out all of ${name}'s phones?`,
      text: `All ${n} phones are signed out. Each needs ${name}'s PIN and an SMS code to sign in again. ${name} stays in the team.`,
      actions: [{ label: `Sign out ${n} phones`, kind: 'dangerSolid', onPress: () => run('all', () => team.signOutAllPhones(id), (r) => `${r.devicesSignedOut} phones signed out`) }, { label: 'Cancel' }],
    });
  }

  let body;
  if (error) {
    body = (
      <View style={{ gap: 10 }}>
        <Banner tone="error" title={error.code === 'MEMBER_NOT_FOUND' ? error.message : `Couldn't load ${name || 'this person'}'s details`} text={error.code === 'MEMBER_NOT_FOUND' ? '' : error.message} />
        <Button title="Retry" kind="secondary" icon="refresh" small onPress={load} style={{ alignSelf: 'flex-start' }} />
      </View>
    );
  } else if (!m) {
    body = <Card>{[0, 1].map((i) => <View key={i} style={{ height: i ? 120 : 96, margin: 8, borderRadius: 12, backgroundColor: c.surface3, opacity: 0.6 }} />)}</Card>;
  } else {
    const removed = m.status === 'removed';
    body = (
      <>
        <Card>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 16 }}>
            <Avatar name={m.name} size={64} muted={removed} />
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <T variant="barTitle">{m.name}</T>
                {m.isMainOwner ? <Icon name="crown" size={18} color={c.accent} /> : null}
              </View>
              <T variant="small" color="muted">+91 {formatMobile(m.mobile || '')}</T>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {m.role ? <Badge text={ROLE_LABEL[m.role]} tone={m.role} /> : null}
                <Badge {...STATUS_BADGE[m.status]} />
                {m.isMainOwner ? <Badge text="Main owner" tone="neutral" /> : null}
                {m.isYou ? <Badge text="You" tone="neutral" /> : null}
              </View>
            </View>
          </View>
          <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 2 }}>
            {memberFacts(m).map((f) => <T key={f} variant="caption" color="text2">{f}</T>)}
          </View>
        </Card>

        {m.isYou ? <Banner tone="info" title="This is you" text="Change your own PIN, phones and Face ID or fingerprint in More → My account. Another owner manages your role." style={{ marginTop: 12 }} /> : null}
        {!m.isYou && m.isMainOwner ? <Banner tone="info" icon="crown" title="Main owner · protected" text={`${name} is the main owner. Nobody can remove them, make them Staff or sign out their phones.`} style={{ marginTop: 12 }} /> : null}

        {removed ? (
          <>
            <Banner tone="warning" title="Access removed" text={`${name} can't sign in. Their sales, invoices and history are kept.`} style={{ marginTop: 12 }} />
            {a.reinvite ? <Button title="Invite again" icon="userplus" onPress={() => router.push(`/more/team/reinvite?id=${id}&name=${encodeURIComponent(m.name)}`)} style={{ marginTop: 12 }} /> : null}
          </>
        ) : (
          <>
            <SectionLabel>Details</SectionLabel>
            <Card>
              <Row icon="user" title="Name" subtitle={m.name}
                right={a.rename ? <Button title="Edit" kind="secondary" icon="edit" small onPress={() => router.push(`/more/team/edit-name?id=${id}&name=${encodeURIComponent(m.name)}`)} /> : null} />
              <Row icon="phone" title="Mobile" subtitle={`+91 ${formatMobile(m.mobile || '')} · can't be changed`} right={<Icon name="lock" size={18} color={c.muted} />}
                onPress={() => showToast(`To use a new number, remove ${name} and invite the new number.`)} last />
            </Card>

            <SectionLabel>Role</SectionLabel>
            <Card>
              <Row icon="shield" title={ROLE_LABEL[m.role]}
                subtitle={m.role === 'owner' ? 'Can do everything' : 'No money totals or team'}
                right={a.changeRole
                  ? <Button title={m.role === 'owner' ? 'Make Staff' : 'Make Owner'} kind="secondary" small loading={busy === 'role'} disabled={!!busy} onPress={roleDialog} />
                  : <T variant="caption" color="muted">{m.isYou ? 'Your own role' : 'Main owner'}</T>}
                last={!a.makeMainOwner} />
              {a.makeMainOwner ? (
                <Row icon="crown" title="Main owner" subtitle={`Hand the main-owner title to ${name}`}
                  right={<Button title="Make main owner" kind="secondary" small loading={busy === 'main'} disabled={!!busy} onPress={mainDialog} />} last />
              ) : null}
            </Card>
            <LinkButton title={`What ${m.role === 'owner' ? 'an Owner' : 'Staff'} can do`} onPress={() => confirm({ icon: 'shield', title: `What ${m.role === 'owner' ? 'an Owner' : 'Staff'} can do`, text: canDoText(m.role), actions: [{ label: 'OK', kind: 'primary' }] })} style={{ marginTop: 10, marginLeft: 4 }} />

            {m.status === 'active' ? (
              <>
                <SectionLabel>Phones signed in</SectionLabel>
                {m.phones.length ? (
                  <Card>
                    {m.phones.map((d, i) => (
                      <Row key={d.id} icon={phoneIcon(d)} title={d.name} subtitle={`${d.platform === 'ios' ? 'iOS' : 'Android'} · ${lastActiveText(d.lastSeenAt)}`}
                        right={a.signOutPhones ? <Button title="Sign out" kind="danger" small loading={busy === `out-${d.id}`} disabled={!!busy} onPress={() => signOutOne(d)} /> : null}
                        last={i === m.phones.length - 1} />
                    ))}
                  </Card>
                ) : (
                  <Card><View style={{ padding: 16, gap: 2 }}><T variant="bodyStrong">No phones signed in</T><T variant="small" color="muted">{name} needs their PIN and an SMS code to sign in.</T></View></Card>
                )}
                {m.isYou ? <T variant="small" color="muted" style={{ marginTop: 8, marginLeft: 4 }}>Sign out your own phones in More → My devices.</T> : null}
                {a.signOutPhones && m.phones.length > 1 ? <Button title={`Sign out all ${m.phones.length} phones`} kind="danger" loading={busy === 'all'} disabled={!!busy} onPress={signOutAll} style={{ marginTop: 10 }} /> : null}
              </>
            ) : null}

            {a.shareInvite && data.invite ? (
              <>
                <SectionLabel>Invite</SectionLabel>
                <View style={{ gap: 10 }}>
                  <Button title="Share invite again on WhatsApp" kind="whatsapp" icon="whatsapp" onPress={() => shareOnWhatsApp(data.invite).catch(() => showToast('Couldn\'t open WhatsApp. Use "Share another way".'))} />
                  <Button title="Share another way" kind="secondary" icon="share" onPress={() => shareAnotherWay(data.invite).catch(() => {})} />
                </View>
              </>
            ) : null}

            {a.remove ? <Button title={m.status === 'invited' ? 'Cancel invite' : 'Remove access'} kind="danger" icon="logout" loading={busy === 'remove'} disabled={!!busy} onPress={removeDialog} style={{ marginTop: 28 }} /> : null}
          </>
        )}
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ width: '100%', maxWidth: 680, alignSelf: 'center' }}>
        <TopBar title={m ? (m.isYou ? 'You' : m.name) : 'Team member'} onBack={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: space.scroll, width: '100%', maxWidth: 680, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        {body}
      </ScrollView>
    </View>
  );
}
