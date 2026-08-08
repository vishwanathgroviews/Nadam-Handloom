import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Phone, Lock, Eye, EyeOff, ArrowRight, MapPin } from 'lucide-react';
import { mockDb } from '../services/mockDb';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    state: '',
    pincode: '',
    password: '',
    confirmPassword: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    setApiError('');
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.first_name.trim()) newErrors.first_name = 'First name is required';
    if (!formData.last_name.trim()) newErrors.last_name = 'Last name is required';
    
    if (!formData.email) {
      newErrors.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.phone) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\d{10}$/.test(formData.phone.replace(/[- )(]/g, ''))) {
      newErrors.phone = 'Please enter a valid 10-digit phone number';
    }

    if (!formData.state.trim()) {
      newErrors.state = 'State is required';
    }

    if (!formData.pincode.trim()) {
      newErrors.pincode = 'Pincode is required';
    } else if (!/^\d{6}$/.test(formData.pincode.trim())) {
      newErrors.pincode = 'Please enter a valid 6-digit pincode';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      // Mock API register call
      const result = await mockDb.registerUser({
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone,
        state: formData.state,
        pincode: formData.pincode,
        password: formData.password
      });

      // Redirect to OTP verification with state context
      navigate('/otp-verify', { state: { phone: result.phone, autoCode: result.mockOtp } });
    } catch (err) {
      setApiError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-slide">
      <h3 className="form-title">Create Account</h3>
      <p className="form-subtitle">Register to begin your curated handloom journey</p>

      {apiError && (
        <div className="error-msg" style={{ marginBottom: '15px', padding: '10px', background: '#ffebee', borderRadius: '6px' }}>
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-row">
          <div className="form-group">
            <label className="input-label">
              <User size={14} /> First Name
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                name="first_name"
                className="form-input"
                placeholder="e.g. Srinivas"
                value={formData.first_name}
                onChange={handleChange}
              />
              <User size={18} className="input-icon" />
            </div>
            {errors.first_name && <span className="error-msg">{errors.first_name}</span>}
          </div>

          <div className="form-group">
            <label className="input-label">
              <User size={14} /> Last Name
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                name="last_name"
                className="form-input"
                placeholder="e.g. Nandam"
                value={formData.last_name}
                onChange={handleChange}
              />
              <User size={18} className="input-icon" />
            </div>
            {errors.last_name && <span className="error-msg">{errors.last_name}</span>}
          </div>
        </div>

        <div className="form-group">
          <label className="input-label">
            <Mail size={14} /> Email Address
          </label>
          <div className="input-wrapper">
            <input
              type="email"
              name="email"
              className="form-input"
              placeholder="srinivas@nandam.com"
              value={formData.email}
              onChange={handleChange}
            />
            <Mail size={18} className="input-icon" />
          </div>
          {errors.email && <span className="error-msg">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label className="input-label">
            <Phone size={14} /> Phone Number
          </label>
          <div className="input-wrapper">
            <input
              type="tel"
              name="phone"
              className="form-input"
              placeholder="9876543210"
              value={formData.phone}
              onChange={handleChange}
            />
            <Phone size={18} className="input-icon" />
          </div>
          {errors.phone && <span className="error-msg">{errors.phone}</span>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="input-label">
              <MapPin size={14} /> State
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                name="state"
                className="form-input"
                placeholder="e.g. Andhra Pradesh"
                value={formData.state}
                onChange={handleChange}
              />
              <MapPin size={18} className="input-icon" />
            </div>
            {errors.state && <span className="error-msg">{errors.state}</span>}
          </div>

          <div className="form-group">
            <label className="input-label">
              <MapPin size={14} /> Pincode
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                name="pincode"
                className="form-input"
                placeholder="e.g. 524001"
                value={formData.pincode}
                onChange={handleChange}
                maxLength={6}
              />
              <MapPin size={18} className="input-icon" />
            </div>
            {errors.pincode && <span className="error-msg">{errors.pincode}</span>}
          </div>
        </div>

        <div className="form-group">
          <label className="input-label">
            <Lock size={14} /> Password
          </label>
          <div className="input-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              className="form-input"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
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
          <label className="input-label">
            <Lock size={14} /> Confirm Password
          </label>
          <div className="input-wrapper">
            <input
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              className="form-input"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
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
          {loading ? 'Registering...' : 'Register Account'} <ArrowRight size={18} />
        </button>
      </form>

      <p className="form-footer-link">
        Already have an account? <Link to="/login">Sign In</Link>
      </p>
    </div>
  );
}
