// "‹ Back" at the start of the breadcrumbs (owner, 31 Oct 2026): back one page on the website,
// or one level up when the page was opened straight from a link.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { BackRow, Crumbs } from './bits.jsx';

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function App() {
  return (
    <BrowserRouter>
      <Where />
      <Routes>
        <Route path="/" element={<><Link to="/saree">Open saree</Link><Link to="/sign-in">Sign in</Link></>} />
        <Route path="/category" element={<p>Category</p>} />
        <Route path="/saree" element={<Crumbs items={[['Home', '/'], ['Pattu sarees', '/category'], ['NH-001']]} />} />
        <Route path="/sign-in" element={<BackRow />} />
      </Routes>
    </BrowserRouter>
  );
}
const where = () => screen.getByTestId('where');
const back = () => screen.getByRole('button', { name: 'Back' });

describe('Back button', () => {
  beforeEach(() => window.history.replaceState(null, '', '/'));

  it('goes back to the page the visitor came from', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Open saree'));
    expect(where()).toHaveTextContent('/saree');
    fireEvent.click(back());
    await waitFor(() => expect(where()).toHaveTextContent(/^\/$/));
  });

  it('opened straight from a link: goes one level up (the last linked crumb), not off the website', async () => {
    window.history.replaceState(null, '', '/saree');
    render(<App />);
    fireEvent.click(back());
    await waitFor(() => expect(where()).toHaveTextContent('/category'));
  });

  it('comes first in the breadcrumb row, as a button; the crumbs stay links', () => {
    window.history.replaceState(null, '', '/saree');
    const { container } = render(<App />);
    const row = container.querySelector('.crumbs-row');
    expect(row.firstElementChild).toBe(back());
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pattu sarees' })).toHaveAttribute('href', '/category');
  });

  it('pages without breadcrumbs (sign-in): back to the page before, or home when opened directly', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Open saree'));
    fireEvent.click(back());
    await waitFor(() => expect(where()).toHaveTextContent(/^\/$/));
    fireEvent.click(screen.getByText('Sign in'));
    fireEvent.click(back());
    await waitFor(() => expect(where()).toHaveTextContent(/^\/$/));
    window.history.replaceState(null, '', '/sign-in');
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Back' }).at(-1));
    await waitFor(() => expect(screen.getAllByTestId('where').at(-1)).toHaveTextContent(/^\/$/));
  });
});
