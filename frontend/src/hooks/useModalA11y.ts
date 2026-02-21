import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook for modal accessibility: focus trapping, Escape-to-close,
 * and auto-focus of the first focusable element.
 */
export function useModalA11y(onClose: () => void) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Trap focus within the modal
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const modal = modalRef.current;
      if (!modal) return;

      const focusable = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose]
  );

  // Auto-focus runs once on mount only — must not re-run on every render, since
  // the keydown listener's dependency (handleKeyDown → onClose) changes when the
  // parent re-renders, which would snap focus back to the label field mid-editing.
  useEffect(() => {
    const modal = modalRef.current;
    if (modal) {
      const firstInput = modal.querySelector<HTMLElement>(
        'input, select, textarea'
      );
      const firstFocusable = modal.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (firstInput ?? firstFocusable)?.focus();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return modalRef;
}
