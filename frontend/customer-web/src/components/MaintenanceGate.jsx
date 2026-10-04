import React, { useCallback, useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import { api } from '../services/api';

const DEFAULT_MESSAGE = 'We are making a few improvements to the shop. Please visit again in a little while.';

/**
 * Shows a maintenance page instead of the shop while the owner has "Website
 * maintenance" switched on in the staff app (App Settings).
 *
 * The shop renders straight away and is only replaced once the server says
 * maintenance is on. Waiting for that answer first would put a network round
 * trip in front of every page load, and a server that cannot be reached would
 * then take the whole storefront down with it — so a failed check changes
 * nothing.
 */
export default function MaintenanceGate({ children }) {
  // null = the shop is open, or we could not find out.
  const [maintenance, setMaintenance] = useState(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    try {
      const res = await api.getAppConfig();
      const web = res.data?.webMaintenance;
      setMaintenance(web?.enabled ? web : null);
    } catch {
      // Unreachable: keep whatever was showing.
    }
  }, []);

  useEffect(() => {
    check();
    // A tab left open through a maintenance window finds out when the
    // customer comes back to it, not only on a full reload.
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [check]);

  if (!maintenance) return children;

  const tryAgain = async () => {
    setChecking(true);
    await check();
    setChecking(false);
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--bg-ivory)',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '460px',
          textAlign: 'center',
          background: 'var(--card-bg)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-premium)',
          padding: '40px 28px',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            margin: '0 auto 20px',
            borderRadius: '50%',
            background: 'rgba(122, 31, 43, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Wrench size={26} color="var(--primary)" />
        </div>
        <p style={{ color: 'var(--secondary)', fontWeight: 600, letterSpacing: '0.12em', fontSize: '12px', textTransform: 'uppercase' }}>
          Nandam Handlooms
        </p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text-dark)', fontSize: '28px', margin: '8px 0 12px' }}>
          We&rsquo;ll be back soon
        </h1>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
          {maintenance.message?.trim() || DEFAULT_MESSAGE}
        </p>
        <button
          type="button"
          onClick={tryAgain}
          disabled={checking}
          style={{
            marginTop: '28px',
            padding: '12px 28px',
            border: 'none',
            borderRadius: '999px',
            background: 'var(--primary)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '15px',
            cursor: checking ? 'wait' : 'pointer',
            opacity: checking ? 0.7 : 1,
          }}
        >
          {checking ? 'Checking…' : 'Try again'}
        </button>
      </section>
    </main>
  );
}
