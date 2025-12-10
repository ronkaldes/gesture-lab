/**
 * ModeIndicator Component
 * Displays current mode and switching shortcut
 */

export class ModeIndicator {
  private container: HTMLElement;
  private element: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  update(mode: 'galaxy' | 'foggy-mirror'): void {
    if (!this.element) {
      this.createDOM();
    }

    if (!this.element) return;

    const content = this.element.querySelector('.mode-content');
    if (!content) return;

    if (mode === 'galaxy') {
      content.innerHTML = `
        <div class="current-mode">Interactive Galaxy</div>
        <div class="switch-hint">Press <kbd>F</kbd> for Foggy Mirror</div>
      `;
    } else {
      content.innerHTML = `
        <div class="current-mode">Foggy Mirror</div>
        <div class="switch-hint">Press <kbd>G</kbd> for Interactive Galaxy</div>
      `;
    }
  }

  private createDOM(): void {
    this.element = document.createElement('div');
    this.element.className = 'mode-indicator';
    this.element.innerHTML = `
      <div class="mode-content"></div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      .mode-indicator {
        position: absolute;
        top: 20px;
        left: 20px;
        padding: 10px 12px;
        background: rgba(20, 20, 25, 0.6);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        color: #fff;
        font-family: 'Nunito', sans-serif;
        border-radius: 16px;
        z-index: 100;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.08);
        min-width: 160px;
      }

      .current-mode {
        font-family: 'Playfair Display', serif;
        font-size: 0.95rem;
        font-weight: 700;
        color: #fff;
        margin-bottom: 4px;
        letter-spacing: 0.02em;
      }

      .switch-hint {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.5);
        padding-top: 4px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .switch-hint kbd {
        display: inline-block;
        padding: 2px 6px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 4px;
        font-family: 'Nunito', sans-serif;
        font-weight: 700;
        font-size: 0.75rem;
        color: #fff;
        min-width: 18px;
        text-align: center;
      }
    `;
    this.element.appendChild(style);
    this.container.appendChild(this.element);
  }
}
