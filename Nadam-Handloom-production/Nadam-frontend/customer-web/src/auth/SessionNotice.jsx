import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth.js';
import { clearEnded } from './session.js';
import { useToast } from '../components/Toasts.jsx';

// When a sign-in ends by itself (signed out elsewhere, 30 days unused, for safety), say why
// once. Pages that need a sign-in then send the customer to sign in and back.
export default function SessionNotice() {
  const { ended } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const loc = useLocation();
  useEffect(() => {
    if (!ended) return;
    toast(ended.message || 'Please sign in again.', { tone: 'info', ms: 8000 });
    clearEnded();
    if (loc.pathname.startsWith('/account')) navigate(`/sign-in?next=${encodeURIComponent(loc.pathname + loc.search)}`, { replace: true });
  }, [ended, toast, navigate, loc]);
  return null;
}
