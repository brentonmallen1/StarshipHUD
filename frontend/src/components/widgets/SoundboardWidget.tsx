import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { WidgetRendererProps } from '../../types';
import { getConfig } from '../../types';
import type { SoundButton, SoundboardWidgetConfig } from '../../types';
import { useContainerDimensions } from '../../hooks/useContainerDimensions';
import { useModalA11y } from '../../hooks/useModalA11y';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { AudioPickerModal } from '../admin/AudioPickerModal';
import './SoundboardWidget.css';
import './WidgetCreationModal.css';

// ─── Sortable Sound Button Item ─────────────────────────────────────

interface SortableSoundButtonProps {
  button: SoundButton;
  isPlaying: boolean;
  canEditData: boolean;
  isEditing: boolean;
  onPlay: (button: SoundButton) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function SortableSoundButton({
  button,
  isPlaying,
  canEditData,
  isEditing,
  onPlay,
  onEdit,
  onDelete,
}: SortableSoundButtonProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: button.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`soundboard__button-wrapper ${isPlaying ? 'soundboard__button-wrapper--playing' : ''}`}
    >
      {canEditData && !isEditing && (
        <button
          type="button"
          className="soundboard__drag-handle"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
        >
          ⋮⋮
        </button>
      )}

      <button
        type="button"
        className={`soundboard__button ${isPlaying ? 'soundboard__button--playing' : ''} ${button.loop ? 'soundboard__button--loop' : ''}`}
        onClick={() => onPlay(button)}
        disabled={isEditing}
        title={isPlaying ? 'Click to stop' : `Play: ${button.label}`}
      >
        <span className="soundboard__button-label">{button.label}</span>
        {isPlaying && (
          <div className="soundboard__waveform">
            <span className="soundboard__waveform-bar" />
            <span className="soundboard__waveform-bar" />
            <span className="soundboard__waveform-bar" />
            <span className="soundboard__waveform-bar" />
            <span className="soundboard__waveform-bar" />
          </div>
        )}
        {button.loop && <span className="soundboard__loop-icon">↻</span>}
      </button>

      {canEditData && !isEditing && (
        <div className="soundboard__actions">
          <button
            type="button"
            className="soundboard__action-btn"
            onClick={() => onEdit(button.id)}
            title="Edit button"
          >
            ✎
          </button>
          <button
            type="button"
            className="soundboard__action-btn soundboard__action-btn--delete"
            onClick={() => onDelete(button.id)}
            title="Delete button"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sound Button Edit Modal ─────────────────────────────────────────

interface SoundButtonModalProps {
  button?: SoundButton;
  onSave: (button: Omit<SoundButton, 'id'> & { id?: string }) => void;
  onClose: () => void;
}

function SoundButtonModal({ button, onSave, onClose }: SoundButtonModalProps) {
  const modalRef = useModalA11y(onClose);
  const [label, setLabel] = useState(button?.label ?? '');
  const [audioUrl, setAudioUrl] = useState(button?.audioUrl ?? '');
  const [loop, setLoop] = useState(button?.loop ?? false);
  const [showAudioPicker, setShowAudioPicker] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !audioUrl) return;

    onSave({
      id: button?.id,
      label: label.trim(),
      audioUrl,
      loop,
    });
  };

  const audioFilename = audioUrl ? audioUrl.split('/').pop() : null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal-content"
        style={{ maxWidth: '400px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">{button ? 'Edit Sound Button' : 'Add Sound Button'}</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="config-section">
              <label className="configure-label">Button Label</label>
              <input
                type="text"
                className="config-input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Alert Klaxon"
                autoFocus
              />
            </div>

            <div className="config-section">
              <label className="configure-label">Audio File</label>
              <div className="soundboard-modal__audio-select">
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => setShowAudioPicker(true)}
                >
                  {audioFilename ? 'Change Audio' : 'Select Audio'}
                </button>
                {audioFilename && (
                  <span className="soundboard-modal__audio-filename">{audioFilename}</span>
                )}
              </div>
            </div>

            <div className="config-section">
              <label className="soundboard-modal__checkbox-label">
                <input
                  type="checkbox"
                  checked={loop}
                  onChange={(e) => setLoop(e.target.checked)}
                />
                Loop audio (for ambient sounds)
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!label.trim() || !audioUrl}
            >
              {button ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>

      {showAudioPicker && (
        <AudioPickerModal
          currentUrl={audioUrl}
          onSelect={(url) => {
            setAudioUrl(url);
            setShowAudioPicker(false);
          }}
          onClose={() => setShowAudioPicker(false)}
        />
      )}
    </div>,
    document.body
  );
}

// ─── Main Widget Component ───────────────────────────────────────────

export function SoundboardWidget({
  instance,
  isEditing,
  canEditData,
  onConfigChange,
}: WidgetRendererProps) {
  const config = getConfig<SoundboardWidgetConfig>(instance.config);
  const { containerRef, ready } = useContainerDimensions();
  const audioPlayer = useAudioPlayer();

  // Local state for immediate UI feedback
  const [localButtons, setLocalButtons] = useState<SoundButton[]>(config.buttons ?? []);
  const [localTitle, setLocalTitle] = useState(config.title ?? 'Soundboard');
  const [editingButton, setEditingButton] = useState<SoundButton | null>(null);
  const [isAddingButton, setIsAddingButton] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Sync local state when config changes externally
  useEffect(() => {
    setLocalButtons(config.buttons ?? []);
  }, [config.buttons]);

  useEffect(() => {
    setLocalTitle(config.title ?? 'Soundboard');
  }, [config.title]);

  // Persist buttons to config
  const persistButtons = useCallback(
    (buttons: SoundButton[]) => {
      setLocalButtons(buttons);
      onConfigChange?.({ ...instance.config, buttons });
    },
    [onConfigChange, instance.config]
  );

  // Persist title to config
  const persistTitle = useCallback(
    (title: string) => {
      const trimmed = title.trim() || 'Soundboard';
      setLocalTitle(trimmed);
      onConfigChange?.({ ...instance.config, title: trimmed });
      setIsEditingTitle(false);
    },
    [onConfigChange, instance.config]
  );

  // Drag and drop setup
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = localButtons.findIndex((b) => b.id === active.id);
        const newIndex = localButtons.findIndex((b) => b.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          persistButtons(arrayMove(localButtons, oldIndex, newIndex));
        }
      }
    },
    [localButtons, persistButtons]
  );

  // Play/stop handler
  const handlePlayButton = useCallback(
    (button: SoundButton) => {
      if (isEditing) return;

      // If this button is already playing, stop it
      if (audioPlayer.state.currentUrl === button.audioUrl) {
        audioPlayer.stop();
      } else {
        // Play this button's audio
        audioPlayer.play(button.audioUrl, {
          loop: button.loop,
          name: button.label,
        });
      }
    },
    [audioPlayer, isEditing]
  );

  // CRUD handlers
  const handleAddButton = useCallback(
    (buttonData: Omit<SoundButton, 'id'> & { id?: string }) => {
      const newButton: SoundButton = {
        id: crypto.randomUUID(),
        label: buttonData.label,
        audioUrl: buttonData.audioUrl,
        loop: buttonData.loop,
      };

      persistButtons([...localButtons, newButton]);
      setIsAddingButton(false);
    },
    [localButtons, persistButtons]
  );

  const handleEditButton = useCallback(
    (buttonData: Omit<SoundButton, 'id'> & { id?: string }) => {
      if (!buttonData.id) return;

      const updatedButtons = localButtons.map((b) =>
        b.id === buttonData.id
          ? {
              ...b,
              label: buttonData.label,
              audioUrl: buttonData.audioUrl,
              loop: buttonData.loop,
            }
          : b
      );

      persistButtons(updatedButtons);
      setEditingButton(null);
    },
    [localButtons, persistButtons]
  );

  const handleDeleteButton = useCallback(
    (id: string) => {
      persistButtons(localButtons.filter((b) => b.id !== id));
    },
    [localButtons, persistButtons]
  );

  const buttonIds = localButtons.map((b) => b.id);

  // Editing mode placeholder
  if (isEditing) {
    return (
      <div className="soundboard-widget soundboard-widget--editing">
        <span className="soundboard-widget__label">{localTitle.toUpperCase()}</span>
        <span className="soundboard-widget__hint">
          {localButtons.length} button{localButtons.length !== 1 ? 's' : ''}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="soundboard-widget"
    >
      {/* Title header */}
      <div className="soundboard__header">
        {isEditingTitle ? (
          <input
            type="text"
            className="soundboard__title-input"
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={() => persistTitle(localTitle)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') persistTitle(localTitle);
              if (e.key === 'Escape') {
                setLocalTitle(config.title ?? 'Soundboard');
                setIsEditingTitle(false);
              }
            }}
            autoFocus
          />
        ) : (
          <span
            className={`soundboard__title ${canEditData ? 'soundboard__title--editable' : ''}`}
            onClick={() => canEditData && setIsEditingTitle(true)}
            title={canEditData ? 'Click to edit title' : undefined}
          >
            {localTitle}
          </span>
        )}
      </div>

      {!ready ? null : localButtons.length === 0 ? (
        <div className="soundboard__empty">
          <p>No sounds yet</p>
          {canEditData && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsAddingButton(true)}
            >
              + Add Sound
            </button>
          )}
        </div>
      ) : (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={buttonIds}
              strategy={rectSortingStrategy}
            >
              <div className="soundboard__grid">
                {localButtons.map((button) => (
                  <SortableSoundButton
                    key={button.id}
                    button={button}
                    isPlaying={audioPlayer.state.currentUrl === button.audioUrl && audioPlayer.state.isPlaying}
                    canEditData={canEditData}
                    isEditing={isEditing}
                    onPlay={handlePlayButton}
                    onEdit={(id) => {
                      const b = localButtons.find((btn) => btn.id === id);
                      if (b) setEditingButton(b);
                    }}
                    onDelete={handleDeleteButton}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {canEditData && (
            <button
              type="button"
              className="soundboard__add-btn"
              onClick={() => setIsAddingButton(true)}
            >
              + Add Sound
            </button>
          )}
        </>
      )}

      {/* Modals */}
      {isAddingButton && (
        <SoundButtonModal
          onSave={handleAddButton}
          onClose={() => setIsAddingButton(false)}
        />
      )}

      {editingButton && (
        <SoundButtonModal
          button={editingButton}
          onSave={handleEditButton}
          onClose={() => setEditingButton(null)}
        />
      )}
    </div>
  );
}
