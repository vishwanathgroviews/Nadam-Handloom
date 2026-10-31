import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header.jsx';
import Footer, { FooterLine } from './Footer.jsx';
import Icon from './Icon.jsx';
import BagPanel from './BagPanel.jsx';
import BagWhatsApp from './BagWhatsApp.jsx';
import OrderNotice from './OrderNotice.jsx';
import { useOnline } from '../utils/useOnline.js';
import { useConfig } from '../config/useConfig.js';

export default function Layout() {
  const online = useOnline();
  const { pathname } = useLocation();
  const { config } = useConfig();
  const home = pathname === '/';
  // Sign-in and My account have their own help links; the round button would cover form text,
  // and on the saree page and the bag it would cover the bar at the bottom of phones.
  const fab = !pathname.startsWith('/sign-in') && !pathname.startsWith('/account') && !pathname.startsWith('/product/') && pathname !== '/bag' && pathname !== '/checkout' && !pathname.startsWith('/order/');
  return (
    <div className={home ? 'at-home' : undefined}>
      <a className="skip-link" href="#main">Skip to content</a>
      {!online ? (
        <div className="net-banner" role="status"><Icon name="wifioff" />You are offline. What you type is kept; we'll try again when you're back.</div>
      ) : null}
      <Header />
      <main id="main" tabIndex={-1}>
        <OrderNotice />
        {/* A page whose code is still loading: the header and footer stay. */}
        <Suspense fallback={<div className="boot page-boot" aria-busy="true" aria-label="Loading"><span className="dot" /></div>}>
          <Outlet />
        </Suspense>
      </main>
      {/* The shop's details only on the home page (client, 26 Oct 2026); elsewhere one line of links. */}
      {home ? <Footer /> : <FooterLine />}
      {fab ? (
        <a className="wa-fab" href={`https://wa.me/${config.store.whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label="Message Nandam Handlooms on WhatsApp">
          <Icon name="whatsapp" />
        </a>
      ) : null}
      <BagPanel />
      <BagWhatsApp />
    </div>
  );
}
