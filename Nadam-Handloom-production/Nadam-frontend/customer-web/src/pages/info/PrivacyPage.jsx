import { Link } from 'react-router-dom';
import { useTitle } from '../../utils/useTitle.js';
import { useConfig } from '../../config/useConfig.js';
import { formatMobile, whatsappText } from '../../utils/format.js';

// What we collect and why (Digital Personal Data Protection Act, 2023). DRAFT for the shop.
export default function PrivacyPage() {
  useTitle('Privacy');
  const { config } = useConfig();
  return (
    <div className="wrap narrow page-enter">
      <div className="page-head">
        <span className="draft-note">Draft: to be reviewed by the shop</span>
        <h1>Privacy</h1>
        <p className="lead">What we ask for, why, and what you can do about it.</p>
      </div>
      <div className="prose" style={{ paddingBottom: 'clamp(48px,6vw,90px)' }}>
        <h2>What we collect</h2>
        <ul>
          <li><b>When you sign up:</b> your mobile number (to sign you in with a code), your name, email and pincode with city and state (to deliver your orders and send invoices).</li>
          <li><b>Later, only if you add them:</b> a profile picture, your date of birth, anniversary, preferred language and delivery addresses.</li>
          <li><b>Automatically:</b> the device and browser you use, when you signed in, and where you first came from (for example a link from Instagram), to keep your account safe and to understand how people find us. We don't use advertising trackers.</li>
        </ul>
        <h2>Why</h2>
        <p>To sign you in, deliver your orders, send order updates and GST invoices, and, only if you tick the box, tell you about new arrivals and offers. You can change that choice any time in My account → Notifications.</p>
        <h2>Your choices</h2>
        <ul>
          <li>See and change your details in <Link className="link" to="/account/profile">My account → Profile</Link>.</li>
          <li>See every device you're signed in on and sign them out in <Link className="link" to="/account/devices">Signed-in devices</Link>.</li>
          <li>Delete your account in <Link className="link" to="/account/delete">Delete account</Link>. Your details are removed after 7 days; orders and invoices are kept as tax law requires, without your contact details.</li>
        </ul>
        <h2>Keeping it safe</h2>
        <p>Sign-in codes are stored only in scrambled form, your sign-in is protected by a secure cookie, and only the shop's own staff can see your orders.</p>
        <h2>Contact</h2>
        <p>{config.shop.name}, {config.shop.address}. Call +91 {formatMobile(config.shop.mobile)} or message us on WhatsApp at +91 {whatsappText(config)}.</p>
      </div>
    </div>
  );
}
