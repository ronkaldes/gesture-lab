/**
 * InputManager - Managed input orchestration with provider switching
 */

import { InputProvider, InputState } from './InputTypes';
import { MudraProvider } from './MudraProvider';
import { KeyboardMouseProvider } from './KeyboardMouseProvider';

export class InputManager {
    private activeProvider: InputProvider;
    private mudraProvider: MudraProvider;
    private fallbackProvider: KeyboardMouseProvider;
    private onSourceChange: ((source: 'mudra' | 'fallback') => void) | null = null;

    constructor() {
        this.mudraProvider = new MudraProvider();
        this.fallbackProvider = new KeyboardMouseProvider();

        // Start with fallback until Mudra connects
        this.activeProvider = this.fallbackProvider;
    }

    public async initialize(): Promise<void> {
        // Connect both, but we'll choose which one to use for getState
        await this.fallbackProvider.connect();

        try {
            await this.mudraProvider.connect();
            // If we reach here, Mudra is connected
            this.activeProvider = this.mudraProvider;
            this.notifySourceChange('mudra');
        } catch (error) {
            console.warn('[InputManager] Mudra not available, staying on fallback');
            this.activeProvider = this.fallbackProvider;
            this.notifySourceChange('fallback');
        }

        // Monitor Mudra status to switch automatically
        setInterval(() => {
            this.checkProviderSwitch();
        }, 1000);
    }

    public getState(): InputState {
        return this.activeProvider.getState();
    }

    public getActiveSource(): 'mudra' | 'fallback' {
        return this.activeProvider.getState().source;
    }

    public isConnected(): boolean {
        return this.activeProvider.isConnected();
    }

    public onSourceChanged(callback: (source: 'mudra' | 'fallback') => void): void {
        this.onSourceChange = callback;
    }

    /**
     * For debugging/UI: trigger gestures manually
     */
    public triggerGesture(type: string): void {
        if (this.mudraProvider.isConnected()) {
            this.mudraProvider.triggerGesture(type);
        }
    }

    private checkProviderSwitch(): void {
        const mudraConnected = this.mudraProvider.isConnected();
        const currentIsMudra = this.activeProvider instanceof MudraProvider;

        if (mudraConnected && !currentIsMudra) {
            console.log('[InputManager] Mudra detected, switching source');
            this.activeProvider = this.mudraProvider;
            this.notifySourceChange('mudra');
        } else if (!mudraConnected && currentIsMudra) {
            console.log('[InputManager] Mudra lost, switching to fallback');
            this.activeProvider = this.fallbackProvider;
            this.notifySourceChange('fallback');
        }
    }

    private notifySourceChange(source: 'mudra' | 'fallback'): void {
        if (this.onSourceChange) {
            this.onSourceChange(source);
        }
    }
}
