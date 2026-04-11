import type { KeyboardHandler, TextInputHandler, IMECompositionHandler, IMECompositionState } from "../types";

export class InputManager {
  private _canvas: HTMLCanvasElement;
  private _textarea: HTMLTextAreaElement;
  private _active = false;
  private _textHandlers: TextInputHandler[] = [];
  private _keyDownHandlers: KeyboardHandler[] = [];
  private _keyUpHandlers: KeyboardHandler[] = [];
  private _imeHandlers: IMECompositionHandler[] = [];
  private _onInput: () => void;
  private _onCompositionStart: () => void;
  private _onCompositionEnd: (e: CompositionEvent) => void;
  private _onKeyDown: (e: KeyboardEvent) => void;
  private _onKeyUp: (e: KeyboardEvent) => void;

  constructor(canvas: HTMLCanvasElement, textarea: HTMLTextAreaElement) {
    this._canvas = canvas;
    this._textarea = textarea;
    this._onInput = () => {
      if (!this._active) return;
      const value = this._textarea.value;
      if (value) { for (const h of this._textHandlers) h(value); this._textarea.value = ""; }
    };
    this._onCompositionStart = () => {
      const state: IMECompositionState = { isComposing: true, compositionText: "" };
      for (const h of this._imeHandlers) h(state);
    };
    this._onCompositionEnd = (e: CompositionEvent) => {
      const state: IMECompositionState = { isComposing: false, compositionText: e.data ?? "" };
      for (const h of this._imeHandlers) h(state);
    };
    this._onKeyDown = (e: KeyboardEvent) => { for (const h of this._keyDownHandlers) h(e); };
    this._onKeyUp = (e: KeyboardEvent) => { for (const h of this._keyUpHandlers) h(e); };
    textarea.addEventListener("input", this._onInput);
    textarea.addEventListener("compositionstart", this._onCompositionStart);
    textarea.addEventListener("compositionend", this._onCompositionEnd as EventListener);
    canvas.addEventListener("keydown", this._onKeyDown);
    canvas.addEventListener("keyup", this._onKeyUp);
  }

  get isActive(): boolean { return this._active; }

  activate(): void { this._active = true; this._textarea.focus(); }

  deactivate(): void { this._active = false; this._textarea.value = ""; this._textarea.blur(); }

  onTextInput(handler: TextInputHandler): void { this._textHandlers.push(handler); }
  onKeyDown(handler: KeyboardHandler): void { this._keyDownHandlers.push(handler); }
  onKeyUp(handler: KeyboardHandler): void { this._keyUpHandlers.push(handler); }
  onIMEComposition(handler: IMECompositionHandler): void { this._imeHandlers.push(handler); }

  dispose(): void {
    this._textarea.removeEventListener("input", this._onInput);
    this._textarea.removeEventListener("compositionstart", this._onCompositionStart);
    this._textarea.removeEventListener("compositionend", this._onCompositionEnd as EventListener);
    this._canvas.removeEventListener("keydown", this._onKeyDown);
    this._canvas.removeEventListener("keyup", this._onKeyUp);
    this._textHandlers.length = 0;
    this._keyDownHandlers.length = 0;
    this._keyUpHandlers.length = 0;
    this._imeHandlers.length = 0;
  }
}
