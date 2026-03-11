import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { shipTransferApi, type ShipImportResponse } from '../../services/api';
import { useModalA11y } from '../../hooks/useModalA11y';
import type { Ship } from '../../types';
import './ShipImportModal.css';

interface ShipImportModalProps {
  onClose: () => void;
  onImported?: (ship: Ship) => void;
}

type ImportState =
  | { step: 'select' }
  | { step: 'uploading' }
  | { step: 'conflict'; existingShip: { id: string; name: string }; suggestedName: string }
  | { step: 'success'; ship: Ship; recordCounts: Record<string, number>; assetCount: number }
  | { step: 'error'; message: string };

export function ShipImportModal({ onClose, onImported }: ShipImportModalProps) {
  const modalRef = useModalA11y(onClose);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<ImportState>({ step: 'select' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [newName, setNewName] = useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.zip')) {
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const processResponse = (response: ShipImportResponse) => {
    if ('conflict' in response) {
      setState({
        step: 'conflict',
        existingShip: response.existing_ship,
        suggestedName: response.suggested_name,
      });
      setNewName(response.suggested_name);
    } else {
      queryClient.invalidateQueries({ queryKey: ['ships'] });
      setState({
        step: 'success',
        ship: response.ship,
        recordCounts: response.imported_records,
        assetCount: response.imported_assets,
      });
    }
  };

  const handleImport = async (options?: { newName?: string; replaceExisting?: boolean }) => {
    if (!selectedFile) return;

    setState({ step: 'uploading' });

    try {
      const response = await shipTransferApi.import(selectedFile, options);
      processResponse(response);
    } catch (error) {
      setState({
        step: 'error',
        message: error instanceof Error ? error.message : 'Import failed',
      });
    }
  };

  const handleRename = () => {
    handleImport({ newName: newName.trim() });
  };

  const handleReplace = () => {
    handleImport({ replaceExisting: true });
  };

  const handleNavigateToShip = () => {
    if (state.step === 'success') {
      onImported?.(state.ship);
      navigate(`/${state.ship.id}/panels`);
    }
  };

  const handleClose = () => {
    if (state.step === 'success') {
      queryClient.invalidateQueries({ queryKey: ['ships'] });
    }
    onClose();
  };

  const renderContent = () => {
    switch (state.step) {
      case 'select':
        return (
          <>
            <div
              className="import-dropzone"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              {selectedFile ? (
                <div className="selected-file">
                  <span className="file-icon">ZIP</span>
                  <span className="file-name">{selectedFile.name}</span>
                  <span className="file-size">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              ) : (
                <div className="dropzone-prompt">
                  <span className="dropzone-icon">+</span>
                  <span className="dropzone-text">
                    Drop a ship export ZIP here or click to browse
                  </span>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!selectedFile}
                onClick={() => handleImport()}
              >
                Import Ship
              </button>
            </div>
          </>
        );

      case 'uploading':
        return (
          <div className="import-progress">
            <div className="progress-spinner" />
            <span className="progress-text">Importing ship data...</span>
          </div>
        );

      case 'conflict':
        return (
          <>
            <div className="import-conflict">
              <p className="conflict-message">
                A ship named <strong>"{state.existingShip.name}"</strong> already exists.
              </p>
              <p className="conflict-options-label">Choose how to proceed:</p>

              <div className="conflict-option">
                <label htmlFor="new-name">Rename imported ship:</label>
                <input
                  id="new-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter new name"
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!newName.trim() || newName.trim() === state.existingShip.name}
                  onClick={handleRename}
                >
                  Import with New Name
                </button>
              </div>

              <div className="conflict-divider">
                <span>or</span>
              </div>

              <div className="conflict-option danger">
                <p className="warning-text">
                  Replace the existing ship. This will delete all its data permanently.
                </p>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleReplace}
                >
                  Replace Existing Ship
                </button>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={handleClose}>
                Cancel
              </button>
            </div>
          </>
        );

      case 'success':
        const totalRecords = Object.values(state.recordCounts).reduce((a, b) => a + b, 0);
        return (
          <>
            <div className="import-success">
              <div className="success-icon">OK</div>
              <h3>Ship Imported Successfully</h3>
              <p className="success-ship-name">{state.ship.name}</p>

              <div className="import-stats">
                <div className="stat">
                  <span className="stat-value">{totalRecords}</span>
                  <span className="stat-label">records imported</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{state.assetCount}</span>
                  <span className="stat-label">assets copied</span>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={handleClose}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNavigateToShip}
              >
                Board Ship
              </button>
            </div>
          </>
        );

      case 'error':
        return (
          <>
            <div className="import-error">
              <div className="error-icon">!</div>
              <h3>Import Failed</h3>
              <p className="error-message">{state.message}</p>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={handleClose}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setState({ step: 'select' })}
              >
                Try Again
              </button>
            </div>
          </>
        );
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        ref={modalRef}
        className="modal-content ship-import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Import Ship"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Import Ship</h2>
          <button className="modal-close" onClick={handleClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
