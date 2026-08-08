import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, MessageSquare, CheckCircle2 } from 'lucide-react';
import { mockDb } from '../services/mockDb';

export default function ResetRequest() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mockResetLink, setMockResetLink] = useState('');

  const validate = () => {
    if (!email) {
      setError('Email address is required.');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.');
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
      const result = await mockDb.requestPasswordReset(email);
      setSuccess(true);
      setMockResetLink(result.mockResetUrl);
    } catch (err) {
      setError(err.message || 'Error requesting password reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-slide">
      {success ? (
        <div className="success-card">
          <div className="success-icon-container">
            <CheckCircle2 size={40} />
          </div>
          <h3 className="success-title">Link Generated</h3>
          <p className="success-desc">
            A password reset link has been created for **{email}**. Click below to access the reset form:
          </p>
          
          <div style={{ 
            width: '100%',
            marginBottom: '25px', 
            padding: '12px', 
            backgroundColor: '#FFF9E6', 
            borderLeft: '4px solid var(--secondary)', 
            borderRadius: '6px',
            fontSize: '0.85rem',
            textAlign: 'left',
            wordBreak: 'break-all'
          }}>
            <strong style={{ color: '#8A621F', display: 'block', marginBottom: '4px' }}>Mock Email Link:</strong>
            <Link to={`/reset-password?token=${mockResetLink.split('token=')[1]}`} style={{ color: 'var(--primary)', fontWeight: '600' }}>
              Reset My Password →
            </Link>
          </div>

          <Link to="/login" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>
            Back to Sign In
          </Link>
        </div>
      ) : (
        <>
          <h3 className="form-title">Forgot Password</h3>
          <p className="form-subtitle">Enter your email and we'll send you a link to reset your password</p>

          {error && (
            <div className="error-msg" style={{ marginBottom: '15px', padding: '10px', background: '#ffebee', borderRadius: '6px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="input-label">Email Address</label>
              <div className="input-wrapper">
                <input
                  type="email"
                  className="form-input"
                  placeholder="srinivas@nandam.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                />
                <Mail size={18} className="input-icon" />
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'} <ArrowRight size={18} />
            </button>
          </form>

          <p className="form-footer-link">
            Remember your password? <Link to="/login">Sign In</Link>
          </p>
        </>
      )}
    </div>
  );
}
