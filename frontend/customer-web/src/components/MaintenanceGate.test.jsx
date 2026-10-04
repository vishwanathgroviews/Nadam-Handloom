import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/api', () => ({ api: { getAppConfig: vi.fn() } }));

import { api } from '../services/api';
import MaintenanceGate from './MaintenanceGate';

const config = (webMaintenance) => ({ data: { webMaintenance } });
const renderGate = () =>
  render(
    <MaintenanceGate>
      <p>The shop</p>
    </MaintenanceGate>
  );

beforeEach(() => {
  api.getAppConfig.mockReset();
});

describe('MaintenanceGate', () => {
  it('shows the shop when maintenance is off', async () => {
    api.getAppConfig.mockResolvedValue(config({ enabled: false, message: '' }));
    renderGate();

    await waitFor(() => expect(api.getAppConfig).toHaveBeenCalled());
    expect(screen.getByText('The shop')).toBeTruthy();
  });

  it("replaces the shop with the owner's message when maintenance is on", async () => {
    api.getAppConfig.mockResolvedValue(config({ enabled: true, message: 'Back at 6 pm today.' }));
    renderGate();

    expect(await screen.findByText('Back at 6 pm today.')).toBeTruthy();
    expect(screen.queryByText('The shop')).toBeNull();
  });

  it('uses a standard message when the owner left it empty', async () => {
    api.getAppConfig.mockResolvedValue(config({ enabled: true, message: '  ' }));
    renderGate();

    expect(await screen.findByText(/making a few improvements/)).toBeTruthy();
  });

  it('keeps the shop open when the server cannot be reached', async () => {
    api.getAppConfig.mockRejectedValue(new Error('Network down'));
    renderGate();

    await waitFor(() => expect(api.getAppConfig).toHaveBeenCalled());
    expect(screen.getByText('The shop')).toBeTruthy();
  });

  it('brings the shop back on "Try again" once maintenance is switched off', async () => {
    api.getAppConfig.mockResolvedValueOnce(config({ enabled: true, message: 'Back soon.' }));
    renderGate();
    await screen.findByText('Back soon.');

    api.getAppConfig.mockResolvedValueOnce(config({ enabled: false, message: '' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('The shop')).toBeTruthy();
  });
});
