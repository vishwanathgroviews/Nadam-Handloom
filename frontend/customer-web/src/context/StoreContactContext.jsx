import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';

const DEFAULT_STORE_PHONE = '+917382968566';
const DEFAULT_DISPLAY_PHONE = '+91 73829 68566';

const StoreContactContext = createContext({
  phone: DEFAULT_STORE_PHONE,
  displayPhone: DEFAULT_DISPLAY_PHONE,
  tel: DEFAULT_STORE_PHONE,
  loading: false,
});

export function StoreContactProvider({ children }) {
  const [contact, setContact] = useState({
    phone: DEFAULT_STORE_PHONE,
    displayPhone: DEFAULT_DISPLAY_PHONE,
    tel: DEFAULT_STORE_PHONE,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;
    api.getStoreContact()
      .then((data) => {
        if (!mounted || !data) return;
        setContact({
          phone: data.phone || DEFAULT_STORE_PHONE,
          displayPhone: data.displayPhone || data.phone || DEFAULT_DISPLAY_PHONE,
          tel: data.tel || data.phone || DEFAULT_STORE_PHONE,
          loading: false,
        });
      })
      .catch(() => {
        if (mounted) {
          setContact((prev) => ({ ...prev, loading: false }));
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <StoreContactContext.Provider value={contact}>
      {children}
    </StoreContactContext.Provider>
  );
}

export function useStoreContact() {
  const context = useContext(StoreContactContext);
  if (!context) {
    return {
      phone: DEFAULT_STORE_PHONE,
      displayPhone: DEFAULT_DISPLAY_PHONE,
      tel: DEFAULT_STORE_PHONE,
      loading: false,
    };
  }
  return context;
}
