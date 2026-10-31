// The shop's numbers on the website come from the server's settings (/shop/config), never from
// the pages themselves (number changed to 73823 88565 on 23 Oct 2026).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { fakeServer } from '../../test/fetch.js';
import { whatsappText } from '../../utils/format.js';

let config;
beforeEach(async () => {
  vi.resetModules();
  config = await import('../../config/config.js');
});
const page = async (file) => {
  const Page = (await import(file)).default;
  return render(<MemoryRouter><Page /></MemoryRouter>);
};

describe('the shop numbers', () => {
  it('before the server answers: the built-in ones are the new number', async () => {
    await page('./MaintenancePage.jsx');
    expect(screen.getByRole('link', { name: '+91 73823 88565' })).toHaveAttribute('href', 'https://wa.me/917382388565');
  });

  it('every page follows the server\'s numbers', async () => {
    fakeServer().on('GET', '/shop/config', 200, { shop: { name: 'Nandam Handlooms', mobile: '9000000001', address: 'Hussain Katta, Mangalagiri, Andhra Pradesh, 522503, India' }, store: { whatsapp: '919000000002', addressLines: [], hours: '' } });
    await config.loadConfig();
    const terms = await page('./TermsPage.jsx');
    expect(terms.container.textContent).toContain('WhatsApp at +91 90000 00002.');
    terms.unmount();
    const privacy = await page('./PrivacyPage.jsx');
    expect(privacy.container.textContent).toContain('Call +91 90000 00001 or message us on WhatsApp at +91 90000 00002.');
    privacy.unmount();
    await page('./MaintenancePage.jsx');
    expect(screen.getByRole('link', { name: '+91 90000 00002' })).toHaveAttribute('href', 'https://wa.me/919000000002');
  });

  it('whatsappText writes the number as people read it', () => {
    expect(whatsappText({ store: { whatsapp: '917382388565' } })).toBe('73823 88565');
    expect(whatsappText({ store: {} })).toBe('');
  });
});
