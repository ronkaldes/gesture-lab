/**
 * KeyboardMouseProvider - Fallback input using mouse and keys
 */

import { InputProvider, InputState, GestureType } from './InputTypes';

export class KeyboardMouseProvider implements InputProvider {
    private state: InputState;
    private readonly PRESSURE_STEP = 0.05;

    constructor() {
        this.state = this.getInitialState();
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleWheel = this.handleWheel.bind(this);
    }

    private getInitialState(): InputState {
        return {
            cursor: { x: 0.5, y: 0.5 },
            pressure: 0,
            buttonDown: false,
            lastGesture: null,
            source: 'fallback',
            connected: true, // Keyboard/mouse is always "connected"
        };
    }

    public async connect(): Promise<void> {
        window.addEventListener('mousemove', this.handleMouseMove);
        window.addEventListener('mousedown', this.handleMouseDown);
        window.addEventListener('mouseup', this.handleMouseUp);
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('wheel', this.handleWheel, { passive: false });
        console.log('[Fallback] Keyboard/Mouse providers connected');
    }

    public disconnect(): void {
        window.removeEventListener('mousemove', this.handleMouseMove);
        window.removeEventListener('mousedown', this.handleMouseDown);
        window.removeEventListener('mouseup', this.handleMouseUp);
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('wheel', this.handleWheel);
    }

    public getState(): InputState {
        const current = { ...this.state };
        this.state.lastGesture = null;
        return current;
    }

    public isConnected(): boolean {
        return true;
    }

    private handleMouseMove(e: MouseEvent): void {
        this.state.cursor.x = e.clientX / window.innerWidth;
        this.state.cursor.y = e.clientY / window.innerHeight;
    }

    private handleMouseDown(): void {
        this.state.buttonDown = true;
    }

    private handleMouseUp(): void {
        this.state.buttonDown = false;
    }

    private handleWheel(e: WheelEvent): void {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -this.PRESSURE_STEP : this.PRESSURE_STEP;
        this.state.pressure = Math.max(0, Math.min(1, this.state.pressure + delta));
    }

    private handleKeyDown(e: KeyboardEvent): void {
        let type: GestureType | null = null;

        switch (e.key) {
            case '1': type = 'tap'; break;
            case '2': type = 'double_tap'; break;
            case '3': type = 'twist'; break;
            case '4': type = 'double_twist'; break;
            case ' ':
                // Toggle buttonDown with space as alternative to mouse click
                this.state.buttonDown = !this.state.buttonDown;
                break;
        }

        if (type) {
            this.state.lastGesture = {
                type,
                timestamp: Date.now(),
            };
        }
    }
}
