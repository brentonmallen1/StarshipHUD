import { useState, useEffect, useRef, useCallback } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { useModalA11y } from '../../hooks/useModalA11y';
import type { NotesWidgetConfig } from '../../types/widget-configs';
import './NotesEditModal.css';

interface NotesEditModalProps {
  isOpen: boolean;
  title: string;
  showTitle: boolean;
  content: string;
  onClose: () => void;
  onSave: (config: NotesWidgetConfig) => void;
}

const AUTO_SAVE_DELAY = 1500; // 1.5 seconds

export function NotesEditModal({
  isOpen,
  title: initialTitle,
  showTitle: initialShowTitle,
  content: initialContent,
  onClose,
  onSave,
}: NotesEditModalProps) {
  const modalRef = useModalA11y(onClose);

  const [localTitle, setLocalTitle] = useState(initialTitle);
  const [localShowTitle, setLocalShowTitle] = useState(initialShowTitle);
  const [localContent, setLocalContent] = useState(initialContent);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const autoSaveTimerRef = useRef<number | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalTitle(initialTitle);
      setLocalShowTitle(initialShowTitle);
      setLocalContent(initialContent);
      setIsDirty(false);
      setLastSaved(null);
    }
  }, [isOpen, initialTitle, initialShowTitle, initialContent]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const performSave = useCallback(() => {
    if (!isDirty) return;

    setIsSaving(true);
    onSave({
      title: localTitle,
      showTitle: localShowTitle,
      content: localContent,
    });
    setIsDirty(false);
    setLastSaved(new Date());
    setIsSaving(false);
  }, [isDirty, localTitle, localShowTitle, localContent, onSave]);

  // Auto-save with debounce
  useEffect(() => {
    if (!isDirty || !isOpen) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      performSave();
    }, AUTO_SAVE_DELAY);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [isDirty, isOpen, localTitle, localShowTitle, localContent, performSave]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalTitle(e.target.value);
    setIsDirty(true);
  };

  const handleShowTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalShowTitle(e.target.checked);
    setIsDirty(true);
  };

  const handleContentChange = (value: string | undefined) => {
    setLocalContent(value ?? '');
    setIsDirty(true);
  };

  const handleManualSave = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    performSave();
  };

  const handleClose = () => {
    // Save any pending changes before closing
    if (isDirty) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      performSave();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="notes-edit-modal-overlay" onClick={handleClose}>
      <div
        ref={modalRef}
        className="notes-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notes-edit-title"
        onClick={(e) => e.stopPropagation()}
        data-color-mode="dark"
      >
        <div className="notes-edit-modal__header">
          <h2 id="notes-edit-title" className="notes-edit-modal__title">
            Edit Notes
          </h2>
          <div className="notes-edit-modal__status">
            {isSaving && (
              <span className="notes-edit-modal__saving">Saving...</span>
            )}
            {isDirty && !isSaving && (
              <span className="notes-edit-modal__dirty">Unsaved changes</span>
            )}
            {lastSaved && !isDirty && !isSaving && (
              <span className="notes-edit-modal__saved">Saved</span>
            )}
          </div>
          <button
            className="notes-edit-modal__close"
            onClick={handleClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="notes-edit-modal__body">
          <div className="notes-edit-modal__config">
            <div className="notes-edit-modal__field">
              <label htmlFor="notes-title" className="notes-edit-modal__label">
                Title
              </label>
              <input
                id="notes-title"
                type="text"
                className="notes-edit-modal__input"
                value={localTitle}
                onChange={handleTitleChange}
                placeholder="Notes"
              />
            </div>
            <div className="notes-edit-modal__checkbox-field">
              <input
                id="notes-show-title"
                type="checkbox"
                checked={localShowTitle}
                onChange={handleShowTitleChange}
              />
              <label htmlFor="notes-show-title">Show title in widget</label>
            </div>
          </div>

          <div className="notes-edit-modal__editor">
            <MDEditor
              value={localContent}
              onChange={handleContentChange}
              height="100%"
              preview="edit"
              hideToolbar={false}
              visibleDragbar={false}
            />
          </div>
        </div>

        <div className="notes-edit-modal__footer">
          <button
            type="button"
            className="notes-edit-modal__btn"
            onClick={handleClose}
          >
            Close
          </button>
          <button
            type="button"
            className="notes-edit-modal__btn notes-edit-modal__btn--primary"
            onClick={handleManualSave}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
