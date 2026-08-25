import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import './ui.css';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * Blocks dismissal by Escape or backdrop click. Use only while a transaction
   * is in flight, where closing would leave someone unsure whether their money
   * moved.
   */
  busy?: boolean;
}

/**
 * A dialog that behaves like one: focus moves in, is trapped while open, and
 * returns to whatever opened it. Escape closes.
 *
 * Every confirmation in this app guards a signature, so a modal that loses
 * focus or cannot be dismissed by keyboard is not a cosmetic problem.
 */
export function Modal({ open, onClose, title, children, footer, busy = false }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const focusables = useCallback(
    () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ),
    [],
  );

  useEffect(() => {
    if (!open) return;

    returnFocusTo.current = document.activeElement as HTMLElement | null;
    const first = focusables()[0] ?? dialogRef.current;
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;

      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;

      // Wrap at both ends, or focus escapes to the page behind the dialog.
      if (event.shiftKey && active === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && active === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusTo.current?.focus();
    };
  }, [open, busy, onClose, focusables]);

  if (!open) return null;

  return (
    <div
      className="ui-modal__backdrop"
      onClick={() => !busy && onClose()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="ui-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ui-modal__header">
          <h2 className="ui-modal__title">{title}</h2>
          <button
            type="button"
            className="ui-modal__close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="ui-modal__body">{children}</div>
        {footer && <footer className="ui-modal__footer">{footer}</footer>}
      </div>
    </div>
  );
}
