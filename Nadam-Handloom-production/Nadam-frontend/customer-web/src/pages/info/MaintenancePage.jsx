import { useEffect } from 'react';
import { useConfig } from '../../config/useConfig.js';
import { whatsappText } from '../../utils/format.js';

// The shop switched the website off for a while (Settings → Maintenance → Website).
export default function MaintenancePage({ message }) {
  const { config } = useConfig();
  useEffect(() => { document.title = 'Back soon · Nandam Handlooms'; }, []);
  return (
    <main className="maint" id="main">
      <div>
        <img src="/img/logo-192.png" alt="Nandam Handlooms" width="110" height="110" />
        <span className="eyebrow">We'll be back soon</span>
        <h1 style={{ fontSize: 'clamp(2rem,5vw,3rem)' }}>The website is being updated</h1>
        <p className="lead">{message || 'Please check back in a little while.'}</p>
        <p className="muted">Need something now? Message us on WhatsApp at <a className="link" href={`https://wa.me/${config.store.whatsapp}`}>+91 {whatsappText(config)}</a>.</p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>Try again</button>
      </div>
    </main>
  );
}
