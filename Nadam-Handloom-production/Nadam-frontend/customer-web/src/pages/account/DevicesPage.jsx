// My account → Signed-in devices: each browser stays signed in for 30 days; sign one out,
// or all of them at once.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button.jsx';
import Alert from '../../components/Alert.jsx';
import Icon from '../../components/Icon.jsx';
import { Skeleton } from '../../components/bits.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { useConfirm } from '../../components/Modal.jsx';
import { signOutEverywhere } from '../../auth/session.js';
import { shopApi } from '../../api/shop.js';
import { longDate, whenText } from '../../utils/format.js';

const ICON = { mobile: 'phonedev', tablet: 'tablet', desktop: 'laptop' };

export default function DevicesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [data, setData] = useState({ status: 'loading', list: [], error: null });
  const [busyId, setBusyId] = useState(null);
  const [allBusy, setAllBusy] = useState(false);

  const load = useCallback(async () => {
    setData((d) => ({ ...d, status: 'loading', error: null }));
    try {
      const r = await shopApi.sessions();
      setData({ status: 'ready', list: r.sessions, error: null });
    } catch (ex) {
      setData((d) => ({ ...d, status: 'error', error: ex }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function signOutOne(s) {
    const ok = await confirm({ icon: 'logout', title: `Sign out ${s.label}?`, text: 'That device will need a new code to sign in again.', ok: 'Sign out' });
    if (!ok) return;
    setBusyId(s.id);
    try {
      const r = await shopApi.signOutSession(s.id);
      setData({ status: 'ready', list: r.sessions, error: null });
      toast(`Signed out ${s.label}`);
    } catch (ex) {
      toast(ex.message, { tone: 'bad' });
      if (ex.code === 'SESSION_NOT_FOUND') load();
    } finally {
      setBusyId(null);
    }
  }

  async function signOutAll() {
    const ok = await confirm({ icon: 'logout', tone: 'warn', title: 'Sign out of all devices?', text: 'Every phone and computer, this one included, will need a new code to sign in.', ok: 'Sign out everywhere' });
    if (!ok) return;
    setAllBusy(true);
    try {
      await signOutEverywhere(() => navigate('/sign-in', { replace: true }));
      toast('Signed out of all devices');
    } catch (ex) {
      setAllBusy(false);
      toast(ex.message, { tone: 'bad' });
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 780 }}>
      <p className="muted">You stay signed in for 30 days on each device, and every visit extends it. Sign out of any you don't recognise.</p>
      {data.status === 'loading' ? <Skeleton h={160} /> : null}
      {data.status === 'error' ? <Alert tone="bad" title="The list didn't load" actions={<Button size="sm" onClick={load}>Try again</Button>}>{data.error.message}</Alert> : null}
      {data.status === 'ready' ? (
        <div className="table-wrap">
          <table className="table stack">
            <thead><tr><th scope="col">Device</th><th scope="col">Signed in</th><th scope="col">Last active</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
            <tbody>
              {data.list.map((s) => (
                <tr key={s.id}>
                  <td data-label=""><span className="row-wrap"><Icon name={ICON[s.device] || 'laptop'} /><b>{s.label}</b></span></td>
                  <td data-label="Signed in">{longDate(s.signedInAt)}</td>
                  <td data-label="Last active">{s.isCurrent ? 'Now' : whenText(s.lastActiveAt)}</td>
                  <td data-label="">{s.isCurrent ? <span className="badge badge-ok">This device</span> : <Button size="sm" loading={busyId === s.id} onClick={() => signOutOne(s)}>Sign out</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div><Button icon="logout" loading={allBusy} onClick={signOutAll}>Sign out of all devices</Button></div>
    </div>
  );
}
