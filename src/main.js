import * as THREE from "three";
import {
  CHUNK_SIZE,
  WORLD_HEIGHT,
  SEA_LEVEL,
  RENDER_DISTANCE,
  REACH,
  DAY_LENGTH,
  AUTOSAVE_INTERVAL,
} from "./config.js";
import {
  AIR,
  WATER,
  HOTBAR,
  BLOCKS,
  isLiquid,
  isUnbreakable,
  isSolid,
} from "./blocks.js";
import { createAtlas } from "./textures.js";
import { World } from "./world.js";
import { buildChunkGeometry, disposeChunkMeshes } from "./mesher.js";
import { Player } from "./player.js";
import { Input } from "./input.js";
import { UI } from "./ui.js";
import { Sfx } from "./audio.js";
import { Sky } from "./sky.js";
import { saveGame, loadGame, hasSave } from "./storage.js";

const app = document.getElementById("app");
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xbfe0ff, RENDER_DISTANCE * CHUNK_SIZE * 0.5, RENDER_DISTANCE * CHUNK_SIZE * 0.95);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 900);
camera.rotation.order = "YXZ";

const atlas = createAtlas();
const texture = new THREE.CanvasTexture(atlas.canvas);
texture.magFilter = THREE.NearestFilter;
texture.minFilter = THREE.NearestFilter;
texture.generateMipmaps = false;
texture.colorSpace = THREE.SRGBColorSpace;

const materialOpaque = new THREE.MeshLambertMaterial({ map: texture, vertexColors: true });
const materialAlpha = new THREE.MeshLambertMaterial({
  map: texture,
  vertexColors: true,
  alphaTest: 0.5,
  side: THREE.DoubleSide,
});
const materialWater = new THREE.MeshLambertMaterial({
  map: texture,
  vertexColors: true,
  transparent: true,
  opacity: 0.82,
  depthWrite: false,
  side: THREE.DoubleSide,
});

const outline = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 })
);
outline.visible = false;
scene.add(outline);

const sky = new Sky(scene);

let world;
let player;
let timeOfDay = 0.32;
let selectedSlot = 0;
let started = false;
let ready = false;
let currentTarget = null;
let breakCooldown = 0;
let placeCooldown = 0;
let saveTimer = 0;
let fps = 0;
let frameCount = 0;
let fpsTimer = 0;
let stepOdometer = 0;

const sfx = new Sfx();
const ui = new UI({
  atlas,
  hotbar: HOTBAR,
  onContinue: () => {
    const result = renderer.domElement.requestPointerLock();
    if (result && result.catch) result.catch(() => {});
  },
  onSave: () => doSave(true),
  onLoad: () => doLoad(),
  onNewWorld: () => doNewWorld(),
  onSelectSlot: (i) => selectSlot(i),
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
    } else if (started) {
      ui.showMenu("pause");
      doSave(false);
    }
  },
  onBreak: () => tryBreak(),
  onPlace: () => tryPlace(),
  onPick: () => pickBlock(),
  onWheel: (dir) => selectSlot((selectedSlot + dir + HOTBAR.length) % HOTBAR.length),
  onHotbar: (i) => selectSlot(i),
  onFly: () => {
    if (!started || !input.locked) return;
    player.flying = !player.flying;
    player.vel.y = 0;
    ui.toast(player.flying ? "Modo vuelo activado" : "Modo vuelo desactivado");
  },
});

function init() {
  const saved = loadGame();
  const seed = saved?.seed ?? Math.floor(Math.random() * 1e9);
  world = new World(seed);
  ui.setSeed(seed);
  if (saved?.edits) world.loadEdits(saved.edits);
  player = new Player(world);
  ui.showMenu("start", { ready: false });
  ui.showHud();
  if (saved?.player) {
    player.pos.set(saved.player.x, saved.player.y, saved.player.z);
    player.yaw = saved.player.yaw ?? 0;
    player.pitch = saved.player.pitch ?? 0;
    timeOfDay = saved.time ?? 0.32;
    selectedSlot = saved.selected ?? 0;
    ui.setStatus("", true);
  } else {
    preloadSpawn();
  }
  ui.select(selectedSlot);
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
  const spawn = world.findSpawn();
  const sx = spawn.x >> 4;
  const sz = spawn.z >> 4;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const chunk = world.ensureChunk(sx + dx, sz + dz);
      rebuildChunk(chunk);
      chunk.dirty = false;
    }
  }
  const top = world.topSolidAt(spawn.x, spawn.z);
  player.respawn({ x: spawn.x, y: top + 1.2, z: spawn.z });
  ready = true;
  ui.setStatus("", true);
}

function rebuildChunk(chunk) {
  disposeChunkMeshes(chunk, scene);
  const parts = buildChunkGeometry(world, chunk, atlas.uvs);
  const meshes = [];
  if (parts.opaque) meshes.push(new THREE.Mesh(parts.opaque, materialOpaque));
  if (parts.alpha) meshes.push(new THREE.Mesh(parts.alpha, materialAlpha));
  if (parts.water) meshes.push(new THREE.Mesh(parts.water, materialWater));
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
  let tMaxX = stepX !== 0 ? ((stepX > 0 ? x + 1 - origin.x : origin.x - x) / Math.abs(direction.x)) : Infinity;
  let tMaxY = stepY !== 0 ? ((stepY > 0 ? y + 1 - origin.y : origin.y - y) / Math.abs(direction.y)) : Infinity;
  let tMaxZ = stepZ !== 0 ? ((stepZ > 0 ? z + 1 - origin.z : origin.z - z) / Math.abs(direction.z)) : Infinity;
  let nx = 0;
  let ny = 0;
  let nz = 0;
  let t = 0;
  for (let i = 0; i < 128; i++) {
    const block = world.getBlock(x, y, z);
    if (block !== AIR && !isLiquid(block)) {
      return { x, y, z, nx, ny, nz, block };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      if (tMaxX > maxDist) break;
      x += stepX;
      t = tMaxX;
      tMaxX += tDeltaX;
      nx = -stepX;
      ny = 0;
      nz = 0;
    } else if (tMaxY < tMaxZ) {
      if (tMaxY > maxDist) break;
      y += stepY;
      t = tMaxY;
      tMaxY += tDeltaY;
      nx = 0;
      ny = -stepY;
      nz = 0;
    } else {
      if (tMaxZ > maxDist) break;
      z += stepZ;
      t = tMaxZ;
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
  currentTarget = hit;
  if (hit) {
    outline.visible = true;
    outline.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  } else {
    outline.visible = false;
  }
}

function tryBreak() {
  if (!started || !input.locked || !currentTarget) return;
  if (breakCooldown > 0) return;
  const { x, y, z, block } = currentTarget;
  if (isUnbreakable(block)) {
    ui.toast("Ese bloque no se puede romper");
    breakCooldown = 0.4;
    return;
  }
  world.setBlock(x, y, z, AIR);
  sfx.play("break", block);
  breakCooldown = 0.22;
}

function tryPlace() {
  if (!started || !input.locked || !currentTarget) return;
  if (placeCooldown > 0) return;
  const id = HOTBAR[selectedSlot];
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
  sfx.play("place", id);
  placeCooldown = 0.22;
}

function pickBlock() {
  if (!started || !input.locked || !currentTarget) return;
  const block = currentTarget.block;
  if (block === AIR || block === WATER) return;
  HOTBAR[selectedSlot] = block;
  ui.buildHotbar();
  ui.select(selectedSlot);
  ui.toast(`Bloque: ${BLOCKS[block]?.name || "?"}`);
}

function selectSlot(i) {
  selectedSlot = i;
  ui.select(i);
  sfx.click();
}

function doSave(notify) {
  if (!world) return;
  const ok = saveGame({
    seed: world.seed,
    time: timeOfDay,
    selected: selectedSlot,
    edits: world.serializeEdits(),
    player: {
      x: player.pos.x,
      y: player.pos.y,
      z: player.pos.z,
      yaw: player.yaw,
      pitch: player.pitch,
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
  disposeAllChunks();
  world.reset(saved.seed);
  world.loadEdits(saved.edits || []);
  ui.setSeed(saved.seed);
  timeOfDay = saved.time ?? 0.32;
  selectedSlot = saved.selected ?? 0;
  ui.select(selectedSlot);
  if (saved.player) {
    player.pos.set(saved.player.x, saved.player.y, saved.player.z);
    player.yaw = saved.player.yaw ?? 0;
    player.pitch = saved.player.pitch ?? 0;
    player.vel.set(0, 0, 0);
  } else {
    preloadSpawn();
  }
  ui.toast("Partida cargada");
}

function disposeAllChunks() {
  for (const chunk of world.chunks.values()) disposeChunkMeshes(chunk, scene);
  world.chunks.clear();
}

function doNewWorld() {
  disposeAllChunks();
  const seed = Math.floor(Math.random() * 1e9);
  world.reset(seed);
  ui.setSeed(seed);
  timeOfDay = 0.32;
  player.flying = false;
  player.vel.set(0, 0, 0);
  const spawn = world.findSpawn();
  const sx = spawn.x >> 4;
  const sz = spawn.z >> 4;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      world.ensureChunk(sx + dx, sz + dz);
    }
  }
  const top = world.topSolidAt(spawn.x, spawn.z);
  player.respawn({ x: spawn.x, y: top + 1.2, z: spawn.z });
  ui.showMenu("pause");
  ui.toast("Mundo nuevo generado");
}

function updatePhysics(dt) {
  if (!started) return;
  const chunkReady = world.isChunkReadyAt(player.pos.x, player.pos.z);
  if (!chunkReady) return;
  const wasOnGround = player.onGround;
  player.update(dt, input, camera);
  if (player.onGround && !wasOnGround) player.vel.y = 0;
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
}

function updateCamera() {
  const eye = player.eyePosition;
  camera.position.copy(eye);
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

function handleMouseLook() {
  if (!input.locked) return;
  const { dx, dy } = input.consumeMouse();
  player.yaw -= dx * 0.0022;
  player.pitch -= dy * 0.0022;
  const limit = Math.PI / 2 - 0.01;
  player.pitch = Math.max(-limit, Math.min(limit, player.pitch));
}

function fixedUpdate(dt) {
  if (breakCooldown > 0) breakCooldown -= dt;
  if (placeCooldown > 0) placeCooldown -= dt;
  if (input.locked && input.isMouseDown(0)) tryBreak();
  if (input.locked && input.isMouseDown(2)) tryPlace();
}

function updateHud(dt) {
  frameCount++;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    fps = Math.round(frameCount / fpsTimer);
    frameCount = 0;
    fpsTimer = 0;
  }
  const hour = ((timeOfDay + 0.25) % 1) * 24;
  const hh = String(Math.floor(hour)).padStart(2, "0");
  const mm = String(Math.floor((hour % 1) * 60)).padStart(2, "0");
  const targetName = currentTarget ? BLOCKS[currentTarget.block]?.name || "?" : "—";
  ui.setDebug(
    `Vexio Craft · ${fps} fps\n` +
      `XYZ ${player.pos.x.toFixed(1)} ${player.pos.y.toFixed(1)} ${player.pos.z.toFixed(1)}\n` +
      `Chunks ${world.chunks.size} · Hora ${hh}:${mm}\n` +
      `Bloque: ${targetName} · ${player.flying ? "Vuelo" : player.inWater ? "Nadando" : "A pie"}`
  );
}

const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);

  if (started) {
    handleMouseLook();
  }
  updatePhysics(dt);
  fixedUpdate(dt);
  timeOfDay = (timeOfDay + dt / DAY_LENGTH) % 1;
  sky.update(dt, player.pos, timeOfDay);
  scene.fog.color.copy(sky.fogColor);
  streamChunks();
  updateCamera();
  updateTarget();
  updateHud(dt);

  if (started) {
    saveTimer += dt;
    if (saveTimer >= AUTOSAVE_INTERVAL) {
      saveTimer = 0;
      doSave(false);
    }
  }

  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

init();
frame();

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
    start() {
      started = true;
    },
    get playerPos() {
      return player.pos.toArray();
    },
    get time() {
      return timeOfDay;
    },
  };
}
