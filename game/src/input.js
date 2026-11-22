// Harborlight — keyboard + mouse input. Keys tracked by code; mouse in world coords.
const Input = {
  keys: {},
  mouseX: 0, mouseY: 0,       // screen coords
  mouseDown: false, mouseClicked: false,
  _pressed: {},
  init(canvas) {
    addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) this._pressed[e.code] = true;
      this.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; this.mouseDown = false; });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left; this.mouseY = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.mouseClicked = true; }
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  },
  down(code) { return !!this.keys[code]; },
  pressed(code) { return !!this._pressed[code]; },
  clicked() { const c = this.mouseClicked; this.mouseClicked = false; return c; },
  endFrame() { this._pressed = {}; },
  axis() {
    let x = 0, y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    return { x, y };
  },
};
