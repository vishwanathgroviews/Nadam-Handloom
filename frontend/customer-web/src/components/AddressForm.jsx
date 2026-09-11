import React, { useState } from 'react';

const EMPTY = { fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };

export default function AddressForm({ onSubmit, onCancel, submitting, initialValue, submitLabel = 'Save Address' }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...initialValue }));
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const next = {};
    if (!form.fullName.trim()) next.fullName = 'Full name is required';
    if (!/^\d{10}$/.test(form.phone)) next.phone = 'Enter a valid 10-digit phone number';
    if (!form.line1.trim()) next.line1 = 'Address is required';
    if (!form.city.trim()) next.city = 'City is required';
    if (!form.state.trim()) next.state = 'State is required';
    if (!/^\d{6}$/.test(form.pincode)) next.pincode = 'Enter a valid 6-digit pincode';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit(form);
  };

  return (
    <form className="auth-form address-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-group">
          <label className="input-label">Full Name</label>
          <input className="form-input address-input" name="fullName" value={form.fullName} onChange={handleChange} />
          {errors.fullName && <span className="error-msg">{errors.fullName}</span>}
        </div>
        <div className="form-group">
          <label className="input-label">Phone Number</label>
          <input className="form-input address-input" name="phone" value={form.phone} onChange={(e) => handleChange({ target: { name: 'phone', value: e.target.value.replace(/\D/g, '') } })} maxLength={10} />
          {errors.phone && <span className="error-msg">{errors.phone}</span>}
        </div>
      </div>

      <div className="form-group">
        <label className="input-label">Address Line 1</label>
        <input className="form-input address-input" name="line1" value={form.line1} onChange={handleChange} placeholder="House no., street" />
        {errors.line1 && <span className="error-msg">{errors.line1}</span>}
      </div>

      <div className="form-group">
        <label className="input-label">Address Line 2 (optional)</label>
        <input className="form-input address-input" name="line2" value={form.line2} onChange={handleChange} placeholder="Landmark, area" />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="input-label">City</label>
          <input className="form-input address-input" name="city" value={form.city} onChange={handleChange} />
          {errors.city && <span className="error-msg">{errors.city}</span>}
        </div>
        <div className="form-group">
          <label className="input-label">State</label>
          <input className="form-input address-input" name="state" value={form.state} onChange={handleChange} />
          {errors.state && <span className="error-msg">{errors.state}</span>}
        </div>
        <div className="form-group">
          <label className="input-label">Pincode</label>
          <input className="form-input address-input" name="pincode" value={form.pincode} onChange={(e) => handleChange({ target: { name: 'pincode', value: e.target.value.replace(/\D/g, '') } })} maxLength={6} />
          {errors.pincode && <span className="error-msg">{errors.pincode}</span>}
        </div>
      </div>

      <div className="address-form-actions">
        {onCancel && <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
