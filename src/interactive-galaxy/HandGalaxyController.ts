/**
 * HandGalaxyController Module
 * Bridge between Mudra Band and galaxy rendering
 */

import * as THREE from 'three';
import { InputManager } from '../shared/InputManager';
import { InputState } from '../shared/InputTypes';
import { GalaxyRenderer } from './GalaxyRenderer';
import { StarBurstEffect } from './StarBurstEffect';
import { ExplosionState } from './types';
import { normalizedToWorld } from '../utils/math';
import { ScalarSmoother, Vector3Smoother, EulerSmoother } from '../utils/smoothing';

/**
 * Interaction configuration
 */
interface InteractionConfig {
  /** Minimum input distance for galaxy to appear (normalized) */
  minDistance: number;
  /** Maximum input distance for full galaxy size (normalized) */
  maxDistance: number;
  /** Smoothing factor for scale (0-1) */
  scaleSmoothingFactor: number;
  /** Smoothing factor for position (0-1) */
  positionSmoothingFactor: number;
  /** Smoothing factor for rotation (0-1) */
  rotationSmoothingFactor: number;
  /** Grace period in ms to keep galaxy visible after losing input */
  gracePeriodMs: number;
  /** Enable gestures */
  enableGestures: boolean;
}

const DEFAULT_INTERACTION_CONFIG: InteractionConfig = {
  minDistance: 0.06,
  maxDistance: 0.35,
  scaleSmoothingFactor: 0.2,
  positionSmoothingFactor: 0.25,
  rotationSmoothingFactor: 0.2,
  gracePeriodMs: 500,
  enableGestures: true,
};

/**
 * HandGalaxyController - Manages interaction between Mudra and galaxy
 */
export class HandGalaxyController {
  private inputManager: InputManager;
  private galaxyRenderer: GalaxyRenderer;
  private config: InteractionConfig;

  private starBurstEffect: StarBurstEffect | null = null;

  // Smoothers for stable tracking
  private scaleSmoother: ScalarSmoother;
  private positionSmoother: Vector3Smoother;
  private rotationSmoother: EulerSmoother;

  // State tracking
  private lastInputTime: number = 0;
  private isGalaxyActive: boolean = false;
  private lastTimestamp: number = 0;
  private hasExplodedThisLife: boolean = false;

  // Debug state
  private debugEnabled: boolean = false;
  private debugCallback: ((info: DebugInfo) => void) | null = null;

  constructor(
    inputManager: InputManager,
    galaxyRenderer: GalaxyRenderer,
    config: Partial<InteractionConfig> = {}
  ) {
    this.inputManager = inputManager;
    this.galaxyRenderer = galaxyRenderer;
    this.config = { ...DEFAULT_INTERACTION_CONFIG, ...config };

    // Initialize smoothers
    this.scaleSmoother = new ScalarSmoother(1, this.config.scaleSmoothingFactor);
    this.positionSmoother = new Vector3Smoother(
      new THREE.Vector3(0, 0, 0),
      this.config.positionSmoothingFactor
    );
    this.rotationSmoother = new EulerSmoother(
      new THREE.Euler(0, 0, 0),
      this.config.rotationSmoothingFactor
    );
  }

  /**
   * Initialize star burst effect
   */
  initializeEffects(scene: THREE.Scene): void {
    if (!this.config.enableGestures) return;

    this.starBurstEffect = new StarBurstEffect(
      scene,
      {
        particleCount: 300,
        duration: 1.5,
        initialVelocity: 2.5,
        color: new THREE.Color(0xffffff),
      },
      3
    );
  }

  /**
   * Main update method
   */
  update(timestamp: number, input: InputState): void {
    const deltaTime = this.lastTimestamp > 0 ? (timestamp - this.lastTimestamp) / 1000 : 0;
    this.lastTimestamp = timestamp;

    this.galaxyRenderer.updateTime(deltaTime);

    if (this.config.enableGestures && this.starBurstEffect) {
      this.starBurstEffect.update(deltaTime);
    }

    if (input.connected) {
      this.lastInputTime = timestamp;
      this.processInteraction(input);
    } else {
      this.handleNoInput(timestamp);
    }

    this.galaxyRenderer.render();
  }

  private processInteraction(input: InputState): void {
    const worldPos = normalizedToWorld({
      x: input.cursor.x,
      y: input.cursor.y,
      z: 0.5,
    });

    const smoothedPosition = this.positionSmoother.update(worldPos);

    // Pressure maps to scale (0.5 to 1.5)
    const targetScale = 0.5 + input.pressure;
    const smoothedScale = this.scaleSmoother.update(targetScale);

    // Gestures
    if (input.lastGesture?.type === 'tap' && this.starBurstEffect) {
      this.starBurstEffect.trigger(smoothedPosition);
    }

    if (input.lastGesture?.type === 'twist' && !this.hasExplodedThisLife) {
      this.galaxyRenderer.triggerExplosion();
      this.hasExplodedThisLife = true;
    }

    if (!this.isGalaxyActive && smoothedScale > 0.01) {
      this.galaxyRenderer.setVisible(true);
      this.isGalaxyActive = true;
      this.hasExplodedThisLife = false;
    }

    this.galaxyRenderer.setScale(smoothedScale);
    this.galaxyRenderer.setPosition(smoothedPosition.x, smoothedPosition.y, smoothedPosition.z);
    this.galaxyRenderer.setHandDistance(input.pressure * 0.5);

    if (this.debugEnabled && this.debugCallback) {
      this.debugCallback({
        handsDetected: 1,
        distance: input.pressure,
        scale: smoothedScale,
        position: smoothedPosition,
        rotation: this.rotationSmoother.value,
      });
    }
  }

  private handleNoInput(timestamp: number): void {
    const timeSinceLastInput = timestamp - this.lastInputTime;

    if (timeSinceLastInput > this.config.gracePeriodMs) {
      const fadeScale = this.scaleSmoother.update(0);
      if (fadeScale < 0.01 && this.isGalaxyActive) {
        this.galaxyRenderer.setVisible(false);
        this.isGalaxyActive = false;
      } else {
        this.galaxyRenderer.setScale(fadeScale);
      }
    }

    if (this.debugEnabled && this.debugCallback) {
      this.debugCallback({
        handsDetected: 0,
        distance: 0,
        scale: this.scaleSmoother.value,
        position: this.positionSmoother.value,
        rotation: this.rotationSmoother.value,
      });
    }
  }

  enableDebug(callback: (info: DebugInfo) => void): void {
    this.debugEnabled = true;
    this.debugCallback = callback;
  }

  disableDebug(): void {
    this.debugEnabled = false;
    this.debugCallback = null;
  }

  reset(): void {
    this.scaleSmoother.reset(0);
    this.positionSmoother.reset(new THREE.Vector3(0, 0, 0));
    this.rotationSmoother.reset(new THREE.Euler(0, 0, 0));
    this.lastInputTime = 0;
    this.isGalaxyActive = false;
    this.galaxyRenderer.setVisible(false);
    this.galaxyRenderer.setScale(0);
    this.starBurstEffect?.clear();
  }

  dispose(): void {
    this.starBurstEffect?.dispose();
    this.starBurstEffect = null;
  }
}

export interface DebugInfo {
  handsDetected: number;
  distance: number;
  scale: number;
  position: THREE.Vector3;
  rotation: THREE.Euler;
}
