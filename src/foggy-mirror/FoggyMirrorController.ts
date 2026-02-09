/**
 * FoggyMirrorController - Orchestrates foggy mirror interaction mode
 */

import { InputManager } from '../shared/InputManager';
import { InputState } from '../shared/InputTypes';
import { FogOverlay } from './FogOverlay';
import {
  FoggyMirrorConfig,
  DEFAULT_FOGGY_MIRROR_CONFIG,
  FoggyMirrorState,
  FoggyMirrorDebugInfo,
} from './types';

/**
 * FoggyMirrorController manages the foggy mirror interaction mode
 */
export class FoggyMirrorController {
  private readonly inputManager: InputManager;
  private readonly fogOverlay: FogOverlay;
  private readonly config: FoggyMirrorConfig;
  private readonly container: HTMLElement;

  private state: FoggyMirrorState = 'uninitialized';
  private lastTimestamp: number = 0;

  // Debug state
  private debugEnabled: boolean = false;
  private debugCallback: ((info: FoggyMirrorDebugInfo) => void) | null = null;

  // Stats
  private frameCount: number = 0;
  private currentFps: number = 0;
  private lastFpsUpdate: number = 0;
  private cachedFogPercentage: number = 100;
  private lastFogPercentageUpdate: number = 0;

  constructor(
    inputManager: InputManager,
    container: HTMLElement,
    config: Partial<FoggyMirrorConfig> = {}
  ) {
    this.inputManager = inputManager;
    this.container = container;
    this.config = { ...DEFAULT_FOGGY_MIRROR_CONFIG, ...config };

    this.fogOverlay = new FogOverlay(container, this.config.fogOverlay);
  }

  initialize(): void {
    if (this.state !== 'uninitialized') return;
    this.fogOverlay.initialize();
    this.state = 'ready';
    console.log('[FoggyMirrorController] Initialized');
  }

  start(): void {
    if (this.state === 'uninitialized') this.initialize();
    this.fogOverlay.show();
    this.state = 'active';
  }

  stop(): void {
    if (this.state !== 'active') return;
    this.fogOverlay.hide();
    this.state = 'ready';
  }

  /**
   * Main update driven by App
   */
  update(timestamp: number, input: InputState): void {
    if (this.state !== 'active') return;

    // FPS Tracking
    this.frameCount++;
    if (timestamp - this.lastFpsUpdate >= 1000) {
      this.currentFps = (this.frameCount * 1000) / (timestamp - this.lastFpsUpdate);
      this.frameCount = 0;
      this.lastFpsUpdate = timestamp;
    }

    const rect = this.container.getBoundingClientRect();

    // Interaction logic
    if (input.connected) {
      // 1. Wiping active when button is held
      if (input.buttonDown) {
        const x = input.cursor.x * rect.width;
        const y = input.cursor.y * rect.height;
        const radius = 20 + input.pressure * 80; // Radius between 20 and 100

        this.fogOverlay.clearAtPoints([{ x, y, radius }]);
      }

      // 2. Re-fog on tap
      if (input.lastGesture?.type === 'tap') {
        this.fogOverlay.reset(); // Breathe effect (full re-fog for simplicity)
      }

      // 3. Reset on twist
      if (input.lastGesture?.type === 'twist') {
        this.reset();
      }
    }

    this.fogOverlay.render();

    // Debug
    if (this.debugEnabled && this.debugCallback) {
      if (timestamp - this.lastFogPercentageUpdate >= 500) {
        this.cachedFogPercentage = this.fogOverlay.getFogPercentage();
        this.lastFogPercentageUpdate = timestamp;
      }

      this.debugCallback({
        handsDetected: input.connected ? 1 : 0,
        fps: this.currentFps,
        trailPoints: 0, // Trail tracking removed for now
        clearedPercentage: 100 - this.cachedFogPercentage,
        avgVelocity: 0,
        avgBrushSize: input.pressure * 100,
      });
    }

    this.lastTimestamp = timestamp;
  }

  reset(): void {
    this.fogOverlay.reset();
  }

  enableDebug(callback: (info: FoggyMirrorDebugInfo) => void): void {
    this.debugEnabled = true;
    this.debugCallback = callback;
  }

  disableDebug(): void {
    this.debugEnabled = false;
    this.debugCallback = null;
  }

  handleResize(): void {
    this.fogOverlay.handleResize();
  }

  getHandCount(): number {
    return this.inputManager.getState().connected ? 1 : 0;
  }

  dispose(): void {
    this.fogOverlay.dispose();
    this.state = 'disposed';
  }
}
