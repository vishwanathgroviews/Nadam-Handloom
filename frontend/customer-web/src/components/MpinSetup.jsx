import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { KeyRound, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

// Last step of registration — the phone is already OTP-verified (see
// OtpVerification.jsx); this sets the MPIN used for every login afterward.
export default function MpinSetup() {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const phone = location.state?.phone || '';
  const setupToken = location.state?.setupToken || '';
  const redirectTo = location.state?.redirect || '/account';

  const [mpin, setMpin] = useState('');
  const [confirmMpin, setConfirmMpin] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const validate = () => {
    const newErrors = {};
    if (!/^(\d{4}|\d{6})$/.test(mpin)) {
      newErrors.mpin = 'MPIN must be 4 or 6 digits';
    }
    if (mpin !== confirmMpin) {
      newErrors.confirmMpin = 'MPIN and confirmation do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setApiError('');
    try {
      await api.setupMpin(setupToken, mpin);
      await refreshUser();
      navigate(redirectTo || '/account');
    } catch (err) {
      setApiError(err.message || 'Could not set your MPIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!phone || !setupToken) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ color: '#d32f2f', marginBottom: '15px' }}>
          <AlertTriangle size={48} style={{ margin: '0 auto' }} />
        </div>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
          Missing verification details. Please register again.
        </p>
        <Link to="/register" className="submit-btn" style={{ textDecoration: 'none' }}>
          Back to Register
        </Link>
      </div>
    );
  }

  return (
    <div className="form-slide">
      <h3 className="form-title">
        <KeyRound size={26} /> Set Your MPIN
      </h3>
      <p className="form-subtitle">Choose a 4 or 6-digit MPIN — you'll use it to sign in from now on</p>

      {apiError && (
        <div className="error-msg" style={{ marginBottom: '15px', padding: '10px', background: '#ffebee', borderRadius: '6px' }}>
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label className="input-label">New MPIN</label>
          <div className="input-wrapper">
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              className="form-input"
              style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '1.25rem', paddingLeft: '16px' }}
              placeholder="••••"
              value={mpin}
              onChange={(e) => {
                setMpin(e.target.value.replace(/\D/g, ''));
                if (errors.mpin) setErrors((prev) => ({ ...prev, mpin: '' }));
              }}
            />
          </div>
          {errors.mpin && <span className="error-msg">{errors.mpin}</span>}
        </div>

        <div className="form-group">
          <label className="input-label">Confirm MPIN</label>
          <div className="input-wrapper">
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              className="form-input"
              style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '1.25rem', paddingLeft: '16px' }}
              placeholder="••••"
              value={confirmMpin}
              onChange={(e) => {
                setConfirmMpin(e.target.value.replace(/\D/g, ''));
                if (errors.confirmMpin) setErrors((prev) => ({ ...prev, confirmMpin: '' }));
              }}
            />
          </div>
          {errors.confirmMpin && <span className="error-msg">{errors.confirmMpin}</span>}
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Setting up…' : 'Set MPIN & Continue'}
        </button>
      </form>
    </div>
  );
}
