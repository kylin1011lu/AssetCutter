import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from 'react';

type BufferedNumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'defaultValue' | 'max' | 'min' | 'onChange' | 'type' | 'value'
> & {
  commitDelayMs?: number;
  max?: number;
  min?: number;
  onCommit: (value: number) => void;
  value: number;
};

const defaultCommitDelayMs = 300;

export function BufferedNumberInput({
  commitDelayMs = defaultCommitDelayMs,
  max,
  min,
  onBlur,
  onCommit,
  onFocus,
  onKeyDown,
  value,
  ...inputProps
}: BufferedNumberInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const onCommitRef = useRef(onCommit);
  const valueRef = useRef(value);
  const [draft, setDraft] = useState(() => formatNumberInputValue(value));

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    valueRef.current = value;
    if (document.activeElement !== inputRef.current) {
      setDraft(formatNumberInputValue(value));
    }
  }, [value]);

  useEffect(() => () => clearPendingCommit(), []);

  function clearPendingCommit() {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function commitNumber(nextValue: number) {
    const clampedValue = clampNumber(nextValue, min, max);
    if (clampedValue !== valueRef.current) {
      onCommitRef.current(clampedValue);
    }
    return clampedValue;
  }

  function commitDraft({ normalize }: { normalize: boolean }) {
    clearPendingCommit();
    const parsedValue = parseNumberInputDraft(draft);
    if (parsedValue === null) {
      if (normalize) setDraft(formatNumberInputValue(valueRef.current));
      return;
    }
    const committedValue = commitNumber(parsedValue);
    if (normalize) setDraft(formatNumberInputValue(committedValue));
  }

  function handleChange(nextDraft: string) {
    setDraft(nextDraft);
    clearPendingCommit();

    const parsedValue = parseNumberInputDraft(nextDraft);
    if (parsedValue === null) return;

    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      commitNumber(parsedValue);
    }, commitDelayMs);
  }

  function handleFocus(event: FocusEvent<HTMLInputElement>) {
    event.currentTarget.select();
    onFocus?.(event);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    commitDraft({ normalize: true });
    onBlur?.(event);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      commitDraft({ normalize: true });
    }
    onKeyDown?.(event);
  }

  return (
    <input
      {...inputProps}
      ref={inputRef}
      type="number"
      min={min}
      max={max}
      value={draft}
      onBlur={handleBlur}
      onChange={(event) => handleChange(event.target.value)}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
    />
  );
}

export function parseNumberInputDraft(draft: string): number | null {
  if (draft.trim() === '') return null;
  const parsed = Number(draft);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampNumber(value: number, min: number | undefined, max: number | undefined) {
  let nextValue = value;
  if (min !== undefined) nextValue = Math.max(min, nextValue);
  if (max !== undefined) nextValue = Math.min(max, nextValue);
  return nextValue;
}

function formatNumberInputValue(value: number) {
  return Number.isFinite(value) ? String(value) : '';
}
