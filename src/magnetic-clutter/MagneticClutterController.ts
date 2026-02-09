/**
 * MagneticClutterController - Mudra Integrated Magnetic Physics
 */

import { InputManager } from '../shared/InputManager';
import { InputState } from '../shared/InputTypes';
import { MagneticClutterRenderer } from './MagneticClutterRenderer';
import {
  MagneticClutterConfig,
  DEFAULT_MAGNETIC_CLUTTER_CONFIG,
} from './types';

export class MagneticClutterController {
  private container: HTMLElement;
  private config: MagneticClutterConfig;
  private inputManager: InputManager;
  private renderer: MagneticClutterRenderer | null = null;

  private lastTimestamp: number = 0;
  private isRunning: boolean = false;

  constructor(
    inputManager: InputManager,
    container: HTMLElement,
    config: Partial<MagneticClutterConfig> = {}
  ) {
    this.inputManager = inputManager;
    this.container = container;
    this.config = { ...DEFAULT_MAGNETIC_CLUTTER_CONFIG, ...config };
  }

  initialize(): void {
    if (this.renderer) return;
    this.renderer = new MagneticClutterRenderer(this.container, this.config);
    this.renderer.initialize();
  }

  start(): void {
    this.isRunning = true;
  }

  stop(): void {
    this.isRunning = false;
  }

  update(timestamp: number, input: InputState): void {
    if (!this.isRunning) return;
    const deltaTime = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = timestamp;

    if (this.renderer) {
      if (input.connected) {
        // Mudra to NDC
        const ndcX = 1 - input.cursor.x * 2;
        const ndcY = -(input.cursor.y * 2) + 1;
        const worldPos = this.renderer.projectToWorld(ndcX, ndcY, 0.2);

        // 1. Magnet Position (Navigation)
        // 2. Button Hold -> Energize Magnet
        if (input.buttonDown) {
          // Adjust grabber strength via pressure
          this.renderer.setGrabber(worldPos.x, worldPos.y, worldPos.z, true);
        } else {
          this.renderer.setGrabber(0, 0, 0, false);
        }

        // 3. Repel Blast (Tap)
        if (input.lastGesture?.type === 'tap') {
          this.renderer.setRepulsor(worldPos.x, worldPos.y, worldPos.z, true);
          // Auto-fade repulsor after a short duration in renderer or here
          setTimeout(() => this.renderer?.setRepulsor(0, 0, 0, false), 100);
        }

        // 4. Twist -> Reset
        if (input.lastGesture?.type === 'twist') {
          this.reset();
        }
      } else {
        this.renderer.setGrabber(0, 0, 0, false);
        this.renderer.setRepulsor(0, 0, 0, false);
      }

      this.renderer.update(deltaTime);
    }
  }

  reset(): void {
    // Implement reset logic in renderer if available
  }

  dispose(): void {
    this.stop();
    this.renderer?.dispose();
  }
}
