/**
 * HintComponent
 * Displays control hints for the current mode
 */

export class HintComponent {
  private container: HTMLElement;
  private element: HTMLElement | null = null;
  private isVisible: boolean = true;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  update(mode: 'galaxy' | 'foggy-mirror'): void {
    if (!this.element) {
      this.createDOM();
    }

    if (!this.element) return;

    const content = this.element.querySelector('.hint-content');
    if (!content) return;

    if (mode === 'galaxy') {
      content.innerHTML = `
        <div class="hint-header">
          <span class="hint-title">Gesture Guide</span>
        </div>
        <div class="hint-list">
          <div class="hint-item">Show both hands to spawn</div>
          <div class="hint-item">Move apart to grow</div>
          <div class="hint-item">Move together to shrink</div>
          <div class="hint-item">Close hands for Big Bang</div>
          <div class="hint-item">Pinch for Star burst</div>
        </div>
      `;
    } else {
      content.innerHTML = `
        <div class="hint-header">
          <span class="hint-title">Gesture Guide</span>
        </div>
        <div class="hint-list">
          <div class="hint-item">Wave hand to wipe fog</div>
          <div class="hint-item highlight">Press <kbd>R</kbd> to reset</div>
        </div>
      `;
    }
  }

  toggle(): void {
    this.isVisible = !this.isVisible;
    this.updateVisibility();
  }

  show(): void {
    this.isVisible = true;
    this.updateVisibility();
  }

  hide(): void {
    this.isVisible = false;
    this.updateVisibility();
  }

  private updateVisibility(): void {
    if (this.element) {
      this.element.style.opacity = this.isVisible ? '1' : '0';
      this.element.style.pointerEvents = this.isVisible ? 'auto' : 'none';
      this.element.style.transform = this.isVisible
        ? 'translateY(0)'
        : 'translateY(10px)';
    }
  }

  private createDOM(): void {
    this.element = document.createElement('div');
    this.element.className = 'hint-component';
    this.element.innerHTML = `
      <div class="hint-content"></div>
      <div class="hint-footer">
        Press <kbd>H</kbd> to toggle hints
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      .hint-component {
        position: absolute;
        bottom: 20px;
        right: 20px;
        padding: 16px 12px;
        background: rgba(20, 20, 25, 0.6);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        color: #fff;
        font-family: 'Nunito', sans-serif;
        border-radius: 16px;
        z-index: 100;
        min-width: 200px;
        max-width: 260px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .hint-header {
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .hint-title {
        font-family: 'Playfair Display', serif;
        font-size: 1rem;
        font-weight: 700;
        color: #fff;
        letter-spacing: 0.02em;
      }

      .hint-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .hint-item {
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.7);
        font-weight: 400;
        line-height: 1.4;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .hint-item::before {
        content: '';
        display: block;
        width: 4px;
        height: 4px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
      }

      .hint-item.highlight {
        color: #fff;
        margin-top: 4px;
      }

      .hint-item.highlight::before {
        background: #fff;
      }

      .hint-footer {
        margin-top: 20px;
        padding-top: 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.4);
        text-align: right;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      kbd {
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
        margin: 0 2px;
      }
    `;
    this.element.appendChild(style);
    this.container.appendChild(this.element);
  }
}
