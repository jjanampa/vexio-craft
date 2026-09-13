import * as THREE from "three";
import {
  CHUNK_SIZE,
  WORLD_HEIGHT,
  RENDER_DISTANCE,
  REACH,
  DAY_LENGTH,
  AUTOSAVE_INTERVAL,
  IS_TOUCH,
  MAX_HEALTH,
} from "./config.js";
import {
  AIR,
  WATER,
  LAVA,
  OBSIDIAN,
  NETHER_PORTAL,
  END_PORTAL,
  BLOCKS,
  isLiquid,
  isLava,
  isWater,
  isPortal,
  isUnbreakable,
  isSolid,
  breakTime,
  faceTile,
} from "./blocks.js";
import {
  DEFAULT_HOTBAR,
  isArmor,
  isFood,
  foodValue,
  armorSlotOf,
  armorPoints,
  armorReduction,
  attackPower,
  breakTimeWithTool,
  canHarvest,
  rollBlockDrop,
  consumeIngredients,
  recipeAvailable,
  RECIPES,
  itemName,
  placeable,
} from "./items.js";
import { Inventory } from "./inventory.js";
import { createAtlas, createCrackStrip, averageTileColors } from "./textures.js";
import { World, BIOME_NAMES, DIMENSION_NAMES } from "./world.js";
import { tryIgnitePortal, ensurePortal } from "./portals.js";
import { buildChunkGeometry, disposeChunkMeshes } from "./mesher.js";
import { Player } from "./player.js";
import { Input } from "./input.js";
import { UI } from "./ui.js";
import { Sfx } from "./audio.js";
import { Sky } from "./sky.js";
import { saveGame, loadGame, hasSave } from "./storage.js";
import { Net } from "./net.js";
import { RemotePlayers } from "./remotePlayers.js";
import { Hand } from "./hand.js";
import { Avatar } from "./avatar.js";
import { Mobs } from "./mobs.js";

const app = document.getElementById("app");
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_TOUCH ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
if (!IS_TOUCH) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const FOG_NEAR = RENDER_DISTANCE * CHUNK_SIZE * 0.5;
const FOG_FAR = RENDER_DISTANCE * CHUNK_SIZE * 0.95;
scene.fog = new THREE.Fog(0xbfe0ff, FOG_NEAR, FOG_FAR);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 900);
camera.rotation.order = "YXZ";

const atlas = createAtlas();
const texture = new THREE.CanvasTexture(atlas.canvas);
texture.magFilter = THREE.NearestFilter;
texture.minFilter = THREE.LinearMipmapLinearFilter;
texture.generateMipmaps = true;
texture.colorSpace = THREE.SRGBColorSpace;
texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

const materialOpaque = new THREE.MeshLambertMaterial({ map: texture, vertexColors: true });
const alphaDepthMaterial = new THREE.MeshDepthMaterial({
  depthPacking: THREE.RGBADepthPacking,
  map: texture,
  alphaTest: 0.5,
});
const materialAlpha = new THREE.MeshLambertMaterial({
  map: texture,
  vertexColors: true,
  alphaTest: 0.5,
  side: THREE.DoubleSide,
});
let waterShader = null;
const materialLava = new THREE.MeshLambertMaterial({
  map: texture,
  vertexColors: true,
  emissive: 0xff6a00,
  emissiveIntensity: 0.65,
});
const materialPortal = new THREE.MeshLambertMaterial({
  map: texture,
  vertexColors: true,
  transparent: true,
  opacity: 0.86,
  emissive: 0x7a30c0,
  emissiveIntensity: 0.55,
  side: THREE.DoubleSide,
  depthWrite: false,
});
const materialWater = new THREE.MeshLambertMaterial({
  map: texture,
  vertexColors: true,
  transparent: true,
  opacity: 0.82,
  depthWrite: false,
  side: THREE.DoubleSide,
});
materialWater.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = { value: 0 };
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nuniform float uTime;")
    .replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nfloat wave = sin(uTime * 1.5 + transformed.x * 0.55 + transformed.z * 0.45) + sin(uTime * 0.9 + transformed.x * 0.21 - transformed.z * 0.33);\ntransformed.y += wave * 0.02;"
    );
  waterShader = shader;
};

const hand = new Hand(atlas, texture);
hand.setHeld(DEFAULT_HOTBAR[0]);
const selfAvatar = new Avatar({ color: 0x3fb8a8, atlas, texture });
selfAvatar.group.visible = false;
scene.add(selfAvatar.group);

const outline = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 })
);
outline.visible = false;
scene.add(outline);

const crackTexture = new THREE.CanvasTexture(createCrackStrip());
crackTexture.magFilter = THREE.NearestFilter;
crackTexture.minFilter = THREE.LinearFilter;
crackTexture.generateMipmaps = false;
crackTexture.colorSpace = THREE.SRGBColorSpace;
crackTexture.wrapS = THREE.ClampToEdgeWrapping;
crackTexture.wrapT = THREE.ClampToEdgeWrapping;
crackTexture.repeat.set(0.096, 1);
const crackMesh = new THREE.Mesh(
  new THREE.BoxGeometry(1.006, 1.006, 1.006),
  new THREE.MeshBasicMaterial({
    map: crackTexture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
);
crackMesh.visible = false;
crackMesh.renderOrder = 2;
scene.add(crackMesh);
let crackStage = -1;

function setCrack(progress, target) {
  if (progress <= 0 || progress >= 1 || !target) {
    crackMesh.visible = false;
    crackStage = -1;
    return;
  }
  const stage = Math.min(9, Math.floor(progress * 10));
  if (stage !== crackStage) {
    crackStage = stage;
    crackTexture.offset.x = stage * 0.1 + 0.002;
  }
  crackMesh.visible = true;
  crackMesh.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
}

const tileColors = averageTileColors(atlas);
const PARTICLE_COUNT = 140;
const particleGeometry = new THREE.BoxGeometry(0.13, 0.13, 0.13);
const particleMaterial = new THREE.MeshLambertMaterial();
const particles = new THREE.InstancedMesh(particleGeometry, particleMaterial, PARTICLE_COUNT);
particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
particles.frustumCulled = false;
scene.add(particles);
const particleData = new Array(PARTICLE_COUNT).fill(null);
const particleDummy = new THREE.Object3D();
const particleColor = new THREE.Color();

function spawnParticles(x, y, z, blockId, count, speed, overrideRgb = null) {
  const tile = blockId ? faceTile(blockId, 4) || faceTile(blockId, 2) || "stone" : null;
  const rgb = overrideRgb || tileColors[tile] || [1, 1, 1];
  for (let i = 0; i < count; i++) {
    const slot = particleData.findIndex((p) => p === null);
    if (slot === -1) return;
    particleData[slot] = {
      pos: new THREE.Vector3(x + Math.random(), y + Math.random(), z + Math.random()),
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * speed,
        speed * 0.3 + Math.random() * speed * 0.7,
        (Math.random() - 0.5) * speed
      ),
      life: 0,
      maxLife: 0.55 + Math.random() * 0.55,
      size: 0.7 + Math.random() * 0.7,
    };
    particleColor.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
    particles.setColorAt(slot, particleColor);
  }
  if (particles.instanceColor) particles.instanceColor.needsUpdate = true;
}

function updateParticles(dt) {
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const data = particleData[i];
    if (data) {
      data.life += dt;
      if (data.life >= data.maxLife) {
        particleData[i] = null;
        particleDummy.position.set(0, -600, 0);
        particleDummy.scale.setScalar(0);
        particleDummy.rotation.set(0, 0, 0);
        particleDummy.updateMatrix();
        particles.setMatrixAt(i, particleDummy.matrix);
        continue;
      }
      data.vel.y -= 18 * dt;
      data.pos.addScaledVector(data.vel, dt);
      const ground = world.getBlock(
        Math.floor(data.pos.x),
        Math.floor(data.pos.y - 0.06),
        Math.floor(data.pos.z)
      );
      if (isSolid(ground) && data.vel.y < 0) {
        data.pos.y = Math.floor(data.pos.y - 0.06) + 1.08;
        data.vel.y *= -0.28;
        data.vel.x *= 0.55;
        data.vel.z *= 0.55;
      }
      const fade = 1 - data.life / data.maxLife;
      particleDummy.position.copy(data.pos);
      particleDummy.scale.setScalar(data.size * fade);
      particleDummy.rotation.set(data.life * 3.2, data.life * 2.4, data.life * 1.7);
      particleDummy.updateMatrix();
      particles.setMatrixAt(i, particleDummy.matrix);
    }
  }
  particles.instanceMatrix.needsUpdate = true;
}

const sky = new Sky(scene);
const remotePlayers = new RemotePlayers(scene, { atlas, texture });

const NAME_KEY = "vexio-craft-name-v1";
const MP_TIMEOUT = 3500;

function loadName() {
  try {
    return localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}

function storeName(name) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {}
}

function randomName() {
  return "Vexio" + Math.floor(100 + Math.random() * 900);
}

function sanitizeName(raw) {
  return String(raw || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 16);
}

let playerName = loadName() || randomName();
let mpActive = false;
let mpDecided = false;
let stateTimer = 0;

const dimensionSeeds = {};
const dimensionEdits = {};
const dimensions = {};
let currentDim = "overworld";
let portalTimer = 0;
let portalCooldown = 0;
let travelled = false;
let lavaTimer = 0;

let world;
let player;
let timeOfDay = 0.32;
let selectedSlot = 0;
let started = false;
let ready = false;
let mode = "creative";
let currentTarget = null;
let currentMob = null;
let attackCooldown = 0;
let miningProgress = 0;
let miningKey = null;
let miningSound = 0;
let breakCooldown = 0;
let placeCooldown = 0;
let saveTimer = 0;
let fps = 0;
let frameCount = 0;
let fpsTimer = 0;
let stepOdometer = 0;
let elapsed = 0;
let underwater = false;
let underwaterLava = false;
let inventoryOpen = false;
let cameraMode = 0;
let pauseBlockUntil = 0;
let prevVelY = 0;
let eatCooldown = 0;
const inventory = new Inventory(36);
const equipment = [0, 0, 0, 0];
const CREATIVE_HOTBAR = [...DEFAULT_HOTBAR];

function seedCreativeInventory() {
  CREATIVE_HOTBAR.forEach((id, i) => inventory.set(i, { id, count: 1 }));
}
const underwaterEl = document.getElementById("underwater");

const sfx = new Sfx();
const mobs = new Mobs(scene, {
  sfx,
  onAttack: (damage) => player?.damage(damage),
  onPoof: (pos, rgb, count, speed) =>
    spawnParticles(pos.x - 0.5, pos.y - 0.5, pos.z - 0.5, 0, count, speed, rgb),
  onDrop: (id, count) => {
    if (mode === "survival" && started) giveItem(id, count);
  },
});
const ui = new UI({
  atlas,
  inventory,
  onContinue: () => {
    if (input.touch) {
      if (!started) {
        started = true;
        input.setTouchUiVisible(true);
        ui.toast(hasSave() ? "Partida cargada" : "¡A construir!");
      }
      ui.hideMenu();
      sfx.resume();
      requestFullscreen();
    } else {
      const result = renderer.domElement.requestPointerLock();
      if (result && result.catch) result.catch(() => {});
    }
  },
  onSave: () => doSave(true),
  onLoad: () => doLoad(),
  onNewWorld: () => doNewWorld(),
  onSelectSlot: (i) => selectSlot(i),
  onToggleMode: () => setMode(mode === "creative" ? "survival" : "creative"),
  onPause: () => {
    if (started) {
      ui.showMenu("pause");
      doSave(false);
    }
  },
  onInventoryPick: (id) => assignToSlot(id),
  onEquip: (slot) => toggleArmorSlot(slot),
  onCloseInventory: () => closeInventory(),
  onCraft: (recipe) => craftItem(recipe),
  onInventoryChanged: () => {
    hand.setHeld(heldItem());
    selfAvatar.setHeld(heldItem());
  },
  onNameChange: (raw) => {
    const name = sanitizeName(raw) || randomName();
    playerName = name;
    storeName(name);
    ui.setPlayerName(name);
    if (mpActive) {
      net.rename(name);
      ui.toast(`Ahora eres ${name}`);
    }
  },
});

const input = new Input(renderer.domElement, {
  onLockChange: (locked) => {
    if (locked) {
      if (!started) {
        started = true;
        ui.toast(hasSave() ? "Partida cargada" : "¡A construir!");
      }
      ui.hideMenu();
      sfx.resume();
    } else if (started && !inventoryOpen && performance.now() >= pauseBlockUntil) {
      ui.showMenu("pause");
      doSave(false);
    }
  },
  onPlace: () => tryPlace(),
  onPick: () => pickBlock(),
  onWheel: (dir) => selectSlot((selectedSlot + dir + 9) % 9),
  onHotbar: (i) => selectSlot(i),
  onInventory: () => toggleInventory(),
  onCamera: () => toggleCamera(),
  onEscape: () => {
    if (inventoryOpen) {
      pauseBlockUntil = performance.now() + 400;
      closeInventory();
    }
  },
  onFly: () => {
    if (!started) return;
    if (mode !== "creative") {
      ui.toast("Volar no está disponible en supervivencia");
      return;
    }
    player.flying = !player.flying;
    player.vel.y = 0;
    ui.toast(player.flying ? "Modo vuelo activado" : "Modo vuelo desactivado");
  },
});

const net = new Net({
  onWelcome: (msg) => handleWelcome(msg),
  onJoin: (p) => {
    remotePlayers.upsert(p);
    if (mpActive) ui.toast(`${p.name} se unió`);
  },
  onLeave: (id, name) => {
    const entry = remotePlayers.map.get(id);
    remotePlayers.remove(id);
    if (mpActive) ui.toast(`${entry?.name || name || "Un jugador"} salió`);
  },
  onRename: (id, name) => remotePlayers.rename(id, name),
  onState: (list) => {
    const local = list.filter((p) => p.dim === currentDim);
    for (const p of local) {
      if (p.id === net.id) continue;
      remotePlayers.upsert(p);
    }
    remotePlayers.prune(local, net.id);
    ui.setMultiplayer(true, local.length);
  },
  onEdit: (msg) => applyRemoteEdit(msg),
  onSwing: (id, action) => {
    if (action === "swing") remotePlayers.swing(id);
  },
  onStatus: (connected, wasConnected) => {
    if (!wasConnected) return;
    ui.toast("Conexión perdida, reconectando…", 3000);
  },
});

function deriveSeed(seed, n) {
  return Math.abs((seed * 31 + n * 1013904223) % 1000000000);
}

function getWorld(dim) {
  let w = dimensions[dim];
  if (!w) {
    const seed =
      dimensionSeeds[dim] ??
      deriveSeed(dimensionSeeds.overworld ?? Math.floor(Math.random() * 1e9), dim === "nether" ? 1 : dim === "end" ? 2 : 0);
    dimensionSeeds[dim] = seed;
    w = new World(seed, dim);
    if (dimensionEdits[dim]) w.loadEdits(dimensionEdits[dim]);
    dimensions[dim] = w;
  }
  return w;
}

function applyDimensionData(dims) {
  if (!dims) return;
  for (const [dim, info] of Object.entries(dims)) {
    dimensionSeeds[dim] = info.seed;
    dimensionEdits[dim] = info.edits || [];
    const existing = dimensions[dim];
    if (existing) {
      if (existing.seed !== info.seed) {
        existing.reset(info.seed, dim);
      }
      existing.loadEdits(info.edits || []);
      existing.reapplyEdits();
    }
  }
}

function handleWelcome(msg) {
  mpDecided = true;
  mpActive = true;
  applyDimensionData(msg.dims);
  currentDim = msg.dim || "overworld";
  if (!ready) {
    world = getWorld(currentDim);
    ui.setSeed(world.seed);
    player = new Player(world);
    player.onDamage = () => {
      ui.flashDamage();
      sfx.hurt();
    };
    player.onDeath = () => handleDeath();
    sky.setDimension(currentDim);
    preloadSpawn();
    ready = true;
    applySavedItems(null);
    refreshEquipment();
    setMode(mode, true);
    selectSlot(selectedSlot);
    ui.setStatus(mpStatus(msg.players.length + 1), true);
  } else {
    world = getWorld(currentDim);
    for (const chunk of world.chunks.values()) chunk.dirty = true;
    remotePlayers.clear();
    ui.toast("Conexión restablecida", 2600);
  }
  const local = msg.players.filter((p) => p.dim === currentDim);
  for (const p of local) remotePlayers.upsert(p);
  remotePlayers.prune(local, net.id);
}

function mpStatus(count) {
  return `En línea · ${count} ${count === 1 ? "jugador" : "jugadores"}`;
}

function applyRemoteEdit(msg) {
  if (!world || (msg.dim && msg.dim !== currentDim)) return;
  world.applyEdit(msg.x, msg.y, msg.z, msg.id);
  if (started) spawnParticles(msg.x, msg.y, msg.z, msg.id, 6, 1.8);
}

function canInteract() {
  return started && !inventoryOpen && (input.locked || input.touch);
}

function requestFullscreen() {
  if (!IS_TOUCH) return;
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  if (typeof screen !== "undefined" && screen.orientation && screen.orientation.lock) {
    screen.orientation.lock("landscape").catch(() => {});
  }
}

function setMode(next, silent = false) {
  mode = next;
  if (player) {
    player.mode = mode;
    if (mode !== "creative") player.flying = false;
  }
  ui.setMode(mode);
  input.setFlyButtonVisible(mode === "creative");
  ui.setHealth(player?.health ?? MAX_HEALTH, mode === "survival" && started);
  if (player) ui.setHunger(player.hunger, mode === "survival" && started);
  if (mode === "survival" && inventory.slots.every((slot) => !slot)) {
    ui.toast("Supervivencia: golpea árboles y fabrica tus herramientas", 3200);
  }
  if (!silent) ui.toast(mode === "survival" ? "Modo supervivencia" : "Modo creativo");
}

function startSingleplayer() {
  const saved = loadGame();
  const baseSeed = saved?.seed ?? Math.floor(Math.random() * 1e9);
  dimensionSeeds.overworld = saved?.seeds?.overworld ?? baseSeed;
  dimensionSeeds.nether = saved?.seeds?.nether ?? deriveSeed(baseSeed, 1);
  dimensionSeeds.end = saved?.seeds?.end ?? deriveSeed(baseSeed, 2);
  dimensionEdits.overworld = saved?.dims?.overworld ?? saved?.edits ?? [];
  dimensionEdits.nether = saved?.dims?.nether ?? [];
  dimensionEdits.end = saved?.dims?.end ?? [];
  currentDim = saved?.player?.dim ?? "overworld";
  world = getWorld(currentDim);
  ui.setSeed(world.seed);
  player = new Player(world);
  player.onDamage = () => {
    ui.flashDamage();
    sfx.hurt();
  };
  player.onDeath = () => handleDeath();
  sky.setDimension(currentDim);
  applySavedItems(saved);
  if (saved?.player) {
    player.pos.set(saved.player.x, saved.player.y, saved.player.z);
    player.yaw = saved.player.yaw ?? 0;
    player.pitch = saved.player.pitch ?? 0;
    timeOfDay = saved.time ?? 0.32;
    selectedSlot = saved.selected ?? 0;
    mode = saved.mode ?? "creative";
    player.health = saved.health ?? player.maxHealth;
    player.hunger = saved.hunger ?? player.maxHunger;
    ui.setStatus("", true);
    preloadAround(Math.floor(player.pos.x), Math.floor(player.pos.z));
    ready = true;
  } else {
    preloadSpawn();
  }
  refreshEquipment();
  setMode(mode, true);
  selectSlot(selectedSlot);
  ui.setHunger(player.hunger, mode === "survival");
}

function applySavedItems(saved) {
  const savedInv = Array.isArray(saved?.inventory) ? saved.inventory : null;
  if (savedInv) {
    inventory.load(savedInv);
  } else if (Array.isArray(saved?.hotbar)) {
    inventory.clear();
    saved.hotbar.forEach((id, i) => {
      if (i < 9 && Number.isInteger(id) && id > 0 && id <= 65535) inventory.set(i, { id, count: 1 });
    });
  } else {
    inventory.clear();
  }
  if (mode === "creative" && inventory.slots.every((slot) => !slot)) seedCreativeInventory();
  const savedArmor = Array.isArray(saved?.armor) ? saved.armor : null;
  if (savedArmor && savedArmor.length === 4) {
    savedArmor.forEach((id, i) => {
      equipment[i] = Number.isInteger(id) && id >= 0 && id <= 65535 ? id : 0;
    });
  }
  ui.refreshHotbar();
  ui.updateRecipeAvailability();
}

function preloadAround(x, z) {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cz = Math.floor(z / CHUNK_SIZE);
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) world.ensureChunk(cx + dx, cz + dz);
  }
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const chunk = world.ensureChunk(cx + dx, cz + dz);
      rebuildChunk(chunk);
      chunk.dirty = false;
    }
  }
}

function preloadSpawn() {
  for (let r = 0; r <= 3; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        world.ensureChunk(dx, dz);
      }
    }
  }
  const point = respawnPoint();
  preloadAround(Math.floor(point.x), Math.floor(point.z));
  player.respawn(point);
  ready = true;
  ui.setStatus("", true);
}

function respawnPoint() {
  const spawn = world.findSpawn();
  world.ensureChunk(spawn.x >> 4, spawn.z >> 4);
  const top = world.findFloor(spawn.x, spawn.z, Math.min(WORLD_HEIGHT - 2, spawn.h + 12));
  return { x: spawn.x, y: top + 1.2, z: spawn.z };
}

function handleDeath() {
  ui.flashDamage();
  ui.toast("Has muerto, reapareces en el spawn");
  player.respawn(respawnPoint());
  ui.setHealth(player.health, true);
}

function rebuildChunk(chunk) {
  disposeChunkMeshes(chunk, scene);
  const parts = buildChunkGeometry(world, chunk, atlas.uvs);
  const meshes = [];
  if (parts.opaque) {
    const mesh = new THREE.Mesh(parts.opaque, materialOpaque);
    mesh.castShadow = !IS_TOUCH;
    mesh.receiveShadow = !IS_TOUCH;
    meshes.push(mesh);
  }
  if (parts.alpha) {
    const mesh = new THREE.Mesh(parts.alpha, materialAlpha);
    mesh.castShadow = !IS_TOUCH;
    mesh.receiveShadow = !IS_TOUCH;
    mesh.customDepthMaterial = alphaDepthMaterial;
    meshes.push(mesh);
  }
  if (parts.water) {
    meshes.push(new THREE.Mesh(parts.water, materialWater));
  }
  if (parts.lava) {
    meshes.push(new THREE.Mesh(parts.lava, materialLava));
  }
  if (parts.portal) {
    meshes.push(new THREE.Mesh(parts.portal, materialPortal));
  }
  for (const mesh of meshes) {
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
  }
  chunk.meshes = meshes;
}

function streamChunks() {
  const lists = world.update(player.pos.x, player.pos.z);
  let t0 = performance.now();
  let generated = 0;
  for (const item of lists.generate) {
    if (generated >= 3 || performance.now() - t0 > 9) break;
    world.ensureChunk(item.cx, item.cz);
    generated++;
  }
  t0 = performance.now();
  let meshed = 0;
  for (const item of lists.mesh) {
    if (meshed >= 3 || performance.now() - t0 > 11) break;
    const chunk = world.getChunk(item.cx, item.cz);
    if (!chunk) continue;
    rebuildChunk(chunk);
    chunk.dirty = false;
    meshed++;
  }
  for (const chunk of lists.unload) {
    disposeChunkMeshes(chunk, scene);
    world.chunks.delete(world.chunkKey(chunk.cx, chunk.cz));
  }
}

function raycastVoxel(origin, direction, maxDist) {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  const stepX = Math.sign(direction.x);
  const stepY = Math.sign(direction.y);
  const stepZ = Math.sign(direction.z);
  const tDeltaX = stepX !== 0 ? Math.abs(1 / direction.x) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / direction.y) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / direction.z) : Infinity;
  let tMaxX = stepX !== 0 ? (stepX > 0 ? x + 1 - origin.x : origin.x - x) / Math.abs(direction.x) : Infinity;
  let tMaxY = stepY !== 0 ? (stepY > 0 ? y + 1 - origin.y : origin.y - y) / Math.abs(direction.y) : Infinity;
  let tMaxZ = stepZ !== 0 ? (stepZ > 0 ? z + 1 - origin.z : origin.z - z) / Math.abs(direction.z) : Infinity;
  let nx = 0;
  let ny = 0;
  let nz = 0;
  let entered = 0;
  for (let i = 0; i < 128; i++) {
    const block = world.getBlock(x, y, z);
    if (block !== AIR && !isLiquid(block)) {
      return { x, y, z, nx, ny, nz, block, dist: entered };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      if (tMaxX > maxDist) break;
      entered = tMaxX;
      x += stepX;
      tMaxX += tDeltaX;
      nx = -stepX;
      ny = 0;
      nz = 0;
    } else if (tMaxY < tMaxZ) {
      if (tMaxY > maxDist) break;
      entered = tMaxY;
      y += stepY;
      tMaxY += tDeltaY;
      nx = 0;
      ny = -stepY;
      nz = 0;
    } else {
      if (tMaxZ > maxDist) break;
      entered = tMaxZ;
      z += stepZ;
      tMaxZ += tDeltaZ;
      nx = 0;
      ny = 0;
      nz = -stepZ;
    }
  }
  return null;
}

function updateTarget() {
  const origin = player.eyePosition;
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
  const hit = raycastVoxel(origin, dir, REACH);
  const mobHit = mobs.raycast(origin, dir, REACH);
  if (mobHit && (!hit || mobHit.dist < hit.dist)) {
    currentMob = mobHit.mob;
    currentTarget = null;
    outline.visible = false;
    return;
  }
  currentMob = null;
  currentTarget = hit;
  if (hit) {
    outline.visible = true;
    outline.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  } else {
    outline.visible = false;
  }
}

function targetKey(t) {
  return `${t.x},${t.y},${t.z}`;
}

function resetMining() {
  miningKey = null;
  miningProgress = 0;
  miningSound = 0;
  ui.setMiningProgress(0);
  setCrack(0);
}

function breakBlock(t) {
  if (isUnbreakable(t.block)) return;
  const drop = rollBlockDrop(t.block);
  const harvest = canHarvest(t.block, heldItem());
  world.setBlock(t.x, t.y, t.z, AIR);
  if (mpActive) net.sendEdit(t.x, t.y, t.z, AIR, currentDim);
  hand.triggerSwing();
  sfx.play("break", t.block);
  spawnParticles(t.x, t.y, t.z, t.block, 10, 2.4);
  if (mode === "survival" && drop && harvest) giveItem(drop.id, drop.count);
  if (t.block === OBSIDIAN) ignitePortalNear(t.x, t.y, t.z);
}

function giveItem(id, count = 1) {
  if (!id || count <= 0) return 0;
  const leftover = inventory.add(id, count);
  const given = count - leftover;
  if (given > 0) {
    sfx.pickup();
    ui.refreshHotbar();
    ui.updateRecipeAvailability();
  }
  if (leftover > 0) ui.toast("Inventario lleno", 1600);
  return leftover;
}

function consumeHeld(count = 1) {
  if (mode === "creative") return;
  const stack = inventory.get(selectedSlot);
  if (!stack) return;
  stack.count -= count;
  if (stack.count <= 0) inventory.set(selectedSlot, null);
  hand.setHeld(heldItem());
  selfAvatar.setHeld(heldItem());
  ui.refreshHotbar();
  ui.updateRecipeAvailability();
}

function craftItem(recipe) {
  if (!recipe || mode !== "survival") return false;
  if (!recipeAvailable(recipe, inventory)) {
    ui.toast("Faltan materiales", 1600);
    return false;
  }
  if (!inventory.canAdd(recipe.outId, recipe.outCount)) {
    ui.toast("Inventario lleno", 1600);
    return false;
  }
  consumeIngredients(recipe, inventory);
  inventory.add(recipe.outId, recipe.outCount);
  sfx.craft();
  ui.refreshHotbar();
  ui.updateRecipeAvailability();
  ui.toast(`Fabricado: ${itemName(recipe.outId)}`, 1500);
  return true;
}

function eatFood() {
  const stack = inventory.get(selectedSlot);
  if (!stack || !isFood(stack.id)) return false;
  if (mode === "creative") return true;
  if (player.hunger >= player.maxHunger) {
    ui.toast("No tienes hambre", 1400);
    return true;
  }
  if (eatCooldown > 0) return true;
  eatCooldown = 1;
  player.eat(foodValue(stack.id));
  consumeHeld(1);
  sfx.eat();
  ui.setHunger(player.hunger, mode === "survival" && started);
  return true;
}

function ignitePortalNear(x, y, z) {
  const changed = tryIgnitePortal(world, x, y, z);
  if (!changed || changed.length === 0) return;
  hand.triggerSwing();
  sfx.play("place", NETHER_PORTAL);
  for (const [bx, by, bz, id] of changed) {
    if (mpActive) net.sendEdit(bx, by, bz, id, currentDim);
  }
  ui.toast("¡Portal encendido!", 2000);
}

function updateMining(dt) {
  if (breakCooldown > 0) breakCooldown -= dt;
  if (attackCooldown > 0) attackCooldown -= dt;
  if (!canInteract()) {
    resetMining();
    return;
  }
  if (currentMob && input.isMiningHeld()) {
    if (attackCooldown <= 0) {
      attackCooldown = 0.5;
      attackMob(currentMob);
    }
    resetMining();
    return;
  }
  if (!currentTarget || !input.isMiningHeld()) {
    resetMining();
    return;
  }
  const target = currentTarget;
  if (isUnbreakable(target.block)) {
    resetMining();
    return;
  }
  if (mode === "creative") {
    if (breakCooldown <= 0) {
      breakBlock(target);
      breakCooldown = 0.2;
    }
    return;
  }
  const key = targetKey(target);
  if (key !== miningKey) {
    miningKey = key;
    miningProgress = 0;
  }
  miningProgress += dt / breakTimeWithTool(target.block, heldItem());
  miningSound -= dt;
  if (miningSound <= 0) {
    sfx.step(target.block);
    hand.triggerSwing();
    spawnParticles(target.x, target.y, target.z, target.block, 2, 1.1);
    miningSound = 0.22;
  }
  const clamped = Math.min(miningProgress, 1);
  ui.setMiningProgress(clamped);
  setCrack(clamped, target);
  if (miningProgress >= 1) {
    breakBlock(target);
    resetMining();
  }
}

function updatePlace(dt) {
  if (placeCooldown > 0) placeCooldown -= dt;
  if (eatCooldown > 0) eatCooldown -= dt;
  if (!canInteract()) return;
  if (input.isMouseDown(2) && placeCooldown <= 0) tryPlace();
}

function tryPlace() {
  if (!canInteract()) return;
  const held = heldItem();
  if (isArmor(held)) {
    toggleArmorSlot(armorSlotOf(held));
    return;
  }
  if (isFood(held)) {
    eatFood();
    return;
  }
  if (!currentTarget || !placeable(held)) return;
  if (placeCooldown > 0) return;
  const id = held;
  const x = currentTarget.x + currentTarget.nx;
  const y = currentTarget.y + currentTarget.ny;
  const z = currentTarget.z + currentTarget.nz;
  if (y < 1 || y >= WORLD_HEIGHT) return;
  const existing = world.getBlock(x, y, z);
  if (existing !== AIR && !isLiquid(existing)) return;
  if (player.intersectsBlock(x, y, z) && isSolid(id)) {
    ui.toast("No hay espacio para colocar ahí");
    placeCooldown = 0.3;
    return;
  }
  world.setBlock(x, y, z, id);
  if (mpActive) net.sendEdit(x, y, z, id, currentDim);
  hand.triggerSwing();
  sfx.play("place", id);
  spawnParticles(x, y, z, id, 5, 1.4);
  placeCooldown = 0.22;
  consumeHeld(1);
  if (id === OBSIDIAN) ignitePortalNear(x, y, z);
}

function pickBlock() {
  if (!canInteract() || !currentTarget) return;
  const block = currentTarget.block;
  if (block === AIR || block === WATER) return;
  if (mode === "creative") {
    assignToSlot(block);
    return;
  }
  for (let i = 0; i < 9; i++) {
    const stack = inventory.get(i);
    if (stack && stack.id === block) {
      selectSlot(i);
      return;
    }
  }
  ui.toast(`${itemName(block)} no está en la barra`, 1600);
}

function heldItem() {
  return inventory.get(selectedSlot)?.id || 0;
}

function selectSlot(i) {
  selectedSlot = i;
  ui.select(i);
  hand.setHeld(heldItem());
  refreshSelfAvatar();
  sfx.click();
}

function assignToSlot(id) {
  if (!id) return;
  inventory.set(selectedSlot, { id, count: 1 });
  ui.refreshHotbar();
  hand.setHeld(heldItem());
  refreshSelfAvatar();
  sfx.click();
  ui.toast(`${itemName(id)} en la barra`, 1500);
}

function refreshEquipment() {
  if (!player) return;
  player.armorReduction = armorReduction(armorPoints(equipment));
  ui.setArmor(equipment);
  selfAvatar.setArmor(equipment);
}

function refreshSelfAvatar() {
  selfAvatar.setHeld(heldItem());
  selfAvatar.setArmor(equipment);
}

function equipArmorItem(id, sourceSlot = -1) {
  const slot = armorSlotOf(id);
  if (slot < 0 || !player) return false;
  const prev = equipment[slot];
  equipment[slot] = id;
  if (sourceSlot >= 0 && sourceSlot < 9) {
    inventory.set(sourceSlot, prev ? { id: prev, count: 1 } : null);
  } else if (prev) {
    inventory.add(prev, 1);
  }
  refreshEquipment();
  ui.refreshHotbar();
  hand.setHeld(heldItem());
  refreshSelfAvatar();
  sfx.equip();
  return true;
}

function equipArmor(id) {
  return equipArmorItem(id, -1);
}

function toggleArmorSlot(slot) {
  if (!started || !player) return;
  const held = heldItem();
  if (isArmor(held) && armorSlotOf(held) === slot) {
    const name = itemName(held);
    equipArmorItem(held, selectedSlot);
    ui.toast(`${name} equipado`, 1600);
    return;
  }
  const current = equipment[slot];
  if (current) {
    if (mode === "creative") {
      inventory.set(selectedSlot, { id: current, count: 1 });
    } else if (inventory.add(current, 1) > 0) {
      ui.toast("Inventario lleno", 1600);
      return;
    }
    equipment[slot] = 0;
    refreshEquipment();
    ui.refreshHotbar();
    hand.setHeld(heldItem());
    refreshSelfAvatar();
    sfx.equip();
    ui.toast(`${itemName(current)} guardado`, 1600);
    return;
  }
  ui.toast(isArmor(held) ? "Esa pieza no va en este hueco" : "Selecciona una pieza de armadura", 1800);
}

function requestLock() {
  const result = renderer.domElement.requestPointerLock();
  if (result && result.catch) result.catch(() => {});
}

function openInventory() {
  if (!started || inventoryOpen) return;
  inventoryOpen = true;
  ui.showInventory();
  sfx.click();
  if (!input.touch) document.exitPointerLock();
}

function closeInventory() {
  if (!inventoryOpen) return;
  inventoryOpen = false;
  ui.hideInventory();
  if (!input.touch && started) requestLock();
}

function toggleInventory() {
  if (inventoryOpen) closeInventory();
  else openInventory();
}

function toggleCamera() {
  if (!started) return;
  cameraMode = cameraMode === 0 ? 1 : 0;
  selfAvatar.group.visible = cameraMode === 1;
  ui.toast(cameraMode === 1 ? "Tercera persona" : "Primera persona", 1400);
}

function attackMob(mob) {
  const dir = new THREE.Vector3(mob.pos.x - player.pos.x, 0, mob.pos.z - player.pos.z);
  if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
  dir.normalize();
  hand.triggerSwing();
  selfAvatar.triggerSwing();
  if (mpActive) net.sendSwing();
  sfx.whoosh();
  const killed = mobs.damage(mob, attackPower(heldItem()), dir);
  if (!killed) {
    spawnParticles(
      mob.pos.x - 0.5,
      mob.pos.y + mob.def.hitbox.cy - 0.5,
      mob.pos.z - 0.5,
      0,
      5,
      1.8,
      [0.62, 0.12, 0.12]
    );
  } else {
    ui.toast(`${mob.def.name} derrotado`, 1600);
  }
}

function doSave(notify) {
  if (!world) return;
  if (mpActive) {
    if (notify) ui.toast("Guardado local desactivado en multijugador");
    return;
  }
  const ok = saveGame({
    seed: dimensionSeeds.overworld,
    seeds: { ...dimensionSeeds },
    dims: {
      overworld: dimensions.overworld?.serializeEdits() ?? [],
      nether: dimensions.nether?.serializeEdits() ?? [],
      end: dimensions.end?.serializeEdits() ?? [],
    },
    time: timeOfDay,
    selected: selectedSlot,
    mode,
    health: player.health,
    hunger: player.hunger,
    inventory: inventory.serialize(),
    armor: [...equipment],
    player: {
      x: player.pos.x,
      y: player.pos.y,
      z: player.pos.z,
      yaw: player.yaw,
      pitch: player.pitch,
      dim: currentDim,
    },
  });
  if (notify) ui.toast(ok ? "Partida guardada" : "No se pudo guardar");
}

function doLoad() {
  const saved = loadGame();
  if (!saved) {
    ui.toast("No hay partida guardada");
    return;
  }
  for (const w of Object.values(dimensions)) {
    for (const chunk of w.chunks.values()) disposeChunkMeshes(chunk, scene);
    w.chunks.clear();
  }
  const baseSeed = saved.seed;
  dimensionSeeds.overworld = saved.seeds?.overworld ?? baseSeed;
  dimensionSeeds.nether = saved.seeds?.nether ?? deriveSeed(baseSeed, 1);
  dimensionSeeds.end = saved.seeds?.end ?? deriveSeed(baseSeed, 2);
  dimensionEdits.overworld = saved.dims?.overworld ?? saved.edits ?? [];
  dimensionEdits.nether = saved.dims?.nether ?? [];
  dimensionEdits.end = saved.dims?.end ?? [];
  for (const dim of Object.keys(dimensions)) delete dimensions[dim];
  currentDim = saved.player?.dim ?? "overworld";
  world = getWorld(currentDim);
  ui.setSeed(world.seed);
  sky.setDimension(currentDim);
  timeOfDay = saved.time ?? 0.32;
  selectedSlot = saved.selected ?? 0;
  mode = saved.mode ?? "creative";
  player.health = saved.health ?? player.maxHealth;
  player.hunger = saved.hunger ?? player.maxHunger;
  player.air = player.maxAir;
  player.dead = false;
  player.world = world;
  applySavedItems(saved);
  refreshEquipment();
  selectSlot(selectedSlot);
  setMode(mode, true);
  ui.setHunger(player.hunger, mode === "survival");
  if (saved.player) {
    player.pos.set(saved.player.x, saved.player.y, saved.player.z);
    player.yaw = saved.player.yaw ?? 0;
    player.pitch = saved.player.pitch ?? 0;
    player.vel.set(0, 0, 0);
    preloadAround(Math.floor(player.pos.x), Math.floor(player.pos.z));
  } else {
    preloadSpawn();
  }
  remotePlayers.clear();
  ui.toast("Partida cargada");
}

function disposeAllChunks() {
  for (const chunk of world.chunks.values()) disposeChunkMeshes(chunk, scene);
  world.chunks.clear();
}

function doNewWorld() {
  const seed = Math.floor(Math.random() * 1e9);
  dimensionSeeds.overworld = seed;
  dimensionSeeds.nether = deriveSeed(seed, 1);
  dimensionSeeds.end = deriveSeed(seed, 2);
  dimensionEdits.overworld = [];
  dimensionEdits.nether = [];
  dimensionEdits.end = [];
  for (const w of Object.values(dimensions)) {
    for (const chunk of w.chunks.values()) disposeChunkMeshes(chunk, scene);
    w.chunks.clear();
  }
  for (const dim of Object.keys(dimensions)) delete dimensions[dim];
  currentDim = "overworld";
  world = getWorld("overworld");
  player.world = world;
  ui.setSeed(seed);
  sky.setDimension(currentDim);
  timeOfDay = 0.32;
  player.flying = false;
  player.vel.set(0, 0, 0);
  player.health = player.maxHealth;
  player.hunger = player.maxHunger;
  player.air = player.maxAir;
  player.dead = false;
  inventory.clear();
  if (mode === "creative") seedCreativeInventory();
  ui.refreshHotbar();
  ui.updateRecipeAvailability();
  ui.setHunger(player.hunger, mode === "survival");
  preloadSpawn();
  ui.showMenu("pause");
  ui.toast("Mundo nuevo generado");
}

function updatePhysics(dt) {
  if (!started) return;
  const chunkReady = world.isChunkReadyAt(player.pos.x, player.pos.z);
  if (!chunkReady) return;
  const wasOnGround = player.onGround;
  const fallSpeed = player.vel.y;
  player.update(dt, input);
  if (player.onGround && !wasOnGround) player.vel.y = 0;
  if (wasOnGround && !player.onGround && player.vel.y > 2 && !player.inWater) sfx.jump();
  if (!wasOnGround && player.onGround && fallSpeed < -8) sfx.land(Math.min(1, -fallSpeed / 18));
  if (player.onGround) {
    stepOdometer += Math.abs(player.vel.x) * dt + Math.abs(player.vel.z) * dt;
    if (stepOdometer > 2.1) {
      stepOdometer = 0;
      const below = world.getBlock(
        Math.floor(player.pos.x),
        Math.floor(player.pos.y - 0.2),
        Math.floor(player.pos.z)
      );
      sfx.step(below === AIR ? 3 : below);
    }
  } else {
    stepOdometer = 1.2;
  }
  if (player.inWater && Math.random() < 0.04) sfx.play("splash", WATER);
  const px = Math.floor(player.pos.x);
  const pz = Math.floor(player.pos.z);
  const hot = isLava(world.getBlock(px, Math.floor(player.pos.y + 0.2), pz)) || isLava(world.getBlock(px, Math.floor(player.pos.y + 1.1), pz));
  if (hot) {
    player.vel.x *= 0.55;
    player.vel.z *= 0.55;
    player.vel.y *= 0.8;
    lavaTimer += dt;
    if (mode === "survival" && lavaTimer >= 0.5) {
      lavaTimer = 0;
      player.damage(3);
    }
  } else {
    lavaTimer = 0;
  }
  if (player.pos.y < -14) {
    if (mode === "survival" && currentDim !== "end") player.damage(4);
    player.respawn(respawnPoint());
    ui.toast("Has caído al vacío");
  }
}

function updatePortals(dt) {
  if (!started || !world || !player || travelled) return;
  if (portalCooldown > 0) portalCooldown -= dt;
  const px = Math.floor(player.pos.x);
  const pz = Math.floor(player.pos.z);
  const feet = world.getBlock(px, Math.floor(player.pos.y + 0.3), pz);
  const eye = world.getBlock(px, Math.floor(player.pos.y + 1.4), pz);
  const portalId = isPortal(feet) ? feet : isPortal(eye) ? eye : AIR;
  if (portalId === AIR) {
    portalTimer = 0;
    return;
  }
  portalTimer += dt;
  if (portalTimer >= 1.1 && portalCooldown <= 0) {
    portalTimer = 0;
    travel(portalId);
  }
}

function travel(portalId) {
  travelled = true;
  setTimeout(() => {
    travelled = false;
  }, 700);
  const spawn = dimensions.overworld ? dimensions.overworld.findSpawn() : { x: 8, z: 8 };
  if (portalId === END_PORTAL) {
    if (currentDim === "end") switchDimension("overworld", spawn.x, spawn.z);
    else switchDimension("end", 8, 8);
  } else if (currentDim === "overworld") {
    switchDimension("nether", Math.floor(player.pos.x / 8), Math.floor(player.pos.z / 8));
  } else if (currentDim === "nether") {
    switchDimension("overworld", Math.floor(player.pos.x * 8), Math.floor(player.pos.z * 8));
  } else {
    switchDimension("overworld", spawn.x, spawn.z);
  }
}

function switchDimension(dim, tx, tz) {
  const dest = getWorld(dim);
  disposeAllChunks();
  currentDim = dim;
  world = dest;
  player.world = dest;
  sky.setDimension(dim);
  let spot;
  if (dim === "end") {
    dest.ensureChunk(0, 0);
    const top = dest.findFloor(6, 8, 50);
    spot = { x: 6.5, y: top + 1.2, z: 8.5 };
  } else {
    const ensured = ensurePortal(dest, tx, tz, dim);
    for (const [bx, by, bz, id] of ensured.placed) {
      if (mpActive) net.sendEdit(bx, by, bz, id, dim);
    }
    spot = { x: ensured.pos.x, y: ensured.pos.y + 0.1, z: ensured.pos.z };
  }
  preloadAround(Math.floor(spot.x), Math.floor(spot.z));
  player.pos.set(spot.x, spot.y, spot.z);
  player.vel.set(0, 0, 0);
  player.fallStart = null;
  player.onGround = false;
  portalCooldown = 5;
  portalTimer = 0;
  remotePlayers.clear();
  if (mpActive) net.sendDim(dim, player.pos.x, player.pos.y, player.pos.z);
  ui.toast(`Has viajado a ${DIMENSION_NAMES[dim]}`, 2600);
}

function updateCamera(dt) {
  const eye = player.eyePosition;
  if (cameraMode === 1 && started) {
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, "YXZ"));
    let dist = 3.7;
    const back = forward.clone().negate();
    const wall = raycastVoxel(eye, back, dist + 0.5);
    if (wall && wall.dist < dist) dist = Math.max(0.7, wall.dist - 0.35);
    const target = eye.clone().addScaledVector(forward, -dist).add(new THREE.Vector3(0, 0.3, 0));
    camera.position.lerp(target, Math.min(1, dt * 14));
    camera.rotation.set(player.pitch, player.yaw, 0);
  } else {
    camera.position.copy(eye);
    let bob = 0;
    if (started && player.onGround && !player.flying) {
      const speed = Math.hypot(player.vel.x, player.vel.z);
      if (speed > 0.6) bob = Math.sin(player.walkedDistance * 2.6) * 0.045 * Math.min(1, speed / 6);
    }
    camera.position.y += bob;
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
  }
  const sprinting = input.isDown("ShiftLeft") || input.isDown("ShiftRight");
  const targetFov = started && sprinting && !player.flying ? 80 : 70;
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8);
    camera.updateProjectionMatrix();
  }
}

function handleMouseLook() {
  if (!started) return;
  if (!input.locked && !input.touch) return;
  const { dx, dy } = input.consumeMouse();
  const sensitivity = input.touch ? 0.0042 : 0.0022;
  player.yaw -= dx * sensitivity;
  player.pitch -= dy * sensitivity;
  const limit = Math.PI / 2 - 0.01;
  player.pitch = Math.max(-limit, Math.min(limit, player.pitch));
}

function updateHud(dt) {
  frameCount++;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    fps = Math.round(frameCount / fpsTimer);
    frameCount = 0;
    fpsTimer = 0;
  }
  const hour = (timeOfDay % 1) * 24;
  const hh = String(Math.floor(hour)).padStart(2, "0");
  const mm = String(Math.floor((hour % 1) * 60)).padStart(2, "0");
  const targetName = currentMob
    ? currentMob.def.name
    : currentTarget
      ? BLOCKS[currentTarget.block]?.name || "?"
      : "—";
  const modeName = mode === "survival" ? "Supervivencia" : "Creativo";
  const state = player.flying ? "Vuelo" : player.inWater ? "Nadando" : "A pie";
  const healthLine = mode === "survival" ? ` · Vida ${player.health}/${player.maxHealth}` : "";
  const points = armorPoints(equipment);
  const armorLine = points > 0 ? ` · Armadura ${points}` : "";
  const mpLine = mpActive ? ` · MP ${remotePlayers.count + 1}` : "";
  const mobLine = mobs.count > 0 ? ` · Criaturas ${mobs.count}` : "";
  const biomeName =
    currentDim === "overworld"
      ? BIOME_NAMES[world.biomeAt(Math.floor(player.pos.x), Math.floor(player.pos.z))]
      : DIMENSION_NAMES[world.dimension];
  const dimLine = currentDim === "overworld" ? `${DIMENSION_NAMES[currentDim]} · ${biomeName}` : `${biomeName}`;
  ui.setDebug(
    `Vexio Craft · ${fps} fps${mpLine}${mobLine}\n` +
      `XYZ ${player.pos.x.toFixed(1)} ${player.pos.y.toFixed(1)} ${player.pos.z.toFixed(1)}\n` +
      `Chunks ${world.chunks.size} · Hora ${hh}:${mm} · ${modeName}\n` +
      `Mundo: ${dimLine}\n` +
      `Mano: ${itemName(heldItem())} · Apunta: ${targetName} · ${state}${healthLine}${armorLine}`
  );
  ui.setHealth(player.health, mode === "survival" && started);
  ui.setHunger(player.hunger, mode === "survival" && started);
  ui.setAir(player.air, started && (underwater || player.air < player.maxAir));
}

function updateUnderwater() {
  const eye = camera.position;
  const block = world.getBlock(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z));
  const inWater = isWater(block);
  const inLava = isLava(block);
  const submerged = inWater || inLava;
  if (submerged !== underwater || (submerged && inLava !== underwaterLava)) {
    underwater = submerged;
    underwaterLava = submerged && inLava;
    underwaterEl.classList.toggle("hidden", !submerged);
    underwaterEl.classList.toggle("lava", underwaterLava);
  }
  if (inWater) {
    scene.fog.color.setHex(0x1b5e94);
    scene.fog.near = 0.6;
    scene.fog.far = 26;
  } else if (inLava) {
    scene.fog.color.setHex(0x5a1a06);
    scene.fog.near = 0.4;
    scene.fog.far = 9;
  } else if (currentDim === "nether") {
    scene.fog.near = 7;
    scene.fog.far = 46;
  } else if (currentDim === "end") {
    scene.fog.near = 40;
    scene.fog.far = 190;
  } else {
    scene.fog.near = FOG_NEAR;
    scene.fog.far = FOG_FAR;
  }
}

const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);

  if (!world || !player) {
    renderer.render(scene, camera);
    return;
  }

  handleMouseLook();
  updatePhysics(dt);
  updatePortals(dt);
  updateCamera(dt);
  updateTarget();
  updateMining(dt);
  updatePlace(dt);
  elapsed += dt;
  if (waterShader) waterShader.uniforms.uTime.value = elapsed;
  timeOfDay = (timeOfDay + dt / DAY_LENGTH) % 1;
  sky.update(dt, player.pos, timeOfDay);
  scene.fog.color.copy(sky.fogColor);
  updateUnderwater();
  streamChunks();
  updateParticles(dt);
  updateHud(dt);
  remotePlayers.update(dt);

  if (mobs.world !== world) mobs.setWorld(world);
  if (started && !inventoryOpen) {
    const night = timeOfDay >= 0.75 || timeOfDay < 0.23;
    mobs.update(dt, player, { night, enabled: true, cap: mpActive ? 8 : 14 });
  }

  const horizSpeed = Math.hypot(player.vel.x, player.vel.z);
  selfAvatar.group.position.set(player.pos.x, player.pos.y, player.pos.z);
  selfAvatar.group.rotation.y = player.yaw;
  selfAvatar.update(dt, {
    speed: horizSpeed,
    moving: started && !player.flying && horizSpeed > 0.8,
    pitch: player.pitch,
    inWater: player.inWater,
  });
  selfAvatar.setHeld(heldItem());

  if (mpActive && started) {
    stateTimer += dt;
    if (stateTimer >= 0.08) {
      stateTimer = 0;
      net.sendState(
        player.pos.x,
        player.pos.y,
        player.pos.z,
        player.yaw,
        player.pitch,
        currentDim,
        heldItem(),
        equipment
      );
    }
  }

  if (started && !mpActive) {
    saveTimer += dt;
    if (saveTimer >= AUTOSAVE_INTERVAL) {
      saveTimer = 0;
      doSave(false);
    }
  }

  const moving = started && !player.flying && Math.hypot(player.vel.x, player.vel.z) > 0.8;
  hand.update(dt, moving, sky.brightness);
  renderer.render(scene, camera);
  if (started && cameraMode === 0) hand.render(renderer);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  hand.resize(window.innerWidth / window.innerHeight);
});

window.addEventListener("pointerdown", () => sfx.resume(), { once: true });

ui.showHud();
ui.setPlayerName(playerName);
ui.showMenu("start", { ready: false });
ui.setStatus("Conectando al servidor…", false);
net.connect(playerName);
setTimeout(() => {
  if (mpDecided) return;
  mpDecided = true;
  net.stop();
  ui.setMultiplayer(false);
  startSingleplayer();
}, MP_TIMEOUT);
frame();

if (new URLSearchParams(location.search).has("autostart")) {
  const autostartTimer = setInterval(() => {
    if (!ready || started) return;
    clearInterval(autostartTimer);
    started = true;
    ui.hideMenu();
    input.setTouchUiVisible(true);
    sfx.resume();
  }, 250);
}

if (typeof window !== "undefined") {
  window.__vexioCraft = {
    get ready() {
      return ready;
    },
    get started() {
      return started;
    },
    get chunks() {
      return world.chunks.size;
    },
    get fps() {
      return fps;
    },
    get mode() {
      return mode;
    },
    get health() {
      return player.health;
    },
    get touch() {
      return IS_TOUCH;
    },
    get mp() {
      return mpActive;
    },
    get players() {
      return remotePlayers.count;
    },
    get playerName() {
      return playerName;
    },
    get dimension() {
      return currentDim;
    },
    get biome() {
      return player ? world.biomeAt(Math.floor(player.pos.x), Math.floor(player.pos.z)) : null;
    },
    findBiome(name, radius = 3000, step = 64) {
      for (let r = 0; r <= radius; r += step) {
        for (let a = 0; a < 10; a++) {
          const angle = (a / 10) * Math.PI * 2;
          const x = Math.round(Math.cos(angle) * r);
          const z = Math.round(Math.sin(angle) * r);
          if (world.biomeAt(x, z) === name) return { x, z };
        }
      }
      return null;
    },
    findStructure(id) {
      return world.findStructure(id);
    },
    teleportSurface(x, z) {
      preloadAround(x, z);
      const y = world.findFloor(x, z, WORLD_HEIGHT - 2);
      player.pos.set(x + 0.5, y + 1.3, z + 0.5);
      player.vel.set(0, 0, 0);
      return [player.pos.x, player.pos.y, player.pos.z];
    },
    teleportY(x, y, z) {
      preloadAround(x, z);
      player.pos.set(x + 0.5, y, z + 0.5);
      player.vel.set(0, 0, 0);
      return [player.pos.x, player.pos.y, player.pos.z];
    },
    setDimension(dim, x, z) {
      switchDimension(dim, x ?? Math.floor(player.pos.x), z ?? Math.floor(player.pos.z));
      return currentDim;
    },
    look(yaw, pitch) {
      player.yaw = yaw;
      player.pitch = pitch;
    },
    blockAt(x, y, z) {
      return world.getBlock(x, y, z);
    },

    setFlying(value) {
      player.flying = !!value;
      player.vel.y = 0;
    },
    setMode(next) {
      setMode(next);
    },
    setTime(value) {
      timeOfDay = ((value % 1) + 1) % 1;
    },
    start() {
      started = true;
      input.setTouchUiVisible(true);
    },
    get playerPos() {
      return player.pos.toArray();
    },
    get pitch() {
      return player.pitch;
    },
    get target() {
      return currentTarget ? { ...currentTarget, name: BLOCKS[currentTarget.block]?.name } : null;
    },
    get edits() {
      return world.edits.size;
    },
    get miningHeld() {
      return input.isMiningHeld();
    },
    get miningProgress() {
      return miningProgress;
    },
    get time() {
      return timeOfDay;
    },
    get mobs() {
      return mobs.count;
    },
    get mobList() {
      return mobs.list.map((mob) => ({
        id: mob.id,
        type: mob.type,
        hp: mob.hp,
        x: mob.pos.x,
        y: mob.pos.y,
        z: mob.pos.z,
      }));
    },
    get held() {
      return heldItem();
    },
    get armor() {
      return [...equipment];
    },
    get armorReduction() {
      return player.armorReduction;
    },
    get cameraMode() {
      return cameraMode;
    },
    get inventoryOpen() {
      return inventoryOpen;
    },
    setHeldItem(id) {
      if (mode === "creative") assignToSlot(id);
      else {
        inventory.set(selectedSlot, { id, count: 1 });
        ui.refreshHotbar();
        hand.setHeld(heldItem());
        selfAvatar.setHeld(heldItem());
      }
      return heldItem();
    },
    give(id, count = 1) {
      const leftover = inventory.add(id, count);
      ui.refreshHotbar();
      ui.updateRecipeAvailability();
      return count - leftover;
    },
    get inventory() {
      return inventory.serialize();
    },
    get hunger() {
      return player.hunger;
    },
    get air() {
      return player.air;
    },
    get recipes() {
      return RECIPES.map((recipe, index) => ({ index, out: recipe.outId, group: recipe.group }));
    },
    craftAt(index) {
      return craftItem(RECIPES[index]);
    },
    eat() {
      return eatFood();
    },
    selectHotbar(index) {
      selectSlot(index);
      return heldItem();
    },
    clearInventory() {
      inventory.clear();
      ui.refreshHotbar();
      ui.updateRecipeAvailability();
      hand.setHeld(0);
      selfAvatar.setHeld(0);
      return true;
    },
    breakBlockAt(x, y, z) {
      const block = world.getBlock(x, y, z);
      if (block === AIR) return null;
      const before = inventory.serialize();
      breakBlock({ x, y, z, block, nx: 0, ny: 1, nz: 0 });
      const after = inventory.serialize();
      return { block, before, after };
    },
    placeBlockAt(x, y, z, id) {
      world.setBlock(x, y, z, id);
      if (mpActive) net.sendEdit(x, y, z, id, currentDim);
      return world.getBlock(x, y, z);
    },
    killMobs() {
      const killed = [];
      for (const mob of [...mobs.list]) {
        killed.push(mob.type);
        mobs.damage(mob, 999, new THREE.Vector3(0, 0, 0));
      }
      return killed;
    },
    setHunger(value) {
      player.hunger = Math.max(0, Math.min(player.maxHunger, value));
      ui.setHunger(player.hunger, mode === "survival" && started);
      return player.hunger;
    },
    setAir(value) {
      player.air = Math.max(0, Math.min(player.maxAir, value));
      return player.air;
    },
    save() {
      doSave(true);
      return true;
    },
    load() {
      doLoad();
      return true;
    },
    equip(id) {
      if (!isArmor(id)) return false;
      return equipArmor(id);
    },
    setCamera(mode) {
      cameraMode = mode === 1 ? 1 : 0;
      selfAvatar.group.visible = cameraMode === 1;
      return cameraMode;
    },
    toggleInventory() {
      toggleInventory();
      return inventoryOpen;
    },
    spawnMob(type = "pig", dist = 4) {
      const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
      const x = Math.floor(player.pos.x + forward.x * dist);
      const z = Math.floor(player.pos.z + forward.z * dist);
      preloadAround(x, z);
      let y = Math.min(60, Math.floor(player.pos.y) + 6);
      while (y > 2 && !isSolid(world.getBlock(x, y, z))) y--;
      const mob = mobs.spawn(type, x + 0.5, z + 0.5, y + 1.02);
      return mob.id;
    },
    attack() {
      const origin = player.eyePosition;
      const dir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
      const hit = mobs.raycast(origin, dir, REACH);
      if (!hit) return false;
      attackMob(hit.mob);
      return true;
    },
    forceSpawns(n = 1, night = true) {
      let added = 0;
      for (let i = 0; i < n; i++) {
        const before = mobs.count;
        mobs.spawnTimer = 0;
        mobs.spawnTick(1, player, night, 99);
        if (mobs.count > before) added++;
      }
      return { added, count: mobs.count };
    },
    get pose() {
      const parts = selfAvatar.parts;
      return {
        legL: Number(parts.legL.rotation.x.toFixed(3)),
        legR: Number(parts.legR.rotation.x.toFixed(3)),
        armL: Number(parts.armL.rotation.x.toFixed(3)),
        armR: Number(parts.armR.rotation.x.toFixed(3)),
        head: Number(parts.head.rotation.x.toFixed(3)),
        swing: Number(selfAvatar.swingTime.toFixed(3)),
      };
    },
    moveAnalog(x = 0, y = 0) {
      input.analogX = x;
      input.analogY = y;
      return true;
    },
  };
}
