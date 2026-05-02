import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { Stage, Layer, Rect, Ellipse, Arrow, Line, Text } from 'react-konva';
import './screenshot-overlay.css';

/**
 * Screenshot Overlay Page — Single-phase workflow:
 * 1. User draws region on full-screen screenshot
 * 2. Annotation toolbar appears immediately below the selection
 * 3. User can annotate, then confirm to export
 */

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Tool = 'rect' | 'circle' | 'arrow' | 'text' | 'pen' | 'mosaic' | 'none';

interface Annotation {
  id: string;
  tool: Tool;
  points?: number[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color: string;
  strokeWidth: number;
  text?: string;
}

export function ScreenshotOverlayPage() {
  const [searchParams] = useSearchParams();
  const imageId = searchParams.get('id') || '';
  const scaleFactor = parseFloat(searchParams.get('scale') || '1');

  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageLoaded, setImageLoaded] = useState(false);

  // Selection state
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const regionRef = useRef<Region | null>(null);
  regionRef.current = region;

  // Annotation state
  const [tool, setTool] = useState<Tool>('none');
  const [color, setColor] = useState('#ff3a3a');
  const [strokeWidth] = useState(3);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0, y: 0, visible: false,
  });
  const [textValue, setTextValue] = useState('');
  const textInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<any>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Load screenshot image via IPC command — returns base64 data URL from memory store.
  // This bypasses all file/protocol/scope issues and is 100% reliable.
  useEffect(() => {
    if (!imageId) return;
    invoke<string>('get_screenshot_image', { imageId })
      .then((dataUrl) => setImageUrl(dataUrl))
      .catch((err) => console.error('[Screenshot] Failed to get image data:', err));
  }, [imageId]);

  const handleClose = useCallback(async (confirmed = false) => {
    await invoke('close_screenshot_overlay', { imageId, confirmed });
  }, [imageId]);

  const handleConfirm = useCallback(async () => {
    try {
      const r = regionRef.current;
      if (!r || r.width < 10 || r.height < 10) return;

      // Get annotation data if any annotations exist
      let annotationData: string | undefined;
      if (stageRef.current && annotations.length > 0) {
        annotationData = stageRef.current.toDataURL({ pixelRatio: 2 });
      }

      // Delegate all image processing to Rust — avoids cross-origin canvas issues entirely.
      // Rust crops the in-memory screenshot, composites annotations, encodes JPEG,
      // and emits the result directly to the main window.
      await invoke('confirm_region_screenshot', {
        imageId,
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        annotationData: annotationData || null,
      });
    } catch (err) {
      console.error('[Screenshot] Confirm failed:', err);
      // Still close the overlay on error so user isn't stuck
      await handleClose(false);
    }
  }, [imageId, annotations, handleClose]);

  // Redraw canvas mask — only after image has loaded so the user sees the
  // screenshot underneath (not black-on-black which makes everything invisible).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clear the selected region (reveals the screenshot image below)
    if (region && region.width > 0 && region.height > 0) {
      const { x, y, width, height } = region;
      ctx.clearRect(x, y, width, height);

      // Border
      ctx.strokeStyle = '#409eff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);

      // Size label
      const img = imgRef.current;
      const imgScaleX = img ? img.naturalWidth / window.innerWidth : scaleFactor;
      const imgScaleY = img ? img.naturalHeight / window.innerHeight : scaleFactor;
      const w = Math.round(width * imgScaleX);
      const h = Math.round(height * imgScaleY);
      const label = `${w} × ${h}`;
      ctx.font = '12px -apple-system, sans-serif';
      const textMetrics = ctx.measureText(label);
      const bgPadding = 4;
      let labelX = x;
      let labelY = y > 24 ? y - 8 : y + height + 18;
      if (labelX + textMetrics.width + bgPadding * 2 > canvas.width) {
        labelX = canvas.width - textMetrics.width - bgPadding * 2;
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(labelX - bgPadding, labelY - 12 - bgPadding, textMetrics.width + bgPadding * 2, 14 + bgPadding * 2);
      ctx.fillStyle = '#409eff';
      ctx.fillText(label, labelX, labelY);
    }
  }, [region, imageLoaded, scaleFactor]);

  // Drag state for moving the selected region
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [canvasCursor, setCanvasCursor] = useState<'crosshair' | 'move'>('crosshair');

  // Check if a point is inside the current region
  const isInsideRegion = (px: number, py: number): boolean => {
    if (!region || region.width < 10 || region.height < 10) return false;
    return px >= region.x && px <= region.x + region.width &&
           py >= region.y && py <= region.y + region.height;
  };

  // Canvas mouse handlers for region selection and dragging
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) {
      if (region) {
        setRegion(null);
        setAnnotations([]);
        setTool('none');
      } else {
        handleClose();
      }
      return;
    }
    // Don't allow selection until image is loaded (otherwise it's black on black)
    if (!imageLoaded) return;
    // If we already have a region and a tool is active, don't restart selection
    if (region && tool !== 'none') return;

    // If clicking inside existing region, start dragging it
    if (region && region.width >= 10 && region.height >= 10 && isInsideRegion(e.clientX, e.clientY)) {
      setIsDragging(true);
      setDragOffset({ x: e.clientX - region.x, y: e.clientY - region.y });
      return;
    }

    // Start new selection
    setIsDrawing(true);
    setStartPoint({ x: e.clientX, y: e.clientY });
    setRegion(null);
    setAnnotations([]);
    setTool('none');
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    // Handle dragging
    if (isDragging && region) {
      const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - region.width));
      const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - region.height));
      setRegion({ ...region, x: newX, y: newY });
      return;
    }
    // Handle drawing
    if (isDrawing && startPoint) {
      const x = Math.min(startPoint.x, e.clientX);
      const y = Math.min(startPoint.y, e.clientY);
      const width = Math.abs(e.clientX - startPoint.x);
      const height = Math.abs(e.clientY - startPoint.y);
      setRegion({ x, y, width, height });
      return;
    }
    // Update cursor based on hover position
    if (region && region.width >= 10 && region.height >= 10 && tool === 'none') {
      setCanvasCursor(isInsideRegion(e.clientX, e.clientY) ? 'move' : 'crosshair');
    }
  };

  const handleCanvasMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      return;
    }
    if (!isDrawing) return;
    setIsDrawing(false);
    if (region && region.width < 5 && region.height < 5) {
      setRegion(null);
    }
  };

  // Konva annotation handlers (when tool is active and region exists)
  const handleStageMouseDown = (e: any) => {
    if (tool === 'none') return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;

    if (tool === 'text') {
      setTextInput({ x: pos.x, y: pos.y, visible: true });
      setTextValue('');
      setTimeout(() => textInputRef.current?.focus(), 50);
      return;
    }

    setIsAnnotating(true);
    const id = `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const ann: Annotation = {
      id, tool, x: pos.x, y: pos.y, width: 0, height: 0,
      color, strokeWidth,
      points: (tool === 'pen' || tool === 'arrow' || tool === 'mosaic') ? [pos.x, pos.y] : undefined,
    };
    setCurrentAnnotation(ann);
  };

  const handleStageMouseMove = (e: any) => {
    if (!isAnnotating || !currentAnnotation) return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;

    if (currentAnnotation.tool === 'pen' || currentAnnotation.tool === 'mosaic') {
      setCurrentAnnotation({
        ...currentAnnotation,
        points: [...(currentAnnotation.points || []), pos.x, pos.y],
      });
    } else if (currentAnnotation.tool === 'arrow') {
      setCurrentAnnotation({
        ...currentAnnotation,
        points: [currentAnnotation.points![0], currentAnnotation.points![1], pos.x, pos.y],
      });
    } else {
      setCurrentAnnotation({
        ...currentAnnotation,
        width: pos.x - (currentAnnotation.x || 0),
        height: pos.y - (currentAnnotation.y || 0),
      });
    }
  };

  const handleStageMouseUp = () => {
    if (!isAnnotating || !currentAnnotation) return;
    setIsAnnotating(false);
    setAnnotations((prev) => [...prev, currentAnnotation]);
    setCurrentAnnotation(null);
  };

  const handleUndo = useCallback(() => {
    setAnnotations((prev) => prev.slice(0, -1));
  }, []);

  const handleTextSubmit = () => {
    if (textValue.trim() && region) {
      const id = `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const ann: Annotation = {
        id, tool: 'text', x: textInput.x, y: textInput.y,
        color, strokeWidth, text: textValue.trim(),
      };
      setAnnotations((prev) => [...prev, ann]);
    }
    setTextInput({ x: 0, y: 0, visible: false });
    setTextValue('');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (textInput.visible) {
        // Let text input handle its own keys
        return;
      }
      if (e.key === 'Escape') {
        if (region) {
          setRegion(null);
          setAnnotations([]);
          setTool('none');
        } else {
          handleClose();
        }
      } else if (e.key === 'Enter') {
        if (region && region.width >= 10 && region.height >= 10) {
          handleConfirm();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [region, handleClose, handleConfirm, handleUndo, textInput.visible]);

  const renderAnnotation = (ann: Annotation) => {
    const key = ann.id;
    switch (ann.tool) {
      case 'rect':
        return <Rect key={key} x={ann.x} y={ann.y} width={ann.width} height={ann.height} stroke={ann.color} strokeWidth={ann.strokeWidth} />;
      case 'circle':
        return <Ellipse key={key} x={(ann.x || 0) + (ann.width || 0) / 2} y={(ann.y || 0) + (ann.height || 0) / 2} radiusX={Math.abs((ann.width || 0) / 2)} radiusY={Math.abs((ann.height || 0) / 2)} stroke={ann.color} strokeWidth={ann.strokeWidth} />;
      case 'arrow':
        return <Arrow key={key} points={ann.points || []} stroke={ann.color} strokeWidth={ann.strokeWidth} fill={ann.color} pointerLength={10} pointerWidth={8} />;
      case 'pen':
        return <Line key={key} points={ann.points || []} stroke={ann.color} strokeWidth={ann.strokeWidth} tension={0.5} lineCap="round" lineJoin="round" />;
      case 'mosaic':
        return <Line key={key} points={ann.points || []} stroke={ann.color} strokeWidth={ann.strokeWidth * 8} tension={0} lineCap="square" lineJoin="round" opacity={1} />;
      case 'text':
        return <Text key={key} x={ann.x} y={ann.y} text={ann.text || ''} fontSize={18} fill={ann.color} />;
      default:
        return null;
    }
  };

  // Toolbar position: below region, or above if no space
  const getToolbarStyle = (): React.CSSProperties => {
    if (!region) return { display: 'none' };
    const toolbarHeight = 36;
    const toolbarWidth = 520;
    let left = region.x + region.width / 2 - toolbarWidth / 2;
    if (left < 4) left = 4;
    if (left + toolbarWidth > window.innerWidth - 4) left = window.innerWidth - toolbarWidth - 4;

    let top = region.y + region.height + 8;
    if (top + toolbarHeight + 8 > window.innerHeight) {
      top = region.y - toolbarHeight - 8;
      if (top < 0) top = region.y + region.height - toolbarHeight - 4;
    }
    return { left, top, position: 'absolute' as const };
  };

  if (!imageId) return null;

  const hasRegion = region && region.width >= 10 && region.height >= 10;

  const toolList: { id: Tool; label: string }[] = [
    { id: 'rect', label: '□' },
    { id: 'circle', label: '○' },
    { id: 'arrow', label: '→' },
    { id: 'pen', label: '✎' },
    { id: 'mosaic', label: '▦' },
    { id: 'text', label: 'A' },
  ];

  const colors = ['#ff3a3a', '#f8b60f', '#0083ff', '#40ff00', '#363636', '#ffffff'];

  return (
    <div className="screenshot-overlay-container">
      {/* Background image */}
      {imageUrl && (
        <img
          ref={imgRef}
          src={imageUrl}
          className="screenshot-bg-image"
          draggable={false}
          onLoad={() => setImageLoaded(true)}
          onError={(e) => console.error('[Screenshot] Image failed to load:', e)}
        />
      )}

      {/* Canvas mask for selection (on top of image, below Konva) */}
      <canvas
        ref={canvasRef}
        className="region-selector-canvas"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          pointerEvents: (tool !== 'none' && hasRegion) ? 'none' : 'auto',
          cursor: isDragging ? 'move' : canvasCursor,
        }}
      />

      {/* Konva annotation layer - positioned exactly over the region */}
      {hasRegion && (
        <div
          className="annotation-stage"
          style={{
            position: 'absolute',
            left: region!.x,
            top: region!.y,
            width: region!.width,
            height: region!.height,
            pointerEvents: tool !== 'none' ? 'auto' : 'none',
            zIndex: 20,
          }}
        >
          <Stage
            ref={stageRef}
            width={region!.width}
            height={region!.height}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            style={{ cursor: tool === 'none' ? 'default' : 'crosshair' }}
          >
            <Layer>
              {/* We don't draw the background image in Konva since it's already visible via <img> */}
              {annotations.map(renderAnnotation)}
              {currentAnnotation && renderAnnotation(currentAnnotation)}
            </Layer>
          </Stage>

          {/* Text input overlay */}
          {textInput.visible && (
            <input
              ref={textInputRef}
              className="text-input-overlay"
              style={{ left: textInput.x, top: textInput.y, color }}
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTextSubmit();
                else if (e.key === 'Escape') {
                  setTextInput({ x: 0, y: 0, visible: false });
                  setTextValue('');
                }
                e.stopPropagation();
              }}
              onBlur={handleTextSubmit}
              placeholder="输入文字..."
            />
          )}
        </div>
      )}

      {/* Toolbar - appears below the selection */}
      {hasRegion && !isDrawing && (
        <div className="annotation-toolbar" style={getToolbarStyle()}>
          <div className="tool-group">
            {toolList.map((t) => (
              <button
                key={t.id}
                className={`tool-btn ${tool === t.id ? 'active' : ''}`}
                onClick={() => setTool(tool === t.id ? 'none' : t.id)}
                title={t.id}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="separator" />
          <div className="color-group">
            {colors.map((c) => (
              <button
                key={c}
                className={`color-btn ${color === c ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <div className="separator" />
          <div className="action-group">
            <button className="tool-btn" onClick={handleUndo} disabled={annotations.length === 0} title="撤销 (Ctrl+Z)">
              ↩
            </button>
            <button className="tool-btn confirm-btn" onClick={handleConfirm} title="确认 (Enter)">
              ✓
            </button>
            <button className="tool-btn cancel-btn" onClick={() => handleClose()} title="取消 (Esc)">
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
