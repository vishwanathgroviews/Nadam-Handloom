import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth.js';
import { retryBootstrap } from './session.js';
import Button from '../components/Button.jsx';
import { EmptyState } from '../components/bits.jsx';

// Pages for signed-in customers only. A visitor goes to sign in and comes back after.
export default function RequireAuth() {
  const { status, bootError } = useAuth();
  const loc = useLocation();
  if (status === 'signedIn') return <Outlet />;
  if (status === 'signedOut') {
    const next = `${loc.pathname}${loc.search}`;
    return <Navigate to={`/sign-in?next=${encodeURIComponent(next)}`} replace />;
  }
  if (bootError) {
    return (
      <div className="wrap narrow">
        <EmptyState icon="wifioff" title="We can't reach Nandam Handlooms" text={bootError.message}>
          <Button kind="primary" onClick={() => retryBootstrap()}>Try again</Button>
        </EmptyState>
      </div>
    );
  }
  return <div className="boot" aria-busy="true" aria-label="Loading"><span className="dot" /></div>;
}
