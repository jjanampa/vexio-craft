import { BLOCKS } from "./blocks.js";
import { drawTileIcon } from "./textures.js";

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
  constructor({ atlas, hotbar, onContinue, onSave, onLoad, onNewWorld, onSelectSlot }) {
    this.atlas = atlas;
    this.hotbar = hotbar;
    this.onContinue = onContinue;
    this.onSave = onSave;
    this.onLoad = onLoad;
    this.onNewWorld = onNewWorld;
    this.onSelectSlot = onSelectSlot;

    this.menu = document.getElementById("menu");
    this.hud = document.getElementById("hud");
    this.debug = document.getElementById("debug");
    this.toastEl = document.getElementById("toast");
    this.hotbarEl = document.getElementById("hotbar");

    this.toastTimer = null;
    this.mode = null;
    this.selected = 0;
    this.seed = 0;

    this.buildHotbar();
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

  showHud() {
    this.hud.classList.remove("hidden");
  }

  showMenu(mode, options = {}) {
    this.mode = mode;
    const ready = options.ready !== false;
    if (mode === "start") {
      this.menu.innerHTML = "";
      const panel = document.createElement("div");
      panel.className = "panel";
      panel.innerHTML = `
        <h1>VEXIO CRAFT</h1>
        <p class="sub">Mundo infinito en tu navegador · semilla <b>${this.seed}</b></p>
        <div class="status" id="menu-status">${ready ? "" : "Generando mundo…"}</div>
        <div class="controls">
          <span><b>WASD</b> moverse</span><span><b>Espacio</b> saltar / nadar</span>
          <span><b>Shift</b> correr</span><span><b>Ctrl / C</b> bajar (volando)</span>
          <span><b>Clic izq.</b> romper</span><span><b>Clic der.</b> colocar</span>
          <span><b>Rueda / 1-9</b> bloque</span><span><b>Clic medio</b> copiar bloque</span>
          <span><b>F</b> volar</span><span><b>Esc</b> pausa</span>
        </div>
        <div class="buttons">
          <button id="btn-play" ${ready ? "" : "disabled"}>${ready ? "Jugar" : "Cargando…"}</button>
        </div>
      `;
      this.menu.appendChild(panel);
      panel.querySelector("#btn-play").addEventListener("click", () => this.onContinue?.());
      this.statusEl = panel.querySelector("#menu-status");
    } else if (mode === "pause") {
      this.menu.innerHTML = "";
      const panel = document.createElement("div");
      panel.className = "panel";
      panel.innerHTML = `
        <h2>Pausa</h2>
        <p class="sub">Semilla <b>${this.seed}</b></p>
        <div class="controls">
          <span><b>WASD</b> moverse</span><span><b>Espacio</b> saltar</span>
          <span><b>Shift</b> correr</span><span><b>F</b> volar</span>
          <span><b>Clic izq.</b> romper</span><span><b>Clic der.</b> colocar</span>
          <span><b>Esc</b> continuar</span><span><b>1-9 / rueda</b> bloque</span>
        </div>
        <div class="buttons">
          <button id="btn-continue">Continuar</button>
          <button id="btn-save" class="secondary">Guardar</button>
          <button id="btn-load" class="secondary">Cargar</button>
          <button id="btn-new" class="secondary">Mundo nuevo</button>
        </div>
      `;
      this.menu.appendChild(panel);
      panel.querySelector("#btn-continue").addEventListener("click", () => this.onContinue?.());
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
    this.mode = null;
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
