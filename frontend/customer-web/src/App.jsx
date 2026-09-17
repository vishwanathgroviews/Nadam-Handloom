import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';

import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import Login from './components/Login';
import Register from './components/Register';
import OtpVerification from './components/OtpVerification';
import MpinSetup from './components/MpinSetup';
import ResetRequest from './components/ResetRequest';
import MpinReset from './components/MpinReset';
import ProfileSettings from './components/ProfileSettings';

import StoreLayout from './components/StoreLayout';
import Home from './pages/Home';
import CategoryPage from './pages/CategoryPage';
import ProductListPage from './pages/ProductListPage';
import ProductDetail from './pages/ProductDetail';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmation from './pages/OrderConfirmation';
import MyOrders from './pages/MyOrders';
import OrderDetail from './pages/OrderDetail';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          {/* Inside the router, above every route: one place resets the
              scroll position instead of each page remembering to. */}
          <ScrollToTop />
          <Routes>
            {/* Storefront — main site layout, browsable without login */}
            <Route element={<StoreLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/shop" element={<ProductListPage />} />
              <Route path="/category/:slug" element={<CategoryPage />} />
              <Route path="/category/:slug/:subcategoryId" element={<ProductListPage />} />
              <Route path="/product/:slug" element={<ProductDetail />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />
              <Route path="/account" element={<ProfileSettings />} />
              <Route path="/account/orders" element={<MyOrders />} />
              <Route path="/account/orders/:orderId" element={<OrderDetail />} />
            </Route>

            {/* Auth lifecycle screens — branded banner layout */}
            <Route element={<Layout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/otp-verify" element={<OtpVerification />} />
              <Route path="/mpin-setup" element={<MpinSetup />} />
              <Route path="/forgot-password" element={<ResetRequest />} />
              <Route path="/reset-password" element={<MpinReset />} />
            </Route>

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
