import * as THREE from 'three';
import { InputManager } from '../shared/InputManager';
import { InputState } from '../shared/InputTypes';
import { PostProcessingManager } from '../shared/PostProcessingManager';
import { HandTrailRenderer } from './HandTrailRenderer';
import { ObjectPoolManager } from './ObjectPoolManager';
import { CollisionDetector, CollisionEvent } from './CollisionDetector';
import { SliceEffect } from './SliceEffect';
import { CosmicBackground } from './CosmicBackground';
import { CosmicAssetLibrary } from './CosmicAssetLibrary';
import { HybridCosmicObjectFactory } from './HybridCosmicObjectFactory';
import { ScoreManager } from './ScoreManager';
import { ScoreHud } from './ScoreHud';
import { FloatingScoreEffect } from './FloatingScoreEffect';
import {
  CosmicSlashConfig,
  DEFAULT_COSMIC_SLASH_CONFIG,
  CosmicSlashDebugInfo,
  CosmicObjectInstance,
  CosmicObjectType,
} from './types';
import { PowHud } from './PowHud';
import { PowLaserEffect } from './PowLaserEffect';
import { PowManager } from './PowManager';

export class CosmicSlashController {
  private container: HTMLElement;
  private config: CosmicSlashConfig;

  // Three.js core
  private scene: THREE.Scene;
  private overlayScene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private postProcessing: PostProcessingManager | null = null;

  private assetLibrary: CosmicAssetLibrary | null = null;

  // Game subsystems
  private trailRenderer: HandTrailRenderer | null = null;
  private objectPool: ObjectPoolManager | null = null;
  private collisionDetector: CollisionDetector | null = null;
  private sliceEffect: SliceEffect | null = null;
  private background: CosmicBackground | null = null;
  private floatingScoreEffect: FloatingScoreEffect | null = null;

  // Scoring
  private scoreManager: ScoreManager | null = null;
  private scoreHud: ScoreHud | null = null;

  // POW System
  private powManager: PowManager | null = null;
  private powHud: PowHud | null = null;
  private powLaserEffect: PowLaserEffect | null = null;

  // Boss
  private bossInstance: CosmicObjectInstance | null = null;
  private nextBossLevel: number = 5;

  // State
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private lastTimestamp: number = 0;
  private debugCallback: ((info: CosmicSlashDebugInfo) => void) | null = null;

  constructor(
    _inputManager: InputManager,
    container: HTMLElement,
    config: Partial<CosmicSlashConfig> = {}
  ) {
    this.container = container;
    this.config = { ...DEFAULT_COSMIC_SLASH_CONFIG, ...config };

    this.scene = new THREE.Scene();
    this.overlayScene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    this.camera.position.z = 5;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.renderer.domElement.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 10;
    `;
    container.appendChild(this.renderer.domElement);
  }

  initialize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.setupLighting();

    this.assetLibrary = new CosmicAssetLibrary(this.renderer, { enableKtx2: false });
    this.background = new CosmicBackground(this.scene, this.config.background);

    this.trailRenderer = new HandTrailRenderer(this.overlayScene, this.camera, this.container);

    const factory = new HybridCosmicObjectFactory(this.assetLibrary);
    this.objectPool = new ObjectPoolManager(this.scene, this.camera, this.config.objectPool, factory);

    this.setupScoring();

    this.collisionDetector = new CollisionDetector(this.camera, width, height);
    this.sliceEffect = new SliceEffect(this.scene, this.config.sliceEffect);
    this.floatingScoreEffect = new FloatingScoreEffect(this.scene);

    this.postProcessing = new PostProcessingManager(this.renderer, this.scene, this.camera);

    this.powManager = new PowManager();
    this.powHud = new PowHud(this.container);
    this.powHud.show();
    this.powManager.addListener((state) => this.powHud?.update(state));
    this.powLaserEffect = new PowLaserEffect(this.scene, this.camera);

    console.log('[CosmicSlashController] Initialized');
  }

  private setupLighting(): void {
    const ambient = new THREE.AmbientLight(0x222244, 0.35);
    this.scene.add(ambient);
    const point = new THREE.PointLight(0xffffff, 1, 30);
    point.position.set(0, 0, 5);
    this.scene.add(point);
  }

  private setupScoring(): void {
    if (!this.objectPool) return;
    this.scoreManager = new ScoreManager({
      pointsByType: {
        [CosmicObjectType.STAR]: 10,
        [CosmicObjectType.CRYSTAL]: 15,
        [CosmicObjectType.METEOR]: 20,
        [CosmicObjectType.VOID_PEARL]: 25,
        [CosmicObjectType.NEBULA_CORE]: 30,
        [CosmicObjectType.ANCIENT_RELIC]: 35,
        [CosmicObjectType.COMET_EMBER]: 40,
      } as any,
      maxLevel: 50
    });

    this.scoreHud = new ScoreHud(this.container);
    this.scoreHud.show();

    this.scoreManager.addListener((state, event) => {
      this.scoreHud?.update(state, event);
      if (state.level >= this.nextBossLevel && !this.bossInstance) {
        this.initiateBossSequence(state.level);
        this.nextBossLevel += 5;
      }
    });

    this.objectPool.onObjectMissed((instance) => {
      this.scoreManager?.applyMiss(instance.config.type);
    });
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[CosmicSlashController] Started');
  }

  stop(): void {
    this.isRunning = false;
    console.log('[CosmicSlashController] Stopped');
  }

  togglePause(): boolean {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  reset(): void {
    this.scoreManager?.reset();
    this.objectPool?.reset();
    this.powManager?.reset();
  }

  enableDebug(callback: (info: CosmicSlashDebugInfo) => void): void {
    this.debugCallback = callback;
  }

  disableDebug(): void {
    this.debugCallback = null;
  }

  update(timestamp: number, input: InputState): void {
    if (!this.isRunning) return;
    const deltaTime = this.lastTimestamp > 0 ? (timestamp - this.lastTimestamp) / 1000 : 0;
    this.lastTimestamp = timestamp;

    // 1. Trail Handling
    // Slash is active when button is held
    const isWiping = input.connected && input.buttonDown;
    this.trailRenderer?.setEnabled(isWiping);
    this.trailRenderer?.updateFromPosition(input.cursor.x, input.cursor.y, input.connected, deltaTime);

    // 2. POW Processing
    if (this.powManager) {
      this.powManager.update(deltaTime);
      // Tap triggers Power-up boost or Laser if fully charged
      if (input.lastGesture?.type === 'double_tap' && this.powManager.isReady()) {
        this.powManager.activate();
        this.powLaserEffect?.activate();
      }

      if (this.powManager.isActive()) {
        const p1 = this.unproject(input.cursor.x, input.cursor.y, -5);
        this.powLaserEffect?.setHandPositions(p1, p1); // Singe point laser for Mudra?
        this.powLaserEffect?.update(deltaTime);
        this.checkBeamCollisions(new THREE.Vector2(input.cursor.x * this.container.clientWidth, input.cursor.y * this.container.clientHeight));
      } else {
        this.powLaserEffect?.deactivate();
      }
    }

    // 3. Game Subsystems
    this.objectPool?.update(deltaTime, timestamp);
    this.background?.update(deltaTime);
    this.sliceEffect?.update(deltaTime);
    this.floatingScoreEffect?.update(deltaTime);

    // 4. Collision Detection
    if (isWiping) {
      this.checkCollisions();
    }

    // 5. Rendering
    if (this.postProcessing) {
      this.postProcessing.render();
    } else {
      this.renderer.render(this.scene, this.camera);
      this.renderer.autoClear = false;
      this.renderer.render(this.overlayScene, this.camera);
      this.renderer.autoClear = true;
    }

    // 6. Debug Info
    if (this.debugCallback) {
      this.debugCallback({
        fps: 60,
        handsDetected: input.connected ? 1 : 0,
        activeObjects: this.objectPool?.getActiveObjects().length ?? 0,
        totalSliced: this.objectPool?.getTotalSliced() ?? 0,
        trailPointCounts: { '0': this.trailRenderer?.getPointCount() ?? 0 },
        activeExplosions: 0,
        drawCalls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
        trailRenderMode: 'depth-aware',
        detectionIntervalMs: 0,
      });
    }
  }

  private checkCollisions(): void {
    if (!this.trailRenderer || !this.objectPool || !this.collisionDetector) return;
    const segments = this.trailRenderer.getTrailSegments();
    const objects = this.objectPool.getActiveObjects();
    const collisions = this.collisionDetector.detectCollisions(segments, objects);
    for (const c of collisions) {
      this.handleSlice(c);
    }
  }

  private handleSlice(collision: CollisionEvent): void {
    const { object } = collision;
    this.objectPool?.sliceObject(object);
    this.powManager?.addCharge(object.config.type);
    const points = this.scoreManager?.applySlice(object.config.type) ?? 0;
    this.floatingScoreEffect?.trigger(object.position.clone(), points);
    this.sliceEffect?.trigger(object.position.clone(), {
      type: object.config.type,
      baseColor: object.config.color,
      glowColor: object.config.emissiveColor,
      velocityMultiplier: 1.0,
    });
  }

  private checkBeamCollisions(screenPos: THREE.Vector2): void {
    const objects = this.objectPool?.getActiveObjects() ?? [];
    const tempV3 = new THREE.Vector3();
    const widthHalf = this.container.clientWidth / 2;
    const heightHalf = this.container.clientHeight / 2;

    for (const obj of objects) {
      tempV3.copy(obj.position);
      tempV3.project(this.camera);

      const x = tempV3.x * widthHalf + widthHalf;
      const y = -(tempV3.y * heightHalf) + heightHalf;

      const dist = screenPos.distanceTo(new THREE.Vector2(x, y));
      if (dist < 60) {
        this.handleSlice({
          object: obj,
          velocity: 10,
          screenPosition: { x, y },
          handId: '0'
        });
      }
    }
  }

  private initiateBossSequence(level: number): void {
    console.log('Boss incoming level', level);
    // Logic for boss...
  }

  private unproject(x: number, y: number, z: number): THREE.Vector3 {
    const vector = new THREE.Vector3(x * 2 - 1, -y * 2 + 1, 0.5);
    vector.unproject(this.camera);
    const dir = vector.sub(this.camera.position).normalize();
    const distance = (z - this.camera.position.z) / dir.z;
    return this.camera.position.clone().add(dir.multiplyScalar(distance));
  }

  handleResize = (): void => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.postProcessing?.resize(width, height);
  };

  dispose(): void {
    this.stop();
    this.renderer.dispose();
    this.scene.clear();
    this.overlayScene.clear();
    console.log('[CosmicSlashController] Disposed');
  }
}
