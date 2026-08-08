import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Globe, LogOut, Check, Save, Image, Palette, CheckCircle, MessageSquare, MapPin } from 'lucide-react';
import { mockDb } from '../services/mockDb';

const AVATAR_OPTIONS = [
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'
];

export default function ProfileSettings() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    display_name: '',
    avatar_url: '',
    phone: '',
    state: '',
    pincode: '',
    theme: 'light',
    language: 'en'
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState('');
  const [phoneChangeOtpInfo, setPhoneChangeOtpInfo] = useState(null);

  useEffect(() => {
    const user = mockDb.getCurrentUser();
    if (!user) {
      navigate('/login');
      return;
    }
    setCurrentUser(user);
    setFormData({
      first_name: user.profile?.first_name || '',
      last_name: user.profile?.last_name || '',
      display_name: user.profile?.display_name || '',
      avatar_url: user.profile?.avatar_url || AVATAR_OPTIONS[0],
      phone: user.phone || '',
      state: user.profile?.state || '',
      pincode: user.profile?.pincode || '',
      theme: user.profile?.preferences?.theme || 'light',
      language: user.profile?.preferences?.language || 'en'
    });
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
    setSuccessMsg('');
  };

  const handleAvatarSelect = (url) => {
    setFormData(prev => ({ ...prev, avatar_url: url }));
    setSuccessMsg('');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, avatar_url: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.first_name.trim()) newErrors.first_name = 'First name is required';
    if (!formData.last_name.trim()) newErrors.last_name = 'Last name is required';
    if (!formData.display_name.trim()) newErrors.display_name = 'Display name is required';
    
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

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setSuccessMsg('');
    setPhoneChangeOtpInfo(null);
    try {
      // 1. Save general profile settings
      await mockDb.updateUserProfile(currentUser.userId, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        display_name: formData.display_name,
        avatar_url: formData.avatar_url,
        state: formData.state,
        pincode: formData.pincode,
        preferences: {
          theme: formData.theme,
          language: formData.language
        }
      });

      // 2. Check if phone number changed
      if (formData.phone !== currentUser.phone) {
        // Triggers re-verification via OTP
        const response = await mockDb.updateUserPhone(currentUser.userId, formData.phone);
        setPhoneChangeOtpInfo(response);
        
        // Wait 2 seconds so they read the OTP notification, then redirect
        setTimeout(() => {
          navigate('/otp-verify', { state: { phone: response.phone, autoCode: response.mockOtp } });
        }, 3000);
        return;
      }

      // Refresh currentUser state
      const updatedUser = mockDb.getCurrentUser();
      setCurrentUser(updatedUser);
      setSuccessMsg('Profile updated successfully.');
    } catch (err) {
      setErrors({ api: err.message || 'Error saving changes.' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    mockDb.logout();
    navigate('/login');
  };

  if (!currentUser) return null;

  return (
    <div className="form-slide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 className="form-title">Profile Settings</h3>
        <button 
          onClick={handleLogout} 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            background: 'none', 
            border: 'none', 
            color: 'var(--primary)', 
            fontWeight: '600', 
            cursor: 'pointer' 
          }}
        >
          <LogOut size={16} /> Logout
        </button>
      </div>
      <p className="form-subtitle">Customize your handloom weaver profile and preferences</p>

      {successMsg && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '12px', 
          backgroundColor: '#E8F5E9', 
          borderLeft: '4px solid #4CAF50', 
          borderRadius: '6px',
          fontSize: '0.9rem',
          color: '#2E7D32',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle size={18} /> {successMsg}
        </div>
      )}

      {phoneChangeOtpInfo && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '12px', 
          backgroundColor: '#FFF9E6', 
          borderLeft: '4px solid var(--secondary)', 
          borderRadius: '6px',
          fontSize: '0.85rem',
          color: '#8A621F'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', marginBottom: '4px' }}>
            <MessageSquare size={16} /> Phone Change OTP Triggered
          </div>
          <p>Redirecting to OTP verification. Your mock OTP is: <strong>{phoneChangeOtpInfo.mockOtp}</strong></p>
        </div>
      )}

      {errors.api && (
        <div className="error-msg" style={{ marginBottom: '15px', padding: '10px', background: '#ffebee', borderRadius: '6px' }}>
          {errors.api}
        </div>
      )}

      <form onSubmit={handleSave} className="auth-form">
        {/* Avatar Uploader Section */}
        <div className="form-group" style={{ alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
          <div style={{ position: 'relative' }}>
            <img 
              src={formData.avatar_url || 'https://via.placeholder.com/100'} 
              alt="Avatar" 
              style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--secondary)' }} 
            />
            <label 
              htmlFor="avatar-upload" 
              style={{ 
                position: 'absolute', 
                bottom: '0', 
                right: '0', 
                backgroundColor: 'var(--primary)', 
                color: '#fff', 
                borderRadius: '50%', 
                width: '28px', 
                height: '28px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
              }}
            >
              <Image size={14} />
              <input id="avatar-upload" type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>
          
          {/* Avatar presets */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {AVATAR_OPTIONS.map((url, i) => (
              <img 
                key={i} 
                src={url} 
                alt="preset" 
                onClick={() => handleAvatarSelect(url)}
                style={{ 
                  width: '36px', 
                  height: '36px', 
                  borderRadius: '50%', 
                  cursor: 'pointer', 
                  border: formData.avatar_url === url ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  opacity: formData.avatar_url === url ? 1 : 0.7,
                  transition: 'all 0.2s'
                }} 
              />
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="input-label">First Name</label>
            <div className="input-wrapper">
              <input
                type="text"
                name="first_name"
                className="form-input"
                value={formData.first_name}
                onChange={handleChange}
              />
              <User size={18} className="input-icon" />
            </div>
            {errors.first_name && <span className="error-msg">{errors.first_name}</span>}
          </div>

          <div className="form-group">
            <label className="input-label">Last Name</label>
            <div className="input-wrapper">
              <input
                type="text"
                name="last_name"
                className="form-input"
                value={formData.last_name}
                onChange={handleChange}
              />
              <User size={18} className="input-icon" />
            </div>
            {errors.last_name && <span className="error-msg">{errors.last_name}</span>}
          </div>
        </div>

        <div className="form-group">
          <label className="input-label">Display Name</label>
          <div className="input-wrapper">
            <input
              type="text"
              name="display_name"
              className="form-input"
              value={formData.display_name}
              onChange={handleChange}
            />
            <User size={18} className="input-icon" />
          </div>
          {errors.display_name && <span className="error-msg">{errors.display_name}</span>}
        </div>

        <div className="form-group">
          <label className="input-label">Phone Number (Changing triggers OTP)</label>
          <div className="input-wrapper">
            <input
              type="tel"
              name="phone"
              className="form-input"
              value={formData.phone}
              onChange={handleChange}
            />
            <Phone size={18} className="input-icon" />
          </div>
          {errors.phone && <span className="error-msg">{errors.phone}</span>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="input-label">State</label>
            <div className="input-wrapper">
              <input
                type="text"
                name="state"
                className="form-input"
                value={formData.state}
                onChange={handleChange}
              />
              <MapPin size={18} className="input-icon" />
            </div>
            {errors.state && <span className="error-msg">{errors.state}</span>}
          </div>

          <div className="form-group">
            <label className="input-label">Pincode</label>
            <div className="input-wrapper">
              <input
                type="text"
                name="pincode"
                className="form-input"
                value={formData.pincode}
                onChange={handleChange}
                maxLength={6}
              />
              <MapPin size={18} className="input-icon" />
            </div>
            {errors.pincode && <span className="error-msg">{errors.pincode}</span>}
          </div>
        </div>

        <div className="form-row">
          {/* Preferences Theme */}
          <div className="form-group">
            <label className="input-label">
              <Palette size={14} /> Theme Preference
            </label>
            <div className="input-wrapper">
              <select
                name="theme"
                className="form-input"
                style={{ paddingLeft: '42px', appearance: 'auto' }}
                value={formData.theme}
                onChange={handleChange}
              >
                <option value="light">Classic Ivory</option>
                <option value="dark">Charcoal Weave</option>
              </select>
              <Palette size={18} className="input-icon" />
            </div>
          </div>

          {/* Preferences Language */}
          <div className="form-group">
            <label className="input-label">
              <Globe size={14} /> Language
            </label>
            <div className="input-wrapper">
              <select
                name="language"
                className="form-input"
                style={{ paddingLeft: '42px', appearance: 'auto' }}
                value={formData.language}
                onChange={handleChange}
              >
                <option value="en">English</option>
                <option value="te">Telugu (తెలుగు)</option>
                <option value="ta">Tamil (தமிழ்)</option>
              </select>
              <Globe size={18} className="input-icon" />
            </div>
          </div>
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          <Save size={18} /> {loading ? 'Saving Changes...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
