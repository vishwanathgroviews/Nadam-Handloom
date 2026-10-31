// My account → Addresses: at most 10; one is the default (the first one saved is).
import { useCallback, useEffect, useState } from 'react';
import Button from '../../components/Button.jsx';
import Alert from '../../components/Alert.jsx';
import { EmptyState, Skeleton } from '../../components/bits.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { useConfirm } from '../../components/Modal.jsx';
import { useAuth } from '../../auth/useAuth.js';
import { shopApi } from '../../api/shop.js';
import AddressForm from './AddressForm.jsx';
import { formatMobile, labelName } from '../../utils/format.js';

export default function AddressesPage() {
  const { customer } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState({ status: 'loading', list: [], max: 10, error: null });
  const [form, setForm] = useState(null); // { address } or { address: null }
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setData((d) => ({ ...d, status: 'loading', error: null }));
    try {
      const r = await shopApi.addresses();
      setData({ status: 'ready', list: r.addresses, max: r.max, error: null });
    } catch (ex) {
      setData((d) => ({ ...d, status: 'error', error: ex }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const take = (r) => setData({ status: 'ready', list: r.addresses, max: r.max, error: null });

  async function makeDefault(a) {
    setBusyId(a.id);
    try { take(await shopApi.defaultAddress(a.id)); toast('Default address changed'); } catch (ex) { toast(ex.message, { tone: 'bad' }); if (ex.code === 'ADDRESS_NOT_FOUND') load(); } finally { setBusyId(null); }
  }
  async function remove(a) {
    const ok = await confirm({ icon: 'trash', tone: 'bad', title: 'Delete this address?', text: 'Orders already placed keep their own copy of the address.', ok: 'Delete', danger: true });
    if (!ok) return;
    setBusyId(a.id);
    try { take(await shopApi.removeAddress(a.id)); toast('Address deleted'); } catch (ex) { toast(ex.message, { tone: 'bad' }); if (ex.code === 'ADDRESS_NOT_FOUND') load(); } finally { setBusyId(null); }
  }

  const full = data.list.length >= data.max;
  return (
    <div className="stack">
      <div className="row-between">
        <p className="muted">{data.status === 'ready' ? `${data.list.length} of ${data.max} addresses saved` : ' '}</p>
        <Button icon="plus" disabled={data.status !== 'ready' || full} onClick={() => setForm({ address: null })}>Add a new address</Button>
      </div>
      {full ? <Alert title="You have 10 saved addresses">That's the most we keep. Delete one to add another.</Alert> : null}
      {data.status === 'loading' ? <><Skeleton h={120} /><Skeleton h={120} /></> : null}
      {data.status === 'error' ? (
        <Alert tone="bad" title="Your addresses didn't load" actions={<Button size="sm" onClick={load}>Try again</Button>}>{data.error.message}</Alert>
      ) : null}
      {data.status === 'ready' && !data.list.length ? (
        <EmptyState icon="pin" title="No saved addresses" text="Add one now and checkout will be quicker.">
          <Button kind="primary" icon="plus" onClick={() => setForm({ address: null })}>Add an address</Button>
        </EmptyState>
      ) : null}
      {data.status === 'ready' ? data.list.map((a) => (
        <article key={a.id} className="card addr-card" aria-label={`${labelName(a.label)} address${a.isDefault ? ', default' : ''}`}>
          <div>
            <div className="row-wrap"><b>{a.fullName}</b><span className="badge">{labelName(a.label)}</span>{a.isDefault ? <span className="badge badge-ok">Default</span> : null}{a.problem ? <span className="badge badge-warn">Needs checking</span> : null}</div>
            <p className="muted">
              {[a.line1, a.line2].filter(Boolean).join(', ')}{a.landmark ? ` (near ${a.landmark})` : ''}<br />
              {a.city}, {a.state} {a.pincode}<br />
              +91 {formatMobile(a.mobile)}
            </p>
          </div>
          <div className="row-wrap actions">
            {!a.isDefault ? <Button size="sm" loading={busyId === a.id} onClick={() => makeDefault(a)}>Make default</Button> : null}
            <Button size="sm" icon="edit" onClick={() => setForm({ address: a })}>Edit</Button>
            <Button size="sm" icon="trash" onClick={() => remove(a)} disabled={busyId === a.id}>Delete</Button>
          </div>
        </article>
      )) : null}
      {form ? (
        <AddressForm
          address={form.address}
          problem={form.address?.problem || null}
          customer={customer}
          isFirst={!data.list.length}
          onClose={() => setForm(null)}
          onSaved={(r, editing) => { take(r); setForm(null); toast(editing ? 'Address saved' : 'Address added'); }}
        />
      ) : null}
    </div>
  );
}
