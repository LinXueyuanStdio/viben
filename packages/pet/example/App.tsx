import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PetContainer,
  PetSprite,
  type PetConfig,
  type PetPosition,
  type PetInteraction,
  type PetAnimationDef,
  PET_DEFAULTS,
  STANDARD_ANIMATIONS,
} from '@viben/pet';

interface RawPetJson {
  id: string;
  displayName: string;
  description: string;
  spritesheetPath: string;
}

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

export function App() {
  const [pet, setPet] = useState<PetConfig | null>(null);
  const [position, setPosition] = useState<PetPosition>(PET_DEFAULTS.position);
  const [showBubble, setShowBubble] = useState(true);
  const [petSize, setPetSize] = useState(96);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [forcedRowId, setForcedRowId] = useState<string | null>(null);
  const [currentInteraction, setCurrentInteraction] = useState<PetInteraction>('idle');
  const [currentPetId, setCurrentPetId] = useState('tux');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [animSpeed, setAnimSpeed] = useState(1.0);
  const [petPreviews, setPetPreviews] = useState<Record<string, PetConfig | null>>({});

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

  useEffect(() => {
    loadPetFromPublic(currentPetId)
      .then(setPet)
      .catch((err) => {
        console.error('Failed to load pet:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [currentPetId]);

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

  const handleSelectPet = useCallback((petId: string) => {
    setCurrentPetId(petId);
    setLoading(true);
    setError(null);
    setSidebarOpen(false);
  }, []);

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

  return (
    <div className={`example-app ${theme}`}>
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
        <h3>Select Pet</h3>
        <div className="pet-grid">
          {AVAILABLE_PETS.map((petId) => (
            <button
              key={petId}
              className={`pet-card ${petId === currentPetId ? 'active' : ''}`}
              onClick={() => handleSelectPet(petId)}
            >
              <div className="pet-card-preview">
                {petPreviews[petId] ? (
                  <PetSprite pet={petPreviews[petId]!} rowId="idle" size={48} />
                ) : (
                  <div className="pet-card-placeholder">{petId[0].toUpperCase()}</div>
                )}
              </div>
              <span className="pet-card-name">{petId}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Debug Panel */}
      <div className="debug-panel">
        <h3>Debug Info</h3>

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
      </div>

      {/* Instructions */}
      <div className="instructions">
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

      {/* Pet Container */}
      <PetContainer
        pet={adjustedPet}
        position={position}
        onPositionChange={setPosition}
        onTap={handleTap}
        showBubble={showBubble}
        size={petSize}
        forcedRowId={forcedRowId}
        onInteractionChange={setCurrentInteraction}
      />
    </div>
  );
}
