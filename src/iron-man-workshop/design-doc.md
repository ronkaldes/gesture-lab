# Exploded View / Assembly Sequence Feature Design Document

## Overview

This document describes the implementation plan for adding an **Exploded View / Assembly Sequence** animation to the Iron Man Workshop mode. This feature will allow the Mark VI holographic model to dramatically separate into its component parts and reassemble, directly referencing the iconic Mark 42/43 suit-up sequences from Iron Man 3.

---

## Current State Analysis

### Model Assets: `mark-vi-articulated.glb`

| Property          | Value                                                                |
| ----------------- | -------------------------------------------------------------------- |
| File Size         | ~1.7 MB (meshopt compressed)                                         |
| Articulated Parts | 6: `head`, `torso`, `arm_left`, `arm_right`, `leg_left`, `leg_right` |
| Part Structure    | Each is a separate `THREE.Mesh` with origin at joint                 |
| Hit Volumes       | Box geometry per limb (already implemented)                          |
| Materials         | Holographic shader with fresnel + scanlines                          |

### Existing Infrastructure

From `MarkVIModel.ts`:

- Limbs are stored in `limbMeshes: Map<LimbType, LimbReference>`
- Each limb has `mesh` and `initialRotation` properties
- Hit volumes are attached to each limb for raycasting

From `WorkshopController.ts`:

- Hand tracking with gesture detection (pinch, grab)
- Animation loop running at 60fps
- Hover/interaction state management

---

## MCU Reference: Mark 42 Prehensile Armor

The Mark 42 (Iron Man 3) introduced **"prehensile propulsion"** technology:

- Individual armor pieces fly to Tony and assemble around him
- Each piece has its own thruster
- Assembly is staggered - not simultaneous
- Servo sounds and metallic clicks accompany the assembly
- Pieces spin and rotate while in flight

**Key Visual Elements:**

1. Outward explosion from center (torso)
2. Curved flight paths with rotation
3. Thruster glow trails behind pieces
4. Staggered timing creates dramatic effect
5. Sound design sells the experience

---

## Technology Stack

### Animation: GSAP (GreenSock)

**Why GSAP:**

- Industry standard for web animation
- Native support for animating Three.js object properties
- Powerful timeline and stagger features
- Advanced easing functions (`power2.out`, `back.inOut`, `elastic`)
- Battle-tested (Google, Nike, Disney)

**Installation:**

```bash
npm install gsap
```

**Usage Pattern:**

```typescript
import gsap from 'gsap';

gsap.to(mesh.position, {
  x: targetX,
  y: targetY,
  z: targetZ,
  duration: 0.8,
  ease: 'power2.out',
});
```

### Sound Effects: Howler.js

**Why Howler.js:**

- Cross-browser compatibility
- Audio sprite support (multiple sounds in one file)
- Preloading prevents playback delays
- Spatial audio support

**Installation:**

```bash
npm install howler
```

### Particle Trails: Three.js Points/Shaders

Use `THREE.Points` with `BufferGeometry` for thruster exhaust effects.

---

## Animation Architecture

### State Machine

```
┌──────────────┐    explode()    ┌──────────────┐
│   ASSEMBLED  │─────────────────▶│  EXPLODING   │
└──────────────┘                  └──────────────┘
       ▲                                 │
       │                                 ▼
       │              ┌──────────────────────────┐
       │              │        EXPLODED          │
       │              └──────────────────────────┘
       │                                 │
       │               assemble()        │
┌──────────────┐   ◀─────────────────────┘
│  ASSEMBLING  │
└──────────────┘
```

### Explosion Directions

Each limb moves outward from the torso center:

```
                    HEAD ↑
                     (0, +Y, 0)

     ARM_LEFT ←      TORSO      → ARM_RIGHT
     (-X, 0, 0)   (center)       (+X, 0, 0)

                 ↙         ↘
            LEG_LEFT     LEG_RIGHT
         (-X, -Y, 0)    (+X, -Y, 0)
```

### Explosion Distances

| Limb      | Direction      | Distance (units) |
| --------- | -------------- | ---------------- |
| head      | +Y             | 1.5              |
| arm_left  | -X, slight +Y  | 2.0              |
| arm_right | +X, slight +Y  | 2.0              |
| leg_left  | -X, -Y         | 1.8              |
| leg_right | +X, -Y         | 1.8              |
| torso     | stays centered | 0                |

---

## Implementation Plan

### Tier 1: Core Animation (Must Have)

1. **Create ExplodedViewManager class**

   - File: `src/iron-man-workshop/components/ExplodedViewManager.ts`
   - Manages animation state (ASSEMBLED, EXPLODING, EXPLODED, ASSEMBLING)
   - Stores original positions/rotations of all limbs
   - Exposes `explode()` and `assemble()` methods

2. **GSAP Timeline Setup**

   ```typescript
   const explodeTimeline = gsap.timeline({ paused: true });

   // Stagger outward movement
   explodeTimeline
     .to(armLeft.position, { x: -2, duration: 0.8, ease: 'power2.out' }, 0.1)
     .to(armRight.position, { x: 2, duration: 0.8, ease: 'power2.out' }, 0.1)
     .to(head.position, { y: 1.5, duration: 0.8, ease: 'back.out(1.5)' }, 0.2)
     .to(legLeft.position, { x: -1.2, y: -1.8, duration: 0.8 }, 0.15)
     .to(legRight.position, { x: 1.2, y: -1.8, duration: 0.8 }, 0.15);
   ```

3. **Gesture Detection: Two-Hand Spread**

   - Detect when both hands are visible
   - Track distance between hands
   - Trigger explode when hands move apart quickly
   - Trigger assemble when hands move together

4. **Bidirectional Animation**
   - `explode()`: Play timeline forward
   - `assemble()`: Play timeline in reverse

### Tier 2: Enhanced (Should Have)

5. **Limb Rotation During Flight**

   ```typescript
   // Add rotation tweens parallel to position tweens
   explodeTimeline
     .to(head.rotation, { y: Math.PI * 2, duration: 1.2 }, 0)
     .to(armLeft.rotation, { z: -Math.PI / 4, duration: 0.8 }, 0.1)
     .to(armRight.rotation, { z: Math.PI / 4, duration: 0.8 }, 0.1);
   ```

6. **Sound Effects**

   - Create audio sprite with:
     - `servo_whir`: Continuous servo sound
     - `metal_click`: Click when piece locks in place
     - `power_up`: Arc reactor pulse sound
   - Sync sounds with animation timeline

7. **Arc Reactor Pulse**

   - Flash the chest glow brighter when animation triggers
   - Animate `uEmissiveIntensity` uniform in shader

8. **Camera Response**
   - Slight zoom out during explosion
   - Zoom back in during assembly

### Tier 3: Premium (Nice to Have)

9. **Particle Trails**

   - Create particle emitter class
   - Attach emitter to each limb during movement
   - Particles fade out over short lifetime
   - Use additive blending for glow effect

10. **Curved Flight Paths**

    - Use `THREE.CatmullRomCurve3` for curved trajectories
    - Limbs arc outward then settle into final position

11. **Holographic Shimmer**

    - Increase scanline frequency during animation
    - Add slight vertex displacement noise
    - Intensify fresnel glow

12. **Glow Intensification**
    - Animate bloom intensity during transition
    - Each limb gets brighter while moving

---

## File Structure

```
src/iron-man-workshop/
├── components/
│   ├── ExplodedViewManager.ts    [NEW]
│   ├── ParticleTrailEmitter.ts   [NEW - Tier 3]
│   ├── MarkVIModel.ts            [MODIFY - expose limb refs]
│   └── ...
├── audio/
│   └── suit-assembly.mp3         [NEW - audio sprite]
├── WorkshopController.ts         [MODIFY - integrate explosion]
└── types.ts                      [MODIFY - add animation states]
```

---

## API Design

### ExplodedViewManager

```typescript
interface ExplodedViewConfig {
  limbMeshes: Map<LimbType, LimbReference>;
  explosionDistance: number;
  animationDuration: number;
  enableSound: boolean;
  enableParticles: boolean;
}

class ExplodedViewManager {
  constructor(config: ExplodedViewConfig);

  // State
  getState(): 'assembled' | 'exploding' | 'exploded' | 'assembling';

  // Actions
  explode(): Promise<void>;
  assemble(): Promise<void>;
  toggle(): Promise<void>;

  // Cleanup
  dispose(): void;
}
```

### Gesture Detection Addition

```typescript
// In WorkshopController.ts
private detectTwoHandSpread(): boolean {
  // Returns true when both hands detected and moving apart
}

private detectTwoHandPinch(): boolean {
  // Returns true when both hands detected and moving together
}
```

---

## Performance Considerations

| Concern         | Mitigation                                      |
| --------------- | ----------------------------------------------- |
| Animation jank  | GSAP syncs with `requestAnimationFrame`         |
| Too many tweens | Only 6 objects - negligible overhead            |
| Particle trails | Use `InstancedMesh` or `Points` for efficiency  |
| Sound latency   | Preload all audio on mode initialization        |
| Memory leaks    | Proper disposal of GSAP timelines and particles |

---

## Testing Plan

1. **Unit Tests**

   - ExplodedViewManager state transitions
   - Gesture detection logic

2. **Visual Tests**

   - Verify limb positions match expected explosion vectors
   - Confirm rotation directions are natural
   - Check particle trail appearance

3. **Integration Tests**
   - Full explode/assemble cycle
   - Gesture trigger works reliably
   - Sound syncs with animation

---

## Success Criteria

- [ ] Limbs explode outward with staggered timing
- [ ] Limbs spin/rotate while moving
- [ ] Smooth easing (no janky motion)
- [ ] Two-hand gesture trigger works reliably
- [ ] Sound effects enhance the experience
- [ ] Arc reactor pulses on trigger
- [ ] Particle trails visible during motion
- [ ] Animation is reversible (assemble works)
- [ ] No performance degradation (maintains 60fps)
- [ ] Feels cinematic and Iron Man-like

---

## Dependencies

```json
{
  "gsap": "^3.12.0",
  "howler": "^2.2.4"
}
```

---

## Timeline Estimate

| Phase                  | Duration        |
| ---------------------- | --------------- |
| Tier 1: Core Animation | 4-6 hours       |
| Tier 2: Enhanced       | 3-4 hours       |
| Tier 3: Premium        | 4-6 hours       |
| Testing & Polish       | 2-3 hours       |
| **Total**              | **13-19 hours** |
