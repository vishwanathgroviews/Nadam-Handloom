// My account → Notifications (W1, web-01 section 10): this browser's notifications (Firebase),
// the topics it gets, and the account-wide choice about offers and new arrivals.
import { useCallback, useEffect, useState } from 'react';
import Button from '../../components/Button.jsx';
import Alert from '../../components/Alert.jsx';
import Icon from '../../components/Icon.jsx';
import { Toggle, Skeleton } from '../../components/bits.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { useAuth } from '../../auth/useAuth.js';
import { updateCustomer } from '../../auth/session.js';
import { useConfig } from '../../config/useConfig.js';
import { shopApi } from '../../api/shop.js';
import { pushSupport, permission, turnOn, turnOff, currentToken } from '../../push/push.js';
import { readPushToken } from '../../push/token.js';

const TOPICS = [
  ['orders', 'Order updates', 'Paid, shipped with the tracking number, delivered'],
  ['arrivals', 'New arrivals', 'When new collections arrive'],
  ['offers', 'Offers and festive sales', 'Only if you want them'],
];

function BrowserCard({ support, state, busy, onTurnOn, onTurnOff, onTest }) {
  if (support === 'not-configured') {
    return <Alert title="Notifications aren't available yet">The shop hasn't switched them on yet. Please check back later.</Alert>;
  }
  if (support === 'insecure') {
    return <Alert tone="warn" title="Notifications need a secure (https) address">Open the website at its https:// address to turn them on.</Alert>;
  }
  if (support === 'ios-home-screen') {
    return (
      <div className="card push-card" data-push="default">
        <Icon name="phonedev" />
        <div className="stack-sm">
          <b>On iPhone and iPad, add the website to your Home Screen first</b>
          <ol className="steps-list">
            <li>Tap the <b>Share</b> button in Safari (the square with an arrow).</li>
            <li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li>
            <li>Open Nandam from your Home Screen and come back to this page to turn notifications on.</li>
          </ol>
          <span className="muted small">Apple allows website notifications only this way (iOS 16.4 or later).</span>
        </div>
      </div>
    );
  }
  if (support === 'unsupported') {
    return <Alert title="This browser can't show notifications">Try Chrome, Edge, Firefox or Safari on a computer or an Android phone.</Alert>;
  }
  if (state.permission === 'denied') {
    return (
      <div className="card push-card" data-push="denied">
        <Icon name="alert" />
        <div className="stack-sm">
          <b>Notifications are blocked on this browser</b>
          <p className="muted">To allow them: click the lock or settings icon next to the website address, set <b>Notifications</b> to <b>Allow</b>, then reload this page.</p>
        </div>
      </div>
    );
  }
  if (state.subscribed) {
    return (
      <div className="card push-card" data-push="granted">
        <Icon name="check" />
        <div className="stack-sm">
          <b>Notifications are on for this browser</b>
          <p className="muted">Choose below what you get here. Sent with Firebase; you can turn them off any time.</p>
          <div className="row-wrap">
            <Button size="sm" onClick={onTest} loading={busy === 'test'}>Send a test notification</Button>
            <Button size="sm" kind="ghost" onClick={onTurnOff} loading={busy === 'off'}>Turn off for this browser</Button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="card push-card" data-push="default">
      <Icon name="spark" />
      <div className="stack-sm">
        <b>Get updates on this device</b>
        <p className="muted">Order shipped, delivered, new arrivals: straight to this phone or computer.</p>
        <div><Button kind="primary" size="sm" onClick={onTurnOn} loading={busy === 'on'}>Turn on notifications</Button></div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const { customer } = useAuth();
  const { config } = useConfig();
  const toast = useToast();
  const support = pushSupport(config.push);
  const [state, setState] = useState({ loading: true, permission: support === 'ok' ? permission() : 'default', subscribed: false, topics: [], token: null });
  const [busy, setBusy] = useState(null);
  const [consentBusy, setConsentBusy] = useState(false);

  // This browser's state: allowed in the browser, and linked to this account on the server.
  const check = useCallback(async () => {
    if (support !== 'ok') return { loading: false, permission: 'default', subscribed: false, topics: [], token: null };
    const perm = permission();
    let token = readPushToken();
    if (perm === 'granted') token = (await currentToken(config.push)) || token;
    if (!token || perm !== 'granted') return { loading: false, permission: perm, subscribed: false, topics: [], token: null };
    try {
      let s = await shopApi.pushStatus(token);
      // Allowed in the browser but not linked to this account yet (e.g. after signing in again).
      if (!s.subscribed) s = await shopApi.pushSubscribe(token);
      return { loading: false, permission: perm, subscribed: s.subscribed, topics: s.topics, token };
    } catch (ex) {
      return { loading: false, permission: perm, subscribed: false, topics: [], token, error: ex.message };
    }
  }, [support, config.push]);
  useEffect(() => {
    let live = true;
    check().then((s) => { if (live) setState(s); });
    return () => { live = false; };
  }, [check]);

  async function on() {
    setBusy('on');
    try {
      const r = await turnOn(config.push);
      if (r.permission !== 'granted') {
        setState((s) => ({ ...s, permission: r.permission }));
        if (r.permission === 'denied') toast('Notifications were blocked. You can allow them later in the browser\'s site settings.', { tone: 'info' });
        return;
      }
      const s = await shopApi.pushSubscribe(r.token);
      setState({ loading: false, permission: 'granted', subscribed: true, topics: s.topics, token: r.token });
      toast('Notifications are on for this browser');
    } catch (ex) {
      toast(ex.code === 'PUSH_UNSUPPORTED' ? 'This browser can\'t show notifications.' : ex.message || 'Notifications couldn\'t be turned on. Please try again.', { tone: 'bad' });
    } finally {
      setBusy(null);
    }
  }

  async function off() {
    setBusy('off');
    try {
      if (state.token) await shopApi.pushUnsubscribe(state.token).catch(() => {});
      await turnOff(config.push);
      setState((s) => ({ ...s, subscribed: false, topics: [], token: null }));
      toast('Notifications are off for this browser');
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy('test');
    try {
      const r = await shopApi.pushTest(state.token);
      toast(r.status === 'sent' ? 'Test sent. It should appear in a few seconds.' : 'The test couldn\'t be delivered. Try turning notifications off and on.', { tone: r.status === 'sent' ? 'ok' : 'bad' });
    } catch (ex) {
      toast(ex.message, { tone: 'bad' });
    } finally {
      setBusy(null);
    }
  }

  async function setTopic(topic, value) {
    const next = value ? [...new Set([...state.topics, topic])] : state.topics.filter((t) => t !== topic);
    const before = state.topics;
    setState((s) => ({ ...s, topics: next }));
    try {
      const r = await shopApi.pushTopics(state.token, next);
      setState((s) => ({ ...s, topics: r.topics }));
      // Choosing offers or new arrivals here also records the account's consent.
      if (value && topic !== 'orders' && !customer.marketingOptIn) {
        const me = await shopApi.me();
        updateCustomer(me.customer);
      }
      toast('Saved');
    } catch (ex) {
      setState((s) => ({ ...s, topics: before }));
      toast(ex.message, { tone: 'bad' });
    }
  }

  async function setConsent(value) {
    setConsentBusy(true);
    try {
      const r = await shopApi.updateMe({ marketingOptIn: value });
      updateCustomer(r.customer);
      toast(value ? 'You\'ll hear about new arrivals and offers' : 'No more offers. Order updates continue.');
    } catch (ex) {
      toast(ex.message, { tone: 'bad' });
    } finally {
      setConsentBusy(false);
    }
  }

  return (
    <div className="stack-lg" style={{ maxWidth: 780 }}>
      {state.loading ? <Skeleton h={130} /> : <BrowserCard support={support} state={state} busy={busy} onTurnOn={on} onTurnOff={off} onTest={test} />}
      {state.error ? <Alert tone="warn" title="We couldn't check this browser's notifications">{state.error}</Alert> : null}

      <section className="stack-sm" aria-labelledby="topics-h">
        <h3 id="topics-h">On this browser</h3>
        <div className="table-wrap">
          <table className="table stack">
            <thead><tr><th scope="col">What</th><th scope="col">Notification</th></tr></thead>
            <tbody>
              {TOPICS.map(([key, title, sub]) => (
                <tr key={key}>
                  <td data-label=""><span><b>{title}</b><br /><span className="muted small">{sub}</span></span></td>
                  <td data-label="Notification">
                    <Toggle label={`${title} as notifications`} checked={state.topics.includes(key)} disabled={!state.subscribed} onChange={(val) => setTopic(key, val)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!state.subscribed ? <p className="note"><Icon name="info" size="sm" />Turn notifications on above to choose these.</p> : null}
      </section>

      <section className="card stack-sm" aria-labelledby="consent-h">
        <div className="row-between">
          <div>
            <h3 id="consent-h">New arrivals and offers</h3>
            <p className="muted small">On every channel we use (notifications now; SMS, WhatsApp or email later). Order updates are always sent.</p>
          </div>
          <Toggle label="New arrivals and offers" checked={customer.marketingOptIn} disabled={consentBusy} onChange={setConsent} />
        </div>
      </section>
    </div>
  );
}
