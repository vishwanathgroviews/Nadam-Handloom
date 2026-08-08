// Mock Database Service simulating customer accounts, profiles, and OTP flows.
// Persisted in localStorage for persistent demo testing.

// Simple hashing utility (simulating backend password hashing)
function mockHash(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `nandam_hash_${Math.abs(hash).toString(16)}`;
}

// Simulated network delay
const delay = (ms = 800) => new Promise(resolve => setTimeout(resolve, ms));

const DB_KEYS = {
  ACCOUNTS: 'NANDAM_AUTH_ACCOUNTS',
  PROFILES: 'NANDAM_USER_PROFILES',
  OTP: 'NANDAM_OTP_CODES',
  SESSION: 'NANDAM_CURRENT_SESSION',
  RESET_TOKENS: 'NANDAM_RESET_TOKENS'
};

// Initialize DB structure if not present
const getFromStorage = (key, defaultVal = []) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultVal;
};

const saveToStorage = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const mockDb = {
  // 1. REGISTER
  registerUser: async (userData) => {
    await delay(1000);
    const accounts = getFromStorage(DB_KEYS.ACCOUNTS);
    const profiles = getFromStorage(DB_KEYS.PROFILES);

    // Check unique email and phone
    const emailExists = accounts.some(acc => acc.email.toLowerCase() === userData.email.toLowerCase());
    const phoneExists = accounts.some(acc => acc.phone === userData.phone);

    if (emailExists) throw new Error('An account with this email address already exists.');
    if (phoneExists) throw new Error('An account with this phone number already exists.');

    const userId = 'usr_' + Math.random().toString(36).substr(2, 9);
    
    // AUTH_ACCOUNTS.password_hash (hash before storing, never store plaintext)
    const newAccount = {
      id: userId,
      email: userData.email,
      phone: userData.phone,
      password_hash: mockHash(userData.password),
      isVerified: false
    };

    const newProfile = {
      userId: userId,
      first_name: userData.first_name,
      last_name: userData.last_name,
      display_name: `${userData.first_name} ${userData.last_name}`,
      avatar_url: '',
      state: userData.state || '',
      pincode: userData.pincode || '',
      preferences: { theme: 'light', language: 'en' }
    };

    accounts.push(newAccount);
    profiles.push(newProfile);

    saveToStorage(DB_KEYS.ACCOUNTS, accounts);
    saveToStorage(DB_KEYS.PROFILES, profiles);

    // Auto generate OTP for phone verification
    const otp = await mockDb.generateOtp(userData.phone);
    console.log(`[Mock SMS Backend] OTP for ${userData.phone} is: ${otp}`);

    return { userId, phone: userData.phone, mockOtp: otp };
  },

  // 2. LOGIN
  loginUser: async (identifier, password) => {
    await delay(1000);
    const accounts = getFromStorage(DB_KEYS.ACCOUNTS);
    const profiles = getFromStorage(DB_KEYS.PROFILES);

    // Detect if identifier is email or phone
    const isEmail = identifier.includes('@');
    const account = accounts.find(acc => 
      isEmail 
        ? acc.email.toLowerCase() === identifier.toLowerCase()
        : acc.phone.replace(/[- )(]/g, '') === identifier.replace(/[- )(]/g, '')
    );

    if (!account) {
      throw new Error('No account found with this email/phone.');
    }

    if (account.password_hash !== mockHash(password)) {
      throw new Error('Incorrect password. Please try again.');
    }

    // Check if phone verification is completed
    if (!account.isVerified) {
      const otp = await mockDb.generateOtp(account.phone);
      console.log(`[Mock SMS Backend] OTP for ${account.phone} is: ${otp}`);
      return { requiresVerification: true, phone: account.phone, mockOtp: otp };
    }

    const profile = profiles.find(p => p.userId === account.id);
    const session = { userId: account.id, email: account.email, phone: account.phone };
    saveToStorage(DB_KEYS.SESSION, session);

    return { requiresVerification: false, user: { ...session, profile } };
  },

  // 3. OTP VERIFICATION
  generateOtp: async (phone) => {
    const otps = getFromStorage(DB_KEYS.OTP);
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit code
    
    // Store hashed OTP
    const expiry = Date.now() + 5 * 60 * 1000; // 5 min expiry
    const newOtp = {
      phone: phone,
      code_hash: mockHash(code),
      expiry: expiry
    };

    // Remove old OTPs for this phone
    const filteredOtps = otps.filter(o => o.phone !== phone);
    filteredOtps.push(newOtp);
    saveToStorage(DB_KEYS.OTP, filteredOtps);

    return code; // Return plain code to show in console/dev tool for simulation
  },

  verifyOtp: async (phone, enteredCode) => {
    await delay(800);
    const otps = getFromStorage(DB_KEYS.OTP);
    const accounts = getFromStorage(DB_KEYS.ACCOUNTS);
    const profiles = getFromStorage(DB_KEYS.PROFILES);

    const otpRecord = otps.find(o => o.phone === phone);
    if (!otpRecord) throw new Error('No OTP requested for this phone number.');

    if (Date.now() > otpRecord.expiry) {
      throw new Error('OTP has expired. Please request a new code.');
    }

    if (otpRecord.code_hash !== mockHash(enteredCode)) {
      throw new Error('Invalid verification code. Please try again.');
    }

    // Verification successful, update account status
    const accountIndex = accounts.findIndex(acc => acc.phone === phone);
    if (accountIndex !== -1) {
      accounts[accountIndex].isVerified = true;
      saveToStorage(DB_KEYS.ACCOUNTS, accounts);

      // Create session
      const account = accounts[accountIndex];
      const profile = profiles.find(p => p.userId === account.id);
      const session = { userId: account.id, email: account.email, phone: account.phone };
      saveToStorage(DB_KEYS.SESSION, session);

      // Clean up OTP
      saveToStorage(DB_KEYS.OTP, otps.filter(o => o.phone !== phone));

      return { user: { ...session, profile } };
    }

    throw new Error('Account associated with this phone number not found.');
  },

  // 4. PASSWORD RESET
  requestPasswordReset: async (email) => {
    await delay(1000);
    const accounts = getFromStorage(DB_KEYS.ACCOUNTS);
    const account = accounts.find(acc => acc.email.toLowerCase() === email.toLowerCase());

    if (!account) {
      throw new Error('No account found with this email address.');
    }

    // Generate simulated URL-token
    const tokens = getFromStorage(DB_KEYS.RESET_TOKENS);
    const token = 'tok_' + Math.random().toString(36).substr(2, 9);
    const expiry = Date.now() + 15 * 60 * 1000; // 15 mins expiry

    const newToken = { email: email.toLowerCase(), token, expiry };
    const filteredTokens = tokens.filter(t => t.email !== email.toLowerCase());
    filteredTokens.push(newToken);
    saveToStorage(DB_KEYS.RESET_TOKENS, filteredTokens);

    const mockResetUrl = `${window.location.origin}/reset-password?token=${token}`;
    console.log(`[Mock Email Backend] Password Reset Link: ${mockResetUrl}`);

    return { token, mockResetUrl };
  },

  validateResetToken: async (token) => {
    const tokens = getFromStorage(DB_KEYS.RESET_TOKENS);
    const record = tokens.find(t => t.token === token);
    
    if (!record) return { isValid: false, message: 'Invalid or missing reset token.' };
    if (Date.now() > record.expiry) return { isValid: false, message: 'Reset token has expired.' };
    
    return { isValid: true, email: record.email };
  },

  resetPassword: async (token, newPassword) => {
    await delay(1000);
    const tokens = getFromStorage(DB_KEYS.RESET_TOKENS);
    const accounts = getFromStorage(DB_KEYS.ACCOUNTS);

    const tokenRecord = tokens.find(t => t.token === token);
    if (!tokenRecord || Date.now() > tokenRecord.expiry) {
      throw new Error('Invalid or expired reset token.');
    }

    const accIndex = accounts.findIndex(acc => acc.email.toLowerCase() === tokenRecord.email.toLowerCase());
    if (accIndex === -1) throw new Error('Account associated with token not found.');

    // Update password_hash
    accounts[accIndex].password_hash = mockHash(newPassword);
    saveToStorage(DB_KEYS.ACCOUNTS, accounts);

    // Clean up used token
    saveToStorage(DB_KEYS.RESET_TOKENS, tokens.filter(t => t.token !== token));

    return true;
  },

  // 5. SESSION & PROFILE MANAGEMENT
  getCurrentUser: () => {
    const session = getFromStorage(DB_KEYS.SESSION, null);
    if (!session) return null;

    const profiles = getFromStorage(DB_KEYS.PROFILES);
    const profile = profiles.find(p => p.userId === session.userId);

    return { ...session, profile };
  },

  updateUserProfile: async (userId, profileData) => {
    await delay(1000);
    const profiles = getFromStorage(DB_KEYS.PROFILES);
    const index = profiles.findIndex(p => p.userId === userId);

    if (index === -1) throw new Error('User profile not found.');

    profiles[index] = {
      ...profiles[index],
      first_name: profileData.first_name,
      last_name: profileData.last_name,
      display_name: profileData.display_name,
      avatar_url: profileData.avatar_url,
      state: profileData.state,
      pincode: profileData.pincode,
      preferences: profileData.preferences
    };

    saveToStorage(DB_KEYS.PROFILES, profiles);
    return profiles[index];
  },

  updateUserPhone: async (userId, newPhone) => {
    await delay(800);
    const accounts = getFromStorage(DB_KEYS.ACCOUNTS);
    const accIndex = accounts.findIndex(acc => acc.id === userId);

    if (accIndex === -1) throw new Error('Account not found.');

    // Update phone & set isVerified to false
    accounts[accIndex].phone = newPhone;
    accounts[accIndex].isVerified = false;
    saveToStorage(DB_KEYS.ACCOUNTS, accounts);

    // Update session info
    const session = getFromStorage(DB_KEYS.SESSION);
    if (session && session.userId === userId) {
      session.phone = newPhone;
      saveToStorage(DB_KEYS.SESSION, session);
    }

    // Generate new OTP for verify flow
    const otp = await mockDb.generateOtp(newPhone);
    console.log(`[Mock SMS Backend] Updated phone OTP for ${newPhone} is: ${otp}`);

    return { phone: newPhone, mockOtp: otp };
  },

  logout: () => {
    localStorage.removeItem(DB_KEYS.SESSION);
  }
};
