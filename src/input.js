export class Input {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.keys = new Set();
    this.mouseButtons = new Set();
    this.dx = 0;
    this.dy = 0;
    this.locked = false;

    canvas.addEventListener("click", () => {
      if (!this.locked) canvas.requestPointerLock();
    });

    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) {
        this.keys.clear();
        this.mouseButtons.clear();
      }
      this.callbacks.onLockChange?.(this.locked);
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });

    document.addEventListener("mousedown", (e) => {
      if (!this.locked) return;
      this.mouseButtons.add(e.button);
      if (e.button === 0) this.callbacks.onBreak?.();
      if (e.button === 1) {
        e.preventDefault();
        this.callbacks.onPick?.();
      }
      if (e.button === 2) this.callbacks.onPlace?.();
    });

    document.addEventListener("mouseup", (e) => {
      this.mouseButtons.delete(e.button);
    });

    document.addEventListener(
      "wheel",
      (e) => {
        if (!this.locked) return;
        e.preventDefault();
        this.callbacks.onWheel?.(Math.sign(e.deltaY));
      },
      { passive: false }
    );

    document.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code.startsWith("Digit")) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= 9) this.callbacks.onHotbar?.(n - 1);
      }
      if (e.code === "KeyF") this.callbacks.onFly?.();
      if (e.code === "Space") e.preventDefault();
    });

    document.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });

    document.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  isDown(code) {
    return this.keys.has(code);
  }

  isMouseDown(button) {
    return this.mouseButtons.has(button);
  }

  consumeMouse() {
    const out = { dx: this.dx, dy: this.dy };
    this.dx = 0;
    this.dy = 0;
    return out;
  }
}
