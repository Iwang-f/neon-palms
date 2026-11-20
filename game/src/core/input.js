// NEON PALMS — keyboard and mouse. The mouse aims (the cursor is the crosshair);
// keys are read as held state plus a one-frame "pressed" set for actions.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, down: false, clicked: false, wheel: 0 };
    this.enabled = true;
    this._bind();
  }

  _bind() {
    const block = new Set(['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
    window.addEventListener('keydown', (e) => {
      if (block.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });

    const move = (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    };
    window.addEventListener('mousemove', move);
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.down = false; });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
  }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  axis() {
    const x = (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0) - (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
    const z = (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0) - (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0);
    return { x, z };
  }
  /** Call once at the end of each frame. */
  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
    this.mouse.wheel = 0;
  }
}
