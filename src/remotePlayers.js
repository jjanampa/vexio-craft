import * as THREE from "three";
import { Avatar } from "./avatar.js";
import { characterIdForSeed } from "./skins.js";

const STALE_MS = 8000;

export class RemotePlayers {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.atlas = options.atlas || null;
    this.texture = options.texture || null;
    this.map = new Map();
  }

  get count() {
    return this.map.size;
  }

  upsert(data) {
    let entry = this.map.get(data.id);
    if (!entry) {
      const character = typeof data.character === "string" ? data.character : characterIdForSeed(data.id);
      const avatar = new Avatar({
        name: data.name,
        character,
        atlas: this.atlas,
        texture: this.texture,
      });
      this.scene.add(avatar.group);
      entry = {
        avatar,
        target: new THREE.Vector3(data.x, data.y, data.z),
        targetYaw: data.yaw ?? 0,
        pitch: data.pitch ?? 0,
        lastSeen: performance.now(),
        name: data.name,
        character,
        speed: 0,
        item: -1,
        armor: [0, 0, 0, 0],
      };
      entry.avatar.group.position.copy(entry.target);
      entry.avatar.group.rotation.y = entry.targetYaw;
      this.map.set(data.id, entry);
    } else {
      entry.target.set(data.x, data.y, data.z);
      entry.targetYaw = data.yaw ?? 0;
      entry.pitch = data.pitch ?? 0;
      entry.lastSeen = performance.now();
    }

    const character = typeof data.character === "string" ? data.character : characterIdForSeed(data.id);
    if (entry.character !== character) {
      entry.character = character;
      entry.avatar.setCharacter(character);
    }
    const item = Number.isInteger(data.item) ? data.item : 0;
    if (entry.item !== item) {
      entry.item = item;
      entry.avatar.setHeld(item);
    }
    if (Array.isArray(data.armor)) {
      const next = data.armor.slice(0, 4).map((v) => (Number.isInteger(v) ? v : 0));
      const changed = next.some((v, i) => v !== entry.armor[i]);
      if (changed) {
        entry.armor = next;
        entry.avatar.setArmor(next);
      }
    }
  }

  swing(id) {
    this.map.get(id)?.avatar.triggerSwing();
  }

  rename(id, name) {
    const entry = this.map.get(id);
    if (!entry || entry.name === name) return;
    entry.avatar.setName(name);
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
      const group = entry.avatar.group;
      group.visible = now - entry.lastSeen < STALE_MS;
      group.position.lerp(entry.target, t);
      let delta = entry.targetYaw - group.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      group.rotation.y += delta * t;

      const remaining = group.position.distanceTo(entry.target);
      const desired = Math.min(10, remaining / Math.max(dt, 0.016));
      entry.speed += (desired - entry.speed) * Math.min(1, dt * 5);
      entry.avatar.update(dt, {
        speed: entry.speed,
        moving: group.visible && entry.speed > 0.4,
        pitch: entry.pitch,
      });
    }
  }

  disposeEntry(entry) {
    this.scene.remove(entry.avatar.group);
    entry.avatar.dispose();
  }
}
