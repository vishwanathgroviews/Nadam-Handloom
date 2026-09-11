import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Phone, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

// Reached either from "Forgot MPIN?" on the login screen (no prefill) or
// from the profile page's "Change MPIN" action, which already knows the
// signed-in customer's number — no reason to make them retype it.
export default function ResetRequest() {
  const navigate = useNavigate();
  const location = useLocation();
  const [phone, setPhone] = useState(location.state?.phone || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (!phone) {
      setError('Mobile number is required.');
      return false;
    }
    if (!/^\d{10}$/.test(phone)) {
      setError('Please enter a valid 10-digit mobile number.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError('');
    try {
      await api.requestMpinReset(phone);
      navigate('/reset-password', { state: { phone } });
    } catch (err) {
      setError(err.message || 'Error requesting an MPIN reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-slide">
      <h3 className="form-title">Forgot MPIN</h3>
      <p className="form-subtitle">Enter your registered mobile number and we'll send you a code to reset your MPIN</p>

      {error && (
        <div className="error-msg" style={{ marginBottom: '15px', padding: '10px', background: '#ffebee', borderRadius: '6px' }}>
          {error}
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
                setError('');
              }}
            />
            <Phone size={18} className="input-icon" />
          </div>
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Sending...' : 'Send Reset Code'} <ArrowRight size={18} />
        </button>
      </form>

      <p className="form-footer-link">
        Remember your MPIN? <Link to="/login">Sign In</Link>
      </p>
    </div>
  );
}
