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

  useEffect(() => {
    // Auto-focus first focusable element
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

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return modalRef;
}
