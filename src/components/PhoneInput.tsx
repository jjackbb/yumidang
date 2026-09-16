import { useLayoutEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { sanitizePhone } from '../utils/profile';

type PhoneInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'maxLength'> & {
  value: string;
  onValueChange: (digits: string) => void;
};

/** The visible separators never become part of the stored phone number. */
export function PhoneInput({ value, onValueChange, ...props }: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [caret, setCaret] = useState<{ digits: number } | null>(null);
  const digits = sanitizePhone(value);
  const formatted = [digits.slice(0, 3), digits.slice(3, 7), digits.slice(7, 11)].filter(Boolean).join('-');

  useLayoutEffect(() => {
    if (!caret || !inputRef.current) return;
    let position = 0;
    let count = 0;
    while (position < formatted.length && count < caret.digits) {
      if (/\d/.test(formatted[position])) count++;
      position++;
    }
    inputRef.current.setSelectionRange(position, position);
  }, [caret, formatted]);

  return <input {...props} ref={inputRef} type="tel" inputMode="numeric" autoComplete="tel"
    placeholder="010-0000-0000" value={formatted}
    onChange={event => {
      const raw = event.target.value;
      const position = event.target.selectionStart ?? raw.length;
      let next = sanitizePhone(raw);
      let before = raw.slice(0, position).replace(/\D/g, '').length;
      const inputType = (event.nativeEvent as InputEvent).inputType;
      // Deleting a separator should delete the adjacent digit, not reinsert the separator forever.
      if (next === digits && raw.length < formatted.length) {
        if (inputType === 'deleteContentBackward') {
          next = next.slice(0, Math.max(0, before - 1)) + next.slice(before);
          before = Math.max(0, before - 1);
        } else if (inputType === 'deleteContentForward') {
          next = next.slice(0, before) + next.slice(before + 1);
        }
      }
      onValueChange(next);
      setCaret({ digits: Math.min(before, next.length) });
    }} />;
}
