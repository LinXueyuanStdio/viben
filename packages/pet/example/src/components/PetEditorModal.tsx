import { useState, useEffect, useCallback, useRef } from 'react';
import { PetSprite, type PetConfig, STANDARD_ANIMATIONS } from '@viben/pet';
import type { CustomPet } from '../lib/petStorage';
import './PetEditorModal.css';

export interface PetEditorModalProps {
  pet: PetConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: PetConfig) => void;
}

interface FormData {
  displayName: string;
  description: string;
  accent: string;
  greeting: string;
}

interface FormErrors {
  displayName?: string;
}

export function PetEditorModal({ pet, isOpen, onClose, onSave }: PetEditorModalProps) {
  const [formData, setFormData] = useState<FormData>({
    displayName: '',
    description: '',
    accent: '#f5a623',
    greeting: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [previewAnimation, setPreviewAnimation] = useState('idle');

  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Initialize form data when pet changes
  useEffect(() => {
    if (pet) {
      setFormData({
        displayName: pet.name,
        description: pet.description,
        accent: pet.accent,
        greeting: pet.greeting,
      });
      setErrors({});
    }
  }, [pet]);

  // Focus name input when modal opens
  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      // Small delay to ensure modal is rendered
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.displayName.trim()) {
      newErrors.displayName = 'Name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData.displayName]);

  // Handle input changes
  const handleInputChange = useCallback((
    field: keyof FormData,
    value: string
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear error for this field when user starts typing
    if (field === 'displayName' && errors.displayName) {
      setErrors(prev => ({ ...prev, displayName: undefined }));
    }
  }, [errors.displayName]);

  // Handle save
  const handleSave = useCallback(() => {
    if (!pet || !validateForm()) return;

    const updatedPet: PetConfig = {
      ...pet,
      name: formData.displayName.trim(),
      description: formData.description.trim(),
      accent: formData.accent,
      greeting: formData.greeting.trim(),
    };

    onSave(updatedPet);
  }, [pet, formData, validateForm, onSave]);

  // Handle form submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  }, [handleSave]);

  // Create a preview pet config with current form values
  const previewPet: PetConfig | null = pet ? {
    ...pet,
    name: formData.displayName || pet.name,
    description: formData.description,
    accent: formData.accent,
    greeting: formData.greeting,
  } : null;

  if (!isOpen || !pet) return null;

  return (
    <div
      className="pet-editor-overlay"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pet-editor-title"
    >
      <div className="pet-editor-modal" ref={modalRef}>
        {/* Header */}
        <div className="pet-editor-header">
          <h2 id="pet-editor-title">Edit Pet</h2>
          <button
            className="pet-editor-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            X
          </button>
        </div>

        {/* Content */}
        <form className="pet-editor-content" onSubmit={handleSubmit}>
          {/* Preview Section */}
          <div className="pet-editor-preview">
            <div
              className="pet-editor-preview-container"
              style={{ borderColor: formData.accent }}
            >
              {previewPet && (
                <PetSprite pet={previewPet} rowId={previewAnimation} size={96} />
              )}
            </div>
            <div className="pet-editor-preview-controls">
              <label htmlFor="preview-animation">Preview Animation:</label>
              <select
                id="preview-animation"
                value={previewAnimation}
                onChange={(e) => setPreviewAnimation(e.target.value)}
              >
                {STANDARD_ANIMATIONS.map((anim) => (
                  <option key={anim.id} value={anim.id}>
                    {anim.id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Form Fields */}
          <div className="pet-editor-fields">
            {/* Display Name */}
            <div className="pet-editor-field">
              <label htmlFor="pet-name">Display Name *</label>
              <input
                ref={nameInputRef}
                id="pet-name"
                type="text"
                value={formData.displayName}
                onChange={(e) => handleInputChange('displayName', e.target.value)}
                placeholder="Enter pet name"
                className={errors.displayName ? 'error' : ''}
                maxLength={50}
              />
              {errors.displayName && (
                <span className="pet-editor-error">{errors.displayName}</span>
              )}
            </div>

            {/* Description */}
            <div className="pet-editor-field">
              <label htmlFor="pet-description">Description</label>
              <textarea
                id="pet-description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Enter pet description"
                rows={2}
                maxLength={200}
              />
            </div>

            {/* Accent Color */}
            <div className="pet-editor-field">
              <label htmlFor="pet-accent">Accent Color</label>
              <div className="pet-editor-color-input">
                <input
                  id="pet-accent"
                  type="color"
                  value={formData.accent}
                  onChange={(e) => handleInputChange('accent', e.target.value)}
                />
                <input
                  type="text"
                  value={formData.accent}
                  onChange={(e) => handleInputChange('accent', e.target.value)}
                  placeholder="#f5a623"
                  pattern="^#[0-9A-Fa-f]{6}$"
                  maxLength={7}
                />
              </div>
            </div>

            {/* Greeting */}
            <div className="pet-editor-field">
              <label htmlFor="pet-greeting">Greeting Message</label>
              <textarea
                id="pet-greeting"
                value={formData.greeting}
                onChange={(e) => handleInputChange('greeting', e.target.value)}
                placeholder="Enter greeting message"
                rows={2}
                maxLength={200}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pet-editor-footer">
            <button
              type="button"
              className="pet-editor-btn cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="pet-editor-btn save"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
