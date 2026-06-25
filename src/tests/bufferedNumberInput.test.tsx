import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { BufferedNumberInput } from '../app/BufferedNumberInput';

describe('BufferedNumberInput', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  test('allows clearing zero without immediately committing zero again', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    render(<BufferedNumberInput aria-label="Soft edge" value={0} min={0} max={255} onCommit={onCommit} />);

    const input = screen.getByRole('spinbutton', { name: 'Soft edge' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });

    expect(input).toHaveValue(null);
    vi.advanceTimersByTime(400);
    expect(onCommit).not.toHaveBeenCalled();
  });

  test('debounces valid edits before committing to the project value', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    render(
      <BufferedNumberInput
        aria-label="Tolerance"
        value={0}
        min={0}
        max={255}
        commitDelayMs={300}
        onCommit={onCommit}
      />,
    );

    const input = screen.getByRole('spinbutton', { name: 'Tolerance' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '6' } });
    fireEvent.change(input, { target: { value: '60' } });

    vi.advanceTimersByTime(299);
    expect(onCommit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(60);
  });

  test('normalizes leading zeros when the user leaves the field', () => {
    const onCommit = vi.fn();
    render(<BufferedNumberInput aria-label="Tolerance" value={0} min={0} max={255} onCommit={onCommit} />);

    const input = screen.getByRole('spinbutton', { name: 'Tolerance' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '060' } });
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith(60);
    expect(input).toHaveValue(60);
  });
});
