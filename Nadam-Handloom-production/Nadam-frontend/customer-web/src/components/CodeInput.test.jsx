import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CodeInput from './CodeInput.jsx';

function Harness({ onComplete }) {
  const [v, setV] = useState('');
  return <CodeInput value={v} onChange={setV} onComplete={onComplete} />;
}

describe('the 6 code boxes', () => {
  it('typing moves box to box and finishes with the whole code', async () => {
    const done = vi.fn();
    render(<Harness onComplete={done} />);
    const boxes = screen.getAllByRole('textbox');
    expect(boxes).toHaveLength(6);
    expect(document.activeElement).toBe(boxes[0]);
    await userEvent.keyboard('482916');
    expect(boxes.map((b) => b.value).join('')).toBe('482916');
    expect(done).toHaveBeenCalledWith('482916');
  });

  it('a pasted code fills every box', async () => {
    const done = vi.fn();
    render(<Harness onComplete={done} />);
    await userEvent.click(screen.getByLabelText('Digit 1 of 6'));
    await userEvent.paste('Your code is 123 456');
    expect(done).toHaveBeenCalledWith('123456');
  });

  it('each Backspace removes one digit and moves back', async () => {
    render(<Harness onComplete={() => {}} />);
    await userEvent.keyboard('12');
    const boxes = screen.getAllByRole('textbox');
    await userEvent.keyboard('{Backspace}');
    expect(boxes.map((b) => b.value).join('')).toBe('1');
    expect(document.activeElement).toBe(boxes[1]);
    await userEvent.keyboard('{Backspace}');
    expect(boxes.map((b) => b.value).join('')).toBe('');
    expect(document.activeElement).toBe(boxes[0]);
  });

  it('the first box offers the SMS code (iPhone and Android)', () => {
    render(<Harness onComplete={() => {}} />);
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveAttribute('autocomplete', 'one-time-code');
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveAttribute('inputmode', 'numeric');
  });
});
