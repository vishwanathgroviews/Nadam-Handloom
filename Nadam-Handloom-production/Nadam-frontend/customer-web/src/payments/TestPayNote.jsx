import Icon from '../components/Icon.jsx';
import { useConfig } from '../config/useConfig.js';

// While the shop tries online payment with Razorpay's test keys (the website is still being
// built, 26 Oct 2026): no real money moves, so say so wherever Checkout and Pay show.
// A standing note, not an alert: nothing went wrong.
export default function TestPayNote({ short = false }) {
  const { config } = useConfig();
  if (config.payments?.enabled !== true || config.payments.mode !== 'test') return null;
  if (short) return <p className="test-pay small" role="note"><b>Test payment:</b> no real money is taken.</p>;
  return (
    <div className="alert alert-warn" role="note">
      <Icon name="alert" />
      <div>
        <b className="alert-title">Test payment: no real money is taken</b>
        The website is being tried out. Pay with Razorpay&apos;s test card 4111 1111 1111 1111 (any future date, any CVV) or the UPI ID success@razorpay. Test orders are not shipped.
      </div>
    </div>
  );
}
