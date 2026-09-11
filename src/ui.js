import { BLOCKS } from "./blocks.js";
import { drawTileIcon } from "./textures.js";
import { IS_TOUCH } from "./config.js";

const ICON_TILE = {
  1: "grass_side",
  2: "dirt",
  3: "stone",
  4: "cobble",
  5: "sand",
  6: "water",
  7: "log_side",
  8: "leaves",
  9: "planks",
  10: "glass",
  11: "brick",
  12: "snow",
  13: "bedrock",
};

export class UI {
  constructor({ atlas, hotbar, onContinue, onSave, onLoad, onNewWorld, onSelectSlot, onToggleMode, onPause }) {
    this.atlas = atlas;
    this.hotbar = hotbar;
    this.onContinue = onContinue;
    this.onSave = onSave;
    this.onLoad = onLoad;
    this.onNewWorld = onNewWorld;
    this.onSelectSlot = onSelectSlot;
    this.onToggleMode = onToggleMode;
    this.onPause = onPause;

    this.menu = document.getElementById("menu");
    this.hud = document.getElementById("hud");
    this.debug = document.getElementById("debug");
    this.toastEl = document.getElementById("toast");
    this.hotbarEl = document.getElementById("hotbar");
    this.heartsEl = document.getElementById("hearts");
    this.progressEl = document.getElementById("mine-progress");
    this.progressFill = document.getElementById("mine-progress-fill");
    this.flashEl = document.getElementById("damage-flash");
    this.modeBtn = document.getElementById("mode-btn");
    this.pauseBtn = document.getElementById("pause-btn");

    this.toastTimer = null;
    this.flashTimer = null;
    this.mode = "creative";
    this.selected = 0;
    this.seed = 0;
    this.lastHealth = -1;
    this.lastHealthVisible = null;

    this.modeBtn.addEventListener("click", () => this.onToggleMode?.());
    this.pauseBtn.classList.toggle("hidden", !IS_TOUCH);
    this.pauseBtn.addEventListener("click", () => this.onPause?.());

    this.buildHotbar();
    this.setMode("creative");
    this.setHealth(20, false);
  }

  buildHotbar() {
    this.hotbarEl.innerHTML = "";
    this.slots = [];
    this.hotbar.forEach((id, i) => {
      const slot = document.createElement("div");
      slot.className = "slot" + (i === this.selected ? " selected" : "");
      const key = document.createElement("span");
      key.className = "key";
      key.textContent = String(i + 1);
      slot.appendChild(key);
      const tile = ICON_TILE[id] || "stone";
      const icon = drawTileIcon(this.atlas, tile, 64);
      if (icon) slot.appendChild(icon);
      slot.addEventListener("click", () => {
        this.select(i);
        this.onSelectSlot?.(i);
      });
      this.hotbarEl.appendChild(slot);
      this.slots.push(slot);
    });
  }

  select(i) {
    if (i < 0 || i >= this.slots.length) return;
    this.selected = i;
    this.slots.forEach((slot, idx) => slot.classList.toggle("selected", idx === i));
  }

  setSlotBlock(i, id) {
    this.hotbar[i] = id;
    this.buildHotbar();
  }

  setDebug(text) {
    this.debug.textContent = text;
  }

  setSeed(seed) {
    this.seed = seed;
  }

  setMode(mode) {
    this.mode = mode;
    const creative = mode === "creative";
    this.modeBtn.innerHTML = creative ? "✦ <b>Creativo</b>" : "⛏ <b>Supervivencia</b>";
  }

  setHealth(health, visible) {
    if (!visible) {
      if (this.lastHealthVisible !== false) {
        this.heartsEl.classList.add("hidden");
        this.lastHealthVisible = false;
      }
      return;
    }
    this.heartsEl.classList.remove("hidden");
    if (this.lastHealth === health && this.lastHealthVisible === true) return;
    this.lastHealth = health;
    this.lastHealthVisible = true;
    this.heartsEl.innerHTML = "";
    const total = 10;
    const per = 20 / total;
    for (let i = 0; i < total; i++) {
      const hp = health - i * per;
      const heart = document.createElement("div");
      heart.className = "heart";
      const bg = document.createElement("span");
      bg.className = "heart-bg";
      bg.textContent = "♥";
      const fill = document.createElement("span");
      fill.className = "heart-fill";
      fill.textContent = "♥";
      fill.style.width = hp >= per ? "100%" : hp > 0 ? "50%" : "0%";
      heart.appendChild(bg);
      heart.appendChild(fill);
      this.heartsEl.appendChild(heart);
    }
  }

  setMiningProgress(value) {
    if (value <= 0 || value >= 1) {
      this.progressEl.classList.add("hidden");
      this.progressFill.style.width = "0%";
      return;
    }
    this.progressEl.classList.remove("hidden");
    this.progressFill.style.width = `${Math.round(value * 100)}%`;
  }

  flashDamage() {
    this.flashEl.classList.add("active");
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.flashEl.classList.remove("active"), 180);
  }

  showHud() {
    this.hud.classList.remove("hidden");
  }

  controlsFor(mode) {
    if (IS_TOUCH) {
      const rows = [
        ["Joystick", "moverse"],
        ["Arrastrar", "mirar"],
        ["⤒", "saltar / nadar"],
        ["⛏ (mantén)", "minar"],
        ["▣", "colocar bloque"],
        ["Barra inferior", "elegir bloque"],
      ];
      if (mode === "creative") rows.push(["✈", "volar (subir/bajar con ✈ y ⤒)"]);
      return rows;
    }
    const rows = [
      ["WASD", "moverse"],
      ["Espacio", "saltar / nadar"],
      ["Shift", "correr"],
      ["Clic izq.", mode === "survival" ? "minar (mantén)" : "romper"],
      ["Clic der.", "colocar"],
      ["Rueda / 1-9", "bloque"],
      ["Clic medio", "copiar bloque"],
    ];
    if (mode === "creative") {
      rows.push(["F", "volar"]);
      rows.push(["Ctrl / C", "bajar (volando)"]);
    }
    rows.push(["Esc", "pausa"]);
    return rows;
  }

  renderControls(container, mode) {
    container.innerHTML = "";
    for (const [key, desc] of this.controlsFor(mode)) {
      const k = document.createElement("span");
      k.innerHTML = `<b>${key}</b> ${desc}`;
      container.appendChild(k);
    }
  }

  showMenu(mode, options = {}) {
    const ready = options.ready !== false;
    if (mode === "start") {
      this.menu.innerHTML = "";
      const panel = document.createElement("div");
      panel.className = "panel";
      panel.innerHTML = `
        <h1>VEXIO CRAFT</h1>
        <p class="sub">Mundo infinito en tu navegador · semilla <b>${this.seed}</b>${IS_TOUCH ? " · mejor en horizontal" : ""}</p>
        <div class="status" id="menu-status">${ready ? "" : "Generando mundo…"}</div>
        <div class="controls" id="menu-controls"></div>
        <div class="buttons">
          <button id="btn-play" ${ready ? "" : "disabled"}>${ready ? (IS_TOUCH ? "Jugar" : "Jugar") : "Cargando…"}</button>
        </div>
      `;
      this.menu.appendChild(panel);
      this.renderControls(panel.querySelector("#menu-controls"), this.mode);
      panel.querySelector("#btn-play").addEventListener("click", () => this.onContinue?.());
      this.statusEl = panel.querySelector("#menu-status");
    } else if (mode === "pause") {
      this.menu.innerHTML = "";
      const panel = document.createElement("div");
      panel.className = "panel";
      panel.innerHTML = `
        <h2>Pausa</h2>
        <p class="sub">Semilla <b>${this.seed}</b> · Modo <b>${this.mode === "survival" ? "Supervivencia" : "Creativo"}</b></p>
        <div class="controls" id="menu-controls"></div>
        <div class="buttons">
          <button id="btn-continue">Continuar</button>
          <button id="btn-mode" class="secondary">Cambiar a ${this.mode === "survival" ? "creativo" : "supervivencia"}</button>
        </div>
        <div class="buttons">
          <button id="btn-save" class="secondary">Guardar</button>
          <button id="btn-load" class="secondary">Cargar</button>
          <button id="btn-new" class="secondary">Mundo nuevo</button>
        </div>
      `;
      this.menu.appendChild(panel);
      this.renderControls(panel.querySelector("#menu-controls"), this.mode);
      panel.querySelector("#btn-continue").addEventListener("click", () => this.onContinue?.());
      panel.querySelector("#btn-mode").addEventListener("click", () => {
        this.onToggleMode?.();
        this.showMenu("pause");
      });
      panel.querySelector("#btn-save").addEventListener("click", () => this.onSave?.());
      panel.querySelector("#btn-load").addEventListener("click", () => this.onLoad?.());
      panel.querySelector("#btn-new").addEventListener("click", () => this.onNewWorld?.());
    }
    this.menu.classList.remove("hidden");
  }

  setStatus(text, ready = false) {
    if (!this.statusEl) return;
    this.statusEl.textContent = text || "";
    const btn = document.getElementById("btn-play");
    if (btn) {
      btn.disabled = !ready;
      btn.textContent = ready ? "Jugar" : "Cargando…";
    }
  }

  hideMenu() {
    this.menu.classList.add("hidden");
  }

  toast(text, duration = 2200) {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove("hidden");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.add("hidden"), duration);
  }

  blockName(id) {
    return BLOCKS[id]?.name || "?";
  }
}
