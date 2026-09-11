import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, RefreshCw, MessageSquare } from 'lucide-react';
import { api } from '../services/api';

export default function OtpVerification() {
  const location = useLocation();
  const navigate = useNavigate();

  const phone = location.state?.phone || '';
  const redirectTo = location.state?.redirect || '';

  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(30); // 30 seconds cooldown
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mockMessage, setMockMessage] = useState('');

  useEffect(() => {
    if (!phone) {
      setError('Invalid access. Please register or login first.');
    }
  }, [phone]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Mask phone (e.g. 98******10)
  const maskPhone = (ph) => {
    if (!ph || ph.length < 4) return ph || '';
    return `${ph.slice(0, 2)}${'*'.repeat(ph.length - 4)}${ph.slice(-2)}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { setupToken } = await api.verifyOtp(phone, code);
      navigate('/mpin-setup', { state: { phone, setupToken, redirect: redirectTo } });
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;

    setError('');
    setCooldown(30);
    try {
      await api.sendOtp(phone);
      setMockMessage(`OTP Resent to ${maskPhone(phone)}`);
    } catch (err) {
      setError('Failed to resend code. Please try again.');
    }
  };

  return (
    <div className="form-slide">
      <h3 className="form-title">
        <ShieldCheck size={26} /> Verify Mobile Number
      </h3>
      <p className="form-subtitle">We have sent a 6-digit One-Time Passcode to {maskPhone(phone)}</p>

      {mockMessage && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '12px', 
          backgroundColor: '#FFF9E6', 
          borderLeft: '4px solid var(--secondary)', 
          borderRadius: '6px',
          fontSize: '0.85rem',
          color: '#8A621F',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <MessageSquare size={16} /> {mockMessage}
        </div>
      )}

      {error && (
        <div className="error-msg" style={{ marginBottom: '15px', padding: '10px', background: '#ffebee', borderRadius: '6px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label className="input-label">Enter One-Time Passcode</label>
          <div className="input-wrapper">
            <input
              type="text"
              maxLength={6}
              className="form-input"
              style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '1.25rem', paddingLeft: '16px' }}
              placeholder="000000"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ''));
                setError('');
              }}
              disabled={!phone}
            />
          </div>
        </div>

        <button type="submit" className="submit-btn" disabled={loading || !phone}>
          {loading ? 'Verifying...' : 'Verify & Continue'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '25px', fontSize: '0.9rem' }}>
        <button 
          onClick={handleResend} 
          disabled={cooldown > 0 || !phone}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: cooldown > 0 ? 'var(--text-muted)' : 'var(--primary)', 
            fontWeight: '600', 
            cursor: cooldown > 0 ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 
          {cooldown > 0 ? `Resend Code in ${cooldown}s` : 'Resend Code'}
        </button>
      </div>
    </div>
  );
}
