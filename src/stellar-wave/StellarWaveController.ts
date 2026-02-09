/**
 * StellarWaveController - Mudra Integrated Ripple Visualization
 */

import { InputManager } from '../shared/InputManager';
import { InputState } from '../shared/InputTypes';
import { StellarWaveRenderer } from './StellarWaveRenderer';
import { StellarWaveAudioManager } from './StellarWaveAudioManager';
import {
  DEFAULT_STELLAR_WAVE_CONFIG,
  StellarWaveState,
  type StellarWaveConfig,
} from './types';

export class StellarWaveController {
  private readonly container: HTMLElement;
  private readonly config: StellarWaveConfig;

  private renderer: StellarWaveRenderer | null = null;
  private audioManager: StellarWaveAudioManager | null = null;

  private state: StellarWaveState = StellarWaveState.UNINITIALIZED;
  private lastTimestamp: number = 0;
  private debugCallback: ((info: any) => void) | null = null;

  constructor(
    _inputManager: InputManager,
    container: HTMLElement,
    config: Partial<StellarWaveConfig> = {}
  ) {
    this.container = container;
    this.config = { ...DEFAULT_STELLAR_WAVE_CONFIG, ...config };
  }

  initialize(): void {
    if (this.state !== StellarWaveState.UNINITIALIZED) return;

    this.renderer = new StellarWaveRenderer(this.container, this.config);
    this.renderer.initialize();

    this.audioManager = new StellarWaveAudioManager();
    this.audioManager.initialize();

    this.state = StellarWaveState.READY;
    console.log('[StellarWaveController] Initialized');
  }

  start(): void {
    if (this.state === StellarWaveState.UNINITIALIZED) this.initialize();
    this.state = StellarWaveState.RUNNING;
  }

  stop(): void {
    if (this.state !== StellarWaveState.RUNNING) return;
    this.state = StellarWaveState.PAUSED;
    this.audioManager?.stopForceField();
  }

  enableDebug(callback: (info: any) => void): void {
    this.debugCallback = callback;
  }

  disableDebug(): void {
    this.debugCallback = null;
  }

  update(timestamp: number, input: InputState): void {
    if (this.state !== StellarWaveState.RUNNING) return;

    const deltaTime = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    if (input.connected) {
      const { x, y } = input.cursor;

      // 1. Force Field / Active Wave (Button hold)
      if (input.buttonDown) {
        this.renderer?.setForceField(x, y);
        this.audioManager?.startForceField();
      } else {
        this.renderer?.setForceField(null, null);
        this.audioManager?.stopForceField();
      }

      // 2. Pulse Ripple (Tap)
      if (input.lastGesture?.type === 'tap') {
        this.renderer?.triggerCosmicPulse(x, y);
        this.audioManager?.playCosmicPulse();
      }

      // 3. Pressure -> Amplitude / Modulation
      this.renderer?.setAmplitude(0.5 + input.pressure * 2.0);

      // 4. Twist -> Reset ripples
      if (input.lastGesture?.type === 'twist') {
        this.renderer?.clearRipples();
      }
    } else {
      this.renderer?.setForceField(null, null);
      this.audioManager?.stopForceField();
    }

    if (this.renderer) {
      this.renderer.update(deltaTime);
      this.renderer.render();
    }

    if (this.debugCallback) {
      this.debugCallback({
        fps: 60,
        handsDetected: input.connected ? 1 : 0,
        activeRipples: 0,
      });
    }
  }

  reset(): void {
    this.renderer?.clearRipples();
  }

  dispose(): void {
    this.renderer?.dispose();
    this.audioManager?.dispose();
    this.state = StellarWaveState.DISPOSED;
  }
}
