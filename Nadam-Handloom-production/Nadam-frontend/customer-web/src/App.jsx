// The website's pages. Account and order pages need a sign-in; the rest are open to everyone
// (the checkout asks a visitor to sign in itself).
import { Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ScrollManager from './components/ScrollManager.jsx';
import RequireAuth from './auth/RequireAuth.jsx';
import SessionNotice from './auth/SessionNotice.jsx';
import { useConfig } from './config/useConfig.js';
import { useToast } from './components/Toasts.jsx';
import { onForegroundMessage } from './push/push.js';
import HomePage from './pages/home/HomePage.jsx';
import SignInPage from './pages/account/SignInPage.jsx';
import MaintenancePage from './pages/info/MaintenancePage.jsx';
import NotFoundPage from './pages/info/NotFoundPage.jsx';
import { lazyPage } from './utils/lazyPage.js';

// The shop, My account and the info pages load when first opened.
const ShopPage = lazyPage(() => import('./pages/shop/ShopPage.jsx'));
const CategoryPage = lazyPage(() => import('./pages/shop/CategoryPage.jsx'));
const CollectionPage = lazyPage(() => import('./pages/shop/CollectionPage.jsx'));
const CollectionsPage = lazyPage(() => import('./pages/shop/CollectionsPage.jsx'));
const ProductPage = lazyPage(() => import('./pages/product/ProductPage.jsx'));
const BagPage = lazyPage(() => import('./pages/bag/BagPage.jsx'));
const CheckoutPage = lazyPage(() => import('./pages/checkout/CheckoutPage.jsx'));
const OrderPage = lazyPage(() => import('./pages/orders/OrderPage.jsx'));
const MyOrdersPage = lazyPage(() => import('./pages/orders/MyOrdersPage.jsx'));
const AccountLayout = lazyPage(() => import('./pages/account/AccountLayout.jsx'));
const OverviewPage = lazyPage(() => import('./pages/account/OverviewPage.jsx'));
const ProfilePage = lazyPage(() => import('./pages/account/ProfilePage.jsx'));
const AddressesPage = lazyPage(() => import('./pages/account/AddressesPage.jsx'));
const NotificationsPage = lazyPage(() => import('./pages/account/NotificationsPage.jsx'));
const DevicesPage = lazyPage(() => import('./pages/account/DevicesPage.jsx'));
const DeletePage = lazyPage(() => import('./pages/account/DeletePage.jsx'));
const PrivacyPage = lazyPage(() => import('./pages/info/PrivacyPage.jsx'));
const TermsPage = lazyPage(() => import('./pages/info/TermsPage.jsx'));
const ShippingPage = lazyPage(() => import('./pages/info/ShippingPage.jsx'));
const RefundsPage = lazyPage(() => import('./pages/info/RefundsPage.jsx'));
const ContactPage = lazyPage(() => import('./pages/info/ContactPage.jsx'));

const Loading = () => <div className="boot" aria-busy="true" aria-label="Loading"><span className="dot" /></div>;

// Addresses from the old website that people may still have saved.
const OLD_SIGN_IN = ['login', 'register', 'signup', 'otp-verify', 'mpin-setup', 'forgot-password', 'reset-password'];
const OLD_SHOP = ['products', 'wishlist'];

export default function App() {
  const { config } = useConfig();
  const toast = useToast();
  // A notification that arrives while the website is open shows as a message here.
  useEffect(() => onForegroundMessage((m) => toast(`${m.title}${m.body ? `: ${m.body}` : ''}`, { tone: 'info', ms: 8000 })), [toast]);

  if (config.maintenance?.on) return <MaintenancePage message={config.maintenance.message} />;
  return (
    <>
      <ScrollManager />
      <SessionNotice />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="shop" element={<ShopPage />} />
            <Route path="collections" element={<CollectionsPage />} />
            <Route path="category/:slug" element={<CategoryPage />} />
            <Route path="category/:slug/:collectionId" element={<CollectionPage />} />
            <Route path="product/:slug" element={<ProductPage />} />
            <Route path="bag" element={<BagPage />} />
            <Route path="cart" element={<Navigate to="/bag" replace />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="sign-in" element={<SignInPage />} />
            {OLD_SIGN_IN.map((p) => <Route key={p} path={p} element={<Navigate to="/sign-in" replace />} />)}
            {OLD_SHOP.map((p) => <Route key={p} path={p} element={<Navigate to="/shop" replace />} />)}
            {/* The old website's order pages: My orders (W7 rule 10). */}
            <Route path="account/orders/:id" element={<Navigate to="/account/orders" replace />} />
            <Route path="order-confirmation/:id" element={<Navigate to="/account/orders" replace />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="terms" element={<TermsPage />} />
            <Route path="shipping" element={<ShippingPage />} />
            <Route path="refunds" element={<RefundsPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route element={<RequireAuth />}>
              <Route path="order/:number" element={<OrderPage />} />
              <Route path="account" element={<AccountLayout />}>
                <Route index element={<OverviewPage />} />
                <Route path="orders" element={<MyOrdersPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="addresses" element={<AddressesPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="devices" element={<DevicesPage />} />
                <Route path="delete" element={<DeletePage />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
