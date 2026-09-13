import { BLOCKS } from "./blocks.js";
import { ITEMS, ARMOR_SLOTS, ARMOR_SLOT_NAMES, itemName, iconTile } from "./items.js";
import { drawTileIcon } from "./textures.js";
import { IS_TOUCH } from "./config.js";

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function iconFor(atlas, id, size) {
  if (!id) return null;
  return drawTileIcon(atlas, iconTile(id), size);
}

export class UI {
  constructor({
    atlas,
    hotbar,
    onContinue,
    onSave,
    onLoad,
    onNewWorld,
    onSelectSlot,
    onToggleMode,
    onPause,
    onNameChange,
    onInventoryPick,
    onEquip,
    onCloseInventory,
  }) {
    this.atlas = atlas;
    this.hotbar = hotbar;
    this.onContinue = onContinue;
    this.onSave = onSave;
    this.onLoad = onLoad;
    this.onNewWorld = onNewWorld;
    this.onSelectSlot = onSelectSlot;
    this.onToggleMode = onToggleMode;
    this.onPause = onPause;
    this.onNameChange = onNameChange;
    this.onInventoryPick = onInventoryPick;
    this.onEquip = onEquip;
    this.onCloseInventory = onCloseInventory;
    this.multiplayer = false;
    this.onlineCount = 0;
    this.playerName = "";
    this.armor = [0, 0, 0, 0];

    this.menu = document.getElementById("menu");
    this.hud = document.getElementById("hud");
    this.debug = document.getElementById("debug");
    this.toastEl = document.getElementById("toast");
    this.hotbarEl = document.getElementById("hotbar");
    this.heartsEl = document.getElementById("hearts");
    this.armorEl = document.getElementById("armor-hud");
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

    this.buildInventory();

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
      const icon = iconFor(this.atlas, id, 64);
      if (icon) slot.appendChild(icon);
      if (id) slot.title = itemName(id);
      slot.addEventListener("click", () => {
        this.select(i);
        this.onSelectSlot?.(i);
      });
      this.hotbarEl.appendChild(slot);
      this.slots.push(slot);
    });
    this.refreshInventorySelection();
  }

  select(i) {
    if (i < 0 || i >= this.slots.length) return;
    this.selected = i;
    this.slots.forEach((slot, idx) => slot.classList.toggle("selected", idx === i));
    this.refreshInventorySelection();
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
    const el = document.getElementById("menu-seed");
    if (el) el.textContent = seed;
  }

  setPlayerName(name) {
    this.playerName = name;
    const input = document.getElementById("name-input");
    if (input && input.value !== name) input.value = name;
  }

  setMultiplayer(active, count = this.onlineCount) {
    this.multiplayer = active;
    this.onlineCount = count;
    const info = document.getElementById("mp-info");
    const counter = document.getElementById("mp-count");
    if (counter) counter.textContent = String(count);
    if (info) info.classList.toggle("hidden", !active);
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

  setArmor(list) {
    this.armor = list.slice(0, 4);
    this.armorEl.innerHTML = "";
    const points = this.armor.reduce((sum, id) => sum + (ITEMS[id]?.armor || 0), 0);
    this.armorEl.classList.toggle("hidden", points === 0);
    for (const id of this.armor) {
      const slot = document.createElement("div");
      slot.className = "armor-pip" + (id ? " filled" : "");
      const icon = iconFor(this.atlas, id, 32);
      if (icon) slot.appendChild(icon);
      this.armorEl.appendChild(slot);
    }
    this.renderEquipped();
  }

  buildInventory() {
    this.inventoryEl = document.createElement("div");
    this.inventoryEl.id = "inventory";
    this.inventoryEl.classList.add("hidden");
    const panel = document.createElement("div");
    panel.className = "inv-panel";
    panel.innerHTML = `
      <div class="inv-head">
        <h3>Inventario</h3>
        <p class="inv-note">Clic en un objeto para ponerlo en la barra · Armadura: clic para equipar o quitar</p>
      </div>
      <div class="inv-section">
        <div class="inv-label">Herramientas y armas</div>
        <div class="inv-grid" id="inv-tools"></div>
      </div>
      <div class="inv-section">
        <div class="inv-label">Armadura</div>
        <div class="inv-grid" id="inv-armor"></div>
        <div class="inv-equipped" id="inv-equipped"></div>
      </div>
      <div class="inv-section">
        <div class="inv-label">Bloques</div>
        <div class="inv-grid" id="inv-blocks"></div>
      </div>
      <div class="inv-foot">Seleccionado: <b id="inv-selected">—</b> · <span>E para cerrar</span></div>
    `;
    this.inventoryEl.appendChild(panel);
    panel.addEventListener("click", (event) => event.stopPropagation());
    this.inventoryEl.addEventListener("click", () => this.onCloseInventory?.());

    const tools = panel.querySelector("#inv-tools");
    const armor = panel.querySelector("#inv-armor");
    const blocks = panel.querySelector("#inv-blocks");
    this.invToolsEl = tools;
    this.invArmorEl = armor;
    this.invBlocksEl = blocks;
    this.invSelectedEl = panel.querySelector("#inv-selected");
    this.invEquippedEl = panel.querySelector("#inv-equipped");

    const toolIds = Object.values(ITEMS)
      .filter((item) => item.kind === "tool")
      .map((item) => item.id);
    for (const id of toolIds) tools.appendChild(this.inventoryItem(id));
    for (const id of Object.values(ITEMS).filter((item) => item.kind === "armor").map((item) => item.id)) {
      armor.appendChild(this.inventoryItem(id));
    }
    const blockIds = Object.keys(BLOCKS)
      .map(Number)
      .filter((id) => id !== 0)
      .sort((a, b) => a - b);
    for (const id of blockIds) blocks.appendChild(this.inventoryItem(id));

    document.body.appendChild(this.inventoryEl);
    this.renderEquipped();
  }

  inventoryItem(id) {
    const el = document.createElement("div");
    el.className = "inv-item";
    el.dataset.id = String(id);
    el.title = itemName(id);
    const icon = iconFor(this.atlas, id, 64);
    if (icon) el.appendChild(icon);
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      this.onInventoryPick?.(id);
      this.refreshInventorySelection();
    });
    return el;
  }

  renderEquipped() {
    if (!this.invEquippedEl) return;
    this.invEquippedEl.innerHTML = "";
    ARMOR_SLOTS.forEach((slot, i) => {
      const el = document.createElement("div");
      el.className = "inv-slot" + (this.armor[i] ? " filled" : "");
      el.title = this.armor[i] ? `${itemName(this.armor[i])} (clic para quitar)` : ARMOR_SLOT_NAMES[slot];
      const icon = iconFor(this.atlas, this.armor[i], 48);
      if (icon) el.appendChild(icon);
      const label = document.createElement("span");
      label.textContent = ARMOR_SLOT_NAMES[slot];
      el.appendChild(label);
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        this.onEquip?.(i);
      });
      this.invEquippedEl.appendChild(el);
    });
  }

  refreshInventorySelection() {
    if (this.invSelectedEl) this.invSelectedEl.textContent = itemName(this.hotbar[this.selected]);
    const current = this.hotbar[this.selected];
    this.inventoryEl?.querySelectorAll(".inv-item").forEach((el) => {
      el.classList.toggle("selected", Number(el.dataset.id) === current);
    });
    this.renderEquipped();
  }

  showInventory() {
    this.inventoryEl.classList.remove("hidden");
    this.refreshInventorySelection();
  }

  hideInventory() {
    this.inventoryEl.classList.add("hidden");
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
        ["⛏ (mantén)", "minar / atacar"],
        ["▣", "colocar / equipar"],
        ["🎒", "inventario"],
        ["👁", "cámara"],
        ["Barra inferior", "elegir objeto"],
      ];
      if (mode === "creative") rows.push(["✈", "volar (subir/bajar con ✈ y ⤒)"]);
      return rows;
    }
    const rows = [
      ["WASD", "moverse"],
      ["Espacio", "saltar / nadar"],
      ["Shift", "correr"],
      ["Clic izq.", "minar / atacar (mantén)"],
      ["Clic der.", "colocar / equipar armadura"],
      ["Rueda / 1-9", "objeto"],
      ["E", "inventario"],
      ["F5 / V", "primera / tercera persona"],
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
        <p class="sub">Mundo infinito en tu navegador · semilla <b id="menu-seed">${this.seed}</b>${IS_TOUCH ? " · mejor en horizontal" : ""}</p>
        <label class="name-field">Tu nombre
          <input id="name-input" maxlength="16" autocomplete="off" spellcheck="false" value="${escapeHtml(this.playerName)}" />
        </label>
        <p class="sub hidden" id="mp-info">Multijugador · <b id="mp-count">${this.onlineCount}</b> en línea</p>
        <div class="status" id="menu-status">${ready ? "" : "Generando mundo…"}</div>
        <div class="controls" id="menu-controls"></div>
        <div class="buttons">
          <button id="btn-play" ${ready ? "" : "disabled"}>${ready ? "Jugar" : "Cargando…"}</button>
        </div>
      `;
      this.menu.appendChild(panel);
      this.renderControls(panel.querySelector("#menu-controls"), this.mode);
      panel.querySelector("#btn-play").addEventListener("click", () => this.onContinue?.());
      panel.querySelector("#name-input").addEventListener("change", (event) => {
        this.onNameChange?.(event.target.value);
      });
      this.statusEl = panel.querySelector("#menu-status");
      this.setMultiplayer(this.multiplayer);
    } else if (mode === "pause") {
      this.menu.innerHTML = "";
      const panel = document.createElement("div");
      panel.className = "panel";
      const mp = this.multiplayer;
      const localButtons = `
        <div class="buttons">
          <button id="btn-save" class="secondary">Guardar</button>
          <button id="btn-load" class="secondary">Cargar</button>
          <button id="btn-new" class="secondary">Mundo nuevo</button>
        </div>
      `;
      panel.innerHTML = `
        <h2>Pausa</h2>
        <p class="sub">Semilla <b>${this.seed}</b> · Modo <b>${this.mode === "survival" ? "Supervivencia" : "Creativo"}</b></p>
        <p class="sub${mp ? "" : " hidden"}" id="mp-info">Multijugador · <b id="mp-count">${this.onlineCount}</b> en línea · ediciones compartidas</p>
        <div class="controls" id="menu-controls"></div>
        <div class="buttons">
          <button id="btn-continue">Continuar</button>
          <button id="btn-mode" class="secondary">Cambiar a ${this.mode === "survival" ? "creativo" : "supervivencia"}</button>
        </div>
        ${mp ? "" : localButtons}
      `;
      this.menu.appendChild(panel);
      this.renderControls(panel.querySelector("#menu-controls"), this.mode);
      panel.querySelector("#btn-continue").addEventListener("click", () => this.onContinue?.());
      panel.querySelector("#btn-mode").addEventListener("click", () => {
        this.onToggleMode?.();
        this.showMenu("pause");
      });
      if (!mp) {
        panel.querySelector("#btn-save").addEventListener("click", () => this.onSave?.());
        panel.querySelector("#btn-load").addEventListener("click", () => this.onLoad?.());
        panel.querySelector("#btn-new").addEventListener("click", () => this.onNewWorld?.());
      }
      const counter = panel.querySelector("#mp-count");
      if (counter) counter.textContent = String(this.onlineCount);
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
