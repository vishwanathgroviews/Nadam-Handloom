import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { StoreContactProvider, useStoreContact } from './StoreContactContext';
import { api } from '../services/api';

const wrapper = ({ children }) => <StoreContactProvider>{children}</StoreContactProvider>;

describe('StoreContactContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('provides default fallback phone numbers when API returns empty or fails', async () => {
    vi.spyOn(api, 'getStoreContact').mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useStoreContact(), { wrapper });

    expect(result.current.phone).toBe('+917382968566');
    expect(result.current.displayPhone).toBe('+91 73829 68566');
    expect(result.current.tel).toBe('+917382968566');
    expect(result.current.whatsappNumber).toBe('6301151166');
    expect(result.current.whatsappRecipient).toBe('916301151166');
  });

  it('loads and reflects dynamic store phone number from backend', async () => {
    vi.spyOn(api, 'getStoreContact').mockResolvedValueOnce({
      phone: '+919876543210',
      displayPhone: '+91 98765 43210',
      tel: '+919876543210',
      whatsappNumber: '9988776655',
    });

    const { result } = renderHook(() => useStoreContact(), { wrapper });

    await waitFor(() => {
      expect(result.current.phone).toBe('+919876543210');
      expect(result.current.displayPhone).toBe('+91 98765 43210');
      expect(result.current.tel).toBe('+919876543210');
      expect(result.current.whatsappNumber).toBe('9988776655');
      expect(result.current.whatsappRecipient).toBe('919988776655');
    });
  });
});
