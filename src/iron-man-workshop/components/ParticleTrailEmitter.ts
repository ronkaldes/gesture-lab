/**
 * ParticleTrailEmitter
 *
 * Creates thruster exhaust particle trails behind moving armor limbs.
 * Inspired by the Mark 42/43 repulsor trails from the MCU.
 *
 * Features:
 * - Particle pooling for performance (no allocation during animation)
 * - Additive blending for glowing effect
 * - Short lifetime with fade-out
 * - Attaches to moving limbs automatically
 */

import * as THREE from 'three';

/** Configuration for particle trail appearance */
export interface ParticleTrailConfig {
  /** Maximum particles per trail */
  maxParticles: number;
  /** Particle lifetime in seconds */
  lifetime: number;
  /** Initial particle size */
  particleSize: number;
  /** Trail color (core) */
  coreColor: THREE.Color;
  /** Trail color (fade) */
  fadeColor: THREE.Color;
  /** Particles to emit per frame (can be fractional) */
  emissionRate?: number;
}

const DEFAULT_CONFIG: ParticleTrailConfig = {
  maxParticles: 120, // Increased for denser, more spectacular trails
  lifetime: 0.7, // Even longer lifetime for visible streak
  particleSize: 0.055, // Slightly larger for visibility
  coreColor: new THREE.Color(0x00ffff), // Cyan
  fadeColor: new THREE.Color(0x002233), // Darker fade
};

/** Individual particle data */
interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  lifetime: number;
  size: number;
  active: boolean;
}

/**
 * ParticleTrailEmitter
 *
 * Manages particle trails for cinematic thruster exhaust effects.
 * Uses object pooling and GPU-friendly THREE.Points for performance.
 */
export class ParticleTrailEmitter {
  private config: ParticleTrailConfig;
  private particles: Particle[] = [];
  private particleSystem: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private positionAttribute: THREE.BufferAttribute;
  private colorAttribute: THREE.BufferAttribute;
  private sizeAttribute: THREE.BufferAttribute;
  private isEmitting: boolean = false;
  private emitPosition: THREE.Vector3 = new THREE.Vector3();
  private emitDirection: THREE.Vector3 = new THREE.Vector3(0, -1, 0);

  // Performance: Pre-allocated temp objects to avoid per-frame GC pressure
  private readonly _tempColor: THREE.Color = new THREE.Color();

  constructor(config: Partial<ParticleTrailConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize particle pool
    for (let i = 0; i < this.config.maxParticles; i++) {
      this.particles.push({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        age: 0,
        lifetime: this.config.lifetime,
        size: this.config.particleSize,
        active: false,
      });
    }

    // Create geometry with buffer attributes
    this.geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(this.config.maxParticles * 3);
    const colors = new Float32Array(this.config.maxParticles * 3);
    const sizes = new Float32Array(this.config.maxParticles);

    this.positionAttribute = new THREE.BufferAttribute(positions, 3);
    this.colorAttribute = new THREE.BufferAttribute(colors, 3);
    this.sizeAttribute = new THREE.BufferAttribute(sizes, 1);

    this.geometry.setAttribute('position', this.positionAttribute);
    this.geometry.setAttribute('color', this.colorAttribute);
    this.geometry.setAttribute('size', this.sizeAttribute);

    // Custom shader material for glowing particles
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vColor = color;
          vAlpha = 1.0;

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          // Circular soft particle
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;

          // Soft edge falloff
          float alpha = 1.0 - smoothstep(0.2, 0.5, dist);
          alpha *= vAlpha;

          // Glow core
          float core = 1.0 - smoothstep(0.0, 0.3, dist);
          vec3 finalColor = vColor + vec3(core * 0.5);

          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particleSystem = new THREE.Points(this.geometry, material);
    this.particleSystem.frustumCulled = false;
  }

  /**
   * Get the THREE.Points object to add to scene
   */
  getObject3D(): THREE.Points {
    return this.particleSystem;
  }

  /**
   * Start emitting particles at the given position
   */
  startEmitting(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    rate?: number
  ): void {
    this.isEmitting = true;
    this.emitPosition.copy(position);
    this.emitDirection.copy(direction).normalize();
    if (rate !== undefined) {
      this.config.emissionRate = rate;
    }
  }

  /**
   * Update emit position (call each frame while emitting)
   */
  updateEmitPosition(position: THREE.Vector3): void {
    this.emitPosition.copy(position);
  }

  /**
   * Update emit direction based on velocity (for trailing particles)
   * Direction should be OPPOSITE to movement direction for exhaust effect
   */
  updateEmitDirection(direction: THREE.Vector3): void {
    if (direction.lengthSq() > 0.001) {
      // Only update if we have meaningful velocity
      this.emitDirection.copy(direction).normalize().negate(); // Negate for exhaust behind movement
    }
  }

  /**
   * Stop emitting new particles (existing ones will fade out)
   */
  stopEmitting(): void {
    this.isEmitting = false;
  }

  /**
   * Update all particles (call each frame)
   */
  update(deltaTime: number): void {
    const positions = this.positionAttribute.array as Float32Array;
    const colors = this.colorAttribute.array as Float32Array;
    const sizes = this.sizeAttribute.array as Float32Array;

    // Emit new particles if active
    if (this.isEmitting) {
      // Calculate how many particles to emit this frame based on rate
      // Accumulator logic could be added for precise low-rate emission,
      // but for now simple per-frame count or probabilistic emission is fine.

      const rate = this.config.emissionRate ?? 4; // Default to 4 (burst mode)

      // Handle fractional rates (e.g. 0.5 = 1 particle every 2 frames)
      if (rate >= 1) {
        for (let i = 0; i < Math.floor(rate); i++) this.emitParticle();
        if (Math.random() < rate % 1) this.emitParticle();
      } else {
        if (Math.random() < rate) this.emitParticle();
      }
    }

    // Update all particles
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];

      if (!particle.active) {
        // Hide inactive particles
        sizes[i] = 0;
        continue;
      }

      // Age the particle
      particle.age += deltaTime;

      if (particle.age >= particle.lifetime) {
        // Particle died
        particle.active = false;
        sizes[i] = 0;
        continue;
      }

      // Move particle
      particle.position.addScaledVector(particle.velocity, deltaTime);

      // Calculate life ratio (0 = born, 1 = dead)
      const lifeRatio = particle.age / particle.lifetime;

      // Update position
      positions[i * 3] = particle.position.x;
      positions[i * 3 + 1] = particle.position.y;
      positions[i * 3 + 2] = particle.position.z;

      // Fade color from core to fade color (using pre-allocated temp to avoid GC)
      this._tempColor.lerpColors(
        this.config.coreColor,
        this.config.fadeColor,
        lifeRatio
      );
      colors[i * 3] = this._tempColor.r;
      colors[i * 3 + 1] = this._tempColor.g;
      colors[i * 3 + 2] = this._tempColor.b;

      // Shrink size over lifetime
      sizes[i] = this.config.particleSize * (1 - lifeRatio * 0.7);
    }

    // Mark attributes as needing update
    this.positionAttribute.needsUpdate = true;
    this.colorAttribute.needsUpdate = true;
    this.sizeAttribute.needsUpdate = true;
  }

  /**
   * Emit a single particle
   */
  private emitParticle(): void {
    // Find an inactive particle
    for (const particle of this.particles) {
      if (!particle.active) {
        particle.active = true;
        particle.age = 0;
        particle.lifetime = this.config.lifetime * (0.8 + Math.random() * 0.4);
        particle.size = this.config.particleSize * (0.7 + Math.random() * 0.6);

        // Start at emit position with slight random offset
        particle.position.copy(this.emitPosition);
        particle.position.x += (Math.random() - 0.5) * 0.1;
        particle.position.y += (Math.random() - 0.5) * 0.1;
        particle.position.z += (Math.random() - 0.5) * 0.1;

        // Velocity in emit direction - move faster for clear trail
        particle.velocity
          .copy(this.emitDirection)
          .multiplyScalar(1.2 + Math.random() * 0.4); // Faster for longer streaks
        // Less random spread for cleaner trails
        particle.velocity.x += (Math.random() - 0.5) * 0.15;
        particle.velocity.y += (Math.random() - 0.5) * 0.15;
        particle.velocity.z += (Math.random() - 0.5) * 0.15;

        return; // Only emit one particle per call
      }
    }
  }

  /**
   * Reset all particles to inactive
   */
  reset(): void {
    this.isEmitting = false;
    for (const particle of this.particles) {
      particle.active = false;
    }

    const sizes = this.sizeAttribute.array as Float32Array;
    sizes.fill(0);
    this.sizeAttribute.needsUpdate = true;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.geometry.dispose();
    (this.particleSystem.material as THREE.ShaderMaterial).dispose();
    console.log('[ParticleTrailEmitter] Disposed');
  }
}

/**
 * ParticleTrailSystem
 *
 * Manages multiple particle emitters for all limbs.
 * Provides a simple interface to start/stop trails per limb.
 */
export class ParticleTrailSystem {
  private emitters: Map<string, ParticleTrailEmitter> = new Map();
  private group: THREE.Group = new THREE.Group();

  constructor() {
    this.group.name = 'ParticleTrailSystem';
  }

  /**
   * Get the THREE.Group containing all particle systems
   */
  getObject3D(): THREE.Group {
    return this.group;
  }

  /**
   * Create an emitter for a limb
   */
  createEmitter(
    limbName: string,
    config?: Partial<ParticleTrailConfig>
  ): ParticleTrailEmitter {
    const emitter = new ParticleTrailEmitter(config);
    this.emitters.set(limbName, emitter);
    this.group.add(emitter.getObject3D());
    return emitter;
  }

  /**
   * Start emitting particles for a limb
   */
  startTrail(
    limbName: string,
    position: THREE.Vector3,
    direction: THREE.Vector3,
    rate?: number
  ): void {
    const emitter = this.emitters.get(limbName);
    if (emitter) {
      emitter.startEmitting(position, direction, rate);
    }
  }

  /**
   * Update emit position for a limb
   */
  updateTrail(limbName: string, position: THREE.Vector3): void {
    const emitter = this.emitters.get(limbName);
    if (emitter) {
      emitter.updateEmitPosition(position);
    }
  }

  /**
   * Update emit position AND direction for a limb (for velocity-based trailing)
   * This is the preferred method for cinematic particle trails
   */
  updateTrailWithVelocity(
    limbName: string,
    position: THREE.Vector3,
    velocity: THREE.Vector3
  ): void {
    const emitter = this.emitters.get(limbName);
    if (emitter) {
      emitter.updateEmitPosition(position);
      emitter.updateEmitDirection(velocity);
    }
  }

  /**
   * Stop emitting particles for a limb
   */
  stopTrail(limbName: string): void {
    const emitter = this.emitters.get(limbName);
    if (emitter) {
      emitter.stopEmitting();
    }
  }

  /**
   * Update all emitters
   */
  update(deltaTime: number): void {
    for (const emitter of this.emitters.values()) {
      emitter.update(deltaTime);
    }
  }

  /**
   * Reset all emitters
   */
  reset(): void {
    for (const emitter of this.emitters.values()) {
      emitter.reset();
    }
  }

  /**
   * Clean up all emitters
   */
  dispose(): void {
    for (const emitter of this.emitters.values()) {
      emitter.dispose();
    }
    this.emitters.clear();
    console.log('[ParticleTrailSystem] Disposed');
  }
}
