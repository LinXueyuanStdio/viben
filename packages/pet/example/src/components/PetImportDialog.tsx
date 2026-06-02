import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';
import type { CustomPet } from '../lib/petStorage';
import { CODEX_ATLAS } from '@viben/pet';
import './PetImportDialog.css';

export interface PetImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (pet: CustomPet) => void;
}

type ImportMode = 'image' | 'json';

interface ImageValidation {
  valid: boolean;
  message: string;
  width?: number;
  height?: number;
}

interface ParsedJsonPet {
  displayName: string;
  description?: string;
  accent?: string;
  greeting?: string;
  spritesheetDataUrl: string;
}

/**
 * Generate a unique ID for new pets.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const timestamp = Date.now().toString(36);
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomSuffix}`;
}

/**
 * Validate image dimensions against standard atlas requirements.
 */
function validateImageDimensions(width: number, height: number): ImageValidation {
  const expectedWidth = CODEX_ATLAS.width;
  const expectedHeight = CODEX_ATLAS.height;

  if (width === expectedWidth && height === expectedHeight) {
    return {
      valid: true,
      message: `Image dimensions are correct (${width}x${height})`,
      width,
      height,
    };
  }

  return {
    valid: false,
    message: `Image dimensions (${width}x${height}) do not match the standard atlas size (${expectedWidth}x${expectedHeight}). The pet may not animate correctly.`,
    width,
    height,
  };
}

/**
 * Convert a File to a base64 data URL.
 */
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Get image dimensions from a data URL.
 */
async function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

/**
 * Validate and parse a JSON pet import file.
 */
function validateJsonPet(data: unknown): { valid: boolean; pet?: ParsedJsonPet; error?: string } {
  if (typeof data !== 'object' || data === null) {
    return { valid: false, error: 'Invalid JSON format' };
  }

  const obj = data as Record<string, unknown>;

  // Check for v1 export format
  if (obj.type === 'viben-custom-pet' && obj.version === 1) {
    const petData = obj.pet as Record<string, unknown> | undefined;
    if (!petData || typeof petData !== 'object') {
      return { valid: false, error: 'Invalid pet data in export file' };
    }
    return validatePetObject(petData);
  }

  // Check for raw pet format
  if ('displayName' in obj || 'spritesheetDataUrl' in obj) {
    return validatePetObject(obj);
  }

  return { valid: false, error: 'Unrecognized pet export format' };
}

function validatePetObject(obj: Record<string, unknown>): { valid: boolean; pet?: ParsedJsonPet; error?: string } {
  const displayName = obj.displayName;
  const spritesheetDataUrl = obj.spritesheetDataUrl;

  if (typeof displayName !== 'string' || !displayName.trim()) {
    return { valid: false, error: 'Missing or invalid display name' };
  }

  if (typeof spritesheetDataUrl !== 'string' || !spritesheetDataUrl.startsWith('data:')) {
    return { valid: false, error: 'Missing or invalid spritesheet data' };
  }

  return {
    valid: true,
    pet: {
      displayName: displayName.trim(),
      description: typeof obj.description === 'string' ? obj.description.trim() : undefined,
      accent: typeof obj.accent === 'string' ? obj.accent : undefined,
      greeting: typeof obj.greeting === 'string' ? obj.greeting.trim() : undefined,
      spritesheetDataUrl,
    },
  };
}

export function PetImportDialog({ isOpen, onClose, onImport }: PetImportDialogProps) {
  const [importMode, setImportMode] = useState<ImportMode>('image');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // Image mode state
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageValidation, setImageValidation] = useState<ImageValidation | null>(null);

  // Form fields
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [accent, setAccent] = useState('#f5a623');
  const [greeting, setGreeting] = useState('');

  // JSON mode state
  const [jsonPet, setJsonPet] = useState<ParsedJsonPet | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setImportMode('image');
    setIsDragging(false);
    setUploadStatus('idle');
    setStatusMessage('');
    setImageDataUrl(null);
    setImageValidation(null);
    setDisplayName('');
    setDescription('');
    setAccent('#f5a623');
    setGreeting('');
    setJsonPet(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const processImageFile = useCallback(async (file: File) => {
    setUploadStatus('loading');
    setStatusMessage('Processing image...');

    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file (PNG, JPG, etc.)');
      }

      const dataUrl = await fileToDataUrl(file);
      const dimensions = await getImageDimensions(dataUrl);
      const validation = validateImageDimensions(dimensions.width, dimensions.height);

      setImageDataUrl(dataUrl);
      setImageValidation(validation);
      setUploadStatus('success');
      setStatusMessage(validation.message);

      // Auto-fill display name from filename if empty
      if (!displayName) {
        const nameFromFile = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
        setDisplayName(nameFromFile);
      }
    } catch (err) {
      setUploadStatus('error');
      setStatusMessage(err instanceof Error ? err.message : 'Failed to process image');
    }
  }, [displayName]);

  const processJsonFile = useCallback(async (file: File) => {
    setUploadStatus('loading');
    setStatusMessage('Parsing JSON file...');

    try {
      // Validate file type
      if (!file.type.includes('json') && !file.name.endsWith('.json')) {
        throw new Error('Please select a JSON file');
      }

      const text = await file.text();
      const data = JSON.parse(text);
      const result = validateJsonPet(data);

      if (!result.valid || !result.pet) {
        throw new Error(result.error || 'Invalid pet data');
      }

      setJsonPet(result.pet);
      setUploadStatus('success');
      setStatusMessage(`Successfully parsed "${result.pet.displayName}"`);
    } catch (err) {
      setUploadStatus('error');
      if (err instanceof SyntaxError) {
        setStatusMessage('Invalid JSON file format');
      } else {
        setStatusMessage(err instanceof Error ? err.message : 'Failed to parse JSON');
      }
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];

    if (file.type.includes('json') || file.name.endsWith('.json')) {
      setImportMode('json');
      processJsonFile(file);
    } else if (file.type.startsWith('image/')) {
      setImportMode('image');
      processImageFile(file);
    } else {
      setUploadStatus('error');
      setStatusMessage('Please drop an image file (PNG, JPG) or a JSON pet export file');
    }
  }, [processImageFile, processJsonFile]);

  const handleImageFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processImageFile(files[0]);
    }
  }, [processImageFile]);

  const handleJsonFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processJsonFile(files[0]);
    }
  }, [processJsonFile]);

  const handleBrowseClick = useCallback(() => {
    if (importMode === 'image') {
      fileInputRef.current?.click();
    } else {
      jsonInputRef.current?.click();
    }
  }, [importMode]);

  const handleImport = useCallback(() => {
    const now = Date.now();

    if (importMode === 'image' && imageDataUrl) {
      const pet: CustomPet = {
        id: generateId(),
        displayName: displayName.trim(),
        description: description.trim(),
        accent,
        greeting: greeting.trim() || `Hi! I'm ${displayName.trim()}!`,
        spritesheetDataUrl: imageDataUrl,
        createdAt: now,
        updatedAt: now,
      };
      onImport(pet);
      handleClose();
    } else if (importMode === 'json' && jsonPet) {
      const pet: CustomPet = {
        id: generateId(),
        displayName: jsonPet.displayName,
        description: jsonPet.description || '',
        accent: jsonPet.accent || '#f5a623',
        greeting: jsonPet.greeting || `Hi! I'm ${jsonPet.displayName}!`,
        spritesheetDataUrl: jsonPet.spritesheetDataUrl,
        createdAt: now,
        updatedAt: now,
      };
      onImport(pet);
      handleClose();
    }
  }, [importMode, imageDataUrl, displayName, description, accent, greeting, jsonPet, onImport, handleClose]);

  // Determine if import button should be enabled
  const canImport = importMode === 'image'
    ? imageDataUrl !== null && displayName.trim() !== ''
    : jsonPet !== null;

  if (!isOpen) return null;

  return (
    <div className="pet-import-overlay" onClick={handleClose}>
      <div className="pet-import-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="dialog-header">
          <h2>Import New Pet</h2>
          <button className="close-btn" onClick={handleClose} aria-label="Close">
            &times;
          </button>
        </header>

        <div className="dialog-content">
          {/* Import Mode Tabs */}
          <div className="import-mode-tabs">
            <button
              className={`tab-btn ${importMode === 'image' ? 'active' : ''}`}
              onClick={() => {
                setImportMode('image');
                setUploadStatus('idle');
                setStatusMessage('');
                setJsonPet(null);
              }}
            >
              From Image
            </button>
            <button
              className={`tab-btn ${importMode === 'json' ? 'active' : ''}`}
              onClick={() => {
                setImportMode('json');
                setUploadStatus('idle');
                setStatusMessage('');
                setImageDataUrl(null);
                setImageValidation(null);
              }}
            >
              From JSON File
            </button>
          </div>

          {/* Drop Zone */}
          <div
            className={`drop-zone ${isDragging ? 'dragging' : ''} ${uploadStatus === 'success' ? 'success' : ''} ${uploadStatus === 'error' ? 'error' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={handleBrowseClick}
          >
            {uploadStatus === 'loading' ? (
              <div className="drop-zone-loading">
                <span className="loading-spinner"></span>
                <span>{statusMessage}</span>
              </div>
            ) : uploadStatus === 'success' && imageDataUrl ? (
              <div className="drop-zone-preview">
                <img src={imageDataUrl} alt="Spritesheet preview" className="image-preview" />
                <p className="preview-hint">Click to change image</p>
              </div>
            ) : uploadStatus === 'success' && jsonPet ? (
              <div className="drop-zone-json-preview">
                <div className="json-preview-icon">JSON</div>
                <p className="json-preview-name">{jsonPet.displayName}</p>
                <p className="preview-hint">Click to change file</p>
              </div>
            ) : (
              <>
                <div className="drop-zone-icon">
                  {importMode === 'image' ? '+' : '{ }'}
                </div>
                <p className="drop-zone-text">
                  {importMode === 'image'
                    ? 'Drop spritesheet image here'
                    : 'Drop pet JSON file here'}
                </p>
                <p className="drop-zone-hint">or click to browse</p>
              </>
            )}
          </div>

          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageFileSelect}
            style={{ display: 'none' }}
          />
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleJsonFileSelect}
            style={{ display: 'none' }}
          />

          {/* Status Message */}
          {statusMessage && uploadStatus !== 'loading' && (
            <div className={`status-message ${uploadStatus}`}>
              {uploadStatus === 'success' && imageValidation && !imageValidation.valid && (
                <span className="warning-icon">!</span>
              )}
              {statusMessage}
            </div>
          )}

          {/* Image Mode: Form Fields */}
          {importMode === 'image' && imageDataUrl && (
            <div className="form-fields">
              <div className="form-group">
                <label htmlFor="pet-id">ID (auto-generated)</label>
                <input
                  id="pet-id"
                  type="text"
                  value={generateId().substring(0, 8) + '...'}
                  readOnly
                  className="readonly-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="pet-display-name">Display Name *</label>
                <input
                  id="pet-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter pet name"
                  autoComplete="off"
                />
              </div>

              <div className="form-group">
                <label htmlFor="pet-description">Description</label>
                <input
                  id="pet-description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  autoComplete="off"
                />
              </div>

              <div className="form-group">
                <label htmlFor="pet-accent">Accent Color</label>
                <div className="color-input-group">
                  <input
                    id="pet-accent"
                    type="color"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                    className="color-picker"
                  />
                  <input
                    type="text"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                    className="color-text"
                    placeholder="#f5a623"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="pet-greeting">Greeting Message</label>
                <input
                  id="pet-greeting"
                  type="text"
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  placeholder={`Hi! I'm ${displayName || 'your pet'}!`}
                  autoComplete="off"
                />
              </div>

              {/* Atlas Info */}
              <div className="atlas-info">
                <h4>Atlas Configuration</h4>
                <p>Using standard 8x9 grid ({CODEX_ATLAS.cols} columns, {CODEX_ATLAS.rows} rows)</p>
                <p>Cell size: {CODEX_ATLAS.cellWidth}x{CODEX_ATLAS.cellHeight}px</p>
                <p>Expected image size: {CODEX_ATLAS.width}x{CODEX_ATLAS.height}px</p>
              </div>
            </div>
          )}

          {/* JSON Mode: Preview */}
          {importMode === 'json' && jsonPet && (
            <div className="json-preview-details">
              <h4>Pet Details</h4>
              <dl className="preview-list">
                <dt>Name:</dt>
                <dd>{jsonPet.displayName}</dd>
                {jsonPet.description && (
                  <>
                    <dt>Description:</dt>
                    <dd>{jsonPet.description}</dd>
                  </>
                )}
                {jsonPet.accent && (
                  <>
                    <dt>Accent:</dt>
                    <dd>
                      <span
                        className="color-swatch"
                        style={{ backgroundColor: jsonPet.accent }}
                      />
                      {jsonPet.accent}
                    </dd>
                  </>
                )}
                {jsonPet.greeting && (
                  <>
                    <dt>Greeting:</dt>
                    <dd>{jsonPet.greeting}</dd>
                  </>
                )}
              </dl>
            </div>
          )}
        </div>

        <footer className="dialog-footer">
          <button className="cancel-btn" onClick={handleClose}>
            Cancel
          </button>
          <button
            className="import-btn"
            onClick={handleImport}
            disabled={!canImport}
          >
            Import Pet
          </button>
        </footer>
      </div>
    </div>
  );
}
