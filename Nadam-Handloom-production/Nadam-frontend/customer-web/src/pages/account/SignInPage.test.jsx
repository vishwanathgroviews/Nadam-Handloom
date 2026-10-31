import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fakeServer, signedInReply } from '../../test/fetch.js';

// Fresh modules for every test: the sign-in state lives in a module.
let SignInPage;
let ToastProvider;
beforeEach(async () => {
  vi.resetModules();
  SignInPage = (await import('./SignInPage.jsx')).default;
  ({ ToastProvider } = await import('../../components/Toasts.jsx'));
});

function renderAt(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <Routes>
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/account/addresses" element={<p>ADDRESSES PAGE</p>} />
          <Route path="/account" element={<p>ACCOUNT PAGE</p>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

describe('sign in or create an account', () => {
  it('new customer: mobile → wrong code → right code → profile → back to the page they wanted', async () => {
    const s = fakeServer()
      .on('POST', '/auth/code', 202, { resendInSeconds: 60, expiresInSeconds: 600, codeLength: 6 })
      .error('POST', '/auth/verify', 400, 'WRONG_CODE', 'That code isn\'t right. 2 tries left.', { triesLeft: 2 })
      .on('POST', '/auth/verify', 200, { status: 'needs_profile', stepToken: 'step-123456789012345678901234', stepExpiresInSeconds: 900, mobileMasked: '+91 98765 •••10', prefill: { fullName: '', email: '', pincode: '', city: '', state: '', marketingOptIn: false } })
      .on('GET', '/pincodes/522503', 200, { pincode: '522503', area: 'Mangalagiri', city: 'Guntur', state: 'Andhra Pradesh' })
      .on('POST', '/auth/complete', 200, signedInReply());
    const user = userEvent.setup();
    renderAt('/sign-in?next=%2Faccount%2Faddresses');

    await user.type(screen.getByLabelText('Mobile number'), '12345');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(screen.getByText('Enter a 10-digit mobile number starting with 6, 7, 8 or 9.')).toBeInTheDocument();
    expect(s.calls).toHaveLength(0);

    await user.clear(screen.getByLabelText('Mobile number'));
    await user.type(screen.getByLabelText('Mobile number'), '98765 43210');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByRole('heading', { name: 'Enter the code' });
    expect(s.calls[0].body).toEqual({ mobile: '9876543210' });

    await user.keyboard('000000');
    expect(await screen.findByText('That code isn\'t right. 2 tries left.')).toBeInTheDocument();
    await user.keyboard('123456');
    await screen.findByRole('heading', { name: 'Complete your profile' });

    await user.type(screen.getByLabelText('Full name'), 'Priya Sharma');
    await user.type(screen.getByLabelText('Email'), 'priya@example.com');
    await user.type(screen.getByLabelText('Pincode'), '522503');
    await waitFor(() => expect(screen.getByLabelText('City')).toHaveValue('Guntur'));
    expect(screen.getByLabelText('State')).toHaveValue('Andhra Pradesh');
    await user.click(screen.getByRole('button', { name: 'Create my account' }));
    await screen.findByText('ADDRESSES PAGE');
    const complete = s.calls.find((c) => c.path.endsWith('/auth/complete')).body;
    expect(complete).toMatchObject({ stepToken: 'step-123456789012345678901234', fullName: 'Priya Sharma', email: 'priya@example.com', pincode: '522503', city: 'Guntur', state: 'Andhra Pradesh', marketingOptIn: false });
    expect(localStorage.getItem('nh-shop-signed-in')).toBe('1');
  });

  it('too many codes: says how long to wait', async () => {
    fakeServer().error('POST', '/auth/code', 429, 'CODE_TOO_MANY', 'Too many codes for this number. Try again in 42 minutes.', { retryAfterSeconds: 2520 });
    const user = userEvent.setup();
    renderAt('/sign-in');
    await user.type(screen.getByLabelText('Mobile number'), '9876543210');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText('Too many codes for now')).toBeInTheDocument();
    expect(screen.getByText(/Try again in 42 minutes/)).toBeInTheDocument();
  });

  it('a code was sent a moment ago: goes to the code step with the timer', async () => {
    fakeServer().error('POST', '/auth/code', 429, 'CODE_RESEND_WAIT', 'A code was sent a moment ago.', { retryAfterSeconds: 40 });
    const user = userEvent.setup();
    renderAt('/sign-in');
    await user.type(screen.getByLabelText('Mobile number'), '9876543210');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByRole('heading', { name: 'Enter the code' });
    expect(screen.getByText('A code was sent a moment ago')).toBeInTheDocument();
  });

  it('known customer: signed in straight from the code; an account being deleted opens My account', async () => {
    fakeServer()
      .on('POST', '/auth/code', 202, { resendInSeconds: 60, expiresInSeconds: 600, codeLength: 6 })
      .on('POST', '/auth/verify', 200, signedInReply({ customer: { ...signedInReply().customer, deletion: { requestedAt: '2026-10-15T00:00:00Z', deletesOn: '2026-10-22T00:00:00Z' } } }));
    const user = userEvent.setup();
    renderAt('/sign-in?next=%2Faccount%2Faddresses');
    await user.type(screen.getByLabelText('Mobile number'), '9876543210');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByRole('heading', { name: 'Enter the code' });
    await user.keyboard('123456');
    await screen.findByText('ACCOUNT PAGE');
  });

  it('the profile step took too long: back to the mobile step, with the reason', async () => {
    fakeServer()
      .on('POST', '/auth/code', 202, { resendInSeconds: 60, expiresInSeconds: 600, codeLength: 6 })
      .on('POST', '/auth/verify', 200, { status: 'needs_profile', stepToken: 'step-123456789012345678901234', prefill: { fullName: 'Priya Sharma', email: 'p@example.com', pincode: '', city: '', state: '' } })
      .on('GET', '/pincodes/522503', 200, { pincode: '522503', area: 'Mangalagiri', city: 'Guntur', state: 'Andhra Pradesh' })
      .error('POST', '/auth/complete', 400, 'STEP_EXPIRED', 'This step timed out.');
    const user = userEvent.setup();
    renderAt('/sign-in');
    await user.type(screen.getByLabelText('Mobile number'), '9876543210');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByRole('heading', { name: 'Enter the code' });
    await user.keyboard('123456');
    await screen.findByRole('heading', { name: 'Complete your profile' });
    expect(screen.getByLabelText('Full name')).toHaveValue('Priya Sharma');
    await user.type(screen.getByLabelText('Pincode'), '522503');
    await waitFor(() => expect(screen.getByLabelText('City')).toHaveValue('Guntur'));
    await user.click(screen.getByRole('button', { name: 'Create my account' }));
    expect(await screen.findByText('Please confirm your number again')).toBeInTheDocument();
    expect(screen.getByLabelText('Mobile number')).toHaveValue('98765 43210');
  });

  // The 16 Oct check: rare situations each have a clear way forward.
  const needsProfile = { status: 'needs_profile', stepToken: 'step-123456789012345678901234', stepExpiresInSeconds: 900, mobileMasked: '+91 98765 •••10', prefill: { fullName: 'Priya Sharma', email: 'priya@example.com', pincode: '522503', city: 'Guntur', state: 'Andhra Pradesh', marketingOptIn: false } };
  async function toCodeStep(user) {
    renderAt('/sign-in');
    await user.type(screen.getByLabelText('Mobile number'), '9876543210');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByRole('heading', { name: 'Enter the code' });
  }

  it('a code the SMS service already checked: asks for a new code', async () => {
    fakeServer()
      .on('POST', '/auth/code', 202, { resendInSeconds: 60, expiresInSeconds: 600, codeLength: 6 })
      .error('POST', '/auth/verify', 400, 'CODE_ALREADY_USED', 'This code was already used. Get a new code.');
    const user = userEvent.setup();
    await toCodeStep(user);
    await user.keyboard('123456');
    expect(await screen.findByText('This code was already used. Get a new code.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new code/ })).toBeInTheDocument();
  });

  it('codes can\'t be sent today: offers the shop\'s WhatsApp', async () => {
    fakeServer().error('POST', '/auth/code', 503, 'SMS_PAUSED', 'Codes are paused for today.');
    const user = userEvent.setup();
    renderAt('/sign-in');
    await user.type(screen.getByLabelText('Mobile number'), '9876543210');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText('We couldn\'t send the code')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'WhatsApp us' })).toHaveAttribute('href', 'https://wa.me/917382388565');
  });

  it('a closed shop account: explains and offers WhatsApp instead of "Try again"', async () => {
    fakeServer()
      .on('POST', '/auth/code', 202, { resendInSeconds: 60, expiresInSeconds: 600, codeLength: 6 })
      .error('POST', '/auth/verify', 403, 'ACCOUNT_MANAGED_BY_SHOP', 'This number belongs to a closed shop account. Please message us on WhatsApp.', { help: 'whatsapp' });
    const user = userEvent.setup();
    await toCodeStep(user);
    await user.keyboard('123456');
    expect(await screen.findByText('This number can\'t sign in here')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /WhatsApp us/ })).toHaveAttribute('href', expect.stringContaining('wa.me/917382388565'));
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('codes paused: WhatsApp is offered', async () => {
    fakeServer()
      .on('POST', '/auth/code', 202, { resendInSeconds: 0, expiresInSeconds: 600, codeLength: 6 })
      .error('POST', '/auth/code', 503, 'SMS_PAUSED', 'We can\'t send codes right now. Please try again later or message us on WhatsApp.');
    const user = userEvent.setup();
    await toCodeStep(user);
    await user.click(await screen.findByRole('button', { name: 'Send a new code' }));
    expect(await screen.findByText('The code wasn\'t sent')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /WhatsApp us/ })).toBeInTheDocument();
  });

  it('an email on another account: a WhatsApp link with the email filled in', async () => {
    fakeServer()
      .on('POST', '/auth/code', 202, { resendInSeconds: 60, expiresInSeconds: 600, codeLength: 6 })
      .on('POST', '/auth/verify', 200, needsProfile)
      .error('POST', '/auth/complete', 409, 'EMAIL_TAKEN', 'This email is already on another account. Use a different one, or sign in with that account\'s mobile number. If it is yours, message us on WhatsApp.', { field: 'email', help: 'whatsapp' });
    const user = userEvent.setup();
    await toCodeStep(user);
    await user.keyboard('123456');
    await screen.findByRole('heading', { name: 'Complete your profile' });
    await user.click(screen.getByRole('button', { name: 'Create my account' }));
    const link = await screen.findByRole('link', { name: /This is my email/ });
    expect(decodeURIComponent(link.getAttribute('href'))).toContain('priya@example.com');
    await user.type(screen.getByLabelText('Email'), 'x');
    expect(screen.queryByRole('link', { name: /This is my email/ })).toBeNull();
  });

  it('a sign-up step used already: back to the number, told to sign in', async () => {
    fakeServer()
      .on('POST', '/auth/code', 202, { resendInSeconds: 60, expiresInSeconds: 600, codeLength: 6 })
      .on('POST', '/auth/verify', 200, needsProfile)
      .error('POST', '/auth/complete', 400, 'STEP_USED', 'You have already finished signing up. Please sign in with your mobile number.');
    const user = userEvent.setup();
    await toCodeStep(user);
    await user.keyboard('123456');
    await screen.findByRole('heading', { name: 'Complete your profile' });
    await user.click(screen.getByRole('button', { name: 'Create my account' }));
    expect(await screen.findByText('You have already signed up')).toBeInTheDocument();
    expect(screen.getByLabelText('Mobile number')).toBeInTheDocument();
  });
});
