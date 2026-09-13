import * as THREE from "three";

const PALETTE = [0x4f7fd8, 0xd85f4f, 0x58b32c, 0xd8a83f, 0x9a5fd8, 0x3fb8a8, 0xd85f9a, 0x8d99ae];
const SKIN = 0xe0ac82;
const PANTS = 0x3b4a63;
const STALE_MS = 8000;

function colorFor(id) {
  return PALETTE[Math.abs(id) % PALETTE.length];
}

function makeLabel(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 30px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const width = Math.min(240, ctx.measureText(text).width + 28);
  ctx.fillStyle = "rgba(8, 12, 20, 0.62)";
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect((256 - width) / 2, 12, width, 40, 12);
    ctx.fill();
  } else {
    ctx.fillRect((256 - width) / 2, 12, width, 40);
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, 128, 33);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.8, 0.45, 1);
  sprite.position.y = 2.35;
  return sprite;
}

function addPart(group, geometry, color, x, y, z) {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color }));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function createAvatar(name, id) {
  const group = new THREE.Group();
  const bodyColor = colorFor(id);
  const legGeometry = new THREE.BoxGeometry(0.24, 0.7, 0.24);
  addPart(group, legGeometry, PANTS, -0.16, 0.35, 0);
  addPart(group, legGeometry, PANTS, 0.16, 0.35, 0);
  addPart(group, new THREE.BoxGeometry(0.62, 0.7, 0.34), bodyColor, 0, 1.05, 0);
  const armGeometry = new THREE.BoxGeometry(0.18, 0.7, 0.18);
  addPart(group, armGeometry, bodyColor, -0.4, 1.05, 0);
  addPart(group, armGeometry, bodyColor, 0.4, 1.05, 0);
  addPart(group, new THREE.BoxGeometry(0.5, 0.5, 0.5), SKIN, 0, 1.65, 0);
  const label = makeLabel(name);
  group.add(label);
  return { group, label };
}

export class RemotePlayers {
  constructor(scene) {
    this.scene = scene;
    this.map = new Map();
  }

  get count() {
    return this.map.size;
  }

  upsert(data) {
    let entry = this.map.get(data.id);
    if (!entry) {
      const avatar = createAvatar(data.name, data.id);
      this.scene.add(avatar.group);
      entry = {
        ...avatar,
        target: new THREE.Vector3(data.x, data.y, data.z),
        targetYaw: data.yaw,
        lastSeen: performance.now(),
        name: data.name,
      };
      entry.group.position.copy(entry.target);
      this.map.set(data.id, entry);
    } else {
      entry.target.set(data.x, data.y, data.z);
      entry.targetYaw = data.yaw;
      entry.lastSeen = performance.now();
    }
  }

  rename(id, name) {
    const entry = this.map.get(id);
    if (!entry || entry.name === name) return;
    entry.group.remove(entry.label);
    entry.label.material.map?.dispose();
    entry.label.material.dispose();
    entry.label = makeLabel(name);
    entry.group.add(entry.label);
    entry.name = name;
  }

  remove(id) {
    const entry = this.map.get(id);
    if (!entry) return;
    this.disposeEntry(entry);
    this.map.delete(id);
  }

  clear() {
    for (const entry of this.map.values()) this.disposeEntry(entry);
    this.map.clear();
  }

  prune(list, selfId) {
    const alive = new Set();
    for (const p of list) if (p.id !== selfId) alive.add(p.id);
    for (const id of [...this.map.keys()]) {
      if (!alive.has(id)) this.remove(id);
    }
  }

  update(dt) {
    const now = performance.now();
    const t = Math.min(1, dt * 12);
    for (const entry of this.map.values()) {
      entry.group.visible = now - entry.lastSeen < STALE_MS;
      entry.group.position.lerp(entry.target, t);
      let delta = entry.targetYaw - entry.group.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      entry.group.rotation.y += delta * t;
    }
  }

  disposeEntry(entry) {
    this.scene.remove(entry.group);
    entry.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        child.material.map?.dispose();
        child.material.dispose();
      }
    });
  }
}
