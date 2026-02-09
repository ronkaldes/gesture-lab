/**
 * LightBulbController - Mudra Integrated Light Interaction
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { InputManager } from '../shared/InputManager';
import { InputState } from '../shared/InputTypes';
import { PostProcessingPipeline } from './components/PostProcessingPipeline';
import { FilamentGlowMesh, COLOR_TEMPERATURES } from './components/FilamentGlowMesh';
import { IncandescentAnimator } from './components/IncandescentAnimator';
import { CordSimulator } from './physics/CordSimulator';
import { CordMesh } from './components/CordMesh';
import {
  LightBulbState,
  LightState,
  type LightBulbConfig,
} from './types';

export class LightBulbController {
  private readonly container: HTMLElement;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private postProcessing: PostProcessingPipeline;
  private incandescentAnimator: IncandescentAnimator;

  private lightBulbGroup: THREE.Group | null = null;
  private bulbMaterial: THREE.MeshStandardMaterial | null = null;
  private filamentMaterial: THREE.MeshStandardMaterial | null = null;
  private filamentGlow: FilamentGlowMesh;
  private pointLight: THREE.PointLight;

  private cordSimulator: CordSimulator | null = null;
  private cordMesh: CordMesh | null = null;
  private cordAnchor: THREE.Object3D | null = null;

  private state: LightBulbState = LightBulbState.UNINITIALIZED;
  private lightState: LightState = LightState.OFF;
  private lastTimestamp: number = 0;
  private debugCallback: ((info: any) => void) | null = null;

  constructor(
    _inputManager: InputManager,
    container: HTMLElement,
    _config: Partial<LightBulbConfig> = {}
  ) {
    this.container = container;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 0, 5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.pointLight = new THREE.PointLight(0xfff4e0, 0, 10);
    this.scene.add(this.pointLight);

    this.filamentGlow = new FilamentGlowMesh({ radius: 0.03, color: COLOR_TEMPERATURES.WARM_WHITE, opacity: 0 });
    this.scene.add(this.filamentGlow.mesh);

    this.postProcessing = new PostProcessingPipeline(this.renderer, this.scene, this.camera, {
      bloomStrength: 1.5,
      bloomThreshold: 0.4,
      bloomRadius: 0.8,
      enabled: true,
    });
    this.incandescentAnimator = new IncandescentAnimator((s) => this.applyAnimationState(s));
  }

  initialize(): void {
    this.renderer.domElement.style.cssText = `position: absolute; top:0; left:0; width:100%; height:100%; z-index:10; pointer-events:none;`;
    this.container.appendChild(this.renderer.domElement);

    const loader = new GLTFLoader();
    loader.load('/models/light-bulb.glb', (gltf) => {
      this.lightBulbGroup = new THREE.Group();
      gltf.scene.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const name = child.name.toLowerCase();
        if (name.includes('bulb')) {
          this.bulbMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, emissive: 0x000000, transparent: true, opacity: 0.8 });
          child.material = this.bulbMaterial;
        } else if (name.includes('filament')) {
          this.filamentMaterial = new THREE.MeshStandardMaterial({ color: 0x442200, emissive: 0x000000 });
          child.material = this.filamentMaterial;
        }
      });
      this.lightBulbGroup.add(gltf.scene);
      this.lightBulbGroup.scale.setScalar(0.5);
      this.lightBulbGroup.position.set(0, 1, 0);
      this.scene.add(this.lightBulbGroup);

      // Cord
      this.cordAnchor = new THREE.Object3D();
      this.cordAnchor.position.set(0.1, -0.4, 0.1);
      this.lightBulbGroup.add(this.cordAnchor);

      const anchorPos = new THREE.Vector3();
      this.cordAnchor.getWorldPosition(anchorPos);
      this.cordSimulator = new CordSimulator(anchorPos, { totalLength: 0.6 });
      this.cordMesh = new CordMesh(this.cordSimulator, { radius: 0.01, color: 0xb8860b });
      this.scene.add(this.cordMesh.getMesh());

      this.postProcessing.setup(this.filamentGlow.mesh);
      this.state = LightBulbState.READY;
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  start(): void { this.state = LightBulbState.RUNNING; }
  stop(): void { this.state = LightBulbState.PAUSED; }

  update(timestamp: number, input: InputState): void {
    if (this.state !== LightBulbState.RUNNING) return;
    const deltaTime = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    if (input.connected) {
      // 1. Navigation -> Rotate bulb
      if (this.lightBulbGroup) {
        this.lightBulbGroup.rotation.y = THREE.MathUtils.lerp(this.lightBulbGroup.rotation.y, (input.cursor.x - 0.5) * Math.PI, 0.1);
      }

      // 2. Button Hold -> Pull cord
      if (this.cordSimulator && this.cordAnchor) {
        if (input.buttonDown) {
          const target = new THREE.Vector3(input.cursor.x * 2 - 1, (1 - input.cursor.y) * 2 - 1, 0.5);
          target.unproject(this.camera);
          this.cordSimulator.pinParticle(16);
          this.cordSimulator.grabParticle(16, target);
        } else {
          this.cordSimulator.unpinParticle(16);
        }
      }

      // 3. Tap -> Toggle Light
      if (input.lastGesture?.type === 'tap') {
        this.toggleLight();
      }

      // 4. Pressure -> Intensity (if on)
      if (this.lightState === LightState.ON) {
        this.incandescentAnimator.setDirectIntensity(0.5 + input.pressure * 0.5);
      }
    }

    if (this.cordSimulator && this.cordAnchor) {
      const pos = new THREE.Vector3();
      this.cordAnchor.getWorldPosition(pos);
      this.cordSimulator.update(deltaTime);
      this.cordMesh?.update();
    }

    if (this.debugCallback) {
      this.debugCallback({
        fps: 60,
        handsDetected: input.connected ? 1 : 0,
        lightIntensity: this.incandescentAnimator.getState().intensity,
      });
    }

    this.postProcessing.render(deltaTime);
  }

  reset(): void {
    this.lightState = LightState.OFF;
    this.incandescentAnimator.setImmediate(false);
    if (this.cordSimulator && this.cordAnchor) {
      const pos = new THREE.Vector3();
      this.cordAnchor.getWorldPosition(pos);
      this.cordSimulator.reattachAnchor(pos);
    }
  }

  enableDebug(callback: (info: any) => void): void {
    this.debugCallback = callback;
  }

  disableDebug(): void {
    this.debugCallback = null;
  }

  private toggleLight(): void {
    this.lightState = this.lightState === LightState.ON ? LightState.OFF : LightState.ON;
    if (this.lightState === LightState.ON) this.incandescentAnimator.warmUp();
    else this.incandescentAnimator.coolDown();
  }

  private applyAnimationState(state: any): void {
    const { intensity } = state;
    this.filamentGlow.setIntensity(intensity);
    this.postProcessing.setGodRaysIntensity(intensity);
    if (this.bulbMaterial) {
      this.bulbMaterial.emissive.setHex(0xffaa44);
      this.bulbMaterial.emissiveIntensity = intensity * 2;
    }
    this.pointLight.intensity = intensity * 2;
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
