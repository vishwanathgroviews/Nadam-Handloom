// New-arrival alerts (instead of an email newsletter): a notification on this phone or computer
// when new sarees arrive, through the W1 notifications (topic 'arrivals'). Works without signing in.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/Button.jsx';
import Icon from '../../components/Icon.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { useAuth } from '../../auth/useAuth.js';
import { useConfig } from '../../config/useConfig.js';
import { shopApi } from '../../api/shop.js';
import { pushSupport, permission, turnOn } from '../../push/push.js';
import { readPushToken } from '../../push/token.js';

export default function Alerts() {
  const { config } = useConfig();
  const { customer } = useAuth();
  const toast = useToast();
  const support = pushSupport(config.push);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(() => support === 'ok' && permission() === 'denied');

  // Already getting new-arrival alerts on this browser?
  useEffect(() => {
    const token = readPushToken();
    if (support !== 'ok' || permission() !== 'granted' || !token) return undefined;
    let live = true;
    shopApi.pushStatus(token).then((s) => { if (live) setOn(s.subscribed && s.topics.includes('arrivals')); }).catch(() => {});
    return () => { live = false; };
  }, [support, customer?.id]);

  async function turnOnAlerts() {
    setBusy(true);
    try {
      const r = await turnOn(config.push);
      if (r.permission !== 'granted') {
        if (r.permission === 'denied') setBlocked(true);
        return;
      }
      const now = await shopApi.pushStatus(r.token).catch(() => ({ subscribed: false, topics: [] }));
      const topics = [...new Set([...(now.subscribed ? now.topics : customer ? ['orders'] : []), 'arrivals'])];
      if (now.subscribed) await shopApi.pushTopics(r.token, topics);
      else await shopApi.pushSubscribe(r.token, topics);
      setOn(true);
      toast('Done. We will tell you when new sarees arrive.');
    } catch (ex) {
      toast(ex.code === 'PUSH_UNSUPPORTED' ? 'This browser can\'t show notifications.' : 'Alerts couldn\'t be turned on. Please try again.', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  }

  const wa = `https://wa.me/${config.store.whatsapp}?text=${encodeURIComponent('Hello Nandam Handlooms, please send me your new arrivals.')}`;
  let action;
  if (on) {
    action = <p className="state" role="status"><Icon name="check" /> Alerts are on for this device.{customer ? <> <Link className="link" to="/account/notifications">Manage</Link></> : null}</p>;
  } else if (support === 'ok' && !blocked) {
    action = <Button kind="primary" size="lg" onClick={turnOnAlerts} loading={busy}><Icon name="spark" size="sm" />Tell me about new arrivals</Button>;
  } else if (support === 'ios-home-screen') {
    action = <p className="state">On iPhone, tap <b>Share</b> then <b>Add to Home Screen</b>, open Nandam from there and turn alerts on.</p>;
  } else {
    action = (
      <>
        {blocked ? <p className="state">Notifications are blocked in this browser. You can allow them in the site settings next to the address bar.</p> : null}
        <a className="btn btn-primary btn-lg" href={wa} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size="sm" />Get new arrivals on WhatsApp</a>
      </>
    );
  }

  return (
    <section className="lux-news" aria-labelledby="h-alerts">
      <div className="wrap">
        <span className="eyebrow">New-arrival alerts</span>
        <h2 id="h-alerts">Be the first to see new sarees</h2>
        <p className="muted">New pieces reach the store every week. Get one short alert on this phone or computer when they go up. No email, no spam; turn it off any time.</p>
        {action}
      </div>
    </section>
  );
}
