import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type DialogRole = 'dialog' | 'alertdialog';
type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const dialogStack: string[] = [];

const isTopMost = (id: string) => dialogStack[dialogStack.length - 1] === id;

const getFocusableElements = (root: HTMLElement) => {
  const selectors = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ];
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(selectors.join(',')));
  return nodes.filter((el) => {
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    return true;
  });
};

export interface FocusTrapDialogProps {
  open: boolean;
  title: string;
  description?: string;
  role?: DialogRole;
  size?: DialogSize;
  className?: string;
  panelClassName?: string;
  footer?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  initialFocus?: 'first' | 'none';
  restoreFocus?: boolean;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  closeOnEscape?: boolean;
  testId?: string;
}

export function FocusTrapDialog({
  open,
  title,
  description,
  role = 'dialog',
  size = 'md',
  className,
  panelClassName,
  footer,
  onClose,
  children,
  initialFocus = 'first',
  restoreFocus = true,
  closeOnBackdrop = true,
  showCloseButton = true,
  closeOnEscape = true,
  testId,
}: FocusTrapDialogProps) {
  const internalId = useId();
  const stackId = useMemo(() => `focus-trap-${internalId}`, [internalId]);
  const titleId = useMemo(() => `${stackId}-title`, [stackId]);
  const descriptionId = useMemo(() => `${stackId}-description`, [stackId]);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const previousBodyOverflow = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement | null) ?? null;
    dialogStack.push(stackId);

    previousBodyOverflow.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      const idx = dialogStack.lastIndexOf(stackId);
      if (idx >= 0) dialogStack.splice(idx, 1);
      document.body.style.overflow = previousBodyOverflow.current ?? '';
      previousBodyOverflow.current = null;
      if (!restoreFocus) return;
      const el = restoreRef.current;
      if (el && document.contains(el) && typeof el.focus === 'function') {
        el.focus();
      }
      restoreRef.current = null;
    };
  }, [open, restoreFocus, stackId]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    if (initialFocus === 'none') return;
    const focusables = getFocusableElements(panel);
    if (focusables.length > 0) {
      focusables[0].focus();
      return;
    }
    panel.focus();
  }, [initialFocus, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopMost(stackId)) return;
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = getFocusableElements(panel);
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const active = document.activeElement as HTMLElement | null;
      const currentIndex = active ? focusables.indexOf(active) : -1;
      const goingBack = event.shiftKey;
      const nextIndex = (() => {
        if (currentIndex === -1) return 0;
        if (goingBack) return currentIndex === 0 ? focusables.length - 1 : currentIndex - 1;
        return currentIndex === focusables.length - 1 ? 0 : currentIndex + 1;
      })();
      event.preventDefault();
      focusables[nextIndex].focus();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [closeOnEscape, onClose, open, stackId]);

  if (!open) return null;

  return createPortal(
    <div
      className={`focus-trap-dialog__backdrop${className ? ` ${className}` : ''}`}
      data-test-id={testId}
      onMouseDown={() => {
        if (!isTopMost(stackId)) return;
        if (!closeOnBackdrop) return;
        onClose();
      }}
    >
      <div
        className={`focus-trap-dialog__panel${panelClassName ? ` ${panelClassName}` : ''}`}
        ref={panelRef}
        role={role}
        data-size={size}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="focus-trap-dialog__header">
          <h2 id={titleId} className="focus-trap-dialog__title">
            {title}
          </h2>
          {showCloseButton ? (
            <button type="button" className="focus-trap-dialog__close" onClick={onClose} aria-label="ダイアログを閉じる">
              ×
            </button>
          ) : null}
        </header>
        {description ? (
          <p id={descriptionId} className="focus-trap-dialog__description">
            {description}
          </p>
        ) : null}
        <div className="focus-trap-dialog__content">{children}</div>
        {footer ? <footer className="focus-trap-dialog__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
