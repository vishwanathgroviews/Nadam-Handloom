import { Link } from 'react-router-dom';
import { useTitle } from '../../utils/useTitle.js';
import { useConfig } from '../../config/useConfig.js';
import { whatsappText } from '../../utils/format.js';

// Terms of use. DRAFT for the shop, like the shipping and refunds pages (W6).
export default function TermsPage() {
  useTitle('Terms');
  const { config } = useConfig();
  return (
    <div className="wrap narrow page-enter">
      <div className="page-head">
        <span className="draft-note">Draft: to be reviewed by the shop</span>
        <h1>Terms of use</h1>
      </div>
      <div className="prose" style={{ paddingBottom: 'clamp(48px,6vw,90px)' }}>
        <p>This website is run by {config.shop.name} (GSTIN {config.shop.gstin}), {config.shop.address}.</p>
        <h2>Your account</h2>
        <ul>
          <li>One account per mobile number. Keep your phone safe: the code we send it is how you sign in.</li>
          <li>The details you give should be your own and correct, so your orders reach you.</li>
          <li>You can close your account at any time from My account.</li>
        </ul>
        <h2>Shopping</h2>
        <ul>
          <li>Prices are in rupees and include GST. Delivery is free across India.</li>
          <li>Payment is online through Razorpay (UPI, cards, net banking, wallets). Your sarees are held for you for 15 minutes when you press Pay; an order is confirmed once the payment reaches us.</li>
          <li>Delivery: see our <Link to="/shipping">shipping policy</Link>. Cancelling and refunds: see <Link to="/refunds">cancellation and refunds</Link>.</li>
        </ul>
        <h2>Contact</h2>
        <p>Questions? Message us on WhatsApp at +91 {whatsappText(config)}.</p>
      </div>
    </div>
  );
}
