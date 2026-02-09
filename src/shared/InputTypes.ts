/**
 * Input Signal Types for Mudra and Fallback
 */

export type GestureType = 'tap' | 'double_tap' | 'twist' | 'double_twist';

export interface GestureEvent {
  type: GestureType;
  timestamp: number;
}

export interface InputState {
  /** Normalized cursor position (0-1) */
  cursor: { x: number; y: number };
  /** Analog intensity (0-1) */
  pressure: number;
  /** Binary button/grab state */
  buttonDown: boolean;
  /** Last detected discrete gesture (consumed once per frame) */
  lastGesture: GestureEvent | null;
  /** Active input source */
  source: 'mudra' | 'fallback';
  /** Connection status */
  connected: boolean;
}

export interface InputProvider {
  /** Connect to the input source */
  connect(): Promise<void>;
  /** Disconnect from the input source */
  disconnect(): void;
  /** Get the current snapshot of input state */
  getState(): InputState;
  /** Check if the provider is currently connected */
  isConnected(): boolean;
  /** Set sensitivity for navigation (optional) */
  setSensitivity?(value: number): void;
}

export interface MudraConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  sensitivity: number;
}

export const DEFAULT_MUDRA_CONFIG: MudraConfig = {
  url: 'ws://127.0.0.1:8766',
  reconnectInterval: 3000,
  maxReconnectAttempts: 5,
  sensitivity: 0.005,
};
