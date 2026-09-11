import React, { useState } from 'react';
import { MapPin, Phone, Clock, Copy, Check, Navigation } from 'lucide-react';
import './StoreLocation.css';

const STORE_NAME = 'NANDAM HANDLOOMS';
const STORE_ADDRESS_LINES = [
  '#10-23',
  'Opp. Brahmam Gari Temple, Hussain Katta',
  'Old Mangalagiri, Guntur Dist',
  'Andhra Pradesh – 522 503',
];
const STORE_PHONE_DISPLAY = '+91 73829 68566';
const STORE_PHONE_TEL = '+917382968566';
const STORE_HOURS = 'Monday – Sunday: 9:30 AM to 8:30 PM (IST)';
const STORE_MAP_URL = 'https://maps.app.goo.gl/qK54PztChaCdGzMz6';

export default function StoreLocation() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const fullAddress = `${STORE_NAME}\n${STORE_ADDRESS_LINES.join(', ')}`;
    try {
      await navigator.clipboard.writeText(fullAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — fail silently, the address is still on-screen.
    }
  };

  return (
    <section className="section container store-location">
      <div className="section-header">
        <div>
          <h2 className="section-title">Our Store &amp; Location</h2>
          <p className="section-subtitle">Visit us in person to see and feel the weave</p>
        </div>
      </div>

      <div className="store-location-card">
        <div className="store-location-info">
          <div className="store-location-row store-location-name-row">
            <MapPin size={18} />
            <span className="store-location-name">{STORE_NAME}</span>
            <button type="button" className="store-location-copy" onClick={handleCopy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <p className="store-location-address">
            {STORE_ADDRESS_LINES.map((line) => (
              <React.Fragment key={line}>
                {line}
                <br />
              </React.Fragment>
            ))}
          </p>

          <div className="store-location-row">
            <Phone size={16} />
            <a href={`tel:${STORE_PHONE_TEL}`}>Mobile: {STORE_PHONE_DISPLAY}</a>
          </div>

          <div className="store-location-row">
            <Clock size={16} />
            <span>Hours: {STORE_HOURS}</span>
          </div>

          <div className="store-location-actions">
            <a href={`tel:${STORE_PHONE_TEL}`} className="btn btn-primary">
              <Phone size={16} /> Call Store
            </a>
            <a href={STORE_MAP_URL} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
              <Navigation size={16} /> Get Directions
            </a>
          </div>
        </div>

        <a
          href={STORE_MAP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="store-location-map-preview"
          aria-label="View Nandam Handlooms on Google Maps"
        >
          <MapPin size={40} />
          <span>View on Google Maps</span>
        </a>
      </div>
    </section>
  );
}
