import { useState } from 'react';
import { createPortal } from 'react-dom';
import MarkdownPreview from '@uiw/react-markdown-preview';
import type { WidgetRendererProps } from '../../types';
import { getConfig, type NotesWidgetConfig } from '../../types/widget-configs';
import { NotesEditModal } from './NotesEditModal';
import './NotesWidget.css';

export function NotesWidget({
  instance,
  isEditing,
  canEditData,
  onConfigChange,
}: WidgetRendererProps) {
  const config = getConfig<NotesWidgetConfig>(instance.config);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const title = config.title ?? 'Notes';
  const showTitle = config.showTitle ?? true;
  const content = config.content ?? '';

  const handleSave = (newConfig: NotesWidgetConfig) => {
    onConfigChange?.({
      ...instance.config,
      ...newConfig,
    });
  };

  // Editing mode: show placeholder preview
  if (isEditing) {
    return (
      <div className="notes-widget notes-widget--editing">
        <div className="notes-widget__header">
          <h3 className="notes-widget__title">Notes</h3>
        </div>
        <div className="notes-widget__preview">
          <span className="notes-widget__preview-icon">&#9998;</span>
          <span className="notes-widget__preview-label">Markdown Notes</span>
        </div>
      </div>
    );
  }

  return (
    <div className="notes-widget">
      {showTitle && (
        <div className="notes-widget__header">
          <h3 className="notes-widget__title">{title}</h3>
          {canEditData && (
            <button
              className="notes-widget__edit-btn"
              onClick={() => setIsModalOpen(true)}
              title="Edit notes"
            >
              Edit
            </button>
          )}
        </div>
      )}

      {!showTitle && canEditData && (
        <button
          className="notes-widget__edit-btn notes-widget__edit-btn--floating"
          onClick={() => setIsModalOpen(true)}
          title="Edit notes"
        >
          Edit
        </button>
      )}

      <div className="notes-widget__content">
        {content ? (
          <MarkdownPreview
            source={content}
            className="notes-widget__markdown"
            style={{ background: 'transparent' }}
          />
        ) : (
          <div className="notes-widget__empty">
            <span className="notes-widget__empty-icon">&#9998;</span>
            <span className="notes-widget__empty-text">No notes yet</span>
            {canEditData && (
              <button
                className="notes-widget__empty-btn"
                onClick={() => setIsModalOpen(true)}
              >
                Add Notes
              </button>
            )}
          </div>
        )}
      </div>

      {createPortal(
        <NotesEditModal
          isOpen={isModalOpen}
          title={title}
          showTitle={showTitle}
          content={content}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
        />,
        document.body
      )}
    </div>
  );
}
