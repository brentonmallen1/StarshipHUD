import './EditButton.css';

interface EditButtonProps {
  onClick: () => void;
  title?: string;
  disabled?: boolean;
}

/**
 * Edit Button - Player data editing trigger
 *
 * Appears in widget corner when canEditData=true.
 * Visually distinct from GM config button (⚙ vs gear shape).
 */
export function EditButton({ onClick, title = 'Edit data', disabled = false }: EditButtonProps) {
  return (
    <button
      className="edit-button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      type="button"
      aria-label={title}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="edit-icon"
      >
        {/* Pencil/Edit icon */}
        <path
          d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25a1.75 1.75 0 0 1 .445-.758l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
}
