// Paying (W6), for the checkout and the order page: our server makes the payment request,
// Razorpay's window opens, and after paying our server checks the payment with Razorpay
// before anything is shown as paid. The page's receipt alone never counts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { shopApi } from '../../api/shop.js';
import { loadRazorpay, openRazorpay } from '../../payments/razorpay.js';
import { refresh as refreshBag } from '../../bag/store.js';

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const BRAND = '#8C1A44'; // Razorpay's window is light: the shop's maroon in both themes

// The checkout open in this tab (its order number), so a reload or Back finds its hold.
const KEY = 'nh-checkout';
export function rememberCheckout(number) {
  try {
    if (number) sessionStorage.setItem(KEY, number);
    else sessionStorage.removeItem(KEY);
  } catch { /* private mode: this page only */ }
}
export function rememberedCheckout() {
  try {
    const n = sessionStorage.getItem(KEY);
    return /^NH\d{8}$/.test(n || '') ? n : null;
  } catch {
    return null;
  }
}

// phase: idle | starting (asking our server) | open (Razorpay's window) | confirming.
// ended: how the window last closed without a payment: { kind: 'closed' | 'failed' | 'script', reason }.
export function usePayment() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('idle');
  const [ended, setEnded] = useState(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // Paid in Razorpay's window: our server checks it (tried again if the connection drops), then
  // the order page shows the result. If our server couldn't be reached, the order page keeps
  // checking: Razorpay's notice completes the order on the server meanwhile.
  const confirm = useCallback(async (number, receipt) => {
    setPhase('confirming');
    for (let i = 0; i < 4; i += 1) {
      try {
        await shopApi.verifyPayment(number, receipt);
        break;
      } catch (err) {
        const final = err.status >= 400 && err.status < 500 && err.status !== 429 && err.status !== 408;
        if (final || i === 3) break;
        await sleep(1500 * 2 ** i);
      }
    }
    rememberCheckout(null);
    refreshBag();
    navigate(`/order/${number}`, { replace: true, state: { paid: true } });
    // Paid from the order page itself: the same page stays, so "confirming" must end here.
    if (alive.current) setPhase('idle');
  }, [navigate]);

  // start(): the server call that makes (or renews) the payment request: { order, razorpay }.
  // Its errors are thrown for the page to show. Answers what start() answered.
  const pay = useCallback(async (start) => {
    setEnded(null);
    setPhase('starting');
    const sdk = loadRazorpay(); // loads while our server makes the request
    sdk.catch(() => {});
    let r;
    try {
      r = await start();
    } catch (err) {
      if (alive.current) setPhase('idle');
      throw err;
    }
    rememberCheckout(r.order.number);
    let Razorpay;
    try {
      Razorpay = await sdk;
    } catch {
      if (alive.current) { setPhase('idle'); setEnded({ kind: 'script' }); }
      return r;
    }
    if (!alive.current) return r;
    setPhase('open');
    let failure = null;
    try {
      // Razorpay's window loads the logo itself: only from the real (https) website.
      openRazorpay(Razorpay, r.razorpay, {
        paid: (receipt) => { confirm(r.order.number, receipt); },
        failed: (reason) => { failure = reason; },
        closed: () => {
          if (!alive.current) return;
          setPhase('idle');
          setEnded(failure ? { kind: 'failed', reason: failure } : { kind: 'closed' });
        },
      }, { color: BRAND, logo: window.location.protocol === 'https:' ? `${window.location.origin}/img/logo-96.png` : undefined });
    } catch {
      setPhase('idle');
      setEnded({ kind: 'script' });
    }
    return r;
  }, [confirm]);

  // The hold ran out while the window was open (it closes itself then).
  const reset = useCallback(() => { setPhase('idle'); }, []);

  return { phase, ended, setEnded, pay, reset };
}
