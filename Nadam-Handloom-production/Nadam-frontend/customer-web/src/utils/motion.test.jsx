// Cards fade in as they come into view and must never be left invisible (31 Oct 2026): a
// refreshed list with new sarees on top (same count) left the new row blank, and "Add to bag"
// rewrote a card's class and made it vanish.
import { useRef } from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useReveal } from './motion.js';

// A stand-in for the browser's IntersectionObserver: the test says when an element is in view.
class FakeIO {
  static all = [];
  constructor(cb) { this.cb = cb; this.els = new Set(); FakeIO.all.push(this); }
  observe(el) { this.els.add(el); }
  unobserve(el) { this.els.delete(el); }
  disconnect() { this.els.clear(); }
}
const inView = (el) => act(() => FakeIO.all.forEach((io) => io.els.has(el) && io.cb([{ isIntersecting: true, target: el }])));
const watched = (el) => FakeIO.all.some((io) => io.els.has(el));
const settle = () => act(() => new Promise((r) => setTimeout(r, 0)));

function List({ ids, bag = [] }) {
  const ref = useRef(null);
  useReveal(ref, [ids.length]);
  return (
    <div ref={ref}>
      {ids.map((id) => <article key={id} data-id={id} className={`pcard reveal${bag.includes(id) ? ' added' : ''}`}>{id}</article>)}
    </div>
  );
}
const card = (c, id) => c.querySelector(`[data-id="${id}"]`);

describe('cards fading in', () => {
  beforeEach(() => { FakeIO.all = []; window.IntersectionObserver = FakeIO; });
  afterEach(() => { delete window.IntersectionObserver; });

  it('new cards at the top of a refreshed list (same count) are watched and fade in', async () => {
    const { container, rerender } = render(<List ids={['a', 'b', 'c']} />);
    ['a', 'b', 'c'].forEach((id) => inView(card(container, id)));
    rerender(<List ids={['new1', 'a', 'b']} />);
    await settle();
    const fresh = card(container, 'new1');
    expect(fresh).not.toHaveClass('in');
    expect(watched(fresh)).toBe(true);
    inView(fresh);
    expect(fresh).toHaveClass('in');
  });

  it('a card stays visible when its class changes (Add to bag)', async () => {
    const { container, rerender } = render(<List ids={['a', 'b']} />);
    inView(card(container, 'a'));
    rerender(<List ids={['a', 'b']} bag={['a']} />);
    await settle();
    expect(card(container, 'a')).toHaveClass('pcard', 'reveal', 'added', 'in');
  });

  it('a card not yet in view still waits for it, even after a class change', async () => {
    const { container, rerender } = render(<List ids={['a', 'b']} />);
    rerender(<List ids={['a', 'b']} bag={['b']} />);
    await settle();
    const b = card(container, 'b');
    expect(b).not.toHaveClass('in');
    inView(b);
    expect(b).toHaveClass('added', 'in');
  });

  it('without IntersectionObserver every card, old or new, simply shows', async () => {
    delete window.IntersectionObserver;
    const { container, rerender } = render(<List ids={['a']} />);
    expect(card(container, 'a')).toHaveClass('in');
    rerender(<List ids={['new1']} />);
    await settle();
    expect(card(container, 'new1')).toHaveClass('in');
  });
});
