/**
 * WorkshopController - Mudra Integrated Holographic Workshop
 */

import * as THREE from 'three';
import { EffectComposer, RenderPass, BloomEffect, EffectPass } from 'postprocessing';
import { InputManager } from '../shared/InputManager';
import { InputState } from '../shared/InputTypes';
import { WorkshopConfig, DEFAULT_WORKSHOP_CONFIG } from './types';
import { createWorkshopGrid } from './components/WorkshopGrid';
import { createWorkshopRings, updateWorkshopRings } from './components/WorkshopRings';
import { createWorkshopPanels, updateWorkshopPanels } from './components/WorkshopPanels';
import { loadMarkVIModel, updateMarkVIModel } from './components/MarkVIModel';
import { ExplodedViewManager } from './components/ExplodedViewManager';
import { WorkshopAudioManager } from './audio/WorkshopAudioManager';

export class WorkshopController {
  private container: HTMLElement;
  private config: WorkshopConfig;

  // Three.js core
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;

  // Components
  private grid: THREE.Group | null = null;
  private rings: THREE.Group | null = null;
  private panels: THREE.Group | null = null;
  private schematic: THREE.Group | null = null;
  private explodedViewManager: ExplodedViewManager | null = null;
  private audio: WorkshopAudioManager;

  // State
  private isRunning: boolean = false;
  private lastTimestamp: number = 0;
  private schematicTargetRotation = new THREE.Euler(0, -Math.PI / 2, 0);
  private currentRotationY = -Math.PI / 2;
  private debugCallback: ((info: any) => void) | null = null;

  constructor(
    _inputManager: InputManager,
    container: HTMLElement,
    config: Partial<WorkshopConfig> = {}
  ) {
    this.container = container;
    this.config = { ...DEFAULT_WORKSHOP_CONFIG, ...config };

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 0.5, 5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    this.composer = new EffectComposer(this.renderer);
    this.setupPostProcessing();
    this.audio = new WorkshopAudioManager(this.camera);
  }

  private setupPostProcessing(): void {
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);
    const bloomEffect = new BloomEffect({
      intensity: 1.5,
      luminanceThreshold: 0.1,
      mipmapBlur: true,
    });
    this.composer.addPass(new EffectPass(this.camera, bloomEffect));
  }

  initialize(): void {
    this.renderer.domElement.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 10;
    `;
    this.container.appendChild(this.renderer.domElement);

    const primaryColor = new THREE.Color(this.config.primaryColor);

    this.grid = createWorkshopGrid({ color: primaryColor, size: 15, divisions: 39 });
    this.scene.add(this.grid);

    this.rings = createWorkshopRings({ color: primaryColor });
    this.scene.add(this.rings);

    this.panels = createWorkshopPanels({ color: primaryColor });
    this.scene.add(this.panels);

    const { group: modelGroup, loadPromise } = loadMarkVIModel({ color: new THREE.Color(this.config.secondaryColor), scale: 3.0 });
    this.schematic = modelGroup;
    this.scene.add(this.schematic);

    this.explodedViewManager = new ExplodedViewManager({ animationDuration: 1.0, enableSound: false });

    loadPromise.then(() => {
      this.explodedViewManager?.initialize(this.schematic!);
      this.schematic!.visible = true;
      this.audio.startAmbient();
    });

    window.addEventListener('resize', this.handleResize);
  }

  start(): void {
    this.isRunning = true;
  }

  stop(): void {
    this.isRunning = false;
  }

  reset(): void {
    this.schematicTargetRotation.set(0, -Math.PI / 2, 0);
    this.currentRotationY = -Math.PI / 2;
    if (this.schematic) {
      this.schematic.rotation.set(0, -Math.PI / 2, 0);
    }
    this.explodedViewManager?.assemble();
  }

  enableDebug(callback: (info: any) => void): void {
    this.debugCallback = callback;
  }

  disableDebug(): void {
    this.debugCallback = null;
  }

  update(timestamp: number, input: InputState): void {
    if (!this.isRunning) return;
    const deltaTime = this.lastTimestamp > 0 ? (timestamp - this.lastTimestamp) / 1000 : 0;
    this.lastTimestamp = timestamp;

    if (this.schematic) {
      // 1. Navigation + Button -> Subtle translation/interaction
      if (input.connected) {
        // 2. Twist -> Rotate schematic
        if (input.lastGesture?.type === 'twist') {
          this.schematicTargetRotation.y += Math.PI / 4;
        }

        // 3. Tap -> Toggle Exploded View
        if (input.lastGesture?.type === 'tap') {
          if (this.explodedViewManager?.getState() === 'assembled') {
            this.explodedViewManager.explode();
            (this.audio as any).play('disassemble');
          } else {
            this.explodedViewManager?.assemble();
            (this.audio as any).play('assemble');
          }
        }

        // 4. Pressure -> Zoom camera
        const targetZ = 5 + (1 - input.pressure) * 3;
        this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetZ, 0.1);
      }

      // Smooth rotation
      this.currentRotationY = THREE.MathUtils.lerp(this.currentRotationY, this.schematicTargetRotation.y, 0.1);
      this.schematic.rotation.y = this.currentRotationY;

      updateMarkVIModel(this.schematic, timestamp / 1000);
    }

    if (this.rings) updateWorkshopRings(this.rings, deltaTime, timestamp / 1000);
    if (this.panels) updateWorkshopPanels(this.panels, timestamp / 1000);

    if (this.debugCallback) {
      this.debugCallback({
        fps: 60,
        handsDetected: input.connected ? 1 : 0,
        objects: 1,
      });
    }

    this.composer.render();
  }

  handleResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose(): void {
    this.stop();
    this.renderer.dispose();
    this.audio.stopAmbient();
  }
}
