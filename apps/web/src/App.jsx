import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './components/Login';
import Register from './components/Register';
import OtpVerification from './components/OtpVerification';
import ResetRequest from './components/ResetRequest';
import ResetPassword from './components/ResetPassword';
import ProfileSettings from './components/ProfileSettings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Wrap all auth lifecycle screens inside the branded Layout */}
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/otp-verify" element={<OtpVerification />} />
          <Route path="/forgot-password" element={<ResetRequest />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/profile" element={<ProfileSettings />} />
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
