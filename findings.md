# 🔍 Research & Findings

## Project Overview

- **Type:** React + Vite + TypeScript.
- **Repository:** Gesture Lab.

## Discoveries

- **Project Structure**: React + Vite + TypeScript.
- **Current Task**: Implementing Mudra Band integration as per the approved plan in `docs/plans/2026-02-09-mudra-integration-design.md`.
- **Infrastructure**: Input abstraction layer created (`InputTypes`, `InputManager`, `MudraProvider`, `KeyboardMouseProvider`).
- **Git State**: Several documentation files and plans are staged but not committed.

## Constraints

- **Hardware**: Navigation and IMU cannot be used simultaneously (using Navigation).
- **Environment**: Mudra works via WebSocket on `ws://127.0.0.1:8766`.
- **Fallback**: Keyboard and mouse must always be available.
