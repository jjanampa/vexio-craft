import { BLOCKS } from "./blocks.js";
import {
  ITEMS,
  ARMOR_SLOTS,
  ARMOR_SLOT_NAMES,
  RECIPES,
  itemName,
  iconTile,
  stackLimit,
  recipeAvailable,
} from "./items.js";
import { drawTileIcon } from "./textures.js";
import { CHARACTERS, headDataUrl } from "./skins.js";
import { IS_TOUCH } from "./config.js";

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

const HOTBAR_ICON = "porkchop";
const BACKPACK_START = 9;
const BACKPACK_END = 36;

export class UI {
  constructor(options = {}) {
    const {
      atlas,
      inventory,
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
      onCraft,
      onInventoryChanged,
      onCharacterChange,
    } = options;

    this.atlas = atlas;
    this.inventory = inventory;
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
    this.onCraft = onCraft;
    this.onInventoryChanged = onInventoryChanged;
    this.onCharacterChange = onCharacterChange;
    this.character = "steve";
    this.multiplayer = false;
    this.onlineCount = 0;
    this.playerName = "";
    this.armor = [0, 0, 0, 0];
    this.cursorStack = null;
    this.iconUrls = new Map();

    this.menu = document.getElementById("menu");
    this.hud = document.getElementById("hud");
    this.debug = document.getElementById("debug");
    this.toastEl = document.getElementById("toast");
    this.hotbarEl = document.getElementById("hotbar");
    this.heartsEl = document.getElementById("hearts");
    this.hungerEl = document.getElementById("hunger-hud");
    this.airEl = document.getElementById("air-hud");
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
    this.lastHunger = -1;
    this.lastAir = -1;

    this.modeBtn.addEventListener("click", () => this.onToggleMode?.());
    this.pauseBtn.classList.toggle("hidden", !IS_TOUCH);
    this.pauseBtn.addEventListener("click", () => this.onPause?.());

    this.buildInventory();
    this.buildHotbar();
    this.setMode("creative");
    this.setHealth(20, false);
  }

  iconUrl(id) {
    const tile = iconTile(id);
    let url = this.iconUrls.get(tile);
    if (!url) {
      const canvas = drawTileIcon(this.atlas, tile, 64);
      if (!canvas) return null;
      url = canvas.toDataURL();
      this.iconUrls.set(tile, url);
    }
    return url;
  }

  iconEl(id, size) {
    const url = this.iconUrl(id);
    if (!url) return null;
    const img = document.createElement("img");
    img.src = url;
    img.className = "px";
    img.draggable = false;
    if (size) {
      img.style.width = `${size}px`;
      img.style.height = `${size}px`;
    }
    return img;
  }

  renderStack(el, stack, size = 48) {
    el.innerHTML = "";
    if (!stack) return;
    el.classList.add("filled");
    const img = this.iconEl(stack.id, size);
    if (img) el.appendChild(img);
    if (stack.count > 1) {
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = String(stack.count);
      el.appendChild(count);
    }
  }

  buildHotbar() {
    this.hotbarEl.innerHTML = "";
    this.slots = [];
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement("div");
      slot.className = "slot" + (i === this.selected ? " selected" : "");
      const key = document.createElement("span");
      key.className = "key";
      key.textContent = String(i + 1);
      slot.appendChild(key);
      const stack = this.inventory?.get(i) || null;
      this.renderStack(slot, stack, IS_TOUCH ? 34 : 40);
      if (stack) slot.title = itemName(stack.id);
      slot.addEventListener("click", () => {
        this.select(i);
        this.onSelectSlot?.(i);
      });
      this.hotbarEl.appendChild(slot);
      this.slots.push(slot);
    }
    this.refreshInventorySlots();
  }

  refreshHotbar() {
    if (!this.slots) return;
    this.slots.forEach((slot, i) => {
      const selected = i === this.selected;
      slot.className = "slot" + (selected ? " selected" : "");
      const key = document.createElement("span");
      key.className = "key";
      key.textContent = String(i + 1);
      slot.innerHTML = "";
      slot.appendChild(key);
      const stack = this.inventory?.get(i) || null;
      this.renderStack(slot, stack, IS_TOUCH ? 34 : 40);
      if (stack) slot.title = itemName(stack.id);
    });
    this.refreshInventorySlots();
    this.updateCursor();
  }

  select(i) {
    if (i < 0 || i >= 9) return;
    this.selected = i;
    this.slots?.forEach((slot, idx) => slot.classList.toggle("selected", idx === i));
    this.refreshInventorySlots();
  }

  setDebug(text) {
    this.debug.textContent = text;
  }

  setSeed(seed) {
    this.seed = seed;
    const el = document.getElementById("menu-seed");
    if (el) el.textContent = seed;
  }

  renderCharacterPicker(container) {
    if (!container) return;
    container.innerHTML = "";
    this.charButtons = new Map();
    for (const character of CHARACTERS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "char-card" + (character.id === this.character ? " selected" : "");
      button.dataset.id = character.id;
      const img = document.createElement("img");
      img.src = headDataUrl(character.id);
      img.alt = character.name;
      img.draggable = false;
      const name = document.createElement("span");
      name.textContent = character.name;
      button.appendChild(img);
      button.appendChild(name);
      button.addEventListener("click", () => {
        this.setCharacter(character.id);
        this.onCharacterChange?.(character.id);
      });
      container.appendChild(button);
      this.charButtons.set(character.id, button);
    }
  }

  setCharacter(id) {
    this.character = id;
    if (!this.charButtons) return;
    for (const [key, button] of this.charButtons) {
      button.classList.toggle("selected", key === id);
    }
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
    this.updateInventoryMode();
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

  setHunger(hunger, visible) {
    if (!visible) {
      this.hungerEl.classList.add("hidden");
      this.lastHunger = -1;
      return;
    }
    this.hungerEl.classList.remove("hidden");
    if (this.lastHunger === hunger) return;
    this.lastHunger = hunger;
    this.hungerEl.innerHTML = "";
    const whole = Math.ceil(hunger / 2);
    for (let i = 0; i < 10; i++) {
      const pip = document.createElement("div");
      pip.className = "food-pip" + (i < whole ? " filled" : "");
      const img = document.createElement("img");
      img.src = this.iconUrl(HOTBAR_ICON);
      pip.appendChild(img);
      this.hungerEl.appendChild(pip);
    }
  }

  setAir(air, visible) {
    if (!visible) {
      this.airEl.classList.add("hidden");
      this.lastAir = -1;
      return;
    }
    this.airEl.classList.remove("hidden");
    if (this.lastAir === air) return;
    this.lastAir = air;
    this.airEl.innerHTML = "";
    const whole = Math.ceil(air);
    for (let i = 0; i < 10; i++) {
      const bubble = document.createElement("div");
      bubble.className = "bubble" + (i < whole ? " filled" : "");
      this.airEl.appendChild(bubble);
    }
  }

  setArmor(list) {
    this.armor = list.slice(0, 4);
    this.armorEl.innerHTML = "";
    const points = this.armor.reduce((sum, id) => sum + (ITEMS[id]?.armor || 0), 0);
    this.armorEl.classList.toggle("hidden", points === 0 || this.mode === "creative");
    for (const id of this.armor) {
      const slot = document.createElement("div");
      slot.className = "armor-pip" + (id ? " filled" : "");
      const img = this.iconEl(id, 18);
      if (img) slot.appendChild(img);
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
        <p class="inv-note" id="inv-note"></p>
      </div>
      <div class="inv-section">
        <div class="inv-label">Armadura equipada</div>
        <div class="inv-equipped" id="inv-equipped"></div>
      </div>
      <div class="inv-section" id="inv-recipes-section">
        <div class="inv-label">Crafteo</div>
        <div class="inv-recipes" id="inv-recipes"></div>
      </div>
      <div class="inv-section" id="inv-backpack-section">
        <div class="inv-label">Mochila</div>
        <div class="inv-grid inv-slots" id="inv-backpack"></div>
      </div>
      <div class="inv-section" id="inv-hotbar-section">
        <div class="inv-label">Barra rápida</div>
        <div class="inv-grid inv-slots inv-hotbar-grid" id="inv-hotbar-grid"></div>
      </div>
      <div class="inv-section" id="inv-catalog-tools">
        <div class="inv-label">Herramientas y armas</div>
        <div class="inv-grid" id="inv-tools"></div>
      </div>
      <div class="inv-section" id="inv-catalog-armor">
        <div class="inv-label">Armadura</div>
        <div class="inv-grid" id="inv-armor"></div>
      </div>
      <div class="inv-section" id="inv-catalog-blocks">
        <div class="inv-label">Bloques</div>
        <div class="inv-grid" id="inv-blocks"></div>
      </div>
      <div class="inv-foot"><span id="inv-selected"></span><span>E para cerrar</span></div>
    `;
    this.inventoryEl.appendChild(panel);
    panel.addEventListener("click", (event) => event.stopPropagation());
    panel.addEventListener("contextmenu", (event) => event.preventDefault());
    this.inventoryEl.addEventListener("click", () => this.onCloseInventory?.());

    this.invNoteEl = panel.querySelector("#inv-note");
    this.invEquippedEl = panel.querySelector("#inv-equipped");
    this.invRecipesEl = panel.querySelector("#inv-recipes");
    this.invBackpackEl = panel.querySelector("#inv-backpack");
    this.invHotbarEl = panel.querySelector("#inv-hotbar-grid");
    this.invSelectedEl = panel.querySelector("#inv-selected");
    this.recipesSection = panel.querySelector("#inv-recipes-section");
    this.backpackSection = panel.querySelector("#inv-backpack-section");
    this.hotbarSection = panel.querySelector("#inv-hotbar-section");
    this.catalogTools = panel.querySelector("#inv-catalog-tools");
    this.catalogArmor = panel.querySelector("#inv-catalog-armor");
    this.catalogBlocks = panel.querySelector("#inv-catalog-blocks");

    const tools = panel.querySelector("#inv-tools");
    const armor = panel.querySelector("#inv-armor");
    const blocks = panel.querySelector("#inv-blocks");
    for (const id of Object.values(ITEMS)
      .filter((item) => item.kind === "tool")
      .map((item) => item.id)) {
      tools.appendChild(this.catalogItem(id));
    }
    for (const id of Object.values(ITEMS)
      .filter((item) => item.kind === "armor")
      .map((item) => item.id)) {
      armor.appendChild(this.catalogItem(id));
    }
    for (const id of Object.keys(BLOCKS).map(Number).filter((v) => v !== 0).sort((a, b) => a - b)) {
      blocks.appendChild(this.catalogItem(id));
    }

    for (let i = BACKPACK_START; i < BACKPACK_END; i++) {
      this.invBackpackEl.appendChild(this.slotCell(i));
    }
    for (let i = 0; i < 9; i++) {
      this.invHotbarEl.appendChild(this.slotCell(i));
    }

    document.body.appendChild(this.inventoryEl);

    this.cursorEl = document.createElement("div");
    this.cursorEl.id = "cursor-stack";
    this.cursorEl.classList.add("hidden");
    document.body.appendChild(this.cursorEl);
    document.addEventListener("mousemove", (event) => {
      this.cursorEl.style.left = `${event.clientX - 14}px`;
      this.cursorEl.style.top = `${event.clientY - 14}px`;
    });

    this.renderRecipes();
    this.renderEquipped();
  }

  catalogItem(id) {
    const el = document.createElement("div");
    el.className = "inv-item";
    el.dataset.id = String(id);
    el.title = itemName(id);
    const img = this.iconEl(id, 48);
    if (img) el.appendChild(img);
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      this.onInventoryPick?.(id);
      this.refreshInventorySlots();
    });
    return el;
  }

  slotCell(index) {
    const el = document.createElement("div");
    el.className = "inv-slot-sm";
    el.dataset.index = String(index);
    this.renderStack(el, this.inventory?.get(index) || null, 40);
    el.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.cursorEl.style.left = `${event.clientX - 14}px`;
      this.cursorEl.style.top = `${event.clientY - 14}px`;
      this.onSlotClick(index, event.button);
    });
    return el;
  }

  onSlotClick(index, button) {
    if (this.mode !== "survival") {
      this.select(index);
      this.onSelectSlot?.(index);
      return;
    }
    const slot = this.inventory.get(index);
    if (!this.cursorStack) {
      if (!slot) return;
      if (button === 2) {
        this.cursorStack = this.inventory.takeFrom(index, Math.ceil(slot.count / 2));
      } else {
        this.cursorStack = this.inventory.takeFrom(index, slot.count);
      }
    } else if (!slot) {
      if (button === 2) {
        const put = { id: this.cursorStack.id, count: 1 };
        this.inventory.set(index, put);
        this.cursorStack.count -= 1;
      } else {
        this.inventory.set(index, this.cursorStack);
        this.cursorStack = null;
      }
    } else if (slot.id === this.cursorStack.id) {
      const limit = stackLimit(slot.id);
      const space = limit - slot.count;
      const put = Math.min(space, this.cursorStack.count);
      slot.count += put;
      this.cursorStack.count -= put;
    } else if (button === 0) {
      this.inventory.set(index, this.cursorStack);
      this.cursorStack = slot;
    }
    if (this.cursorStack && this.cursorStack.count <= 0) this.cursorStack = null;
    this.refreshHotbar();
    this.updateRecipeAvailability();
    this.updateCursor();
    this.onInventoryChanged?.();
  }

  updateCursor() {
    if (!this.cursorEl) return;
    if (!this.cursorStack || this.inventoryEl.classList.contains("hidden")) {
      this.cursorEl.classList.add("hidden");
      return;
    }
    this.cursorEl.classList.remove("hidden");
    this.cursorEl.innerHTML = "";
    const img = this.iconEl(this.cursorStack.id, 36);
    if (img) this.cursorEl.appendChild(img);
    if (this.cursorStack.count > 1) {
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = String(this.cursorStack.count);
      this.cursorEl.appendChild(count);
    }
  }

  returnCursorToInventory() {
    if (!this.cursorStack) return true;
    const leftover = this.inventory.add(this.cursorStack.id, this.cursorStack.count);
    if (leftover > 0) {
      this.cursorStack.count = leftover;
      return false;
    }
    this.cursorStack = null;
    this.updateCursor();
    return true;
  }

  renderRecipes() {
    if (!this.invRecipesEl) return;
    this.invRecipesEl.innerHTML = "";
    let group = "";
    RECIPES.forEach((recipe, index) => {
      if (recipe.group !== group) {
        group = recipe.group;
        const label = document.createElement("div");
        label.className = "recipe-group";
        label.textContent = group;
        this.invRecipesEl.appendChild(label);
      }
      const el = document.createElement("div");
      el.className = "recipe";
      el.dataset.index = String(index);
      el.title = itemName(recipe.outId);
      const out = document.createElement("div");
      out.className = "recipe-out";
      const outImg = this.iconEl(recipe.outId, 36);
      if (outImg) out.appendChild(outImg);
      if (recipe.outCount > 1) {
        const count = document.createElement("span");
        count.className = "count";
        count.textContent = String(recipe.outCount);
        out.appendChild(count);
      }
      const ing = document.createElement("div");
      ing.className = "recipe-ing";
      for (const item of recipe.ingredients) {
        const chip = document.createElement("span");
        chip.className = "ing";
        chip.title = item.ids.map((id) => itemName(id)).join(" / ");
        const img = this.iconEl(item.ids[0], 26);
        if (img) chip.appendChild(img);
        const count = document.createElement("b");
        count.textContent = `x${item.count}`;
        chip.appendChild(count);
        ing.appendChild(chip);
      }
      el.appendChild(out);
      el.appendChild(ing);
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        this.onCraft?.(recipe);
      });
      this.invRecipesEl.appendChild(el);
    });
    this.updateRecipeAvailability();
  }

  updateRecipeAvailability() {
    if (!this.invRecipesEl || !this.inventory) return;
    for (const el of this.invRecipesEl.querySelectorAll(".recipe")) {
      const recipe = RECIPES[Number(el.dataset.index)];
      el.classList.toggle("ok", recipeAvailable(recipe, this.inventory));
    }
  }

  renderEquipped() {
    if (!this.invEquippedEl) return;
    this.invEquippedEl.innerHTML = "";
    ARMOR_SLOTS.forEach((slot, i) => {
      const el = document.createElement("div");
      el.className = "inv-slot" + (this.armor[i] ? " filled" : "");
      el.title = this.armor[i] ? `${itemName(this.armor[i])} (clic para quitar)` : ARMOR_SLOT_NAMES[slot];
      const img = this.iconEl(this.armor[i], 34);
      if (img) el.appendChild(img);
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

  refreshInventorySlots() {
    if (this.invSelectedEl) {
      const selected = this.inventory?.get(this.selected);
      this.invSelectedEl.textContent = selected
        ? `Seleccionado: ${itemName(selected.id)} ×${selected.count}`
        : `Slot ${this.selected + 1}: vacío`;
    }
    if (!this.inventoryEl) return;
    for (const el of this.inventoryEl.querySelectorAll(".inv-slot-sm")) {
      const index = Number(el.dataset.index);
      el.className = "inv-slot-sm" + (this.inventory?.get(index) ? " filled" : "");
      el.innerHTML = "";
      this.renderStack(el, this.inventory?.get(index) || null, 40);
    }
    const current = this.inventory?.get(this.selected);
    this.inventoryEl.querySelectorAll(".inv-item").forEach((el) => {
      el.classList.toggle("selected", current && Number(el.dataset.id) === current.id);
    });
    this.updateCursor();
  }

  updateInventoryMode() {
    if (!this.inventoryEl) return;
    const survival = this.mode === "survival";
    this.recipesSection.classList.toggle("hidden", !survival);
    this.backpackSection.classList.toggle("hidden", !survival);
    this.hotbarSection.classList.toggle("hidden", !survival);
    this.catalogTools.classList.toggle("hidden", survival);
    this.catalogArmor.classList.toggle("hidden", survival);
    this.catalogBlocks.classList.toggle("hidden", survival);
    this.invNoteEl.textContent = survival
      ? "Recoge bloques al minar · clic en las recetas para fabricar · clic derecho reparte la mitad"
      : "Clic en un objeto para ponerlo en la barra · Armadura: clic para equipar o quitar";
    this.setArmor(this.armor);
    this.refreshInventorySlots();
  }

  showInventory() {
    this.inventoryEl.classList.remove("hidden");
    this.updateInventoryMode();
    this.refreshHotbar();
    this.updateRecipeAvailability();
  }

  hideInventory() {
    this.returnCursorToInventory();
    this.inventoryEl.classList.add("hidden");
    this.updateCursor();
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
        ["▣", "colocar / comer / equipar"],
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
      ["Clic der.", "colocar / comer / equipar"],
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
        <div class="char-section">
          <div class="char-label">Elige tu personaje</div>
          <div class="char-list" id="menu-chars"></div>
        </div>
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
      this.renderCharacterPicker(panel.querySelector("#menu-chars"));
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
