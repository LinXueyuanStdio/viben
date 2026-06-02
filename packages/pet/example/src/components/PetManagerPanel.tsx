import { useState } from 'react';
import { PetSprite, type PetConfig } from '@viben/pet';
import type { CustomPet } from '../lib/petStorage';
import './PetManagerPanel.css';

export interface PetManagerPanelProps {
  builtinPets: PetConfig[];
  customPets: CustomPet[];
  selectedPetId: string | null;
  onSelectPet: (petId: string, isCustom: boolean) => void;
  onEditPet: (petId: string) => void;
  onDeletePet: (petId: string) => void;
  onAddPet: () => void;
  onExportPet: (petId: string) => void;
  isLoadingCustomPets?: boolean;
}

interface DeleteConfirmDialogProps {
  petName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmDialog({ petName, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  return (
    <div className="delete-confirm-overlay" onClick={onCancel}>
      <div className="delete-confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h4>Delete Pet</h4>
        <p>Are you sure you want to delete "{petName}"? This action cannot be undone.</p>
        <div className="delete-confirm-actions">
          <button className="cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="confirm-btn" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function PetManagerPanel({
  builtinPets,
  customPets,
  selectedPetId,
  onSelectPet,
  onEditPet,
  onDeletePet,
  onAddPet,
  onExportPet,
  isLoadingCustomPets = false,
}: PetManagerPanelProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const handleDeleteClick = (petId: string, petName: string) => {
    setDeleteConfirm({ id: petId, name: petName });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm) {
      onDeletePet(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  return (
    <div className="pet-manager-panel">
      {/* Built-in Pets Section */}
      <section className="pet-section">
        <h3 className="section-header">Built-in Pets</h3>
        <div className="pet-manager-grid">
          {builtinPets.map((pet) => (
            <button
              key={pet.id}
              className={`pet-manager-card ${selectedPetId === pet.id ? 'active' : ''}`}
              onClick={() => onSelectPet(pet.id, false)}
            >
              <div className="pet-manager-card-preview">
                <PetSprite pet={pet} rowId="idle" size={48} />
              </div>
              <span className="pet-manager-card-name">{pet.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Custom Pets Section */}
      <section className="pet-section">
        <h3 className="section-header">Custom Pets</h3>

        {isLoadingCustomPets ? (
          <div className="custom-pets-loading">
            <span className="loading-spinner"></span>
            <span>Loading custom pets...</span>
          </div>
        ) : (
          <>
            <div className="pet-manager-grid">
              {customPets.length === 0 ? (
                <div className="custom-pets-empty">
                  <p>No custom pets yet</p>
                  <p className="empty-hint">Click "Add New" to create your first custom pet!</p>
                </div>
              ) : (
                customPets.map((pet) => (
                  <div
                    key={pet.id}
                    className={`pet-manager-card custom ${selectedPetId === `custom:${pet.id}` ? 'active' : ''}`}
                  >
                    <button
                      className="pet-manager-card-content"
                      onClick={() => onSelectPet(pet.id, true)}
                    >
                      <div className="pet-manager-card-preview">
                        <span
                          className="pet-image atlas custom-pet-preview"
                          style={{
                            backgroundImage: `url(${pet.spritesheetDataUrl})`,
                            backgroundSize: '800% 900%',
                            backgroundPosition: '0% 0%',
                            width: 48,
                            height: 48,
                          }}
                          aria-hidden
                        />
                      </div>
                      <span className="pet-manager-card-name">{pet.displayName}</span>
                    </button>
                    <div className="pet-manager-card-actions">
                      <button
                        className="action-btn edit-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditPet(pet.id);
                        }}
                        title="Edit pet"
                      >
                        Edit
                      </button>
                      <button
                        className="action-btn export-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onExportPet(pet.id);
                        }}
                        title="Export pet"
                      >
                        Export
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(pet.id, pet.displayName);
                        }}
                        title="Delete pet"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add New Pet Button */}
            <button className="add-pet-card" onClick={onAddPet}>
              <span className="add-pet-icon">+</span>
              <span className="add-pet-text">Add New Pet</span>
            </button>
          </>
        )}
      </section>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <DeleteConfirmDialog
          petName={deleteConfirm.name}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  );
}
