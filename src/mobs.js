import * as THREE from "three";
import { Avatar } from "./avatar.js";
import { GRASS, GRASS_SNOWY, PODZOL, DIRT, SNOW, SAND, RED_SAND, isSolid, isLiquid } from "./blocks.js";
import { SEA_LEVEL, GRAVITY } from "./config.js";

const TYPES = {
  pig: {
    name: "Cerdo",
    hp: 10,
    speed: 1.3,
    flee: 3.4,
    damage: 0,
    hostile: false,
    sound: "pig",
    body: 0xe58f9f,
    dark: 0xc97787,
    wool: 0,
    collide: { half: 0.4, height: 0.95 },
    hitbox: { hx: 0.5, hy: 0.5, hz: 0.7, cy: 0.5 },
    poof: 0.9,
  },
  sheep: {
    name: "Oveja",
    hp: 8,
    speed: 1.2,
    flee: 3.2,
    damage: 0,
    hostile: false,
    sound: "sheep",
    body: 0xe8e4dc,
    dark: 0xcac2b6,
    wool: 0,
    collide: { half: 0.42, height: 0.95 },
    hitbox: { hx: 0.52, hy: 0.5, hz: 0.72, cy: 0.5 },
    poof: 0.9,
  },
  zombie: {
    name: "Zombi",
    hp: 20,
    speed: 1.25,
    chase: 2.15,
    flee: 0,
    damage: 2.5,
    hostile: true,
    sound: "zombie",
    body: 0x4f8a4a,
    dark: 0x3c6b38,
    wool: 0,
    collide: { half: 0.36, height: 1.85 },
    hitbox: { hx: 0.36, hy: 0.95, hz: 0.36, cy: 0.95 },
    poof: 0.3,
  },
};

function box(w, h, d, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildQuadruped(def) {
  const group = new THREE.Group();
  const container = new THREE.Group();
  group.add(container);
  const mats = [];
  const bodyMat = new THREE.MeshLambertMaterial({ color: def.body });
  const darkMat = new THREE.MeshLambertMaterial({ color: def.dark });
  mats.push(bodyMat, darkMat);

  const body = box(0.62, 0.48, 0.95, bodyMat);
  body.position.set(0, 0.66, 0);
  container.add(body);

  const head = new THREE.Group();
  head.position.set(0, 0.8, -0.5);
  const headMesh = box(0.42, 0.4, 0.42, bodyMat);
  headMesh.position.z = -0.16;
  head.add(headMesh);
  const snout = box(0.22, 0.18, 0.14, darkMat);
  snout.position.set(0, -0.07, -0.42);
  head.add(snout);
  container.add(head);

  const legs = [];
  for (const [lx, lz] of [
    [-0.19, -0.32],
    [0.19, -0.32],
    [-0.19, 0.32],
    [0.19, 0.32],
  ]) {
    const pivot = new THREE.Group();
    pivot.position.set(lx, 0.46, lz);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.46, 0.18), darkMat);
    mesh.position.y = -0.23;
    mesh.castShadow = true;
    pivot.add(mesh);
    container.add(pivot);
    legs.push(pivot);
  }

  return { group, container, parts: { head, body }, legs, mats, avatar: null };
}

function buildZombie() {
  const avatar = new Avatar({
    skin: 0x4f8a4a,
    shirt: 0x3a5588,
    pants: 0x2f4668,
    armsForward: true,
  });
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0x14210f });
  for (const ex of [-0.12, 0.12]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), eyeMat);
    eye.position.set(ex, 0.32, -0.26);
    avatar.parts.head.add(eye);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.02), eyeMat);
  mouth.position.set(0, 0.16, -0.26);
  avatar.parts.head.add(mouth);
  const mats = [];
  avatar.group.traverse((child) => {
    if (child.material && child.material.emissive && !child.material.userData.shared) mats.push(child.material);
  });
  return { group: avatar.group, container: avatar.container, parts: avatar.parts, legs: [], mats, avatar };
}

function rayAABB(origin, dir, min, max) {
  let tmin = 0;
  let tmax = Infinity;
  for (const axis of ["x", "y", "z"]) {
    if (Math.abs(dir[axis]) < 1e-8) {
      if (origin[axis] < min[axis] || origin[axis] > max[axis]) return null;
      continue;
    }
    const inv = 1 / dir[axis];
    let t1 = (min[axis] - origin[axis]) * inv;
    let t2 = (max[axis] - origin[axis]) * inv;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  return tmax > 0 ? tmin : null;
}

export class Mobs {
  constructor(scene, handlers = {}) {
    this.scene = scene;
    this.sfx = handlers.sfx || null;
    this.onAttack = handlers.onAttack || null;
    this.onPoof = handlers.onPoof || null;
    this.world = null;
    this.list = [];
    this.ids = 0;
    this.spawnTimer = 2;
    this.time = 0;
  }

  get count() {
    return this.list.length;
  }

  setWorld(world) {
    this.clear();
    this.world = world;
  }

  clear() {
    for (const mob of this.list) this.dispose(mob);
    this.list = [];
  }

  dispose(mob) {
    this.scene.remove(mob.group);
    mob.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material && !child.material.userData.shared) {
        child.material.map?.dispose();
        child.material.dispose();
      }
    });
    if (mob.avatar) mob.avatar.materials = [];
  }

  collides(x, y, z, half, height) {
    const minX = Math.floor(x - half);
    const maxX = Math.floor(x + half - 1e-4);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + height - 1e-4);
    const minZ = Math.floor(z - half);
    const maxZ = Math.floor(z + half - 1e-4);
    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          if (isSolid(this.world.getBlock(bx, by, bz))) return true;
        }
      }
    }
    return false;
  }

  groundHeight(x, z, fromY) {
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    for (let y = Math.max(1, Math.floor(fromY)); y >= 0; y--) {
      if (isSolid(this.world.getBlock(bx, y, bz))) return y + 1;
    }
    return 0;
  }

  spawn(type, x, z, y) {
    const def = TYPES[type];
    const built = type === "zombie" ? buildZombie() : buildQuadruped(def);
    const mob = {
      id: ++this.ids,
      type,
      def,
      group: built.group,
      container: built.container,
      parts: built.parts,
      legs: built.legs,
      mats: built.mats,
      avatar: built.avatar,
      pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3(),
      yaw: Math.random() * Math.PI * 2,
      hp: def.hp,
      maxHp: def.hp,
      onGround: false,
      wanderAngle: Math.random() * Math.PI * 2,
      wanderTimer: 1 + Math.random() * 3,
      hurtTimer: 0,
      fleeTimer: 0,
      attackTimer: 0,
      soundTimer: 1 + Math.random() * 5,
      burn: 0,
      smokeTimer: 0,
      phase: Math.random() * 10,
      amp: 0,
      dead: false,
      deadTimer: 0,
    };
    mob.group.position.copy(mob.pos);
    this.scene.add(mob.group);
    this.list.push(mob);
    return mob;
  }

  canSpawnAt(def, x, z, y, night) {
    const chunk = this.world.getChunk(x >> 4, z >> 4);
    if (!chunk || !chunk.ready) return false;
    const ground = this.world.getBlock(x, y, z);
    if (!isSolid(ground) || isLiquid(ground)) return false;
    if (isSolid(this.world.getBlock(x, y + 1, z)) || isSolid(this.world.getBlock(x, y + 2, z))) return false;
    if (def.hostile) return y > 2;
    if (night) return false;
    if (y < SEA_LEVEL) return false;
    return ground === GRASS || ground === GRASS_SNOWY || ground === PODZOL || ground === DIRT || ground === SNOW || ground === SAND || ground === RED_SAND;
  }

  spawnTick(dt, player, night, cap) {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0 || this.list.length >= cap) return;
    this.spawnTimer = 2.2;
    for (let attempt = 0; attempt < 10; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 16 + Math.random() * 26;
      const x = Math.floor(player.pos.x + Math.cos(angle) * dist);
      const z = Math.floor(player.pos.z + Math.sin(angle) * dist);
      const zombieBias = night ? 0.62 : 0.1;
      const type = Math.random() < zombieBias ? "zombie" : Math.random() < 0.5 ? "pig" : "sheep";
      const def = TYPES[type];
      const maxY = Math.min(60, Math.floor(player.pos.y) + 10);
      let y = maxY;
      while (y > 2 && !isSolid(this.world.getBlock(x, y, z))) y--;
      if (!this.canSpawnAt(def, x, y, z, night)) continue;
      const dx = x + 0.5 - player.pos.x;
      const dz = z + 0.5 - player.pos.z;
      if (Math.hypot(dx, dz) < 12) continue;
      this.spawn(type, x + 0.5, z + 0.5, y + 1.02);
      return;
    }
  }

  update(dt, player, options = {}) {
    const { night = false, enabled = true, cap = 12 } = options;
    this.time += dt;
    if (!this.world || this.world.dimension !== "overworld") {
      if (this.list.length) this.clear();
      return;
    }
    if (enabled) this.spawnTick(dt, player, night, cap);

    for (const mob of [...this.list]) {
      const dx = player.pos.x - mob.pos.x;
      const dz = player.pos.z - mob.pos.z;
      const dist = Math.hypot(dx, dz);

      if (mob.dead) {
        mob.deadTimer += dt;
        const scale = Math.max(0.01, 1 - mob.deadTimer / 0.6);
        mob.container.scale.setScalar(scale);
        mob.group.rotation.x = Math.min(1.2, mob.deadTimer * 4);
        if (mob.deadTimer >= 0.6) {
          this.dispose(mob);
          this.list = this.list.filter((m) => m !== mob);
        }
        continue;
      }

      if (dist > 72) {
        this.dispose(mob);
        this.list = this.list.filter((m) => m !== mob);
        continue;
      }

      if (mob.hurtTimer > 0) {
        mob.hurtTimer -= dt;
        for (const mat of mob.mats) mat.emissive?.setHex(mob.hurtTimer > 0 ? 0x662020 : 0x000000);
      }
      if (mob.fleeTimer > 0) mob.fleeTimer -= dt;

      if (mob.def.hostile && !night && player.mode === "survival") {
        mob.burn += dt;
        if (mob.burn > 1.4) {
          mob.burn = 0;
          this.damage(mob, 2, new THREE.Vector3());
          if (mob.dead) continue;
        }
        mob.smokeTimer -= dt;
        if (mob.smokeTimer <= 0) {
          mob.smokeTimer = 0.4;
          this.onPoof?.(mob.pos, [0.35, 0.35, 0.35], 2, 1.2);
        }
      }

      let moveX = 0;
      let moveZ = 0;
      let speed = 0;
      const chasing = mob.def.hostile && player.mode === "survival" && dist < 16 && Math.abs(player.pos.y - mob.pos.y) < 6;
      if (chasing) {
        moveX = dx;
        moveZ = dz;
        speed = mob.def.chase;
        if (dist < 1.7 && Math.abs(player.pos.y - mob.pos.y) < 1.6 && mob.attackTimer <= 0) {
          mob.attackTimer = 1.15;
          mob.avatar?.triggerSwing();
          this.onAttack?.(mob.def.damage);
          this.sfx?.mobHurt?.(mob.type);
        }
      } else {
        mob.wanderTimer -= dt;
        if (mob.wanderTimer <= 0) {
          mob.wanderTimer = 2 + Math.random() * 5;
          mob.wanderAngle = Math.random() * Math.PI * 2;
        }
        const fleeing = mob.fleeTimer > 0 && mob.def.flee > 0 && dist < 14;
        if (fleeing) {
          moveX = -dx;
          moveZ = -dz;
          speed = mob.def.flee;
        } else {
          moveX = Math.cos(mob.wanderAngle);
          moveZ = Math.sin(mob.wanderAngle);
          speed = mob.def.speed;
        }
      }

      mob.attackTimer -= dt;
      mob.soundTimer -= dt;
      if (mob.soundTimer <= 0) {
        mob.soundTimer = 4 + Math.random() * 6;
        if (dist < 28) this.sfx?.mob?.(mob.def.sound);
      }

      if (speed > 0) {
        const len = Math.hypot(moveX, moveZ) || 1;
        moveX /= len;
        moveZ /= len;
        const nextX = mob.pos.x + moveX * speed * dt;
        const nextZ = mob.pos.z + moveZ * speed * dt;
        const { half, height } = mob.def.collide;
        if (!this.collides(nextX, mob.pos.y, nextZ, half, height)) {
          mob.pos.x = nextX;
          mob.pos.z = nextZ;
        } else if (!this.collides(nextX, mob.pos.y + 1.02, nextZ, half, height)) {
          mob.pos.x = nextX;
          mob.pos.z = nextZ;
          mob.pos.y += 1.02;
          mob.vel.y = 0;
        } else {
          mob.wanderAngle += Math.PI * (0.5 + Math.random());
          mob.wanderTimer = 1 + Math.random() * 2;
        }
        const desired = Math.atan2(-moveX, -moveZ);
        let delta = desired - mob.yaw;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        mob.yaw += delta * Math.min(1, dt * 8);
      }

      if (Math.abs(mob.vel.x) > 0.01 || Math.abs(mob.vel.z) > 0.01) {
        const { half, height } = mob.def.collide;
        const kx = mob.pos.x + mob.vel.x * dt;
        const kz = mob.pos.z + mob.vel.z * dt;
        if (!this.collides(kx, mob.pos.y, kz, half, height)) {
          mob.pos.x = kx;
          mob.pos.z = kz;
        } else {
          mob.vel.x = 0;
          mob.vel.z = 0;
        }
        const damp = Math.min(1, dt * 5);
        mob.vel.x -= mob.vel.x * damp;
        mob.vel.z -= mob.vel.z * damp;
      }

      const feet = this.world.getBlock(Math.floor(mob.pos.x), Math.floor(mob.pos.y + 0.4), Math.floor(mob.pos.z));
      const inLiquid = isLiquid(feet);
      if (inLiquid) {
        mob.vel.y = Math.max(mob.vel.y - GRAVITY * 0.15 * dt, -2);
        if (this.world.getBlock(Math.floor(mob.pos.x), Math.floor(mob.pos.y + 1.4), Math.floor(mob.pos.z)) !== 0) {
          mob.vel.y = 1.6;
        }
      } else {
        mob.vel.y -= GRAVITY * dt;
        if (mob.vel.y < -40) mob.vel.y = -40;
      }
      mob.pos.y += mob.vel.y * dt;
      const ground = this.groundHeight(mob.pos.x, mob.pos.z, mob.pos.y + 0.5);
      if (mob.pos.y <= ground) {
        mob.pos.y = ground;
        mob.vel.y = 0;
        mob.onGround = true;
      } else {
        mob.onGround = false;
      }

      const horiz = speed > 0 ? speed : 0;
      mob.amp += (Math.min(1, horiz / 2.5) - mob.amp) * Math.min(1, dt * 8);
      if (horiz > 0) mob.phase += dt * (4 + horiz * 2);
      if (mob.avatar) {
        mob.avatar.update(dt, { speed: horiz, moving: horiz > 0.05, pitch: 0 });
      } else {
        const swing = Math.sin(mob.phase) * 0.85 * mob.amp;
        const [legFL, legFR, legBL, legBR] = mob.legs;
        if (legFL) legFL.rotation.x = swing;
        if (legFR) legFR.rotation.x = -swing;
        if (legBL) legBL.rotation.x = -swing;
        if (legBR) legBR.rotation.x = swing;
        if (mob.parts.head) mob.parts.head.rotation.x = Math.sin(mob.phase * 0.5) * 0.05 * mob.amp;
        mob.container.position.y = Math.abs(Math.sin(mob.phase)) * 0.03 * mob.amp;
      }

      mob.group.position.copy(mob.pos);
      mob.group.rotation.y = mob.yaw;
    }
  }

  raycast(origin, dir, maxDist) {
    let best = null;
    for (const mob of this.list) {
      if (mob.dead) continue;
      const { hx, hy, hz, cy } = mob.def.hitbox;
      const min = {
        x: mob.pos.x - hx,
        y: mob.pos.y + cy - hy,
        z: mob.pos.z - hz,
      };
      const max = {
        x: mob.pos.x + hx,
        y: mob.pos.y + cy + hy,
        z: mob.pos.z + hz,
      };
      const dist = rayAABB(origin, dir, min, max);
      if (dist !== null && dist <= maxDist && (!best || dist < best.dist)) {
        best = { mob, dist };
      }
    }
    return best;
  }

  damage(mob, amount, dir) {
    if (mob.dead) return false;
    mob.hp -= amount;
    mob.hurtTimer = 0.25;
    for (const mat of mob.mats) mat.emissive?.setHex(0x662020);
    const push = Math.hypot(dir.x, dir.z) || 1;
    mob.vel.x += (dir.x / push) * 4.5;
    mob.vel.z += (dir.z / push) * 4.5;
    mob.vel.y = 3.4;
    mob.onGround = false;
    if (mob.def.flee > 0) mob.fleeTimer = 4;
    if (mob.hp <= 0) {
      mob.dead = true;
      mob.deadTimer = 0;
      this.sfx?.mobDeath?.(mob.def.sound);
      this.onPoof?.(mob.pos, [0.7, 0.25, 0.25], 12, 2.6);
      return true;
    }
    this.sfx?.mobHurt?.(mob.def.sound);
    return false;
  }
}
