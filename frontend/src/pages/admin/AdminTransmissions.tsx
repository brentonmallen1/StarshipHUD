import { useState } from 'react';
import { useAllTransmissions } from '../../hooks/useShipData';
import {
  useCreateTransmission,
  useUpdateTransmission,
  useTransmitTransmission,
  useUntransmitTransmission,
  useDeleteTransmission,
  useResetDecryption,
} from '../../hooks/useMutations';
import { TransmissionFormModal, type TransmissionFormData } from '../../components/admin/TransmissionFormModal';
import type { ShipEvent, TransmissionData } from '../../types';
import './Admin.css';

const DEFAULT_SHIP_ID = 'constellation';

export function AdminTransmissions() {
  const { data: transmissions, isLoading } = useAllTransmissions();

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingTransmission, setEditingTransmission] = useState<ShipEvent | undefined>();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Mutations
  const createTransmission = useCreateTransmission();
  const updateTransmission = useUpdateTransmission();
  const transmitTransmission = useTransmitTransmission();
  const untransmitTransmission = useUntransmitTransmission();
  const deleteTransmission = useDeleteTransmission();
  const resetDecryption = useResetDecryption();

  const handleNew = () => {
    setEditingTransmission(undefined);
    setIsFormModalOpen(true);
  };

  const handleEdit = (transmission: ShipEvent) => {
    setEditingTransmission(transmission);
    setIsFormModalOpen(true);
  };

  const handleSave = (formData: TransmissionFormData) => {
    if (editingTransmission) {
      // Update existing - preserve existing minigame state
      const existingData = editingTransmission.data as unknown as TransmissionData;
      updateTransmission.mutate(
        {
          id: editingTransmission.id,
          data: {
            message: `Incoming transmission from ${formData.sender_name}`,
            severity: formData.channel === 'distress' ? 'critical' : 'info',
            data: {
              sender_name: formData.sender_name,
              channel: formData.channel,
              encrypted: formData.encrypted,
              signal_strength: formData.signal_strength,
              frequency: formData.frequency,
              text: formData.text,
              // Update minigame fields if encrypted
              difficulty: formData.encrypted ? formData.difficulty : undefined,
              minigame_seed: formData.encrypted ? (formData.minigame_seed ?? existingData?.minigame_seed) : undefined,
              // Preserve existing decryption state
              decrypted: existingData?.decrypted,
              decryption_attempts: existingData?.decryption_attempts,
              decryption_locked: existingData?.decryption_locked,
              decryption_cooldown_until: existingData?.decryption_cooldown_until,
            },
          },
        },
        { onSuccess: () => setIsFormModalOpen(false) }
      );
    } else {
      // Create new
      createTransmission.mutate(
        {
          ship_id: DEFAULT_SHIP_ID,
          sender_name: formData.sender_name,
          channel: formData.channel,
          encrypted: formData.encrypted,
          signal_strength: formData.signal_strength,
          frequency: formData.frequency,
          text: formData.text,
          transmitted: false, // Always create as draft
          difficulty: formData.difficulty,
          minigame_seed: formData.minigame_seed,
        },
        { onSuccess: () => setIsFormModalOpen(false) }
      );
    }
  };

  const handleResetDecryption = (id: string) => {
    resetDecryption.mutate(id);
  };

  const handleTransmit = (id: string) => {
    transmitTransmission.mutate(id);
  };

  const handleUntransmit = (id: string) => {
    untransmitTransmission.mutate(id);
  };

  const handleDelete = (id: string) => {
    deleteTransmission.mutate(id, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return <div className="admin-loading">Loading transmissions...</div>;
  }

  // Sort by created_at desc only - no grouping by status to keep list stable during status changes
  const sortedTransmissions = [...(transmissions ?? [])].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="admin-transmissions">
      <div className="admin-header-row">
        <h2 className="admin-page-title">Transmissions</h2>
        <button className="btn btn-primary" onClick={handleNew}>
          + New Transmission
        </button>
      </div>

      <p className="admin-page-description">
        Create and manage transmissions that appear in player Transmission Console widgets.
        Transmissions start as drafts and become visible to players when you click "Transmit".
      </p>

      {sortedTransmissions.length === 0 ? (
        <div className="admin-empty-state">
          <p>No transmissions yet. Create one to send to players!</p>
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Sender</th>
              <th>Channel</th>
              <th>Encryption</th>
              <th>Message</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedTransmissions.map((tx) => {
              const data = tx.data as unknown as TransmissionData;
              return (
                <tr key={tx.id}>
                  <td>
                    <span className={`status-badge ${tx.transmitted ? 'status-transmitted' : 'status-draft'}`}>
                      {tx.transmitted ? 'TRANSMITTED' : 'DRAFT'}
                    </span>
                  </td>
                  <td><strong>{data?.sender_name ?? 'Unknown'}</strong></td>
                  <td>
                    <span className={`channel-badge channel-${data?.channel ?? 'unknown'}`}>
                      {data?.channel?.toUpperCase() ?? 'UNKNOWN'}
                    </span>
                  </td>
                  <td>
                    {data?.encrypted ? (
                      <div className="encryption-status">
                        <span className={`difficulty-badge difficulty-${data.difficulty ?? 'easy'}`}>
                          {(data.difficulty ?? 'easy').toUpperCase()}
                        </span>
                        {data.decryption_locked ? (
                          <span className="decryption-badge locked">LOCKED</span>
                        ) : data.decrypted ? (
                          <span className="decryption-badge decrypted">DECRYPTED</span>
                        ) : (
                          <span className="decryption-badge pending">
                            {data.decryption_attempts ? `${data.decryption_attempts} attempts` : 'PENDING'}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="encryption-none">-</span>
                    )}
                  </td>
                  <td className="transmission-message-cell">
                    <span className="transmission-preview">
                      {data?.encrypted && !data?.decrypted
                        ? '[ENCRYPTED]'
                        : (data?.text?.slice(0, 80) + (data?.text?.length > 80 ? '...' : ''))}
                    </span>
                  </td>
                  <td>{formatTime(tx.created_at)}</td>
                  <td className="actions-cell">
                    <button
                      className="btn btn-small"
                      onClick={() => handleEdit(tx)}
                    >
                      Edit
                    </button>
                    {tx.transmitted ? (
                      <button
                        className="btn btn-small btn-warning"
                        onClick={() => handleUntransmit(tx.id)}
                        disabled={untransmitTransmission.isPending}
                      >
                        Untransmit
                      </button>
                    ) : (
                      <button
                        className="btn btn-small btn-primary"
                        onClick={() => handleTransmit(tx.id)}
                        disabled={transmitTransmission.isPending}
                      >
                        Transmit
                      </button>
                    )}
                    {data?.encrypted && (data?.decrypted || data?.decryption_locked || (data?.decryption_attempts ?? 0) > 0) && (
                      <button
                        className="btn btn-small"
                        onClick={() => handleResetDecryption(tx.id)}
                        disabled={resetDecryption.isPending}
                        title="Reset decryption state"
                      >
                        Reset
                      </button>
                    )}
                    {deleteConfirmId === tx.id ? (
                      <>
                        <button
                          className="btn btn-small btn-danger"
                          onClick={() => handleDelete(tx.id)}
                          disabled={deleteTransmission.isPending}
                        >
                          Confirm
                        </button>
                        <button
                          className="btn btn-small"
                          onClick={() => setDeleteConfirmId(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn btn-small btn-danger"
                        onClick={() => setDeleteConfirmId(tx.id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <TransmissionFormModal
        transmission={editingTransmission}
        shipId={DEFAULT_SHIP_ID}
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingTransmission(undefined);
        }}
        onSave={handleSave}
        isSaving={createTransmission.isPending || updateTransmission.isPending}
      />
    </div>
  );
}
