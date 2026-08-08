import React, { useState } from 'react';
import { Mail, Lock, User, Phone, Eye, EyeOff, Sparkles, CheckCircle2, ArrowRight, MapPin, Map } from 'lucide-react';
import './LoginSignup.css';
import bannerImg from '../assets/handloom_banner.png';

export default function LoginSignup() {
  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'signup'
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form States
  const [loginData, setLoginData] = useState({ email: '', password: '', rememberMe: false });
  const [signupData, setSignupData] = useState({ fullName: '', email: '', phone: '', pincode: '', state: '', password: '', confirmPassword: '', agreeTerms: false });

  // Errors State
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitType, setSubmitType] = useState(''); // 'login' or 'signup'

  // Input Handlers
  const handleLoginChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLoginData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSignupChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSignupData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Validation
  const validateLogin = () => {
    const newErrors = {};
    if (!loginData.email) {
      newErrors.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(loginData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!loginData.password) {
      newErrors.password = 'Password is required';
    } else if (loginData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSignup = () => {
    const newErrors = {};
    if (!signupData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }
    if (!signupData.email) {
      newErrors.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(signupData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!signupData.phone) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\d{10}$/.test(signupData.phone.replace(/[- )(]/g, ''))) {
      newErrors.phone = 'Please enter a valid 10-digit phone number';
    }
    if (!signupData.pincode) {
      newErrors.pincode = 'Pin code is required';
    } else if (!/^\d{6}$/.test(signupData.pincode)) {
      newErrors.pincode = 'Please enter a valid 6-digit pin code';
    }
    if (!signupData.state.trim()) {
      newErrors.state = 'State is required';
    }
    if (!signupData.password) {
      newErrors.password = 'Password is required';
    } else if (signupData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (signupData.password !== signupData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (!signupData.agreeTerms) {
      newErrors.agreeTerms = 'You must agree to the terms and conditions';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Form Submit
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (validateLogin()) {
      setSubmitType('login');
      setIsSubmitted(true);
    }
  };

  const handleSignupSubmit = (e) => {
    e.preventDefault();
    if (validateSignup()) {
      setSubmitType('signup');
      setIsSubmitted(true);
    }
  };

  const resetForm = () => {
    setIsSubmitted(false);
    setSubmitType('');
    setLoginData({ email: '', password: '', rememberMe: false });
    setSignupData({ fullName: '', email: '', phone: '', pincode: '', state: '', password: '', confirmPassword: '', agreeTerms: false });
    setErrors({});
  };

  return (
    <div className="auth-container">
      <div className="auth-wrapper">
        
        {/* Left Side: Brand Story Banner */}
        <div className="auth-banner">
          <img src={bannerImg} alt="Indian Handloom Silk Threads" className="banner-bg-img" />
          <div className="banner-content">
            <div className="banner-header">
              <div className="brand-logo-container">
                <Sparkles size={28} className="brand-icon" />
                <h1 className="brand-name">Nandam</h1>
              </div>
              <span className="brand-tagline">Handloom Weavers</span>
            </div>
            
            <div className="banner-middle">
              <h2 className="banner-headline">
                Crafting Heritage, <span>One Thread</span> at a Time.
              </h2>
              <p className="banner-desc">
                Experience the luxury of handwoven sarees, pure silk, and traditional craftsmanship curated directly from certified master artisans of India.
              </p>
            </div>

            <div className="banner-footer">
              <p>© {new Date().getFullYear()} Nandam Handlooms. Authenticity Guaranteed.</p>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form Panel */}
        <div className="auth-form-container">
          {isSubmitted ? (
            <div className="success-card">
              <div className="success-icon-container">
                <CheckCircle2 size={48} />
              </div>
              <h3 className="success-title">
                {submitType === 'login' ? 'Welcome Back!' : 'Registration Successful!'}
              </h3>
              <p className="success-desc">
                {submitType === 'login' 
                  ? `Successfully authenticated as ${loginData.email}. Redirecting you to the storefront...`
                  : `Thank you for signing up, ${signupData.fullName}! Your account has been created.`}
              </p>
              <button className="success-btn" onClick={resetForm}>
                Continue Shopping
              </button>
            </div>
          ) : (
            <>
              {/* Tab Toggles */}
              <div className="auth-tabs">
                <button 
                  className={`tab-btn ${activeTab === 'login' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('login'); setErrors({}); }}
                >
                  Sign In
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'signup' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('signup'); setErrors({}); }}
                >
                  Create Account
                </button>
              </div>

              {activeTab === 'login' ? (
                /* LOGIN FORM */
                <div className="form-slide">
                  <h3 className="form-title">Welcome back</h3>
                  <p className="form-subtitle">Enter your credentials to access your weaver profile</p>
                  
                  <form onSubmit={handleLoginSubmit} className="auth-form">
                    <div className="form-group">
                      <label className="input-label">Email Address</label>
                      <div className="input-wrapper">
                        <input 
                          type="email" 
                          name="email"
                          className="form-input" 
                          placeholder="name@domain.com"
                          value={loginData.email}
                          onChange={handleLoginChange}
                        />
                        <Mail size={18} className="input-icon" />
                      </div>
                      {errors.email && <span className="error-msg">{errors.email}</span>}
                    </div>

                    <div className="form-group">
                      <label className="input-label">Password</label>
                      <div className="input-wrapper">
                        <input 
                          type={showPassword ? "text" : "password"} 
                          name="password"
                          className="form-input" 
                          placeholder="••••••••"
                          value={loginData.password}
                          onChange={handleLoginChange}
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

                    <div className="form-actions">
                      <label className="remember-me">
                        <input 
                          type="checkbox" 
                          name="rememberMe"
                          checked={loginData.rememberMe}
                          onChange={handleLoginChange}
                        />
                        Remember me
                      </label>
                      <a href="#forgot" className="forgot-password-link">Forgot password?</a>
                    </div>

                    <button type="submit" className="submit-btn">
                      Sign In <ArrowRight size={18} />
                    </button>
                  </form>
                </div>
              ) : (
                /* SIGN UP FORM */
                <div className="form-slide">
                  <h3 className="form-title">Join our heritage</h3>
                  <p className="form-subtitle">Create an account to support local artisans and grab exclusive offers</p>
                  
                  <form onSubmit={handleSignupSubmit} className="auth-form">
                    <div className="form-group">
                      <label className="input-label">Full Name</label>
                      <div className="input-wrapper">
                        <input 
                          type="text" 
                          name="fullName"
                          className="form-input" 
                          placeholder="Weaver name"
                          value={signupData.fullName}
                          onChange={handleSignupChange}
                        />
                        <User size={18} className="input-icon" />
                      </div>
                      {errors.fullName && <span className="error-msg">{errors.fullName}</span>}
                    </div>

                    <div className="form-group">
                      <label className="input-label">Email Address</label>
                      <div className="input-wrapper">
                        <input 
                          type="email" 
                          name="email"
                          className="form-input" 
                          placeholder="weaver@nandam.com"
                          value={signupData.email}
                          onChange={handleSignupChange}
                        />
                        <Mail size={18} className="input-icon" />
                      </div>
                      {errors.email && <span className="error-msg">{errors.email}</span>}
                    </div>

                    <div className="form-group">
                      <label className="input-label">Phone Number</label>
                      <div className="input-wrapper">
                        <input 
                          type="tel" 
                          name="phone"
                          className="form-input" 
                          placeholder="10-digit number"
                          value={signupData.phone}
                          onChange={handleSignupChange}
                        />
                        <Phone size={18} className="input-icon" />
                      </div>
                      {errors.phone && <span className="error-msg">{errors.phone}</span>}
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="input-label">Pin Code</label>
                        <div className="input-wrapper">
                          <input 
                            type="text" 
                            name="pincode"
                            className="form-input" 
                            placeholder="6-digit pin"
                            value={signupData.pincode}
                            onChange={handleSignupChange}
                            maxLength={6}
                          />
                          <MapPin size={18} className="input-icon" />
                        </div>
                        {errors.pincode && <span className="error-msg">{errors.pincode}</span>}
                      </div>

                      <div className="form-group">
                        <label className="input-label">State</label>
                        <div className="input-wrapper">
                          <input 
                            type="text" 
                            name="state"
                            className="form-input" 
                            placeholder="e.g. Andhra Pradesh"
                            value={signupData.state}
                            onChange={handleSignupChange}
                          />
                          <Map size={18} className="input-icon" />
                        </div>
                        {errors.state && <span className="error-msg">{errors.state}</span>}
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="input-label">Password</label>
                      <div className="input-wrapper">
                        <input 
                          type={showPassword ? "text" : "password"} 
                          name="password"
                          className="form-input" 
                          placeholder="••••••••"
                          value={signupData.password}
                          onChange={handleSignupChange}
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
                      <label className="input-label">Confirm Password</label>
                      <div className="input-wrapper">
                        <input 
                          type={showConfirmPassword ? "text" : "password"} 
                          name="confirmPassword"
                          className="form-input" 
                          placeholder="••••••••"
                          value={signupData.confirmPassword}
                          onChange={handleSignupChange}
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

                    <label className="agreement-checkbox">
                      <input 
                        type="checkbox" 
                        name="agreeTerms"
                        checked={signupData.agreeTerms}
                        onChange={handleSignupChange}
                      />
                      <span>
                        I agree to the <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a>
                      </span>
                    </label>
                    {errors.agreeTerms && <span className="error-msg">{errors.agreeTerms}</span>}

                    <button type="submit" className="submit-btn">
                      Register Account <ArrowRight size={18} />
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
