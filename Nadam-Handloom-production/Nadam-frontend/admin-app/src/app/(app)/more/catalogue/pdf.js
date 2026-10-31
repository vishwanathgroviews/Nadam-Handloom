// Catalogue PDF (owners and staff): one page per saree in stock with a photo, with
// its tag ID; no prices. Make a new one, then send it: Android straight into the
// customer's WhatsApp chat, iPhone through the share menu. Docs Module 3, section 6.5.
import { useCallback, useState } from 'react';
import { Platform, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen, TopBar } from '../../../../components/Screen';
import { T } from '../../../../components/T';
import { Button } from '../../../../components/Button';
import { Banner } from '../../../../components/Banner';
import { Card, Facts, Row, SectionLabel } from '../../../../components/Bits';
import { MobileField } from '../../../../components/MobileField';
import { useFeedback } from '../../../../components/Feedback';
import { useTabBarSpace } from '../../../../hooks/useTabBarSpace';
import * as catalog from '../../../../api/catalog';
import { sharePdfAnotherWay, sharePdfOnWhatsApp, whatsAppChatAvailable } from '../../../../utils/sharePdf';
import { dayText, plural } from '../../../../utils/catalog';
import { mobileError } from '../../../../utils/phone';

export default function CataloguePdf() {
  const { id } = useLocalSearchParams();
  const { showToast } = useFeedback();
  const space = useTabBarSpace();
  const [s, setS] = useState(null);
  const [error, setError] = useState(null);
  const [mobile, setMobile] = useState('');
  const [mobileErr, setMobileErr] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try { setS((await catalog.getSubcategory(id)).subcategory); } catch (e) { setError(e); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function make() {
    setBusy('make');
    setError(null);
    try {
      const r = await catalog.makeCataloguePdf(id);
      setS((x) => ({ ...x, catalogue: r.catalogue }));
      showToast(`PDF ready · ${plural(r.catalogue.productCount, 'page')}`, 'success');
    } catch (e) {
      setError(e);
    } finally { setBusy(null); }
  }

  async function whatsapp() {
    const m = mobileError(mobile);
    setMobileErr(m ? m.replace('your', 'the customer\'s') : null);
    if (m) return;
    setBusy('wa');
    try {
      if (whatsAppChatAvailable()) await sharePdfOnWhatsApp(s.catalogue, mobile);
      else {
        showToast('WhatsApp isn\'t installed. Choose another app.');
        await sharePdfAnotherWay(s.catalogue);
      }
    } catch (e) {
      showToast(e.message || 'Couldn\'t open WhatsApp. Try "Share another way".');
    } finally { setBusy(null); }
  }

  async function other() {
    setBusy('other');
    try { await sharePdfAnotherWay(s.catalogue); } catch (e) { showToast(e.message || 'Couldn\'t open the share menu.'); } finally { setBusy(null); }
  }

  const ready = s?.pdfReadyCount ?? 0;
  const android = Platform.OS === 'android';
  return (
    <Screen edges={['top']} top={<TopBar title="Catalogue PDF" onBack={() => router.back()} />} maxWidth={640} contentStyle={{ paddingBottom: space.scroll }}>
      <T color="text2" style={{ marginBottom: 14 }}>One page per saree that is <T variant="bodyStrong">in stock and has a photo</T>, with its tag ID. No prices or shop name.</T>
      {error ? <Banner tone={error.code === 'NETWORK' || error.code === 'TIMEOUT' ? 'warning' : 'error'} title={error.code === 'NOTHING_TO_SHOW' ? 'Nothing to put in the PDF' : 'Couldn\'t make the PDF'} text={error.message} style={{ marginBottom: 12 }} /> : null}
      {!s ? (
        error ? <Button title="Retry" kind="secondary" icon="refresh" small onPress={load} style={{ alignSelf: 'flex-start' }} /> : <View style={{ height: 120, borderRadius: 14, opacity: 0.4 }} />
      ) : (
        <>
          {!s.showOnWebsite ? <Banner tone="info" title="Hidden from the website" text="You can still send this PDF to customers." style={{ marginBottom: 12 }} /> : null}
          <Card>
            <Row icon="pdf" title={s.catalogue ? `Made ${dayText(s.catalogue.generatedAt)} · ${plural(s.catalogue.productCount, 'page')}` : 'No PDF made yet'} subtitle={s.name} last />
          </Card>
          <Facts style={{ marginTop: 12 }} items={[
            ready ? `${plural(ready, 'saree')} will be included` : 'No sarees are in stock with a photo, so a PDF can\'t be made',
            ...(ready && s.productCount > ready ? [`${s.productCount - ready} other products are left out (sold, or no photo)`] : []),
          ]} />
          <Button title={s.catalogue ? 'Make a new PDF' : 'Make PDF'} icon="refresh" kind={s.catalogue ? 'secondary' : 'primary'} loading={busy === 'make'} disabled={!ready || !!busy} onPress={make} style={{ marginTop: 16 }} />

          {s.catalogue ? (
            <>
              <SectionLabel>Send to a customer</SectionLabel>
              {android ? (
                <>
                  <MobileField value={mobile} onChange={(d) => { setMobile(d); setMobileErr(null); }} error={mobileErr} hint="The customer's WhatsApp number. Not saved anywhere." />
                  <Button title="Share on WhatsApp" icon="whatsapp" kind="whatsapp" loading={busy === 'wa'} disabled={!!busy} onPress={whatsapp} />
                  <Button title="Share another way" icon="share" kind="secondary" loading={busy === 'other'} disabled={!!busy} onPress={other} style={{ marginTop: 10 }} />
                </>
              ) : (
                <>
                  <Button title="Share PDF" icon="share" kind="whatsapp" loading={busy === 'other'} disabled={!!busy} onPress={other} />
                  <T variant="small" color="muted" style={{ marginTop: 8 }}>Choose WhatsApp and the customer in the share menu.</T>
                </>
              )}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}
