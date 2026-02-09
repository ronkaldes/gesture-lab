/**
 * MudraProvider - WebSocket client for Mudra Band
 */

import { InputProvider, InputState, MudraConfig, DEFAULT_MUDRA_CONFIG } from './InputTypes';

export class MudraProvider implements InputProvider {
    private socket: WebSocket | null = null;
    private state: InputState;
    private config: MudraConfig;
    private reconnectAttempts = 0;
    private reconnectTimeoutId: any = null;
    private lastDeltas: { x: number; y: number }[] = [];
    private readonly SMOOTHING_SAMPLES = 3;
    private readonly DEAD_ZONE = 0.5;

    constructor(config: Partial<MudraConfig> = {}) {
        this.config = { ...DEFAULT_MUDRA_CONFIG, ...config };
        this.state = this.getInitialState();
    }

    private getInitialState(): InputState {
        return {
            cursor: { x: 0.5, y: 0.5 },
            pressure: 0,
            buttonDown: false,
            lastGesture: null,
            source: 'mudra',
            connected: false,
        };
    }

    public async connect(): Promise<void> {
        if (this.socket || this.reconnectAttempts >= this.config.maxReconnectAttempts) return;

        return new Promise((resolve, reject) => {
            try {
                this.socket = new WebSocket(this.config.url);

                this.socket.onopen = () => {
                    console.log('[Mudra] WebSocket connected');
                    this.reconnectAttempts = 0;
                    this.state.connected = true;

                    // Subscribe to signals separately as per protocol
                    this.subscribe('navigation');
                    this.subscribe('pressure');
                    this.subscribe('gesture');
                    this.subscribe('button');

                    resolve();
                };

                this.socket.onmessage = (event) => {
                    this.handleMessage(JSON.parse(event.data));
                };

                this.socket.onclose = () => {
                    console.log('[Mudra] WebSocket closed');
                    this.state.connected = false;
                    this.socket = null;
                    this.scheduleReconnect();
                };

                this.socket.onerror = (error) => {
                    console.error('[Mudra] WebSocket error:', error);
                    reject(error);
                };
            } catch (error) {
                console.error('[Mudra] Connection error:', error);
                reject(error);
            }
        });
    }

    public disconnect(): void {
        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
            this.reconnectTimeoutId = null;
        }
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.state.connected = false;
    }

    public getState(): InputState {
        // Return a copy and clear the last gesture (consumed once per frame)
        const current = { ...this.state };
        this.state.lastGesture = null;
        return current;
    }

    public isConnected(): boolean {
        return this.state.connected;
    }

    public setSensitivity(value: number): void {
        this.config.sensitivity = value;
    }

    private subscribe(signal: string): void {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ command: 'subscribe', signal }));
        }
    }

    private handleMessage(msg: any): void {
        switch (msg.type) {
            case 'connection_status':
                if (msg.data.status === 'disconnected') {
                    console.warn('[Mudra] Device disconnected');
                    this.state.connected = false;
                } else if (msg.data.status === 'connected') {
                    this.state.connected = true;
                }
                break;

            case 'navigation':
                this.updateCursor(msg.data.delta_x, msg.data.delta_y);
                break;

            case 'pressure':
                this.state.pressure = msg.data.normalized;
                break;

            case 'gesture':
                this.state.lastGesture = {
                    type: msg.data.type,
                    timestamp: msg.timestamp || Date.now(),
                };
                break;

            case 'button':
                this.state.buttonDown = msg.data.state === 'pressed';
                break;
        }
    }

    private updateCursor(dx: number, dy: number): void {
        // Apply dead zone
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        if (adx < this.DEAD_ZONE && ady < this.DEAD_ZONE) return;

        // Smoothening
        this.lastDeltas.push({ x: dx, y: dy });
        if (this.lastDeltas.length > this.SMOOTHING_SAMPLES) {
            this.lastDeltas.shift();
        }

        const avgX = this.lastDeltas.reduce((sum, d) => sum + d.x, 0) / this.lastDeltas.length;
        const avgY = this.lastDeltas.reduce((sum, d) => sum + d.y, 0) / this.lastDeltas.length;

        // Accumulate into normalized 0-1 range
        this.state.cursor.x = Math.max(0, Math.min(1, this.state.cursor.x + avgX * this.config.sensitivity));
        this.state.cursor.y = Math.max(0, Math.min(1, this.state.cursor.y + avgY * this.config.sensitivity));
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[Mudra] Reconnecting attempt ${this.reconnectAttempts}...`);
            this.reconnectTimeoutId = setTimeout(() => this.connect(), this.config.reconnectInterval);
        }
    }

    /**
     * For testing: Trigger a simulated gesture
     */
    public triggerGesture(type: string): void {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ command: 'trigger_gesture', data: { type } }));
        }
    }
}
