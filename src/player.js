import * as THREE from "three";
import {
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  EYE_HEIGHT,
  GRAVITY,
  JUMP_SPEED,
  WALK_SPEED,
  SPRINT_SPEED,
  FLY_SPEED,
  SWIM_SPEED,
} from "./config.js";
import { AIR, WATER, isSolid, isLiquid } from "./blocks.js";

const EPS = 1e-4;

export class Player {
  constructor(world) {
    this.world = world;
    this.pos = new THREE.Vector3(8.5, 45, 8.5);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.flying = false;
    this.inWater = false;
    this.half = PLAYER_WIDTH / 2;
    this.height = PLAYER_HEIGHT;
    this.eye = EYE_HEIGHT;
    this.walkedDistance = 0;
  }

  get eyePosition() {
    return new THREE.Vector3(this.pos.x, this.pos.y + this.eye, this.pos.z);
  }

  isBlockSolidAt(x, y, z) {
    return isSolid(this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)));
  }

  collidesAt(x, y, z) {
    const minX = Math.floor(x - this.half);
    const maxX = Math.floor(x + this.half - EPS);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + this.height - EPS);
    const minZ = Math.floor(z - this.half);
    const maxZ = Math.floor(z + this.half - EPS);
    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          if (isSolid(this.world.getBlock(bx, by, bz))) return true;
        }
      }
    }
    return false;
  }

  intersectsBlock(bx, by, bz) {
    const minX = this.pos.x - this.half;
    const maxX = this.pos.x + this.half;
    const minY = this.pos.y;
    const maxY = this.pos.y + this.height;
    const minZ = this.pos.z - this.half;
    const maxZ = this.pos.z + this.half;
    return maxX > bx && minX < bx + 1 && maxY > by && minY < by + 1 && maxZ > bz && minZ < bz + 1;
  }

  respawn(spawn) {
    this.pos.set(spawn.x + 0.5, spawn.y, spawn.z + 0.5);
    this.vel.set(0, 0, 0);
    this.flying = false;
    this.onGround = false;
  }

  update(dt, input, camera) {
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3();
    if (input.isDown("KeyW")) wish.add(forward);
    if (input.isDown("KeyS")) wish.sub(forward);
    if (input.isDown("KeyD")) wish.add(right);
    if (input.isDown("KeyA")) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize();

    const sprinting = input.isDown("ShiftLeft") || input.isDown("ShiftRight");
    const jump = input.isDown("Space");
    this.inWater =
      isLiquid(this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.6), Math.floor(this.pos.z))) ||
      isLiquid(this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 1.4), Math.floor(this.pos.z)));

    if (this.flying) {
      const speed = sprinting ? FLY_SPEED * 1.8 : FLY_SPEED;
      this.vel.x = wish.x * speed;
      this.vel.z = wish.z * speed;
      let vy = 0;
      if (jump) vy += speed;
      if (input.isDown("ControlLeft") || input.isDown("KeyC")) vy -= speed;
      this.vel.y = vy;
      this.onGround = false;
    } else {
      let speed = sprinting ? SPRINT_SPEED : WALK_SPEED;
      if (this.inWater) {
        speed *= 0.6;
        this.vel.y -= GRAVITY * 0.22 * dt;
        if (this.vel.y < -3.2) this.vel.y = -3.2;
        if (jump) this.vel.y = SWIM_SPEED;
      } else {
        this.vel.y -= GRAVITY * dt;
        if (this.vel.y < -55) this.vel.y = -55;
        if (jump && this.onGround) {
          this.vel.y = JUMP_SPEED;
          this.onGround = false;
        }
      }
      this.vel.x = wish.x * speed;
      this.vel.z = wish.z * speed;
    }

    const startX = this.pos.x;
    const startZ = this.pos.z;
    const startY = this.pos.y;

    this.pos.x += this.vel.x * dt;
    if (this.collidesAt(this.pos.x, this.pos.y, this.pos.z)) {
      const canStep =
        this.onGround &&
        !this.flying &&
        !this.collidesAt(this.pos.x, this.pos.y + 1.02, this.pos.z);
      if (canStep) {
        this.pos.y += 1.02;
      } else {
        this.pos.x = startX;
        this.vel.x = 0;
      }
    }

    this.pos.z += this.vel.z * dt;
    if (this.collidesAt(this.pos.x, this.pos.y, this.pos.z)) {
      const canStep =
        this.onGround &&
        !this.flying &&
        !this.collidesAt(this.pos.x, this.pos.y + 1.02, this.pos.z);
      if (canStep) {
        this.pos.y += 1.02;
      } else {
        this.pos.z = startZ;
        this.vel.z = 0;
      }
    }

    this.pos.y += this.vel.y * dt;
    if (this.collidesAt(this.pos.x, this.pos.y, this.pos.z)) {
      if (this.vel.y <= 0) this.onGround = true;
      this.pos.y = startY;
      this.vel.y = 0;
    } else if (this.vel.y < 0) {
      this.onGround = false;
    }

    if (!this.flying) {
      const groundY = Math.floor(this.pos.y - 0.08);
      const below = this.world.getBlock(Math.floor(this.pos.x), groundY, Math.floor(this.pos.z));
      if (isSolid(below) && Math.abs(this.pos.y - (groundY + 1)) < 0.2) this.onGround = true;
    }

    const dx = this.pos.x - startX;
    const dz = this.pos.z - startZ;
    const moved = Math.sqrt(dx * dx + dz * dz);
    this.walkedDistance += moved;
    if (this.pos.y < -12) this.respawn({ x: Math.floor(this.pos.x), z: Math.floor(this.pos.z), y: 46 });
  }
}
