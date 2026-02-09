# Mudra Band Integration Design

**Date**: 2026-02-09
**Status**: Approved
**Scope**: Replace MediaPipe hand tracking with Mudra Band input across all 7 modes

---

## Summary

Replace the current MediaPipe webcam-based hand tracking system with Mudra Band input via the Mudra WebSocket API. All 7 existing modes will be adapted to use Mudra signals. A keyboard/mouse fallback ensures the app works without the physical device.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Input relationship | Replace MediaPipe entirely | Clean break, single input paradigm |
| Existing modes | Adapt all 7 modes | Preserve existing experiences |
| Spatial input signal | Navigation (deltas) | Precise, cursor-like, compatible with all other signals |
| Fallback | Keyboard/mouse | App always usable for development and demos |

## Signal Stack

All modes use the same compatible signal combination:

| Signal | Purpose | Data |
|--------|---------|------|
| `navigation` | Cursor/position (replaces hand position) | `delta_x`, `delta_y` accumulated to 0-1 range |
| `pressure` | Analog intensity (replaces pinch distance) | `normalized` 0-1 |
| `button` | Grab/hold (replaces pinch threshold) | `pressed` / `released` |
| `gesture` | Discrete actions | `tap`, `double_tap`, `twist`, `double_twist` |

**Constraint**: Navigation and IMU cannot be used simultaneously (hardware limitation). All modes use navigation.

---

## Architecture

### Input Abstraction Layer

```
       Mudra Band                  Keyboard/Mouse
      (WebSocket)                   (Fallback)
           |                            |
           v                            v
    MudraProvider               KeyboardMouseProvider
           |                            |
           +------------+---------------+
                        v
                  InputManager
           +---------------------+
           | cursor: {x, y}     |  <- normalized 0-1
           | pressure: number   |  <- 0-1
           | buttonDown: bool   |  <- grab/hold
           | lastGesture: Event |  <- tap/twist/etc
           | source: 'mudra'    |
           |   | 'fallback'     |
           +----------+----------+
                      |
             Mode Controllers
           (consume unified state)
```

### InputState Interface

```typescript
interface InputState {
  cursor: { x: number; y: number };   // normalized 0-1
  pressure: number;                     // 0-1
  buttonDown: boolean;                  // grab/hold state
  lastGesture: GestureEvent | null;     // consumed once per frame
  source: 'mudra' | 'fallback';
  connected: boolean;
}

interface GestureEvent {
  type: 'tap' | 'double_tap' | 'twist' | 'double_twist';
  timestamp: number;
}

interface InputProvider {
  connect(): Promise<void>;
  disconnect(): void;
  getState(): InputState;
  isConnected(): boolean;
}
```

### MudraProvider

- Connects to `ws://127.0.0.1:8766`
- Subscribes to `navigation`, `pressure`, `gesture`, `button` (one command per signal)
- Accumulates navigation deltas into normalized cursor position with configurable sensitivity
- Smooths navigation with 3-sample rolling average
- Applies dead zone to ignore small deltas
- Handles connection status messages for device disconnect detection

### KeyboardMouseProvider

| Input | Maps To |
|-------|---------|
| Mouse movement | `cursor` (normalized to canvas) |
| Left mouse button | `buttonDown` |
| Scroll wheel | `pressure` (accumulate, clamp 0-1) |
| Key 1 | `tap` gesture |
| Key 2 | `double_tap` gesture |
| Key 3 | `twist` gesture |
| Key 4 | `double_twist` gesture |
| Space bar | `button` press/release toggle |

### InputManager

- On startup, attempts Mudra WebSocket connection
- If connection succeeds: use MudraProvider, show connected indicator
- If connection fails/disconnects: fall back to KeyboardMouseProvider
- Reconnection with backoff (every 3s, max 5 attempts, then stay on fallback)
- Exposes `getState(): InputState` called each frame by the active mode
- Supports `triggerGesture(type)` for testing via Mudra's `trigger_gesture` command

---

## Mode Control Mappings

### Iron Man Workshop

| Signal | Action |
|--------|--------|
| Navigation | Hover cursor over armor pieces |
| Pressure | Rotation speed of assembly |
| Button hold | Grab/place piece |
| Tap | Confirm placement |
| Twist | Undo |

### Cosmic Slash

| Signal | Action |
|--------|--------|
| Navigation | Blade position on screen |
| Pressure | Blade size/intensity |
| Button hold | Slash active (drag to cut) |
| Tap | Power-up |
| Double tap | Combo attack |

### Interactive Galaxy

| Signal | Action |
|--------|--------|
| Navigation | Attraction/repulsion point |
| Pressure | Force strength/radius |
| Button hold | Toggle repulsion mode |
| Tap | Starburst effect |
| Twist | Switch attract/repel |

### Foggy Mirror

| Signal | Action |
|--------|--------|
| Navigation | Wipe cursor position |
| Pressure | Wipe radius |
| Button hold | Wiping active |
| Tap | Breathe on mirror (re-fog) |
| Twist | Reset mirror |

### Stellar Wave

| Signal | Action |
|--------|--------|
| Navigation | Deformation point on grid |
| Pressure | Deformation depth |
| Button hold | Deformation active |
| Twist | Push vs pull mode |
| Tap | Ripple effect |

### Light Bulb

| Signal | Action |
|--------|--------|
| Navigation | Cursor near cord |
| Pressure | Pull force |
| Button hold | Grab cord |
| Tap | Toggle light |
| Twist | Swing cord |

### Magnetic Clutter

| Signal | Action |
|--------|--------|
| Navigation | Magnetic field center |
| Pressure | Field strength |
| Button hold | Grab nearest ball |
| Twist | Attract vs repel mode |
| Tap | Scatter balls |

---

## Connection UI

### Status Indicator (top-right)

- **Mudra connected**: Teal dot + "Mudra" label (fades to subtle after 3s)
- **Fallback active**: Keyboard/mouse icon + "Use mouse or connect Mudra" (dismissible)
- **Reconnecting**: Pulsing dot + "Reconnecting..."

### Landing Page

Replace "Allow camera access" with "Connect Mudra Band or use keyboard/mouse."

### Per-Mode Hints

Auto-detect active input source and show appropriate control labels:

```
Mudra:    "Hold button + move to slash | Pressure = blade size | Tap = power-up"
Fallback: "Hold click + move to slash | Scroll = blade size | Press 1 = power-up"
```

### Debug Panel

Existing debug panel pattern, extended with:
- Live `InputState` values (cursor x/y, pressure, button, last gesture)
- Active provider name and WebSocket state
- Manual gesture trigger buttons (sends `trigger_gesture` over WS)

---

## Migration Path

### Files Removed

- `src/shared/HandTracker.ts` — MediaPipe integration
- `src/shared/GestureDetector.ts` — landmark-to-gesture conversion
- `src/shared/HandTypes.ts` — old hand type definitions
- `src/shared/GestureTypes.ts` — old gesture type definitions
- MediaPipe dependencies from `package.json`
- Webcam permission and video element setup

### Files Added

- `src/shared/InputManager.ts` — orchestrator with provider switching
- `src/shared/MudraProvider.ts` — WebSocket client for Mudra Band
- `src/shared/KeyboardMouseProvider.ts` — mouse/keyboard fallback
- `src/shared/InputTypes.ts` — InputState, InputProvider, config types

### Migration Pattern

```typescript
// BEFORE (each mode controller)
const result = this.handTracker.detectHands(timestamp);
const landmarks = result.landmarks[0];
const thumbTip = landmarks[4];
const indexTip = landmarks[8];
const pinchDist = distance(thumbTip, indexTip);

// AFTER
const input = this.inputManager.getState();
const cursorPos = input.cursor;
const intensity = input.pressure;
const isGrabbing = input.buttonDown;
```

### Order of Work

1. Build `InputTypes`, `InputManager`, both providers (new files)
2. Update `app.ts` to use `InputManager` instead of `HandTracker`
3. Migrate modes one at a time (independent, can be parallelized)
4. Remove HandTracker, GestureDetector, MediaPipe dependencies
5. Update UI (landing page, hints, connection status, debug panel)

---

## Testing Strategy

| Scenario | Approach |
|----------|----------|
| No device | Keyboard/mouse fallback works immediately |
| Mudra Companion app (no band) | `trigger_gesture` simulation for gesture/button events |
| Physical Mudra Band | Full end-to-end testing |
| Development | Debug panel with live InputState + manual trigger buttons |
