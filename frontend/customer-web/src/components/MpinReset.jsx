import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

export default function MpinReset() {
  const location = useLocation();
  const phone = location.state?.phone || '';

  const [code, setCode] = useState('');
  const [mpin, setMpin] = useState('');
  const [confirmMpin, setConfirmMpin] = useState('');

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!code || code.length !== 6) {
      newErrors.code = 'Enter the 6-digit code sent to your mobile number.';
    }
    if (!/^(\d{4}|\d{6})$/.test(mpin)) {
      newErrors.mpin = 'MPIN must be 4 or 6 digits.';
    }
    if (mpin !== confirmMpin) {
      newErrors.confirmMpin = 'MPIN and confirmation do not match.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await api.resetMpin(phone, code, mpin);
      setSuccess(true);
    } catch (err) {
      setErrors({ api: err.message || 'Failed to reset MPIN.' });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="success-card">
        <div className="success-icon-container">
          <CheckCircle2 size={40} />
        </div>
        <h3 className="success-title">MPIN Reset</h3>
        <p className="success-desc">
          Your MPIN has been successfully updated. You can now log in with your new MPIN.
        </p>
        <Link to="/login" className="submit-btn" style={{ textDecoration: 'none' }}>
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="form-slide">
      <h3 className="form-title">
        <KeyRound size={26} /> Reset MPIN
      </h3>

      {!phone ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ color: '#d32f2f', marginBottom: '15px' }}>
            <AlertTriangle size={48} style={{ margin: '0 auto' }} />
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
            Missing mobile number. Please request a reset code first.
          </p>
          <Link to="/forgot-password" className="submit-btn" style={{ textDecoration: 'none' }}>
            Request Reset Code
          </Link>
        </div>
      ) : (
        <>
          <p className="form-subtitle">Enter the code we sent to <strong>{phone}</strong> and choose a new MPIN</p>

          {errors.api && (
            <div className="error-msg" style={{ marginBottom: '15px', padding: '10px', background: '#ffebee', borderRadius: '6px' }}>
              {errors.api}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="input-label">Reset Code</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  maxLength={6}
                  className="form-input"
                  style={{ letterSpacing: '4px', textAlign: 'center' }}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ''));
                    if (errors.code) setErrors((prev) => ({ ...prev, code: '' }));
                  }}
                />
              </div>
              {errors.code && <span className="error-msg">{errors.code}</span>}
            </div>

            <div className="form-group">
              <label className="input-label">New MPIN</label>
              <div className="input-wrapper">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  className="form-input"
                  style={{ letterSpacing: '4px', textAlign: 'center' }}
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
              <label className="input-label">Confirm New MPIN</label>
              <div className="input-wrapper">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  className="form-input"
                  style={{ letterSpacing: '4px', textAlign: 'center' }}
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
              {loading ? 'Updating MPIN...' : 'Reset MPIN'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
