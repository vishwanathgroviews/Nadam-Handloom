// One order (Module 7, 5.2–5.4): the sarees, the ship-to card (Call, Copy address,
// WhatsApp), payment, invoice, what happened when. Ship (owner's pick A: a sheet),
// send the tracking on WhatsApp with the invoice, change the number, mark delivered;
// owners cancel before shipping.
import { useCallback, useState } from 'react';
import { Linking, Platform, Share, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useBack } from '../../../../hooks/useBack';
import * as Haptics from 'expo-haptics';
import { Screen, TopBar } from '../../../../components/Screen';
import { Banner } from '../../../../components/Banner';
import { Button } from '../../../../components/Button';
import { Card, Row, SectionLabel } from '../../../../components/Bits';
import { T } from '../../../../components/T';
import { useFeedback } from '../../../../components/Feedback';
import { Thumb } from '../../../../components/catalog/Thumb';
import { TagChip } from '../../../../components/products/TagChip';
import { LockNote } from '../../../../components/sales/SaleParts';
import { ShipModal } from '../../../../components/orders/ShipModal';
import { CancelOrderModal } from '../../../../components/orders/CancelOrderModal';
import { useTheme } from '../../../../theme/ThemeProvider';
import { orderCount } from '../../../../orders/count';
import * as orders from '../../../../api/orders';
import { rupees } from '../../../../utils/catalog';
import { formatMobile } from '../../../../utils/phone';
import { addressText, telLink, waLink, waitingText } from '../../../../utils/orders';
import { sharePdfAnotherWay, sharePdfOnWhatsApp, whatsAppChatAvailable } from '../../../../utils/sharePdf';

const BLOCKED = {
  OWNERS_ONLY: ['lock', 'Ask an owner to cancel an order.'],
  NOT_THIS_MONTH: ['clock', 'Only this month\'s orders can be cancelled.'],
};

export default function OrderDetail() {
  const goBack = useBack();
  const { id } = useLocalSearchParams();
  const { c } = useTheme();
  const { confirm, showToast } = useFeedback();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [sheet, setSheet] = useState(null); // 'ship' | 'change' | 'cancel'
  const [busy, setBusy] = useState(null);
  const [shipError, setShipError] = useState(null);

  const load = useCallback(async () => {
    try { setData(await orders.getOrder(id)); setError(null); } catch (e) { setError(e.message); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const o = data?.order;
  const a = data?.actions;
  const netMsg = (e, what) => (e.code === 'NETWORK' || e.code === 'TIMEOUT' ? `No internet. ${what} needs internet.` : e.message);

  async function saveTracking(t) {
    setBusy('ship');
    setShipError(null);
    try {
      const r = sheet === 'change' ? await orders.changeTracking(id, t) : await orders.shipOrder(id, t);
      const wasShip = sheet === 'ship';
      setData(r);
      setSheet(null);
      orderCount.refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (wasShip) {
        confirm({
          icon: 'send', title: `${r.order.orderNumber} shipped`, text: `${r.order.carrier} ${r.order.awb}. Send the tracking details${r.order.invoice ? ' and the invoice' : ''} to ${r.order.customer.name} on WhatsApp now?`,
          actions: [{ label: 'Send on WhatsApp', kind: 'whatsapp', onPress: () => send(r.order) }, { label: 'Later' }],
        });
      } else showToast(`Tracking number changed to ${r.order.awb}`, 'success');
    } catch (e) {
      setShipError(netMsg(e, 'Shipping'));
    } finally {
      setBusy(null);
    }
  }

  // The tracking message, with the invoice PDF when there is one (5.3).
  async function send(order = o) {
    setBusy('send');
    try {
      const doc = order.invoice && !order.invoice.cancelled ? { ...order.invoice, caption: order.message } : null;
      if (Platform.OS === 'android' && whatsAppChatAvailable() && order.customer.mobile) {
        if (doc) await sharePdfOnWhatsApp(doc, order.customer.mobile, 'invoices');
        else await Linking.openURL(waLink(order.customer.mobile, order.message));
      } else if (doc) await sharePdfAnotherWay(doc, { folder: 'invoices', title: 'Send the tracking details' });
      else await Share.share({ message: order.message });
    } catch (e) {
      showToast(e.code === 'NOT_AVAILABLE' ? 'WhatsApp isn\'t on this phone.' : e.message || 'Couldn\'t open WhatsApp. Try again.');
    } finally {
      setBusy(null);
    }
  }

  function delivered() {
    confirm({
      icon: 'check', title: `Mark ${o.orderNumber} delivered?`, text: 'Do this when the customer has the parcel (or the courier\'s site says delivered).',
      actions: [{ label: 'Mark delivered', kind: 'primary', onPress: async () => {
        setBusy('delivered');
        try { setData(await orders.markDelivered(id)); showToast(`${o.orderNumber} delivered`, 'success'); } catch (e) { showToast(netMsg(e, 'This')); } finally { setBusy(null); }
      } }, { label: 'Cancel' }],
    });
  }

  async function cancel(reason) {
    setBusy('cancel');
    try {
      const r = await orders.cancelOrder(id, reason);
      setData(r);
      setSheet(null);
      orderCount.refresh();
      showToast(`${r.order.orderNumber} cancelled · ${r.backInStock.length} saree${r.backInStock.length === 1 ? '' : 's'} back in stock`, 'success');
    } catch (e) {
      setSheet(null);
      showToast(netMsg(e, 'Cancelling'));
      load();
    } finally {
      setBusy(null);
    }
  }

  const status = !o ? null
    : o.status === 'processing' ? { tone: o.waitingDays >= 1 ? 'warning' : 'info', title: `To ship · ${waitingText(o.waitingDays)}`, text: 'Pack the sarees, put the courier label on, then Ship.' }
      : o.status === 'shipped' ? { tone: o.checkDelivery ? 'warning' : 'success', title: `${o.checkDelivery ? 'Check delivery' : 'Shipped'} · ${o.carrier} ${o.awb}`, text: `Shipped ${o.shippedDate}.${o.checkDelivery ? ' More than 10 days: ask the customer or check the courier\'s site, then mark it delivered.' : ''}` }
        : o.status === 'delivered' ? { tone: 'success', title: `Delivered · ${o.deliveredDate}`, text: `${o.carrier} ${o.awb}` }
          : { tone: 'error', title: 'Cancelled', text: `${o.cancelled?.reason || ''}${o.cancelled?.by ? ` · ${o.cancelled.by}` : ''}. The sarees are back in stock${o.invoice ? `; ${o.invoice.number} is marked CANCELLED.` : '.'}${o.channel === 'online' ? ` Refund ${rupees(o.total)} in Razorpay if not done yet.` : ''}` };

  const footer = !a ? null : a.ship ? <Button title="Ship" icon="send" onPress={() => { setShipError(null); setSheet('ship'); }} />
    : a.markDelivered ? (
      <>
        {a.sendTracking ? <Button title="Send tracking on WhatsApp" icon="whatsapp" kind="whatsapp" loading={busy === 'send'} onPress={() => send()} /> : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Change number" icon="edit" kind="secondary" onPress={() => { setShipError(null); setSheet('change'); }} style={{ flex: 1 }} />
          <Button title="Mark delivered" icon="check" kind="secondary" loading={busy === 'delivered'} onPress={delivered} style={{ flex: 1 }} />
        </View>
      </>
    ) : a.sendTracking ? <Button title="Send tracking on WhatsApp" icon="whatsapp" kind="whatsapp" loading={busy === 'send'} onPress={() => send()} /> : null;

  return (
    <Screen top={<TopBar title={o ? o.orderNumber : 'Order'} onBack={goBack} right={o ? <T variant="small" color="muted" style={{ marginRight: 14 }}>{o.channel === 'online' ? 'Online' : 'WhatsApp'}</T> : null} />} footer={footer}>
      {error ? <Banner tone="error" title="Couldn't open this order" text={error} /> : null}
      {!o && !error ? <T color="muted" style={{ textAlign: 'center', marginTop: 30 }}>Loading…</T> : null}
      {o ? (
        <>
          <T variant="small" color="muted" style={{ marginBottom: 10 }}>{o.date}, {o.time} · {rupees(o.total)}</T>
          <Banner tone={status.tone} title={status.title} text={status.text} />

          <SectionLabel>Sarees</SectionLabel>
          <Card>
            {o.lines.map((l, i) => (
              <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: i === o.lines.length - 1 ? 0 : 1, borderBottomColor: c.border }}>
                <Thumb uri={l.imageUrl} width={38} height={50} />
                <View style={{ flex: 1, gap: 3 }}>
                  <T variant="smallStrong" numberOfLines={1}>{l.name}</T>
                  {l.code ? <TagChip code={l.code} tone={o.status === 'cancelled' ? 'plain' : 'sold'} /> : null}
                </View>
                <T variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>{rupees(l.price * l.quantity)}</T>
              </View>
            ))}
          </Card>

          <SectionLabel>Ship to</SectionLabel>
          <Card style={{ padding: 16 }}>
            <T variant="bodyStrong">{o.customer.name}</T>
            {o.customer.lines.map((line) => <T key={line} variant="body">{line}</T>)}
            <T variant="small" color="muted" style={{ marginTop: 4 }}>{o.customer.mobile ? `+91 ${formatMobile(o.customer.mobile)}` : 'No mobile'}{o.customer.email ? ` · ${o.customer.email}` : ''}</T>
            {o.customer.mobile ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Button title="Call" icon="phone" kind="secondary" small onPress={() => Linking.openURL(telLink(o.customer.mobile))} style={{ flex: 1 }} />
                <Button title="WhatsApp" icon="whatsapp" kind="secondary" small onPress={() => Linking.openURL(waLink(o.customer.mobile))} style={{ flex: 1 }} />
              </View>
            ) : null}
            <Button title="Copy address" icon="share" kind="secondary" small onPress={() => Share.share({ message: addressText(o.customer) })} style={{ marginTop: 8 }} />
          </Card>

          <SectionLabel>Payment</SectionLabel>
          <Card>
            <Row icon={o.channel === 'online' ? 'card' : 'cash'} title={o.payment.text} subtitle={`Total ${rupees(o.total)}`} last={!o.invoice} />
            {o.invoice ? <Row icon="receipt" title={o.invoice.number} subtitle={o.invoice.cancelled ? 'Invoice · cancelled' : 'Invoice'} onPress={() => router.push(`/more/invoices/${o.invoice.id}`)} last /> : null}
          </Card>

          <SectionLabel>What happened</SectionLabel>
          <Card style={{ padding: 16, gap: 10 }}>
            {o.events.map((e, i) => (
              <View key={`${e.at}-${i}`} style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary, marginTop: 5 }} />
                <View style={{ flex: 1 }}>
                  <T variant="smallStrong">{e.text}</T>
                  <T variant="caption" color="muted">{e.at}</T>
                </View>
              </View>
            ))}
          </Card>

          {a.cancel ? <Button title="Cancel order" icon="xcircle" kind="danger" onPress={() => setSheet('cancel')} style={{ marginTop: 20 }} /> : null}
          {o.status === 'processing' && BLOCKED[a.cancelBlocked] ? <LockNote icon={BLOCKED[a.cancelBlocked][0]} text={BLOCKED[a.cancelBlocked][1]} style={{ marginTop: 16 }} /> : null}

          {sheet === 'ship' || sheet === 'change' ? <ShipModal visible order={o} change={sheet === 'change'} busy={busy === 'ship'} error={shipError} onClose={() => setSheet(null)} onSubmit={saveTracking} /> : null}
          {sheet === 'cancel' ? <CancelOrderModal visible order={o} busy={busy === 'cancel'} onClose={() => setSheet(null)} onCancel={cancel} /> : null}
        </>
      ) : null}
    </Screen>
  );
}
