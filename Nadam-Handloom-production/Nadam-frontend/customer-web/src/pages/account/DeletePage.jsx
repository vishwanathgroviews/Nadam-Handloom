// My account → Delete account: a 7-day window to change one's mind; orders and invoices stay.
import { useState } from 'react';
import Button from '../../components/Button.jsx';
import Alert from '../../components/Alert.jsx';
import Field from '../../components/Field.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { useConfirm } from '../../components/Modal.jsx';
import { useAuth } from '../../auth/useAuth.js';
import { updateCustomer } from '../../auth/session.js';
import { shopApi } from '../../api/shop.js';
import { longDate } from '../../utils/format.js';

export default function DeletePage() {
  const { customer } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [agree, setAgree] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  async function request() {
    setProblem(null);
    if (!agree) { setProblem({ tone: 'warn', text: 'Tick the box to confirm first.' }); return; }
    const ok = await confirm({ icon: 'trash', tone: 'bad', title: 'Delete your account in 7 days?', text: 'You can still sign in and keep it until then.', ok: 'Request deletion', danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      await shopApi.requestDeletion(reason.trim() || undefined);
      const { customer: c } = await shopApi.me();
      updateCustomer(c);
      toast('Deletion requested. You have 7 days to change your mind.');
    } catch (ex) {
      setProblem({ tone: ex.code === 'OPEN_ORDERS' || ex.code === 'ACCOUNT_MANAGED_BY_SHOP' ? 'warn' : 'bad', text: ex.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card stack" style={{ maxWidth: 700 }}>
      <h3>Delete my account</h3>
      <ul className="plain-list muted">
        <li>Your profile, picture and addresses are removed after <b>7 days</b>.</li>
        <li>Changed your mind? Sign in within those 7 days and choose <b>Keep my account</b>.</li>
        <li>Orders and GST invoices stay with the shop for tax records, without your contact details.</li>
        <li>You can create a new account with the same mobile number later.</li>
      </ul>
      {customer.managedByShop ? (
        <Alert title="This account is also used for the shop's staff app">Only the shop owner can close it. Please ask them.</Alert>
      ) : customer.deletion ? (
        <Alert tone="warn" title={customer.deletion.overdue ? 'Deletion requested: waiting for orders on their way' : `Deletion requested: on ${longDate(customer.deletion.deletesOn)}`}>Use <b>Keep my account</b> at the top of this page to cancel it.</Alert>
      ) : (
        <>
          <Field label="Why are you leaving?" optional>
            {(a) => <textarea {...a} className="input" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="It helps us do better (you don't have to say)." />}
          </Field>
          <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>I understand. Delete my account in 7 days.</span></label>
          {problem ? <Alert tone={problem.tone}>{problem.text}</Alert> : null}
          <div><Button kind="danger" icon="trash" loading={busy} onClick={request}>Request deletion</Button></div>
        </>
      )}
    </div>
  );
}
