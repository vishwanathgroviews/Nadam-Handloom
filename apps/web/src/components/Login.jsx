import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { mockDb } from '../services/mockDb';

export default function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const validate = () => {
    const newErrors = {};
    if (!identifier.trim()) {
      newErrors.identifier = 'Email address or Phone number is required';
    }
    if (!password) {
      newErrors.password = 'Password is required';
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
      const response = await mockDb.loginUser(identifier, password);
      
      if (response.requiresVerification) {
        // Requires OTP verification
        navigate('/otp-verify', { state: { phone: response.phone, autoCode: response.mockOtp } });
      } else {
        // Logged in successfully
        navigate('/profile');
      }
    } catch (err) {
      setApiError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-slide">
      <h3 className="form-title">Welcome Back</h3>
      <p className="form-subtitle">Enter your credentials to access your profile</p>

      {apiError && (
        <div className="error-msg" style={{ marginBottom: '15px', padding: '10px', background: '#ffebee', borderRadius: '6px' }}>
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label className="input-label">Email or Phone Number</label>
          <div className="input-wrapper">
            <input
              type="text"
              className="form-input"
              placeholder="srinivas@nandam.com or 9876543210"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (errors.identifier) setErrors(prev => ({ ...prev, identifier: '' }));
                setApiError('');
              }}
            />
            <Mail size={18} className="input-icon" />
          </div>
          {errors.identifier && <span className="error-msg">{errors.identifier}</span>}
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="input-label">Password</label>
            <Link 
              to="/forgot-password" 
              style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: '600' }}
            >
              Forgot password?
            </Link>
          </div>
          <div className="input-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
                setApiError('');
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

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Signing In...' : 'Sign In'} <ArrowRight size={18} />
        </button>
      </form>

      <p className="form-footer-link">
        Don't have an account? <Link to="/register">Create Account</Link>
      </p>
    </div>
  );
}
