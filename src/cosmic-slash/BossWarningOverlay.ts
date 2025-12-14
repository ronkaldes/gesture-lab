/**
 * BossWarningOverlay
 * Premium, minimalist notification when a boss is approaching
 *
 * Design Philosophy:
 * - Urgent but elegant
 * - Cosmic danger aesthetic (Red/Orange/Gold)
 * - Refined typography
 * - Smooth animations
 */

import * as THREE from 'three';

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function drawTrackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  trackingPx: number
): void {
  const chars = Array.from(text);
  let totalWidth = 0;
  for (const ch of chars) {
    totalWidth += ctx.measureText(ch).width;
  }
  totalWidth += trackingPx * Math.max(0, chars.length - 1);

  let x = centerX - totalWidth / 2;
  for (const ch of chars) {
    ctx.fillText(ch, x + ctx.measureText(ch).width / 2, y);
    x += ctx.measureText(ch).width + trackingPx;
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class BossWarningOverlay {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;

  private sprite: THREE.Sprite;
  private material: THREE.SpriteMaterial;
  private texture: THREE.Texture;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private isActive: boolean = false;
  private animationAge: number = 0;
  private readonly animationDuration: number = 3.5; // seconds

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;

    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 256;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('[BossWarningOverlay] 2D canvas not available');
    }
    this.ctx = ctx;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    this.material = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false, // Always on top
      blending: THREE.AdditiveBlending,
    });

    this.sprite = new THREE.Sprite(this.material);
    this.sprite.visible = false;
    this.sprite.renderOrder = 100; // Very high render order

    // Initial scale (will be updated in update loop)
    this.sprite.scale.set(1, 0.25, 1);

    this.scene.add(this.sprite);
  }

  trigger(): void {
    this.isActive = true;
    this.animationAge = 0;
    this.sprite.visible = true;
    this.material.opacity = 1;
    this.draw(0);
  }

  update(deltaTime: number): void {
    if (!this.isActive) return;

    this.animationAge += deltaTime;

    if (this.animationAge >= this.animationDuration) {
      this.isActive = false;
      this.sprite.visible = false;
      return;
    }

    const progress = clamp01(this.animationAge / this.animationDuration);
    this.draw(progress);
    this.updateTransform();
  }

  private updateTransform(): void {
    // Position in front of camera
    const dist = 4;
    const vector = new THREE.Vector3(0, 0, -dist);
    vector.applyQuaternion(this.camera.quaternion);
    const pos = this.camera.position.clone().add(vector);

    // Slight vertical offset
    pos.y += 0.5;

    this.sprite.position.copy(pos);

    // Scale based on distance to maintain constant screen size
    // Aspect ratio of canvas is 4:1 (1024x256)
    const scale = 2.5; // Base scale
    this.sprite.scale.set(scale, scale * 0.25, 1);
  }

  private draw(progress: number): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    // Animation phases
    // 0.0 - 0.2: Fade in & Expand
    // 0.2 - 0.8: Sustain & Pulse
    // 0.8 - 1.0: Fade out

    let opacity = 0;
    let scale = 1;
    let tracking = 0;

    if (progress < 0.2) {
      const t = easeOutCubic(progress / 0.2);
      opacity = t;
      scale = 0.8 + 0.2 * t;
      tracking = 20 * (1 - t);
    } else if (progress < 0.8) {
      opacity = 1;
      const t = (progress - 0.2) / 0.6;
      // Subtle pulse
      scale = 1.0 + 0.05 * Math.sin(t * Math.PI * 2);
      tracking = 0;
    } else {
      const t = easeInOutCubic((progress - 0.8) / 0.2);
      opacity = 1 - t;
      scale = 1.0 + 0.1 * t;
      tracking = 10 * t;
    }

    this.material.opacity = opacity;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);

    // Draw Glow
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.4);
    gradient.addColorStop(0, `rgba(255, 60, 0, ${0.2 * opacity})`);
    gradient.addColorStop(0.5, `rgba(255, 60, 0, ${0.05 * opacity})`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(-w / 2, -h / 2, w, h);

    // Draw Text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Main Warning Text
    ctx.font = '900 64px "Nunito", sans-serif';
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.shadowColor = 'rgba(255, 50, 0, 0.8)';
    ctx.shadowBlur = 20;
    drawTrackedText(ctx, 'ANOMALY DETECTED', 0, -10, 8 + tracking);

    // Subtitle
    ctx.font = '300 32px "Nunito", sans-serif';
    ctx.fillStyle = `rgba(255, 100, 50, ${opacity * 0.9})`;
    ctx.shadowBlur = 10;
    drawTrackedText(ctx, 'MASSIVE ENERGY SIGNATURE', 0, 40, 4 + tracking * 0.5);

    // Decorative Lines
    const lineWidth = 300 * scale;
    const lineAlpha = opacity * 0.6;

    ctx.strokeStyle = `rgba(255, 60, 0, ${lineAlpha})`;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(-lineWidth / 2, 70);
    ctx.lineTo(lineWidth / 2, 70);
    ctx.stroke();

    ctx.restore();

    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.scene.remove(this.sprite);
    this.texture.dispose();
    this.material.dispose();
  }
}
