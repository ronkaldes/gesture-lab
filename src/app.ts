/**
 * App - Main Application Class
 * Orchestrates all modules and manages the application lifecycle
 */

import * as THREE from 'three';
import { HandTracker } from './modules/HandTracker';
import { GalaxyRenderer } from './modules/GalaxyRenderer';
import {
  HandGalaxyController,
  DebugInfo,
} from './modules/HandGalaxyController';
import { FoggyMirrorController } from './modules/FoggyMirrorController';
import { FoggyMirrorDebugInfo } from './modules/types/FoggyMirrorTypes';

/**
 * Interaction mode
 */
type InteractionMode = 'galaxy' | 'foggy-mirror';

/**
 * Application state
 */
type AppState =
  | 'uninitialized'
  | 'initializing'
  | 'running'
  | 'error'
  | 'disposed';

/**
 * Application configuration
 */
interface AppConfig {
  /** Show debug panel */
  debug: boolean;
  /** Particle count for galaxy */
  particleCount: number;
}

const DEFAULT_APP_CONFIG: AppConfig = {
  debug: false,
  particleCount: 20000,
};

/**
 * Main Application Class
 */
export class App {
  private handTracker: HandTracker;
  private galaxyRenderer: GalaxyRenderer | null = null;
  private controller: HandGalaxyController | null = null;
  private foggyMirrorController: FoggyMirrorController | null = null;
  private config: AppConfig;
  private currentMode: InteractionMode = 'galaxy';

  // DOM elements
  private container: HTMLElement;
  private videoElement: HTMLVideoElement | null = null;
  private statusElement: HTMLElement | null = null;
  private debugElement: HTMLElement | null = null;
  private controlsElement: HTMLElement | null = null;
  private modeSwitcherElement: HTMLElement | null = null;

  // State
  private state: AppState = 'uninitialized';
  private animationFrameId: number | null = null;
  private fpsCounter: FpsCounter;

  constructor(container: HTMLElement, config: Partial<AppConfig> = {}) {
    this.container = container;
    this.config = { ...DEFAULT_APP_CONFIG, ...config };
    this.handTracker = new HandTracker();
    this.fpsCounter = new FpsCounter();
  }

  /**
   * Initialize and start the application
   */
  async start(): Promise<void> {
    if (this.state !== 'uninitialized') {
      console.warn('[App] Already initialized');
      return;
    }

    this.state = 'initializing';

    try {
      // Create DOM structure
      this.createDOMStructure();

      // Update status
      this.updateStatus('Initializing...', 'loading');

      // Check browser support
      this.checkBrowserSupport();

      // Initialize hand tracker
      this.updateStatus('Loading hand tracking model...', 'loading');
      await this.handTracker.initialize(this.videoElement!);

      // Initialize galaxy renderer
      this.updateStatus('Creating galaxy...', 'loading');
      this.galaxyRenderer = new GalaxyRenderer(this.container, {
        particleCount: this.config.particleCount,
      });
      this.galaxyRenderer.initialize();

      // Create controller
      this.controller = new HandGalaxyController(
        this.handTracker,
        this.galaxyRenderer
      );

      // Initialize Phase 3.2 gesture effect (star burst)
      this.controller.initializeEffects(this.galaxyRenderer.getScene());

      // Enable debug if configured
      if (this.config.debug) {
        this.enableDebug();
      }

      // Start animation loop
      this.state = 'running';
      this.updateStatus('Galaxy Mode - Press F for Foggy Mirror', 'ready');
      this.startAnimationLoop();

      console.log('[App] Started successfully');
    } catch (error) {
      this.state = 'error';
      this.handleError(error);
    }
  }

  /**
   * Create DOM structure for the application
   */
  private createDOMStructure(): void {
    // Clear container
    this.container.innerHTML = '';

    // Create video element for webcam
    this.videoElement = document.createElement('video');
    this.videoElement.id = 'webcam-video';
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;
    // Initial styles for galaxy mode
    this.applyVideoStyles('galaxy');
    this.container.appendChild(this.videoElement);

    // Create status indicator
    this.statusElement = document.createElement('div');
    this.statusElement.id = 'status-indicator';
    this.statusElement.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 20px;
      padding: 10px 20px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      border-radius: 8px;
      z-index: 100;
      display: flex;
      align-items: center;
      gap: 10px;
    `;
    this.container.appendChild(this.statusElement);

    // Create debug panel (hidden by default)
    this.debugElement = document.createElement('div');
    this.debugElement.id = 'debug-panel';
    this.debugElement.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      padding: 15px;
      background: rgba(0, 0, 0, 0.8);
      color: #00ff00;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      border-radius: 8px;
      z-index: 100;
      display: none;
      min-width: 200px;
    `;
    this.container.appendChild(this.debugElement);

    // Create mode switcher (top-left corner)
    this.modeSwitcherElement = document.createElement('div');
    this.modeSwitcherElement.id = 'mode-switcher';
    this.modeSwitcherElement.style.cssText = `
      position: absolute;
      top: 20px;
      left: 20px;
      padding: 12px 16px;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      color: rgba(255, 255, 255, 0.9);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      border-radius: 8px;
      z-index: 100;
      display: block;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
    `;
    this.modeSwitcherElement.innerHTML = `
      <div style="margin-bottom: 8px; font-size: 11px; font-weight: 600; color: rgba(255, 255, 255, 0.6); text-transform: uppercase; letter-spacing: 0.5px;">Mode</div>
      <div style="margin-bottom: 4px; color: #4caf50; font-weight: 600;">🌌 Galaxy Mode</div>
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.1); font-size: 11px; color: rgba(255, 255, 255, 0.5);">
        Press <kbd style="padding: 1px 5px; background: rgba(255, 255, 255, 0.1); border-radius: 3px; font-family: monospace; font-size: 10px;">F</kbd> for Foggy Mirror
      </div>
    `;
    this.container.appendChild(this.modeSwitcherElement);

    // Create controls hint widget (bottom-right corner)
    this.controlsElement = document.createElement('div');
    this.controlsElement.id = 'controls-hint';
    this.controlsElement.style.cssText = `
      position: absolute;
      bottom: 20px;
      right: 20px;
      padding: 16px 20px;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      color: rgba(255, 255, 255, 0.9);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.8;
      border-radius: 12px;
      z-index: 100;
      display: block;
      max-width: 280px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
    `;
    this.controlsElement.innerHTML = `
      <div style="margin-bottom: 10px; font-size: 14px; font-weight: 600; color: #fff; letter-spacing: 0.5px;">🎮 Galaxy Controls</div>
      <div style="margin-bottom: 6px;">👐 Show both hands → Spawn galaxy</div>
      <div style="margin-bottom: 6px;">↔️ Move hands apart → Grow</div>
      <div style="margin-bottom: 6px;">↕️ Move hands together → Shrink</div>
      <div style="margin-bottom: 6px;">🤏 Close hands → Big Bang explosion</div>
      <div style="margin-bottom: 6px;">✨ Pinch gesture → Star burst</div>
      <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.15); font-size: 11px; color: rgba(255, 255, 255, 0.6);">
        Press <kbd style="padding: 2px 6px; background: rgba(255, 255, 255, 0.1); border-radius: 3px; font-family: monospace;">H</kbd> to toggle hints
      </div>
    `;
    this.container.appendChild(this.controlsElement);

    // Set container styles
    this.container.style.cssText = `
      position: relative;
      width: 100%;
      height: 100vh;
      overflow: hidden;
      background: #000;
    `;
  }

  /**
   * Check browser support for required features
   */
  private checkBrowserSupport(): void {
    const issues: string[] = [];

    // Check WebGL 2.0
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) {
      issues.push('WebGL 2.0 not supported');
    }

    // Check WebAssembly
    if (typeof WebAssembly !== 'object') {
      issues.push('WebAssembly not supported');
    }

    // Check getUserMedia
    if (!navigator.mediaDevices?.getUserMedia) {
      issues.push('Camera access not supported');
    }

    if (issues.length > 0) {
      throw new Error(`Browser not supported: ${issues.join(', ')}`);
    }
  }

  /**
   * Update status indicator
   */
  private updateStatus(
    message: string,
    state: 'loading' | 'ready' | 'error' | 'active'
  ): void {
    if (!this.statusElement) return;

    const stateColors: Record<string, string> = {
      loading: '#ffeb3b',
      ready: '#4caf50',
      error: '#f44336',
      active: '#2196f3',
    };

    const stateIcons: Record<string, string> = {
      loading: '⏳',
      ready: '✓',
      error: '✗',
      active: '👐',
    };

    this.statusElement.innerHTML = `
      <span style="color: ${stateColors[state]}">${stateIcons[state]}</span>
      <span>${message}</span>
    `;
  }

  /**
   * Enable debug mode
   */
  private enableDebug(): void {
    if (!this.debugElement) return;

    this.debugElement.style.display = 'block';

    if (this.currentMode === 'galaxy' && this.controller) {
      this.controller.enableDebug((info) => this.updateGalaxyDebugPanel(info));
    } else if (
      this.currentMode === 'foggy-mirror' &&
      this.foggyMirrorController
    ) {
      this.foggyMirrorController.enableDebug((info) =>
        this.updateFoggyMirrorDebugPanel(info)
      );
    }
  }

  /**
   * Update galaxy debug panel with current info
   */
  private updateGalaxyDebugPanel(info: DebugInfo): void {
    if (!this.debugElement) return;

    const fps = this.fpsCounter.getFps();

    this.debugElement.innerHTML = `
      <div style="margin-bottom: 8px; color: #fff; font-weight: bold;">Galaxy Debug</div>
      <div>FPS: ${fps.toFixed(1)}</div>
      <div>Hands: ${info.handsDetected}</div>
      <div>Distance: ${info.distance.toFixed(3)}</div>
      <div>Scale: ${info.scale.toFixed(3)}</div>
      <div>Position:</div>
      <div style="padding-left: 10px;">
        x: ${info.position.x.toFixed(2)}<br>
        y: ${info.position.y.toFixed(2)}<br>
        z: ${info.position.z.toFixed(2)}
      </div>
      <div>Rotation (deg):</div>
      <div style="padding-left: 10px;">
        x: ${THREE.MathUtils.radToDeg(info.rotation.x).toFixed(1)}°<br>
        y: ${THREE.MathUtils.radToDeg(info.rotation.y).toFixed(1)}°<br>
        z: ${THREE.MathUtils.radToDeg(info.rotation.z).toFixed(1)}°
      </div>
    `;
  }

  /**
   * Update foggy mirror debug panel with current info
   */
  private updateFoggyMirrorDebugPanel(info: FoggyMirrorDebugInfo): void {
    if (!this.debugElement) return;

    this.debugElement.innerHTML = `
      <div style="margin-bottom: 8px; color: #fff; font-weight: bold;">Foggy Mirror Debug</div>
      <div>FPS: ${info.fps.toFixed(1)}</div>
      <div>Hands: ${info.handsDetected}</div>
      <div>Trail Points: ${info.trailPoints}</div>
      <div>Cleared: ${info.clearedPercentage.toFixed(1)}%</div>
      <div style="margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 4px;">
        <div>Wipe Speed: ${info.avgVelocity.toFixed(0)} px/f</div>
        <div>Brush Size: ${info.avgBrushSize.toFixed(0)} px</div>
      </div>
    `;
  }

  /**
   * Start the main animation loop
   */
  private startAnimationLoop(): void {
    const animate = (timestamp: number) => {
      if (this.state !== 'running') return;

      // Update FPS counter
      this.fpsCounter.update();

      // Update controller based on current mode
      if (this.currentMode === 'galaxy') {
        this.controller?.update(timestamp);

        // Update status based on hands (get from controller to avoid duplicate detection)
        const handCount = this.controller?.getHandCount() ?? 0;
        if (handCount >= 2) {
          this.updateStatus(`${handCount} hands detected`, 'active');
        } else if (handCount === 1) {
          this.updateStatus('Show both hands', 'ready');
        } else {
          this.updateStatus('No hands detected', 'ready');
        }
      }
      // Note: foggy-mirror mode has its own update loop in FoggyMirrorController

      // Schedule next frame
      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * Handle errors
   */
  private handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[App] Error:', message);
    this.updateStatus(`Error: ${message}`, 'error');
  }

  /**
   * Toggle debug mode
   */
  toggleDebug(): void {
    if (!this.debugElement) return;

    const isDebugVisible = this.debugElement.style.display !== 'none';

    if (isDebugVisible) {
      // Hide debug
      this.debugElement.style.display = 'none';
      this.controller?.disableDebug();
      this.foggyMirrorController?.disableDebug();
    } else {
      // Show debug
      this.debugElement.style.display = 'block';

      if (this.currentMode === 'galaxy' && this.controller) {
        this.controller.enableDebug((info) =>
          this.updateGalaxyDebugPanel(info)
        );
      } else if (
        this.currentMode === 'foggy-mirror' &&
        this.foggyMirrorController
      ) {
        this.foggyMirrorController.enableDebug((info) =>
          this.updateFoggyMirrorDebugPanel(info)
        );
      }
    }
  }

  /**
   * Toggle controls hint widget
   */
  toggleControls(): void {
    if (!this.controlsElement) return;

    if (this.controlsElement.style.display === 'none') {
      this.controlsElement.style.display = 'block';
    } else {
      this.controlsElement.style.display = 'none';
    }
  }

  /**
   * Apply video styles based on interaction mode
   */
  private applyVideoStyles(mode: InteractionMode): void {
    if (!this.videoElement) return;

    const baseStyles = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scaleX(-1);
    `;

    if (mode === 'galaxy') {
      // Dim video for galaxy mode (background effect)
      this.videoElement.style.cssText =
        baseStyles + 'filter: brightness(0.20) contrast(0.6);';
    } else {
      // Full brightness for foggy-mirror mode
      this.videoElement.style.cssText = baseStyles + 'filter: none;';
    }
  }

  /**
   * Switch to galaxy interaction mode
   */
  switchToGalaxyMode(): void {
    if (this.state !== 'running') {
      console.warn('[App] Cannot switch modes - app not running');
      return;
    }

    if (this.currentMode === 'galaxy') {
      console.log('[App] Already in galaxy mode');
      return;
    }

    console.log('[App] Switching to galaxy mode');

    // Stop foggy-mirror controller
    if (this.foggyMirrorController) {
      this.foggyMirrorController.stop();
      this.foggyMirrorController.disableDebug();
    }

    // Show galaxy renderer
    if (this.galaxyRenderer) {
      this.galaxyRenderer.show();
    }

    // Apply video styles
    this.applyVideoStyles('galaxy');

    // Update mode
    this.currentMode = 'galaxy';
    this.updateStatus('Galaxy Mode - Show both hands', 'ready');

    // Update mode switcher
    this.updateModeSwitcher('galaxy');

    // Update controls hint
    this.updateControlsHint('galaxy');

    // Re-enable debug if it was active
    if (
      this.debugElement &&
      this.debugElement.style.display !== 'none' &&
      this.controller
    ) {
      this.controller.enableDebug((info) => this.updateGalaxyDebugPanel(info));
    }
  }

  /**
   * Switch to foggy-mirror interaction mode
   */
  switchToFoggyMirrorMode(): void {
    if (this.state !== 'running') {
      console.warn('[App] Cannot switch modes - app not running');
      return;
    }

    if (this.currentMode === 'foggy-mirror') {
      console.log('[App] Already in foggy-mirror mode');
      return;
    }

    console.log('[App] Switching to foggy-mirror mode');

    // Initialize foggy mirror controller if needed
    if (!this.foggyMirrorController) {
      this.foggyMirrorController = new FoggyMirrorController(
        this.handTracker,
        this.container,
        { debug: this.config.debug }
      );
      this.foggyMirrorController.initialize();
    }

    // Hide galaxy renderer
    if (this.galaxyRenderer) {
      this.galaxyRenderer.hide();
    }

    // Disable galaxy debug
    if (this.controller) {
      this.controller.disableDebug();
    }

    // Start foggy mirror controller
    this.foggyMirrorController.start();

    // Apply video styles
    this.applyVideoStyles('foggy-mirror');

    // Update mode
    this.currentMode = 'foggy-mirror';
    this.updateStatus('Foggy Mirror - Use hands to clear fog', 'ready');

    // Update mode switcher
    this.updateModeSwitcher('foggy-mirror');

    // Update controls hint
    this.updateControlsHint('foggy-mirror');

    // Re-enable debug if it was active
    if (this.debugElement && this.debugElement.style.display !== 'none') {
      this.foggyMirrorController.enableDebug((info) =>
        this.updateFoggyMirrorDebugPanel(info)
      );
    }
  }

  /**
   * Reset the foggy mirror effect
   */
  resetFoggyMirror(): void {
    if (this.currentMode !== 'foggy-mirror' || !this.foggyMirrorController) {
      return;
    }

    this.foggyMirrorController.reset();
    this.updateStatus('Foggy Mirror Reset', 'active');

    // Reset status message after a short delay
    setTimeout(() => {
      if (this.currentMode === 'foggy-mirror') {
        this.updateStatus('Foggy Mirror - Use hands to clear fog', 'ready');
      }
    }, 2000);
  }

  /**
   * Update mode switcher UI
   */
  private updateModeSwitcher(mode: InteractionMode): void {
    if (!this.modeSwitcherElement) return;

    if (mode === 'galaxy') {
      this.modeSwitcherElement.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 11px; font-weight: 600; color: rgba(255, 255, 255, 0.6); text-transform: uppercase; letter-spacing: 0.5px;">Mode</div>
        <div style="margin-bottom: 4px; color: #4caf50; font-weight: 600;">🌌 Galaxy Mode</div>
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.1); font-size: 11px; color: rgba(255, 255, 255, 0.5);">
          Press <kbd style="padding: 1px 5px; background: rgba(255, 255, 255, 0.1); border-radius: 3px; font-family: monospace; font-size: 10px;">F</kbd> for Foggy Mirror
        </div>
      `;
    } else {
      this.modeSwitcherElement.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 11px; font-weight: 600; color: rgba(255, 255, 255, 0.6); text-transform: uppercase; letter-spacing: 0.5px;">Mode</div>
        <div style="margin-bottom: 4px; color: #2196f3; font-weight: 600;">🌫️ Foggy Mirror</div>
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.1); font-size: 11px; color: rgba(255, 255, 255, 0.5);">
          Press <kbd style="padding: 1px 5px; background: rgba(255, 255, 255, 0.1); border-radius: 3px; font-family: monospace; font-size: 10px;">G</kbd> for Galaxy Mode
        </div>
        <div style="margin-top: 4px; font-size: 11px; color: rgba(255, 255, 255, 0.5);">
          Press <kbd style="padding: 1px 5px; background: rgba(255, 255, 255, 0.1); border-radius: 3px; font-family: monospace; font-size: 10px;">R</kbd> to Reset Fog
        </div>
      `;
    }
  }

  /**
   * Update controls hint based on mode
   */
  private updateControlsHint(mode: InteractionMode): void {
    if (!this.controlsElement) return;

    if (mode === 'galaxy') {
      this.controlsElement.innerHTML = `
        <div style="margin-bottom: 10px; font-size: 14px; font-weight: 600; color: #fff; letter-spacing: 0.5px;">🎮 Galaxy Controls</div>
        <div style="margin-bottom: 6px;">👐 Show both hands → Spawn galaxy</div>
        <div style="margin-bottom: 6px;">↔️ Move hands apart → Grow</div>
        <div style="margin-bottom: 6px;">↕️ Move hands together → Shrink</div>
        <div style="margin-bottom: 6px;">🤏 Close hands → Big Bang explosion</div>
        <div style="margin-bottom: 6px;">✨ Pinch gesture → Star burst</div>
        <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.15); font-size: 11px; color: rgba(255, 255, 255, 0.6);">
          Press <kbd style="padding: 2px 6px; background: rgba(255, 255, 255, 0.1); border-radius: 3px; font-family: monospace;">H</kbd> to toggle hints
        </div>
      `;
    } else {
      this.controlsElement.innerHTML = `
        <div style="margin-bottom: 10px; font-size: 14px; font-weight: 600; color: #fff; letter-spacing: 0.5px;">🌫️ Foggy Mirror Controls</div>
        <div style="margin-bottom: 6px;">👋 Move hands to wipe fog</div>
        <div style="margin-bottom: 6px;">🌈 Reveal camera feed underneath</div>
        <div style="margin-bottom: 6px;">✨ Smooth trails follow your hands</div>
        <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.15); font-size: 11px; color: rgba(255, 255, 255, 0.6);">
          Press <kbd style="padding: 2px 6px; background: rgba(255, 255, 255, 0.1); border-radius: 3px; font-family: monospace;">H</kbd> to toggle hints
        </div>
      `;
    }
  }

  /**
   * Get current interaction mode
   */
  getCurrentMode(): InteractionMode {
    return this.currentMode;
  }

  /**
   * Clean up and stop the application
   */
  dispose(): void {
    if (this.state === 'disposed') return;

    // Stop animation loop
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Dispose modules
    this.controller?.dispose();
    this.foggyMirrorController?.dispose();
    this.handTracker.dispose();
    this.galaxyRenderer?.dispose();

    // Clear container
    this.container.innerHTML = '';

    this.state = 'disposed';
    console.log('[App] Disposed');
  }
}

/**
 * Simple FPS counter
 */
class FpsCounter {
  private frames: number = 0;
  private lastTime: number = performance.now();
  private fps: number = 0;

  update(): void {
    this.frames++;
    const now = performance.now();
    const delta = now - this.lastTime;

    if (delta >= 1000) {
      this.fps = (this.frames * 1000) / delta;
      this.frames = 0;
      this.lastTime = now;
    }
  }

  getFps(): number {
    return this.fps;
  }
}
