import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  PetContainer,
  PetSprite,
  type PetConfig,
  type PetPosition,
  type PetInteraction,
  type PetAnimationDef,
  PET_DEFAULTS,
  STANDARD_ANIMATIONS,
  getFrameAtTime,
} from '@viben/pet';
import { PetManagerPanel } from './src/components/PetManagerPanel';
import { PetEditorModal } from './src/components/PetEditorModal';
import { PetImportDialog } from './src/components/PetImportDialog';
import {
  getAllCustomPets,
  saveCustomPet,
  deleteCustomPet,
  downloadCustomPet,
  type CustomPet,
} from './src/lib/petStorage';
import './src/components/PetManagerPanel.css';
import './src/components/PetEditorModal.css';
import './src/components/PetImportDialog.css';

interface RawPetJson {
  id: string;
  displayName: string;
  description: string;
  spritesheetPath: string;
}

// ============================================================
// localStorage Persistence
// ============================================================

const STORAGE_KEY = 'viben-pet-example-prefs';
const SAVE_DEBOUNCE_MS = 500;

interface UserPreferences {
  petId: string;
  petSize: number;
  animSpeed: number;
  theme: 'dark' | 'light';
  sidebarOpen: boolean;
}

const DEFAULT_PREFS: UserPreferences = {
  petId: 'tux',
  petSize: 96,
  animSpeed: 1.0,
  theme: 'dark',
  sidebarOpen: false,
};

function loadPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_PREFS;
    const parsed = JSON.parse(stored) as Partial<UserPreferences>;
    // Merge with defaults to handle missing fields gracefully
    return {
      petId: typeof parsed.petId === 'string' ? parsed.petId : DEFAULT_PREFS.petId,
      petSize: typeof parsed.petSize === 'number' ? parsed.petSize : DEFAULT_PREFS.petSize,
      animSpeed: typeof parsed.animSpeed === 'number' ? parsed.animSpeed : DEFAULT_PREFS.animSpeed,
      theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : DEFAULT_PREFS.theme,
      sidebarOpen: typeof parsed.sidebarOpen === 'boolean' ? parsed.sidebarOpen : DEFAULT_PREFS.sidebarOpen,
    };
  } catch {
    // JSON parse error or other issue - return defaults
    return DEFAULT_PREFS;
  }
}

function savePreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage might be full or disabled - silently ignore
  }
}

function clearPreferences(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently ignore
  }
}

// Load saved preferences once at module load
const savedPrefs = loadPreferences();

const AVAILABLE_PETS = [
  'tux',
  'clippit',
  'dario',
  'dentist',
  'nyako-shigure',
  'slavik',
  'yelling-dario',
  'yorha-sit-2b',
];

async function loadPetFromPublic(petId: string): Promise<PetConfig> {
  const configUrl = `/pets/${petId}/pet.json`;
  const response = await fetch(configUrl);
  if (!response.ok) {
    throw new Error(`Failed to load pet: ${response.status}`);
  }

  const raw = (await response.json()) as RawPetJson;
  const spritesheetUrl = `/pets/${petId}/${raw.spritesheetPath}`;

  return {
    id: raw.id,
    name: raw.displayName,
    description: raw.description,
    accent: '#f5a623',
    greeting: `Hi! I'm ${raw.displayName}. Try dragging me around!`,
    spritesheet: spritesheetUrl,
    atlas: {
      cols: 8,
      rows: 9,
      cellWidth: 192,
      cellHeight: 208,
      animations: STANDARD_ANIMATIONS,
    },
    ambient: PET_DEFAULTS.ambient,
    idleTimeoutMs: PET_DEFAULTS.idleTimeoutMs,
  };
}

const INTERACTION_COLORS: Record<PetInteraction, string> = {
  idle: '#6b7280',
  hover: '#3b82f6',
  'drag-right': '#22c55e',
  'drag-left': '#22c55e',
  'drag-up': '#a855f7',
  'drag-down': '#a855f7',
  waiting: '#f59e0b',
};

// Parse URL parameters for initial state (URL params override localStorage)
function getInitialStateFromURL() {
  const params = new URLSearchParams(window.location.search);
  // URL params take precedence over localStorage, which takes precedence over defaults
  return {
    pet: params.get('pet') ?? savedPrefs.petId,
    size: params.has('size') ? Number(params.get('size')) : savedPrefs.petSize,
    speed: params.has('speed') ? Number(params.get('speed')) : savedPrefs.animSpeed,
    anim: params.get('anim'),
    theme: params.has('theme')
      ? ((params.get('theme') === 'light' ? 'light' : 'dark') as 'dark' | 'light')
      : savedPrefs.theme,
    sidebarOpen: savedPrefs.sidebarOpen,
  };
}

const initialURLState = getInitialStateFromURL();

// Boundary edge types for visual feedback
type BoundaryEdge = 'top' | 'right' | 'bottom' | 'left' | null;

/**
 * Clamp position to keep pet fully visible within viewport.
 * Position uses right/bottom coordinates.
 */
function clampPosition(
  pos: PetPosition,
  size: number
): { position: PetPosition; hitEdge: BoundaryEdge } {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let hitEdge: BoundaryEdge = null;
  let clampedRight = pos.right;
  let clampedBottom = pos.bottom;

  // right: distance from right edge of viewport to right edge of pet
  // left edge of pet is at: viewportWidth - right - size
  // Clamp so pet stays within viewport

  // Min right = 0 (pet at right edge of viewport)
  if (clampedRight < 0) {
    clampedRight = 0;
    hitEdge = 'right';
  }

  // Max right = viewportWidth - size (pet at left edge of viewport)
  if (clampedRight > viewportWidth - size) {
    clampedRight = viewportWidth - size;
    hitEdge = 'left';
  }

  // Min bottom = 0 (pet at bottom edge of viewport)
  if (clampedBottom < 0) {
    clampedBottom = 0;
    hitEdge = 'bottom';
  }

  // Max bottom = viewportHeight - size (pet at top edge of viewport)
  if (clampedBottom > viewportHeight - size) {
    clampedBottom = viewportHeight - size;
    hitEdge = 'top';
  }

  return {
    position: { right: clampedRight, bottom: clampedBottom },
    hitEdge,
  };
}

export function App() {
  const [pet, setPet] = useState<PetConfig | null>(null);
  const [position, setPosition] = useState<PetPosition>(PET_DEFAULTS.position);
  const [showBubble, setShowBubble] = useState(true);
  const [petSize, setPetSize] = useState(initialURLState.size);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(initialURLState.sidebarOpen);
  const [forcedRowId, setForcedRowId] = useState<string | null>(initialURLState.anim);
  const [currentInteraction, setCurrentInteraction] = useState<PetInteraction>('idle');
  const [currentPetId, setCurrentPetId] = useState(initialURLState.pet);
  const [theme, setTheme] = useState<'dark' | 'light'>(initialURLState.theme);
  const [animSpeed, setAnimSpeed] = useState(initialURLState.speed);
  const [petPreviews, setPetPreviews] = useState<Record<string, PetConfig | null>>({});
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [constrainToViewport, setConstrainToViewport] = useState(true);
  const [boundaryHitEdge, setBoundaryHitEdge] = useState<BoundaryEdge>(null);
  const [debugPanelOpen, setDebugPanelOpen] = useState(true);
  const [instructionsOpen, setInstructionsOpen] = useState(true);

  // Custom pets state
  const [customPets, setCustomPets] = useState<CustomPet[]>([]);
  const [isLoadingCustomPets, setIsLoadingCustomPets] = useState(true);

  // Check if a pet ID is a custom pet (not in built-in list)
  const isCustomPet = useCallback((petId: string) => {
    return !AVAILABLE_PETS.includes(petId);
  }, []);

  // Editor modal state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPet, setEditingPet] = useState<PetConfig | null>(null);
  const [editingCustomPetId, setEditingCustomPetId] = useState<string | null>(null);

  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Frame indicator state for animation debugging
  const [isPaused, setIsPaused] = useState(false);
  const [displayFrame, setDisplayFrame] = useState(0);
  const animationStartTimeRef = useRef<number>(performance.now());

  // Render counter for performance metrics
  const renderCount = useRef(0);
  renderCount.current++;

  // Create modified pet config with adjusted fps based on speed multiplier
  const adjustedPet = pet ? {
    ...pet,
    atlas: {
      ...pet.atlas,
      animations: pet.atlas.animations.map(anim => ({
        ...anim,
        fps: Math.round(anim.fps * animSpeed),
      })),
    },
  } : null;

  // Get current animation info based on forcedRowId or default to 'idle'
  const currentAnimation: PetAnimationDef =
    STANDARD_ANIMATIONS.find((anim) => anim.id === (forcedRowId ?? 'idle')) ??
    STANDARD_ANIMATIONS[0];

  // Get adjusted animation with speed multiplier applied
  const adjustedAnimation: PetAnimationDef = {
    ...currentAnimation,
    fps: Math.round(currentAnimation.fps * animSpeed),
  };

  // Reset animation start time when animation changes
  useEffect(() => {
    animationStartTimeRef.current = performance.now();
    setDisplayFrame(0);
  }, [currentAnimation.id, animSpeed]);

  // Track current frame using requestAnimationFrame
  useEffect(() => {
    if (isPaused) return;

    let rafId: number;
    const updateFrame = () => {
      const elapsed = performance.now() - animationStartTimeRef.current;
      const frame = getFrameAtTime(adjustedAnimation, elapsed);
      setDisplayFrame(frame);
      rafId = requestAnimationFrame(updateFrame);
    };
    rafId = requestAnimationFrame(updateFrame);
    return () => cancelAnimationFrame(rafId);
  }, [isPaused, adjustedAnimation]);

  // Handle frame stepping when paused
  const handleStepFrame = useCallback((direction: 'prev' | 'next') => {
    if (!isPaused) return;
    setDisplayFrame((f) => {
      const totalFrames = currentAnimation.frames;
      if (direction === 'next') {
        return (f + 1) % totalFrames;
      } else {
        return (f - 1 + totalFrames) % totalFrames;
      }
    });
  }, [isPaused, currentAnimation.frames]);

  // Toggle pause and sync animation start time
  const handleTogglePause = useCallback(() => {
    setIsPaused((paused) => {
      if (paused) {
        // Resuming: adjust start time so current frame continues from where we left off
        const frameDurationMs = 1000 / adjustedAnimation.fps;
        animationStartTimeRef.current = performance.now() - (displayFrame * frameDurationMs);
      }
      return !paused;
    });
  }, [adjustedAnimation.fps, displayFrame]);

  // Load pet from public directory (only for built-in pets)
  useEffect(() => {
    // Skip loading from public if it's a custom pet (already loaded in handleSelectPet)
    if (isCustomPet(currentPetId)) return;

    loadPetFromPublic(currentPetId)
      .then(setPet)
      .catch((err) => {
        console.error('Failed to load pet:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [currentPetId, isCustomPet]);

  // Load all pet previews on mount
  useEffect(() => {
    AVAILABLE_PETS.forEach(async (petId) => {
      try {
        const config = await loadPetFromPublic(petId);
        setPetPreviews(prev => ({ ...prev, [petId]: config }));
      } catch {
        setPetPreviews(prev => ({ ...prev, [petId]: null }));
      }
    });
  }, []);

  // Load custom pets on mount, and validate currentPetId
  useEffect(() => {
    setIsLoadingCustomPets(true);
    getAllCustomPets()
      .then((pets) => {
        setCustomPets(pets);

        // If current pet ID is not a built-in pet and not in custom pets, fallback to default
        if (!AVAILABLE_PETS.includes(currentPetId)) {
          const found = pets.find(p => p.id === currentPetId);
          if (!found) {
            console.warn(`Pet "${currentPetId}" not found, falling back to default`);
            setCurrentPetId('tux');
          }
        }
      })
      .catch((err) => console.error('Failed to load custom pets:', err))
      .finally(() => setIsLoadingCustomPets(false));
  }, []);

  // Debounced save to localStorage when settings change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      savePreferences({
        petId: currentPetId,
        petSize,
        animSpeed,
        theme,
        sidebarOpen,
      });
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [currentPetId, petSize, animSpeed, theme, sidebarOpen]);

  // Sync state to URL parameters
  useEffect(() => {
    const params = new URLSearchParams();

    // Only add non-default values to keep URL clean
    if (currentPetId !== 'tux') {
      params.set('pet', currentPetId);
    }
    if (petSize !== 96) {
      params.set('size', String(petSize));
    }
    if (animSpeed !== 1.0) {
      params.set('speed', String(animSpeed));
    }
    if (forcedRowId !== null) {
      params.set('anim', forcedRowId);
    }
    if (theme !== 'dark') {
      params.set('theme', theme);
    }

    const queryString = params.toString();
    const newUrl = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;

    window.history.replaceState(null, '', newUrl);
  }, [currentPetId, petSize, animSpeed, forcedRowId, theme]);

  // Build shareable URL with current state
  const shareableUrl = useMemo(() => {
    const params = new URLSearchParams();

    // Only add non-default values to keep URL clean
    if (currentPetId !== 'tux') {
      params.set('pet', currentPetId);
    }
    if (petSize !== 96) {
      params.set('size', String(petSize));
    }
    if (animSpeed !== 1.0) {
      params.set('speed', String(animSpeed));
    }
    if (forcedRowId !== null) {
      params.set('anim', forcedRowId);
    }
    if (theme !== 'dark') {
      params.set('theme', theme);
    }

    const queryString = params.toString();
    return queryString
      ? `${window.location.origin}${window.location.pathname}?${queryString}`
      : `${window.location.origin}${window.location.pathname}`;
  }, [currentPetId, petSize, animSpeed, forcedRowId, theme]);

  // Copy link handler with visual feedback
  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(shareableUrl).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    }).catch((err) => {
      console.error('Failed to copy link:', err);
    });
  }, [shareableUrl]);

  // Reset settings handler
  const handleResetSettings = useCallback(() => {
    clearPreferences();
    setCurrentPetId(DEFAULT_PREFS.petId);
    setPetSize(DEFAULT_PREFS.petSize);
    setAnimSpeed(DEFAULT_PREFS.animSpeed);
    setTheme(DEFAULT_PREFS.theme);
    setSidebarOpen(DEFAULT_PREFS.sidebarOpen);
    setLoading(true);
    setError(null);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          setShowBubble((prev) => !prev);
          break;
        case 'r':
        case 'R':
          setPosition(PET_DEFAULTS.position);
          break;
        case 'Escape':
          setSidebarOpen(false);
          break;
        case 't':
        case 'T':
          setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
          break;
        case '0':
          setForcedRowId(null);
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9': {
          const index = parseInt(e.key, 10) - 1;
          if (index < STANDARD_ANIMATIONS.length) {
            setForcedRowId(STANDARD_ANIMATIONS[index].id);
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleTap = useCallback(() => {
    setShowBubble((prev) => !prev);
  }, []);

  const handleReset = useCallback(() => {
    setPosition(PET_DEFAULTS.position);
  }, []);

  const handleSelectPet = useCallback((petId: string, isCustom: boolean = false) => {
    setCurrentPetId(petId);
    setLoading(true);
    setError(null);
    setSidebarOpen(false);

    // If custom pet, load directly from customPets state
    if (isCustom || !AVAILABLE_PETS.includes(petId)) {
      const customPet = customPets.find(p => p.id === petId);
      if (customPet) {
        const config: PetConfig = {
          id: customPet.id,
          name: customPet.displayName,
          description: customPet.description,
          accent: customPet.accent,
          greeting: customPet.greeting,
          spritesheet: customPet.spritesheetDataUrl,
          atlas: {
            cols: 8,
            rows: 9,
            cellWidth: 192,
            cellHeight: 208,
            animations: STANDARD_ANIMATIONS,
          },
          ambient: PET_DEFAULTS.ambient,
          idleTimeoutMs: PET_DEFAULTS.idleTimeoutMs,
        };
        setPet(config);
        setLoading(false);
      }
    }
    // Built-in pets are loaded via useEffect
  }, [customPets]);

  // Pet manager handlers
  const handleEditPet = useCallback((petId: string) => {
    const customPet = customPets.find(p => p.id === petId);
    if (customPet) {
      const config: PetConfig = {
        id: customPet.id,
        name: customPet.displayName,
        description: customPet.description,
        accent: customPet.accent,
        greeting: customPet.greeting,
        spritesheet: customPet.spritesheetDataUrl,
        atlas: {
          cols: 8,
          rows: 9,
          cellWidth: 192,
          cellHeight: 208,
          animations: STANDARD_ANIMATIONS,
        },
        ambient: PET_DEFAULTS.ambient,
        idleTimeoutMs: PET_DEFAULTS.idleTimeoutMs,
      };
      setEditingPet(config);
      setEditingCustomPetId(petId);
      setEditorOpen(true);
    }
  }, [customPets]);

  const handleDeletePet = useCallback(async (petId: string) => {
    try {
      await deleteCustomPet(petId);
      setCustomPets(prev => prev.filter(p => p.id !== petId));
      if (currentPetId === petId && isCustomPet(currentPetId)) {
        setCurrentPetId('tux');
        setLoading(true);
      }
    } catch (err) {
      console.error('Failed to delete pet:', err);
    }
  }, [currentPetId, isCustomPet]);

  const handleAddPet = useCallback(() => {
    setImportDialogOpen(true);
  }, []);

  const handleExportPet = useCallback(async (petId: string) => {
    try {
      await downloadCustomPet(petId);
    } catch (err) {
      console.error('Failed to export pet:', err);
    }
  }, []);

  const handleImportPet = useCallback(async (newPet: CustomPet) => {
    try {
      await saveCustomPet(newPet);
      setCustomPets(prev => [newPet, ...prev]);
      setImportDialogOpen(false);
    } catch (err) {
      console.error('Failed to import pet:', err);
    }
  }, []);

  const handleSavePet = useCallback(async (updatedConfig: PetConfig) => {
    if (!editingCustomPetId) return;

    const customPet = customPets.find(p => p.id === editingCustomPetId);
    if (!customPet) return;

    const updatedPet: CustomPet = {
      ...customPet,
      displayName: updatedConfig.name,
      description: updatedConfig.description,
      accent: updatedConfig.accent,
      greeting: updatedConfig.greeting,
      updatedAt: Date.now(),
    };

    try {
      await saveCustomPet(updatedPet);
      setCustomPets(prev => prev.map(p => p.id === editingCustomPetId ? updatedPet : p));
      setEditorOpen(false);
      setEditingPet(null);
      setEditingCustomPetId(null);

      // Update current pet if it's the one being edited
      if (currentPetId === editingCustomPetId && isCustomPet(currentPetId)) {
        setPet({
          ...updatedConfig,
          spritesheet: customPet.spritesheetDataUrl,
        });
      }
    } catch (err) {
      console.error('Failed to save pet:', err);
    }
  }, [editingCustomPetId, customPets, currentPetId, isCustomPet]);

  // Convert built-in pets to PetConfig array for manager
  const builtinPetConfigs = useMemo(() => {
    return AVAILABLE_PETS
      .map(id => petPreviews[id])
      .filter((p): p is PetConfig => p !== null && p !== undefined);
  }, [petPreviews]);

  // Position change handler with optional boundary clamping
  const handlePositionChange = useCallback((newPos: PetPosition) => {
    if (constrainToViewport) {
      const { position: clampedPos, hitEdge } = clampPosition(newPos, petSize);
      setPosition(clampedPos);

      // Show visual feedback when hitting a boundary
      if (hitEdge) {
        setBoundaryHitEdge(hitEdge);
        // Clear the feedback after animation completes
        setTimeout(() => setBoundaryHitEdge(null), 300);
      }
    } else {
      setPosition(newPos);
    }
  }, [constrainToViewport, petSize]);

  // Handle window resize - reposition pet if it ends up outside viewport
  useEffect(() => {
    const handleResize = () => {
      if (constrainToViewport) {
        const { position: clampedPos, hitEdge } = clampPosition(position, petSize);
        if (clampedPos.right !== position.right || clampedPos.bottom !== position.bottom) {
          setPosition(clampedPos);
          if (hitEdge) {
            setBoundaryHitEdge(hitEdge);
            setTimeout(() => setBoundaryHitEdge(null), 300);
          }
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [constrainToViewport, position, petSize]);

  if (loading) {
    return (
      <div className="example-app">
        <div className="loading-message">Loading demo pet...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="example-app">
        <div className="error-message">Error: {error}</div>
        <button
          className="retry-button"
          onClick={() => {
            setLoading(true);
            setError(null);
            loadPetFromPublic(currentPetId)
              .then(setPet)
              .catch((err) => setError(err.message))
              .finally(() => setLoading(false));
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Build boundary hit class for visual feedback
  const boundaryHitClass = boundaryHitEdge ? `boundary-hit boundary-hit-${boundaryHitEdge}` : '';

  return (
    <div className={`example-app ${theme} ${boundaryHitClass}`}>
      <header className="example-header">
        <h1>Viben Pet Development</h1>
        <p>Interactive testing environment for @viben/pet components</p>
      </header>

      {/* Theme Toggle */}
      <button
        className="theme-toggle"
        onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      >
        {theme === 'dark' ? 'Light' : 'Dark'}
      </button>

      {/* Sidebar Toggle */}
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? 'X' : '='} Pets
      </button>

      {/* Pet Selection Sidebar */}
      <div className={`pet-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <h3>Pet Manager</h3>
        <PetManagerPanel
          builtinPets={builtinPetConfigs}
          customPets={customPets}
          selectedPetId={isCustomPet(currentPetId) ? `custom:${currentPetId}` : currentPetId}
          onSelectPet={handleSelectPet}
          onEditPet={handleEditPet}
          onDeletePet={handleDeletePet}
          onAddPet={handleAddPet}
          onExportPet={handleExportPet}
          isLoadingCustomPets={isLoadingCustomPets}
        />
      </div>

      {/* Pet Editor Modal */}
      <PetEditorModal
        pet={editingPet}
        isOpen={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditingPet(null);
          setEditingCustomPetId(null);
        }}
        onSave={handleSavePet}
      />

      {/* Pet Import Dialog */}
      <PetImportDialog
        isOpen={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImport={handleImportPet}
      />

      {/* Debug Panel */}
      <div className={`debug-panel ${debugPanelOpen ? 'open' : 'collapsed'}`}>
        <button
          className="panel-toggle"
          onClick={() => setDebugPanelOpen(!debugPanelOpen)}
          title={debugPanelOpen ? 'Collapse debug panel' : 'Expand debug panel'}
        >
          <span className="panel-toggle-icon">{debugPanelOpen ? '▼' : '▶'}</span>
          <span>Debug Info</span>
        </button>

        {debugPanelOpen && <>
        {/* Interaction State Badge */}
        <div className="state-section">
          <span className="state-label">Interaction:</span>
          <span
            className="state-badge"
            style={{ backgroundColor: INTERACTION_COLORS[currentInteraction] }}
          >
            {currentInteraction}
          </span>
        </div>

        {/* Performance Metrics */}
        <div className="metrics-section">
          <div className="metric-row">
            <span className="metric-label">Animation:</span>
            <span className="metric-value">{currentAnimation.id}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">FPS:</span>
            <span className="metric-value">{currentAnimation.fps}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Frames:</span>
            <span className="metric-value">{currentAnimation.frames}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Renders:</span>
            <span className="metric-value">{renderCount.current}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Frame:</span>
            <span className="metric-value">
              {displayFrame + 1}/{currentAnimation.frames}
              {isPaused && <span className="paused-badge"> (Paused)</span>}
            </span>
          </div>
        </div>

        {/* Frame Stepping Controls */}
        <div className="frame-controls">
          <label>Frame Control:</label>
          <div className="frame-buttons">
            <button
              className={`frame-btn ${isPaused ? 'active' : ''}`}
              onClick={handleTogglePause}
              title={isPaused ? 'Resume animation' : 'Pause animation'}
            >
              {isPaused ? 'Play' : 'Pause'}
            </button>
            <button
              className="frame-btn"
              onClick={() => handleStepFrame('prev')}
              disabled={!isPaused}
              title="Previous frame"
            >
              &#9664;
            </button>
            <button
              className="frame-btn"
              onClick={() => handleStepFrame('next')}
              disabled={!isPaused}
              title="Next frame"
            >
              &#9654;
            </button>
          </div>
        </div>

        <pre>
          {JSON.stringify(
            {
              pet: pet?.id ?? null,
              position,
              showBubble,
              petSize,
              forcedRowId,
            },
            null,
            2
          )}
        </pre>

        {/* Size Slider */}
        <div className="debug-slider">
          <label htmlFor="pet-size-slider">
            Size: {petSize}px
          </label>
          <input
            id="pet-size-slider"
            type="range"
            min={48}
            max={192}
            value={petSize}
            onChange={(e) => setPetSize(Number(e.target.value))}
          />
        </div>

        {/* Speed Slider */}
        <div className="debug-slider">
          <label htmlFor="anim-speed-slider">
            Speed: {animSpeed.toFixed(1)}x
          </label>
          <input
            id="anim-speed-slider"
            type="range"
            min={0.5}
            max={2.0}
            step={0.1}
            value={animSpeed}
            onChange={(e) => setAnimSpeed(Number(e.target.value))}
          />
        </div>

        {/* Animation Row Selector */}
        <div className="animation-selector">
          <label>Animation:</label>
          <div className="animation-buttons">
            <button
              className={`anim-btn ${forcedRowId === null ? 'active' : ''}`}
              onClick={() => setForcedRowId(null)}
            >
              Auto
            </button>
            {STANDARD_ANIMATIONS.map((anim) => (
              <button
                key={anim.id}
                className={`anim-btn ${forcedRowId === anim.id ? 'active' : ''}`}
                onClick={() => setForcedRowId(anim.id)}
                title={`Row ${anim.row}: ${anim.frames} frames @ ${anim.fps}fps`}
              >
                {anim.id.replace('running-', 'run-')}
              </button>
            ))}
          </div>
        </div>

        {/* Viewport Constraint Toggle */}
        <div className="debug-checkbox">
          <label htmlFor="constrain-viewport">
            <input
              id="constrain-viewport"
              type="checkbox"
              checked={constrainToViewport}
              onChange={(e) => setConstrainToViewport(e.target.checked)}
            />
            Constrain to viewport
          </label>
        </div>

        {/* Control Buttons */}
        <div className="debug-controls">
          <button onClick={handleReset}>Reset Position</button>
          <button onClick={() => setPet(pet ? null : undefined as any)}>
            {pet ? 'Hide Pet' : 'Show Pet'}
          </button>
          <button onClick={() => setShowBubble((p) => !p)}>
            Toggle Bubble
          </button>
        </div>

        {/* Copy Link & Reset Settings */}
        <div className="debug-controls">
          <button
            onClick={handleCopyLink}
            className={copyFeedback ? 'copy-success' : ''}
            title="Copy shareable URL with current settings"
          >
            {copyFeedback ? 'Copied!' : 'Copy Link'}
          </button>
          <button
            onClick={handleResetSettings}
            title="Clear all saved preferences and reset to defaults"
          >
            Reset Settings
          </button>
        </div>

        {/* Position Presets */}
        <div className="position-presets">
          <label>Position Presets:</label>
          <div className="preset-buttons">
            <button
              className="preset-btn"
              onClick={() => setPosition({
                right: window.innerWidth - petSize - 24,
                bottom: window.innerHeight - petSize - 24,
              })}
              title="Top Left"
            >
              TL
            </button>
            <button
              className="preset-btn"
              onClick={() => setPosition({
                right: 24,
                bottom: window.innerHeight - petSize - 24,
              })}
              title="Top Right"
            >
              TR
            </button>
            <button
              className="preset-btn"
              onClick={() => setPosition({
                right: (window.innerWidth - petSize) / 2,
                bottom: (window.innerHeight - petSize) / 2,
              })}
              title="Center"
            >
              Center
            </button>
            <button
              className="preset-btn"
              onClick={() => setPosition({
                right: window.innerWidth - petSize - 24,
                bottom: 24,
              })}
              title="Bottom Left"
            >
              BL
            </button>
            <button
              className="preset-btn"
              onClick={() => setPosition({
                right: 24,
                bottom: 24,
              })}
              title="Bottom Right"
            >
              BR
            </button>
          </div>
        </div>
        </>}
      </div>

      {/* Instructions */}
      <div className={`instructions ${instructionsOpen ? 'open' : 'collapsed'}`}>
        <button
          className="panel-toggle"
          onClick={() => setInstructionsOpen(!instructionsOpen)}
          title={instructionsOpen ? 'Collapse instructions' : 'Expand instructions'}
        >
          <span className="panel-toggle-icon">{instructionsOpen ? '▼' : '▶'}</span>
          <span>Help</span>
        </button>

        {instructionsOpen && <>
        <div className="instructions-content">
          <strong>Interactions:</strong>
          Click to toggle bubble<br />
          Drag to move<br />
          Hover to wave<br />
          Wait 45s for idle animation
          <hr style={{ margin: '8px 0', borderColor: 'rgba(255,255,255,0.2)' }} />
          <strong>Keyboard:</strong>
          <span className="kbd">Space</span> bubble |{' '}
          <span className="kbd">R</span> reset |{' '}
          <span className="kbd">T</span> theme |{' '}
          <span className="kbd">Esc</span> close sidebar |{' '}
          <span className="kbd">0</span> auto |{' '}
          <span className="kbd">1-9</span> animations
        </div>
        </>}
      </div>

      {/* Pet Container */}
      <PetContainer
        pet={adjustedPet}
        position={position}
        onPositionChange={handlePositionChange}
        onTap={handleTap}
        showBubble={showBubble}
        size={petSize}
        forcedRowId={forcedRowId}
        onInteractionChange={setCurrentInteraction}
      />
    </div>
  );
}
