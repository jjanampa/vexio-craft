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
  HOTBAR,
  BLOCKS,
  isLiquid,
  isUnbreakable,
  isSolid,
  breakTime,
  faceTile,
} from "./blocks.js";
import { createAtlas, createCrackStrip, averageTileColors } from "./textures.js";
import { World } from "./world.js";
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
hand.setBlock(HOTBAR[0]);

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

function spawnParticles(x, y, z, blockId, count, speed) {
  const tile = faceTile(blockId, 4) || faceTile(blockId, 2) || "stone";
  const rgb = tileColors[tile] || [1, 1, 1];
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
const remotePlayers = new RemotePlayers(scene);

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

let world;
let player;
let timeOfDay = 0.32;
let selectedSlot = 0;
let started = false;
let ready = false;
let mode = "creative";
let currentTarget = null;
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
const underwaterEl = document.getElementById("underwater");

const sfx = new Sfx();
const ui = new UI({
  atlas,
  hotbar: HOTBAR,
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
    } else if (started) {
      ui.showMenu("pause");
      doSave(false);
    }
  },
  onPlace: () => tryPlace(),
  onPick: () => pickBlock(),
  onWheel: (dir) => selectSlot((selectedSlot + dir + HOTBAR.length) % HOTBAR.length),
  onHotbar: (i) => selectSlot(i),
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
    for (const p of list) {
      if (p.id === net.id) continue;
      remotePlayers.upsert(p);
    }
    remotePlayers.prune(list, net.id);
    ui.setMultiplayer(true, remotePlayers.count + 1);
  },
  onEdit: (msg) => applyRemoteEdit(msg),
  onStatus: (connected, wasConnected) => {
    if (!wasConnected) return;
    ui.toast("Conexión perdida, reconectando…", 3000);
  },
});

function handleWelcome(msg) {
  mpDecided = true;
  mpActive = true;
  ui.setMultiplayer(true, msg.players.length + 1);
  if (!ready) {
    world = new World(msg.seed);
    world.loadEdits(msg.edits || []);
    ui.setSeed(msg.seed);
    player = new Player(world);
    player.onDamage = () => ui.flashDamage();
    player.onDeath = () => handleDeath();
    preloadSpawn();
    ready = true;
    setMode(mode, true);
    ui.select(selectedSlot);
    ui.setStatus(mpStatus(msg.players.length + 1), true);
  } else {
    if (msg.seed !== world.seed) {
      disposeAllChunks();
      world.reset(msg.seed);
      world.loadEdits(msg.edits || []);
      ui.setSeed(msg.seed);
      const spawn = world.findSpawn();
      world.ensureChunk(spawn.x >> 4, spawn.z >> 4);
      const top = world.topSolidAt(spawn.x, spawn.z);
      player.respawn({ x: spawn.x, y: top + 1.2, z: spawn.z });
      ui.toast("El mundo cambió, reapareces en el spawn", 3200);
    } else {
      world.loadEdits(msg.edits || []);
      world.reapplyEdits();
    }
    ui.toast("Conexión restablecida", 2600);
  }
  for (const p of msg.players) remotePlayers.upsert(p);
  remotePlayers.prune(msg.players, net.id);
}

function mpStatus(count) {
  return `En línea · ${count} ${count === 1 ? "jugador" : "jugadores"}`;
}

function applyRemoteEdit(msg) {
  if (!world) return;
  world.applyEdit(msg.x, msg.y, msg.z, msg.id);
  if (started) spawnParticles(msg.x, msg.y, msg.z, msg.id, 6, 1.8);
}

function canInteract() {
  return started && (input.locked || input.touch);
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
  if (!silent) ui.toast(mode === "survival" ? "Modo supervivencia" : "Modo creativo");
}

function startSingleplayer() {
  const saved = loadGame();
  const seed = saved?.seed ?? Math.floor(Math.random() * 1e9);
  world = new World(seed);
  ui.setSeed(seed);
  if (saved?.edits) world.loadEdits(saved.edits);
  player = new Player(world);
  player.onDamage = () => ui.flashDamage();
  player.onDeath = () => handleDeath();
  if (saved?.player) {
    player.pos.set(saved.player.x, saved.player.y, saved.player.z);
    player.yaw = saved.player.yaw ?? 0;
    player.pitch = saved.player.pitch ?? 0;
    timeOfDay = saved.time ?? 0.32;
    selectedSlot = saved.selected ?? 0;
    mode = saved.mode ?? "creative";
    player.health = saved.health ?? player.maxHealth;
    ui.setStatus("", true);
  } else {
    preloadSpawn();
  }
  setMode(mode, true);
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

function handleDeath() {
  ui.flashDamage();
  ui.toast("Has muerto, reapareces en el spawn");
  const spawn = world.findSpawn();
  world.ensureChunk(spawn.x >> 4, spawn.z >> 4);
  const top = world.topSolidAt(spawn.x, spawn.z);
  player.respawn({ x: spawn.x, y: top + 1.2, z: spawn.z });
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
  for (let i = 0; i < 128; i++) {
    const block = world.getBlock(x, y, z);
    if (block !== AIR && !isLiquid(block)) {
      return { x, y, z, nx, ny, nz, block };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      if (tMaxX > maxDist) break;
      x += stepX;
      tMaxX += tDeltaX;
      nx = -stepX;
      ny = 0;
      nz = 0;
    } else if (tMaxY < tMaxZ) {
      if (tMaxY > maxDist) break;
      y += stepY;
      tMaxY += tDeltaY;
      nx = 0;
      ny = -stepY;
      nz = 0;
    } else {
      if (tMaxZ > maxDist) break;
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
  world.setBlock(t.x, t.y, t.z, AIR);
  if (mpActive) net.sendEdit(t.x, t.y, t.z, AIR);
  hand.triggerSwing();
  sfx.play("break", t.block);
  spawnParticles(t.x, t.y, t.z, t.block, 10, 2.4);
}

function updateMining(dt) {
  if (breakCooldown > 0) breakCooldown -= dt;
  if (!canInteract() || !currentTarget || !input.isMiningHeld()) {
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
  miningProgress += dt / breakTime(target.block);
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
  if (!canInteract()) return;
  if (input.isMouseDown(2) && placeCooldown <= 0) tryPlace();
}

function tryPlace() {
  if (!canInteract() || !currentTarget) return;
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
  if (mpActive) net.sendEdit(x, y, z, id);
  hand.triggerSwing();
  sfx.play("place", id);
  spawnParticles(x, y, z, id, 5, 1.4);
  placeCooldown = 0.22;
}

function pickBlock() {
  if (!canInteract() || !currentTarget) return;
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
  hand.setBlock(HOTBAR[i]);
  sfx.click();
}

function doSave(notify) {
  if (!world) return;
  if (mpActive) {
    if (notify) ui.toast("Guardado local desactivado en multijugador");
    return;
  }
  const ok = saveGame({
    seed: world.seed,
    time: timeOfDay,
    selected: selectedSlot,
    mode,
    health: player.health,
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
  mode = saved.mode ?? "creative";
  player.health = saved.health ?? player.maxHealth;
  player.dead = false;
  ui.select(selectedSlot);
  setMode(mode, true);
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
  player.health = player.maxHealth;
  player.dead = false;
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
  player.update(dt, input);
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

function updateCamera(dt) {
  const eye = player.eyePosition;
  camera.position.copy(eye);
  let bob = 0;
  if (started && player.onGround && !player.flying) {
    const speed = Math.hypot(player.vel.x, player.vel.z);
    if (speed > 0.6) bob = Math.sin(player.walkedDistance * 2.6) * 0.045 * Math.min(1, speed / 6);
  }
  camera.position.y += bob;
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
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
  const targetName = currentTarget ? BLOCKS[currentTarget.block]?.name || "?" : "—";
  const modeName = mode === "survival" ? "Supervivencia" : "Creativo";
  const state = player.flying ? "Vuelo" : player.inWater ? "Nadando" : "A pie";
  const healthLine = mode === "survival" ? ` · Vida ${player.health}/${player.maxHealth}` : "";
  const mpLine = mpActive ? ` · MP ${remotePlayers.count + 1}` : "";
  ui.setDebug(
    `Vexio Craft · ${fps} fps${mpLine}\n` +
      `XYZ ${player.pos.x.toFixed(1)} ${player.pos.y.toFixed(1)} ${player.pos.z.toFixed(1)}\n` +
      `Chunks ${world.chunks.size} · Hora ${hh}:${mm} · ${modeName}\n` +
      `Bloque: ${targetName} · ${state}${healthLine}`
  );
  ui.setHealth(player.health, mode === "survival" && started);
}

function updateUnderwater() {
  const eye = camera.position;
  const inWater = isLiquid(world.getBlock(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z)));
  if (inWater !== underwater) {
    underwater = inWater;
    underwaterEl.classList.toggle("hidden", !inWater);
  }
  if (underwater) {
    scene.fog.color.setHex(0x1b5e94);
    scene.fog.near = 0.6;
    scene.fog.far = 26;
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

  if (mpActive && started) {
    stateTimer += dt;
    if (stateTimer >= 0.08) {
      stateTimer = 0;
      net.sendState(player.pos.x, player.pos.y, player.pos.z, player.yaw, player.pitch);
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
  if (started) hand.render(renderer);
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
  };
}
