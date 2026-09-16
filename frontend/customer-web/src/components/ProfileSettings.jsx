import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User, Phone, LogOut, Package, Save, CheckCircle, MapPin, AlertCircle,
  ShieldCheck, KeyRound, Plus, Pencil, Trash2, Star, BadgeCheck,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AddressForm from './AddressForm';
import './ProfileSettings.css';

const maskPhone = (phone) => (phone && phone.length >= 4 ? `${phone.slice(0, 2)}${'*'.repeat(phone.length - 4)}${phone.slice(-2)}` : phone || '');

const MEMBER_SINCE_FORMAT = { month: 'short', year: 'numeric' };

export default function ProfileSettings() {
  const navigate = useNavigate();
  const { status, isAuthenticated, user: currentUser, logout, refreshUser } = useAuth();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    display_name: '',
    phone: '',
    state: '',
    pincode: ''
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState('');

  const [addresses, setAddresses] = useState([]);
  const [addressFormMode, setAddressFormMode] = useState(null); // null | 'add' | address id being edited
  const [addressBusyId, setAddressBusyId] = useState(null);
  const [addressError, setAddressError] = useState('');

  // Auth state (including session-restore-on-reload) lives entirely in
  // AuthContext — this page just reacts to it rather than re-fetching
  // independently, which used to race the context's own bootstrap on a
  // fresh page load.
  useEffect(() => {
    if (status === 'loading') return;
    if (!isAuthenticated || !currentUser) {
      navigate('/login');
      return;
    }
    setFormData({
      first_name: currentUser.userProfile?.firstName || '',
      last_name: currentUser.userProfile?.lastName || '',
      display_name: currentUser.userProfile?.displayName || '',
      phone: currentUser.phone || '',
      state: currentUser.userProfile?.preferences?.state || '',
      pincode: currentUser.userProfile?.preferences?.pincode || ''
    });
  }, [status, isAuthenticated, currentUser, navigate]);

  const loadAddresses = useCallback(() => {
    if (!isAuthenticated) return;
    api.getAddresses().then(setAddresses).catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
    setSuccessMsg('');
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.first_name.trim()) newErrors.first_name = 'First name is required';
    if (!formData.last_name.trim()) newErrors.last_name = 'Last name is required';
    if (!formData.display_name.trim()) newErrors.display_name = 'Display name is required';

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
    try {
      await api.updateUserProfile(currentUser.id, {
        firstName: formData.first_name,
        lastName: formData.last_name,
        displayName: formData.display_name,
        // Theme/language are no longer offered, so they are no longer sent.
        // Anything already stored for them is left untouched on the server.
        preferences: {
          state: formData.state,
          pincode: formData.pincode
        }
      });

      await refreshUser();
      setSuccessMsg('Profile updated successfully.');
    } catch (err) {
      setErrors({ api: err.message || 'Error saving changes.' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleChangeMpin = () => {
    navigate('/forgot-password', { state: { phone: formData.phone } });
  };

  const handleSaveAddress = async (payload) => {
    setAddressBusyId('form');
    setAddressError('');
    try {
      if (typeof addressFormMode === 'string' && addressFormMode !== 'add') {
        await api.updateAddress(addressFormMode, payload);
      } else {
        await api.createAddress(payload);
      }
      setAddressFormMode(null);
      loadAddresses();
    } catch (err) {
      setAddressError(err.message || 'Could not save this address.');
    } finally {
      setAddressBusyId(null);
    }
  };

  const handleMakeDefault = async (address) => {
    setAddressBusyId(address.id);
    setAddressError('');
    try {
      await api.updateAddress(address.id, { isDefault: true });
      loadAddresses();
    } catch (err) {
      setAddressError(err.message || 'Could not update this address.');
    } finally {
      setAddressBusyId(null);
    }
  };

  const handleDeleteAddress = async (address) => {
    setAddressBusyId(address.id);
    setAddressError('');
    try {
      await api.deleteAddress(address.id);
      loadAddresses();
    } catch (err) {
      setAddressError(err.message || 'Could not delete this address.');
    } finally {
      setAddressBusyId(null);
    }
  };

  if (status === 'loading' || !currentUser) return null;

  const initial = (formData.display_name || formData.first_name || 'U').trim().charAt(0).toUpperCase();
  const memberSince = currentUser.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString('en-IN', MEMBER_SINCE_FORMAT)
    : null;
  const editingAddress = typeof addressFormMode === 'string' && addressFormMode !== 'add'
    ? addresses.find((a) => a.id === addressFormMode)
    : null;

  return (
    <div className="profile-page">
      <div className="profile-shell">
        <aside className="profile-sidebar">
          <div className="profile-sidebar-identity">
            <div className="profile-avatar" aria-hidden="true">{initial}</div>
            <div>
              <p className="profile-sidebar-name">{formData.display_name || formData.first_name || 'My Account'}</p>
              <p className="profile-sidebar-phone">{formData.phone}</p>
              {memberSince && <p className="profile-sidebar-since">Member since {memberSince}</p>}
            </div>
          </div>
          <nav className="profile-nav">
            <span className="profile-nav-item active">
              <User size={16} /> <span>My Profile</span>
            </span>
            <Link to="/account/orders" className="profile-nav-item">
              <Package size={16} /> <span>My Orders</span>
            </Link>
            <button type="button" onClick={handleLogout} className="profile-nav-item danger">
              <LogOut size={16} /> <span>Logout</span>
            </button>
          </nav>
        </aside>

        <div className="profile-main">
          <div className="profile-main-header">
            <h1 className="profile-main-title">My Profile</h1>
            <p className="profile-main-subtitle">Manage your personal details, addresses, and account security</p>
          </div>

          {successMsg && (
            <div className="alert alert-success profile-alert">
              <CheckCircle size={18} /> {successMsg}
            </div>
          )}

          {errors.api && (
            <div className="alert alert-error profile-alert">
              <AlertCircle size={18} /> {errors.api}
            </div>
          )}

          <form onSubmit={handleSave} className="profile-form">
            <section className="profile-card">
              <h2 className="profile-card-title"><User size={16} /> Personal Info</h2>
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
            </section>

            <section className="profile-card">
              <h2 className="profile-card-title"><MapPin size={16} /> Contact &amp; Location</h2>
              <div className="form-group">
                <label className="input-label">Phone Number</label>
                <div className="input-wrapper">
                  <input type="tel" className="form-input" value={formData.phone} readOnly disabled />
                  <Phone size={18} className="input-icon" />
                  <BadgeCheck size={16} className="profile-verified-icon" title="Verified" />
                </div>
                <span className="input-helper">Contact support to change your registered mobile number.</span>
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
            </section>

            <div className="profile-submit-row">
              <button type="submit" className="submit-btn" disabled={loading}>
                <Save size={18} /> {loading ? 'Saving Changes...' : 'Save Settings'}
              </button>
            </div>
          </form>

          <section className="profile-card">
            <div className="profile-card-title-row">
              <h2 className="profile-card-title"><MapPin size={16} /> Addresses</h2>
              {addressFormMode === null && (
                <button type="button" className="section-link" onClick={() => setAddressFormMode('add')}>
                  <Plus size={14} /> Add address
                </button>
              )}
            </div>

            {addressError && (
              <div className="alert alert-error profile-alert">
                <AlertCircle size={18} /> {addressError}
              </div>
            )}

            {addresses.length === 0 && addressFormMode === null && (
              <p className="profile-empty-hint">No saved addresses yet — add one to speed up checkout.</p>
            )}

            {addresses.length > 0 && addressFormMode === null && (
              <div className="profile-address-list">
                {addresses.map((addr) => (
                  <div key={addr.id} className={`profile-address-card ${addr.isDefault ? 'is-default' : ''}`}>
                    <div>
                      <strong>{addr.fullName}</strong> · {addr.phone}
                      {addr.isDefault && <span className="profile-default-badge"><Star size={11} /> Default</span>}
                      <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state} - {addr.pincode}</p>
                    </div>
                    <div className="profile-address-actions">
                      {!addr.isDefault && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleMakeDefault(addr)}
                          disabled={addressBusyId === addr.id}
                        >
                          Make default
                        </button>
                      )}
                      <button
                        type="button"
                        className="profile-icon-btn"
                        onClick={() => setAddressFormMode(addr.id)}
                        aria-label="Edit address"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="profile-icon-btn danger"
                        onClick={() => handleDeleteAddress(addr)}
                        disabled={addressBusyId === addr.id}
                        aria-label="Delete address"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {addressFormMode !== null && (
              <AddressForm
                key={addressFormMode}
                initialValue={editingAddress || undefined}
                submitLabel={editingAddress ? 'Update Address' : 'Save Address'}
                onSubmit={handleSaveAddress}
                onCancel={() => setAddressFormMode(null)}
                submitting={addressBusyId === 'form'}
              />
            )}
          </section>

          <section className="profile-card">
            <h2 className="profile-card-title"><ShieldCheck size={16} /> Security</h2>
            <div className="profile-security-row">
              <div>
                <p className="profile-security-label">MPIN</p>
                <p className="profile-security-value">Used to sign in with {maskPhone(formData.phone)}</p>
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={handleChangeMpin}>
                <KeyRound size={14} /> Change MPIN
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
