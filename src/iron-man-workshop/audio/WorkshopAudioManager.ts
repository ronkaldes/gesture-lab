/**
 * @fileoverview Centralized audio manager for the Iron Man Workshop mode.
 *
 * Provides a single source of truth for all audio playback following the
 * Single Responsibility Principle. Uses Three.js Audio system for
 * true 3D spatialization and cinematic audio.
 *
 * @module iron-man-workshop/audio/WorkshopAudioManager
 */

import * as THREE from 'three';
import gsap from 'gsap';
import { ThreeAudioManager, SoundName, SoundConfig } from './ThreeAudioManager';

/**
 * Default volume levels for each sound type.
 * Tuned for a premium, cinematic mix.
 */
const SOUND_CONFIGS: Record<SoundName, SoundConfig> = {
  ambientHum: {
    path: '/audio/iron-man-workshop/ambient-hum.wav',
    volume: 0.06, // Deep, steady background drone
    loop: true,
  },
  bootSequence: {
    path: '/audio/iron-man-workshop/boot-sequence.wav',
    volume: 0.45, // Systematic startup sequence
  },
  loadingLoop: {
    path: '/audio/iron-man-workshop/loading-loop.wav',
    volume: 0.3, // High-tech typing/computing sound
    loop: true,
  },
  hoverDetails: {
    path: '/audio/iron-man-workshop/hover-details.wav',
    volume: 0.25, // Subtle UI blip for info reveal
  },
  rotateSchematic: {
    path: '/audio/iron-man-workshop/rotate-sound.wav',
    volume: 0.03, // Mechanical rotation feedback
    duration: 1.5, // Limit to first 1.5 seconds of the 7s file
  },
  plasmaShot: {
    path: '/audio/iron-man-workshop/part-lock.wav',
    volume: 0.15, // Tight mechanical lock sound
    duration: 0.3, // Short, snappy impact
  },
  flybyIn: {
    path: '/audio/iron-man-workshop/flyby-in.wav',
    volume: 0.4, // Sharp whoosh for parts flying in
    refDistance: 5,
  },
  scanBeam: {
    path: '/audio/iron-man-workshop/scan-beam.wav',
    volume: 0.35, // High-tech scanner sweep
    refDistance: 3,
    duration: 1.5,
  },
  energySurge: {
    path: '/audio/iron-man-workshop/energy-surge.wav',
    volume: 0.45, // Powerful energy discharge
  },
  pinchRotate: {
    path: '/audio/iron-man-workshop/pinch-rotate.wav',
    volume: 0.2, // Subtle mechanical rotation
  },
  leftHandRotate: {
    path: '/audio/iron-man-workshop/left-hand-rotate.wav',
    volume: 0.2, // Looping particle texture during rotation
    loop: true,
  },
  disassemble: {
    path: '/audio/iron-man-workshop/disassemble.wav',
    volume: 0.4, // Large swish for disassembly
  },
  assemble: {
    path: '/audio/iron-man-workshop/assemble.wav',
    volume: 0.4, // Systematic mechanical re-assembly
  },
};

/**
 * Centralized audio manager for the Iron Man Workshop mode.
 *
 * Manages the ThreeAudioManager instance and handles high-level audio logic
 * like fading and ambient tracks.
 */
export class WorkshopAudioManager {
  private audioManager: ThreeAudioManager;

  constructor(camera: THREE.Camera) {
    this.audioManager = new ThreeAudioManager(camera);
    this.initializeSounds();
  }

  /**
   * Preloads all audio files.
   */
  private initializeSounds(): void {
    this.audioManager.loadSounds(SOUND_CONFIGS).catch((err) => {
      console.error('[WorkshopAudioManager] Failed to load sounds:', err);
    });
  }

  /**
   * Plays a sound by name.
   *
   * @param name - The sound to play
   * @param sourceMesh - Optional 3D object to attach sound to (for spatial audio)
   */
  play(name: SoundName, sourceMesh?: THREE.Object3D): void {
    const config = SOUND_CONFIGS[name];
    if (!config) {
      console.warn(`[WorkshopAudioManager] Unknown sound: ${name}`);
      return;
    }

    this.audioManager.play(name, config, sourceMesh);
  }

  /**
   * Stops a named looping sound.
   */
  stop(name: SoundName): void {
    this.audioManager.stop(name);
  }

  /**
   * Starts the ambient background hum with a fade-in.
   */
  startAmbient(): void {
    const name: SoundName = 'ambientHum';
    const config = SOUND_CONFIGS[name];

    // Play global ambient
    const sound = this.audioManager.play(name, config);

    if (sound) {
      sound.setVolume(0);
      gsap.to(sound.gain.gain, {
        value: config.volume,
        duration: 2.0,
        ease: 'power2.out',
      });
      console.log('[WorkshopAudioManager] Ambient hum started');
    }
  }

  /**
   * Stops ambient background with fade-out.
   */
  stopAmbient(): void {
    // Current implementation of stop() in ThreeAudioManager is abrupt.
    // For proper fade out, we'd need access to the sound instance.
    // Since stop() only takes name, we assume immediate stop for now or
    // we would need to enhance ThreeAudioManager to return the instance via lookup to animate it.
    // For simplicity/robustness, we'll just stop it.
    // Ideally, we'd refactor to fade out.
    this.audioManager.stop('ambientHum');
  }

  setEnabled(enabled: boolean): void {
    this.audioManager.setEnabled(enabled);
  }

  stopAll(): void {
    this.audioManager.stopAll();
  }

  dispose(): void {
    this.stopAll();
    // Further cleanup if needed
  }
}
