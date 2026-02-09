# 📜 Project Constitution: Gesture Lab

## 🎯 Vision

Improve, fix, and stabilize the Gesture Lab project.

## 🏗️ Architectural Invariants

- **Architecture:** A.N.T. 3-Layer Architecture (`architecture/`, Navigation, `tools/`).
- **Protocol:** B.L.A.S.T. (Blueprint, Link, Architect, Stylize, Trigger).
- **Core Technology:** React, TypeScript, Vite.
- **Data Integrity:** All data schemas must be defined here before implementation.

## 📊 Data Schemas

### InputState

```typescript
interface InputState {
  cursor: { x: number; y: number };   // normalized 0-1
  pressure: number;                     // 0-1
  buttonDown: boolean;                  // grab/hold state
  lastGesture: {                        // discrete gesture
    type: 'tap' | 'double_tap' | 'twist' | 'double_twist';
    timestamp: number;
  } | null;
  source: 'mudra' | 'fallback';
  connected: boolean;
}
```

## 🛠️ Behavioral Rules

- **Connectivity**: Automatically switch to `KeyboardMouseProvider` if Mudra WebSocket is unavailable.
- **Signals**: Use Navigation for spatial input; do not use IMU simultaneously.
- **Feedback**: Show Mudra status in `StatusIndicator`. Tealer (#77EAE9) is the primary brand color.
- **Simulation**: Always support manual gesture triggers via `trigger_gesture` for testing.
- **Safety**: Update SOPs in `architecture/` before modifying core logic.

## 📈 Maintenance Log

### 2026-02-09

- Project initialized with B.L.A.S.T. protocol.
- Memory files created.
