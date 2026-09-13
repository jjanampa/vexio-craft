import { IS_TOUCH } from "./config.js";

export class Input {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.keys = new Set();
    this.mouseButtons = new Set();
    this.dx = 0;
    this.dy = 0;
    this.locked = false;
    this.touch = IS_TOUCH;
    this.analogX = 0;
    this.analogY = 0;
    this.virtualJump = false;
    this.touchMine = false;
    this.lookPointer = null;
    this.lookLast = null;
    this.joyPointer = null;
    this.joyCenter = null;
    this.flyBtn = null;

    canvas.addEventListener("click", () => {
      if (!this.locked && !this.touch) canvas.requestPointerLock();
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
      if (e.button === 1) {
        e.preventDefault();
        this.callbacks.onPick?.();
      }
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
      if (e.code === "KeyE") {
        e.preventDefault();
        this.callbacks.onInventory?.();
      }
      if (e.code === "F5" || e.code === "KeyV") {
        e.preventDefault();
        this.callbacks.onCamera?.();
      }
      if (e.code === "Escape") this.callbacks.onEscape?.();
      if (e.code === "Space") e.preventDefault();
    });

    document.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });

    document.addEventListener("contextmenu", (e) => e.preventDefault());

    if (this.touch) this.setupTouch();
  }

  setupTouch() {
    const layer = document.createElement("div");
    layer.id = "touch-ui";
    layer.classList.add("hidden");

    const joy = document.createElement("div");
    joy.id = "joystick";
    const nub = document.createElement("div");
    nub.id = "joystick-nub";
    joy.appendChild(nub);

    const buttons = document.createElement("div");
    buttons.id = "touch-buttons";
    const makeButton = (id, label) => {
      const b = document.createElement("button");
      b.id = id;
      b.className = "touch-btn";
      b.type = "button";
      b.textContent = label;
      buttons.appendChild(b);
      return b;
    };
    const flyBtn = makeButton("btn-touch-fly", "✈");
    const jumpBtn = makeButton("btn-touch-jump", "⤒");
    const mineBtn = makeButton("btn-touch-mine", "⛏");
    const placeBtn = makeButton("btn-touch-place", "▣");
    const invBtn = makeButton("btn-touch-inv", "🎒");
    const camBtn = makeButton("btn-touch-cam", "👁");

    layer.appendChild(joy);
    layer.appendChild(buttons);
    document.body.appendChild(layer);

    this.touchLayer = layer;
    this.joyBase = joy;
    this.joyNub = nub;
    this.flyBtn = flyBtn;

    joy.addEventListener("pointerdown", (e) => this.startJoy(e));
    joy.addEventListener("pointermove", (e) => this.moveJoy(e));
    joy.addEventListener("pointerup", (e) => this.endJoy(e));
    joy.addEventListener("pointercancel", (e) => this.endJoy(e));

    layer.addEventListener("pointerdown", (e) => {
      if (e.target !== layer) return;
      this.lookPointer = e.pointerId;
      this.lookLast = { x: e.clientX, y: e.clientY };
      layer.setPointerCapture(e.pointerId);
    });
    layer.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.lookPointer || !this.lookLast) return;
      this.dx += e.clientX - this.lookLast.x;
      this.dy += e.clientY - this.lookLast.y;
      this.lookLast = { x: e.clientX, y: e.clientY };
    });
    const releaseLook = (e) => {
      if (e.pointerId === this.lookPointer) {
        this.lookPointer = null;
        this.lookLast = null;
      }
    };
    layer.addEventListener("pointerup", releaseLook);
    layer.addEventListener("pointercancel", releaseLook);

    const hold = (btn, on, off) => {
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.setPointerCapture(e.pointerId);
        on();
      });
      const release = (e) => {
        e.preventDefault();
        e.stopPropagation();
        off?.();
      };
      btn.addEventListener("pointerup", release);
      btn.addEventListener("pointercancel", release);
    };

    hold(jumpBtn, () => (this.virtualJump = true), () => (this.virtualJump = false));
    hold(mineBtn, () => (this.touchMine = true), () => (this.touchMine = false));
    hold(placeBtn, () => this.callbacks.onPlace?.());
    hold(flyBtn, () => this.callbacks.onFly?.());
    hold(invBtn, () => this.callbacks.onInventory?.());
    hold(camBtn, () => this.callbacks.onCamera?.());
  }

  setTouchUiVisible(visible) {
    this.touchLayer?.classList.toggle("hidden", !visible);
  }

  setFlyButtonVisible(visible) {
    this.flyBtn?.classList.toggle("hidden", !visible);
  }

  startJoy(e) {
    e.preventDefault();
    e.stopPropagation();
    this.joyPointer = e.pointerId;
    const rect = this.joyBase.getBoundingClientRect();
    this.joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, r: rect.width / 2 };
    this.joyBase.setPointerCapture(e.pointerId);
    this.moveJoy(e);
  }

  moveJoy(e) {
    if (e.pointerId !== this.joyPointer || !this.joyCenter) return;
    const ox = e.clientX - this.joyCenter.x;
    const oy = e.clientY - this.joyCenter.y;
    const len = Math.hypot(ox, oy);
    const dead = this.joyCenter.r * 0.14;
    let nx = ox / this.joyCenter.r;
    let ny = oy / this.joyCenter.r;
    const mag = Math.hypot(nx, ny);
    if (mag > 1) {
      nx /= mag;
      ny /= mag;
    }
    if (len < dead) {
      nx = 0;
      ny = 0;
    }
    this.analogX = nx;
    this.analogY = -ny;
    this.joyNub.style.transform = `translate(${nx * this.joyCenter.r * 0.55}px, ${ny * this.joyCenter.r * 0.55}px)`;
  }

  endJoy(e) {
    if (e.pointerId !== this.joyPointer) return;
    this.joyPointer = null;
    this.analogX = 0;
    this.analogY = 0;
    this.joyNub.style.transform = "translate(0, 0)";
  }

  getMoveAxes() {
    const x = (this.isDown("KeyD") ? 1 : 0) - (this.isDown("KeyA") ? 1 : 0) + this.analogX;
    const y = (this.isDown("KeyW") ? 1 : 0) - (this.isDown("KeyS") ? 1 : 0) + this.analogY;
    return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
  }

  isJump() {
    return this.isDown("Space") || this.virtualJump;
  }

  isMiningHeld() {
    return this.touchMine || (this.locked && this.mouseButtons.has(0));
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
