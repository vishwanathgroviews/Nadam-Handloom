import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { mockDb } from '../services/mockDb';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [isValidToken, setIsValidToken] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenEmail, setTokenEmail] = useState('');
  const [tokenError, setTokenError] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const checkToken = async () => {
      if (!token) {
        setTokenError('Missing or empty password reset token.');
        setValidatingToken(false);
        return;
      }
      
      const validation = await mockDb.validateResetToken(token);
      if (validation.isValid) {
        setIsValidToken(true);
        setTokenEmail(validation.email);
      } else {
        setTokenError(validation.message || 'Invalid or expired reset token.');
      }
      setValidatingToken(false);
    };

    checkToken();
  }, [token]);

  const validate = () => {
    const newErrors = {};
    if (!password) {
      newErrors.password = 'New password is required.';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await mockDb.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setErrors({ api: err.message || 'Failed to reset password.' });
    } finally {
      setLoading(false);
    }
  };

  if (validatingToken) {
    return (
      <div style={{ textAlign: 'center', padding: '30px' }}>
        <p>Validating reset token, please wait...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="success-card">
        <div className="success-icon-container">
          <CheckCircle2 size={40} />
        </div>
        <h3 className="success-title">Password Reset</h3>
        <p className="success-desc">
          Your password has been successfully updated. You can now log in with your new password.
        </p>
        <Link to="/login" className="submit-btn" style={{ textDecoration: 'none' }}>
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="form-slide">
      <h3 className="form-title">Reset Password</h3>
      
      {!isValidToken ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ color: '#d32f2f', marginBottom: '15px' }}>
            <AlertTriangle size={48} style={{ margin: '0 auto' }} />
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>{tokenError}</p>
          <Link to="/forgot-password" className="submit-btn" style={{ textDecoration: 'none' }}>
            Request New Link
          </Link>
        </div>
      ) : (
        <>
          <p className="form-subtitle">Resetting password for: <strong>{tokenEmail}</strong></p>

          {errors.api && (
            <div className="error-msg" style={{ marginBottom: '15px', padding: '10px', background: '#ffebee', borderRadius: '6px' }}>
              {errors.api}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="input-label">New Password</label>
              <div className="input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
                  }}
                />
                <Lock size={18} className="input-icon" />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <span className="error-msg">{errors.password}</span>}
            </div>

            <div className="form-group">
              <label className="input-label">Confirm New Password</label>
              <div className="input-wrapper">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="form-input"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: '' }));
                  }}
                />
                <Lock size={18} className="input-icon" />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.confirmPassword && <span className="error-msg">{errors.confirmPassword}</span>}
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Updating Password...' : 'Reset Password'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
