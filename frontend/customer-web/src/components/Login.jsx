import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Phone, KeyRound, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/account';
  const [phone, setPhone] = useState('');
  const [mpin, setMpin] = useState('');

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const validate = () => {
    const newErrors = {};
    if (!/^\d{10}$/.test(phone)) {
      newErrors.phone = 'Enter a valid 10-digit mobile number';
    }
    if (!mpin) {
      newErrors.mpin = 'MPIN is required';
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
      const response = await login(phone, mpin);

      if (response.requiresVerification) {
        navigate('/otp-verify', { state: { phone: response.user.phone, redirect: redirectTo } });
      } else {
        navigate(redirectTo);
      }
    } catch (err) {
      setApiError(err.message || 'Sign in failed. Please check your mobile number and MPIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-slide">
      <h3 className="form-title">Welcome Back</h3>
      <p className="form-subtitle">Enter your mobile number and MPIN to sign in</p>

      {apiError && (
        <div className="error-msg" style={{ marginBottom: '15px', padding: '10px', background: '#ffebee', borderRadius: '6px' }}>
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label className="input-label">Mobile Number</label>
          <div className="input-wrapper">
            <input
              type="tel"
              className="form-input"
              placeholder="9876543210"
              maxLength={10}
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/\D/g, ''));
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                setApiError('');
              }}
            />
            <Phone size={18} className="input-icon" />
          </div>
          {errors.phone && <span className="error-msg">{errors.phone}</span>}
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="input-label">MPIN</label>
            <Link
              to="/forgot-password"
              style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: '600' }}
            >
              Forgot MPIN?
            </Link>
          </div>
          <div className="input-wrapper">
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              className="form-input"
              style={{ letterSpacing: '4px' }}
              placeholder="••••"
              value={mpin}
              onChange={(e) => {
                setMpin(e.target.value.replace(/\D/g, ''));
                if (errors.mpin) setErrors((prev) => ({ ...prev, mpin: '' }));
                setApiError('');
              }}
            />
            <KeyRound size={18} className="input-icon" />
          </div>
          {errors.mpin && <span className="error-msg">{errors.mpin}</span>}
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Signing In...' : 'Sign In'} <ArrowRight size={18} />
        </button>
      </form>

      <p className="form-footer-link">
        Don't have an account? <Link to={`/register${redirectTo !== '/account' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}>Create Account</Link>
      </p>
    </div>
  );
}
