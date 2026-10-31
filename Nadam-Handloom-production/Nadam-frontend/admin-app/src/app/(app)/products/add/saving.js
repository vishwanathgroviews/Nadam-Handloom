// Adding sarees, step 5: saving in the background ("5 of 8 saved"). You can leave this
// screen; it carries on, and waits for the internet if it drops. A saree (or a set)
// whose tag was taken meanwhile is listed with a Fix: a new tag in its place. Docs Module 4, sections 5.1 and 6.13.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useBack } from '../../../../hooks/useBack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../../components/Screen';
import { T } from '../../../../components/T';
import { Button } from '../../../../components/Button';
import { Banner } from '../../../../components/Banner';
import { Card, Facts, Progress } from '../../../../components/Bits';
import { Icon } from '../../../../components/Icon';
import { SuccessMark } from '../../../../components/SuccessMark';
import { useFeedback } from '../../../../components/Feedback';
import { TagChip } from '../../../../components/products/TagChip';
import { ScanTagModal } from '../../../../components/products/ScanTagModal';
import { useTheme } from '../../../../theme/ThemeProvider';
import { useOnline } from '../../../../hooks/useOnline';
import { pendingTags, queue, useUploads } from '../../../../products/queue';
import * as products from '../../../../api/products';
import { channelText, plural, tagsOf } from '../../../../utils/products';

export default function Saving() {
  const goBack = useBack('/products');
  const { batch } = useLocalSearchParams();
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const { confirm, showToast } = useFeedback();
  const u = useUploads();
  const [fix, setFix] = useState(null); // { job, error, busy }
  // From the "Saving" bar there's no batch given: show the group the waiting sarees belong to.
  const groups = [...new Set(u.open.map((j) => j.batchId))];
  const group = batch || (groups.length === 1 ? groups[0] : null);
  const jobs = group ? u.jobs.filter((j) => j.batchId === group) : u.open;
  const saved = jobs.filter((j) => j.status === 'saved');
  const failed = jobs.filter((j) => j.status === 'failed');
  const done = jobs.length > 0 && jobs.every((j) => j.status === 'saved' || j.status === 'failed');
  const first = jobs[0];
  const sarees = (list) => list.reduce((n, j) => n + tagsOf(j).length, 0);
  const sets = saved.filter((j) => tagsOf(j).length > 1);
  // The tag the server refused (a set's other tags are fine).
  const badTag = (j) => j.error?.tag || tagsOf(j)[tagsOf(j).length - 1];

  // Once the person leaves a finished batch, its saved sarees are forgotten on the phone.
  useEffect(() => () => { if (group) queue.clearSaved(group); }, [group]);

  async function onFixCode(code) {
    const { job } = fix;
    if (tagsOf(job).includes(code)) { setFix({ ...fix, error: { title: `${code} is already on this photo`, text: 'Scan the new tag.' } }); return; }
    if (pendingTags().has(code)) { setFix({ ...fix, error: { title: `${code} is on another saree being saved`, text: 'Use a different tag.' } }); return; }
    setFix({ ...fix, busy: true, error: null });
    try {
      const r = await products.checkTag(code);
      if (r.status !== 'free') { setFix({ ...fix, busy: false, error: { title: `${code} can't be used`, text: r.message } }); return; }
    } catch (e) {
      if (e.code !== 'NETWORK' && e.code !== 'TIMEOUT') { setFix({ ...fix, busy: false, error: { title: 'Couldn\'t check the tag', text: e.message } }); return; }
    }
    setFix(null);
    queue.fixTag(job.clientRef, code);
    showToast(`Saving with ${code}`, 'success');
  }
  function fixMenu(job) {
    const takenBy = job.error?.product;
    confirm({
      tone: 'warning', icon: 'barcode', title: tagsOf(job).length > 1 ? 'This set needs another tag' : 'This saree needs another tag', text: `${job.error?.message || ''}${tagsOf(job).length > 1 ? ' Nothing of this set is saved until it has a different tag.' : ''}`,
      content: takenBy ? <T variant="small" color="text2" style={{ marginTop: 8 }}>Already on: {takenBy.name} · {takenBy.sku}</T> : null,
      actions: [
        ...(['TAG_TAKEN', 'TAG_SOLD', 'TAG_RETIRED', 'TAG_INVALID', 'VALIDATION_FAILED'].includes(job.error?.code) ? [{ label: 'Scan a new tag', kind: 'primary', onPress: () => setTimeout(() => setFix({ job }), 300) }] : []),
        { label: tagsOf(job).length > 1 ? 'Don\'t save this set' : 'Don\'t save this saree', kind: 'danger', onPress: () => queue.discard(job.clientRef) },
        { label: 'Not now', kind: 'ghost' },
      ],
    });
  }

  let head;
  if (!jobs.length) {
    head = <Banner tone="info" title="Nothing waiting" text="Every saree from this phone is saved." />;
  } else if (done) {
    head = (
      <View style={{ alignItems: 'center' }}>
        {failed.length ? <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: c.warningSoft, alignItems: 'center', justifyContent: 'center', marginTop: 20, marginBottom: 14 }}><Icon name="alert" size={44} color={c.warning} /></View> : <SuccessMark />}
        <T variant="title" style={{ textAlign: 'center' }}>{plural(sarees(saved), 'saree')} added</T>
        <T color="text2" style={{ textAlign: 'center', marginTop: 4 }}>{first?.subcategoryName}{sets.length ? ` · ${sets.map((j) => `a set of ${tagsOf(j).length}`).join(', ')}` : ''}{failed.length ? ` · ${failed.length} need${failed.length === 1 ? 's' : ''} a different tag` : ''}</T>
        {saved.length ? <Facts style={{ marginTop: 16 }} items={[
          first?.channel === 'store_only' ? 'Not on the website (Store only)' : 'On the website now',
          first?.channel === 'online_only' ? 'Online only: not sold at the counter' : 'Ready to sell at the counter',
          `${channelText(first?.channel)} · SKUs ${saved[0].sku}${saved.length > 1 ? ` to ${saved[saved.length - 1].sku}` : ''}`,
        ]} /> : null}
      </View>
    );
  } else {
    head = (
      <View style={{ gap: 8, padding: 16, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
        <T variant="heading">{saved.length} of {jobs.length} saved</T>
        <Progress fraction={saved.length / jobs.length} />
        <T variant="small" color="muted">{online ? 'You can leave this screen: saving carries on, and a bar on the Products screens shows it.' : 'No internet. Everything is kept on this phone and continues by itself.'}</T>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}>
        <TopBar title={done ? 'Saved' : 'Saving'} onBack={goBack} right={done ? null : <Button title="Hide" kind="ghost" small onPress={() => router.dismissTo('/products')} style={{ marginRight: 8 }} />} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 24, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
        {head}
        {u.others ? <Banner tone="info" text={`${plural(u.others, 'saree')} added by someone else on this phone will upload when they sign in again.`} style={{ marginTop: 12 }} /> : null}
        {jobs.length ? (
          <Card style={{ marginTop: 16 }}>
            {jobs.map((j, i) => {
              const tags = tagsOf(j);
          const status = j.status === 'saved' ? `Saved · ${j.sku}${tags.length > 1 ? ` · set of ${tags.length}` : ''}` : j.status === 'failed' ? j.error?.message : j.status === 'sending' ? 'Saving…' : online ? 'Waiting' : 'Waiting for internet';
          const shown = tags.length > 3 ? tags.slice(0, 2) : tags;
              return (
                <View key={j.clientRef} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: i === jobs.length - 1 ? 0 : 1, borderBottomColor: c.border }}>
                  <View style={{ width: 40, height: 53, borderRadius: 7, overflow: 'hidden', backgroundColor: c.surface3 }}>
                    {j.imageUrl || j.photoUri ? <Image source={{ uri: j.imageUrl || j.photoUri }} style={{ width: '100%', height: '100%' }} /> : null}
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                      {shown.map((t) => <TagChip key={t} code={t} tone={j.status === 'saved' ? 'ok' : j.status === 'failed' && t === badTag(j) ? 'bad' : 'plain'} />)}
                      {shown.length < tags.length ? <TagChip code={`+${tags.length - shown.length}`} tone={j.status === 'saved' ? 'ok' : 'plain'} /> : null}
                    </View>
                    <T variant="caption" color={j.status === 'failed' ? 'danger' : 'muted'} numberOfLines={2}>{status}</T>
                  </View>
                  {j.status === 'failed' ? <Button title="Fix" small kind="secondary" onPress={() => fixMenu(j)} />
                    : j.status === 'saved' ? <Icon name="check" color={c.success} />
                      : j.status === 'sending' ? <ActivityIndicator color={c.primary} /> : <Icon name={online ? 'clock' : 'wifioff'} size={18} color={c.muted} />}
                </View>
              );
            })}
          </Card>
        ) : null}
      </ScrollView>
      {done && first ? (
        <View style={{ padding: 20, paddingBottom: Math.max(insets.bottom, 16), gap: 10, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
          <Button title={`See them in ${first.subcategoryName}`} onPress={() => router.dismissTo(`/products/sub/${first.subcategoryId}`)} />
          <Button title="Add more" icon="plus" kind="secondary" onPress={() => router.replace(`/products/add/start?id=${first.subcategoryId}`)} />
        </View>
      ) : null}
      <ScanTagModal visible={!!fix} busy={fix?.busy} title="New tag for this saree" text={fix ? `${badTag(fix.job)} can't be used. Put a new tag on that saree and scan it.` : ''} error={fix?.error} onCode={onFixCode} onClose={() => setFix(null)} />
    </View>
  );
}
