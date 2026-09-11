import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { User, Phone, ArrowRight, MapPin } from 'lucide-react';
import { api } from '../services/api';

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '';
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    state: '',
    pincode: '',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    setApiError('');
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.first_name.trim()) newErrors.first_name = 'First name is required';
    if (!formData.last_name.trim()) newErrors.last_name = 'Last name is required';

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setApiError('');
    try {
      const result = await api.registerUser(formData);
      navigate('/otp-verify', { state: { phone: result.phone, redirect: redirectTo } });
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

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Sending code…' : 'Continue'} <ArrowRight size={18} />
        </button>
      </form>

      <p className="form-footer-link">
        Already have an account? <Link to={`/login${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}>Sign In</Link>
      </p>
    </div>
  );
}
