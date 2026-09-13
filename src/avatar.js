import * as THREE from "three";
import { ITEMS, isItem, iconTile } from "./items.js";
import { BLOCKS, faceTile } from "./blocks.js";

export const AVATAR_SKIN = 0xe0ac82;
export const AVATAR_PANTS = 0x3b4a63;
const PALETTE = [0x4f7fd8, 0xd85f4f, 0x58b32c, 0xd8a83f, 0x9a5fd8, 0x3fb8a8, 0xd85f9a, 0x8d99ae];

export function paletteColor(seed) {
  return PALETTE[Math.abs(seed) % PALETTE.length];
}

function applyFaceUVs(geometry, uvs, id) {
  const uv = geometry.attributes.uv;
  for (let face = 0; face < 6; face++) {
    const rect = uvs[faceTile(id, face)];
    if (!rect) continue;
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      const u = uv.getX(i);
      const w = uv.getY(i);
      uv.setXY(i, rect.u0 + u * (rect.u1 - rect.u0), rect.v0 + w * (rect.v1 - rect.v0));
    }
  }
  uv.needsUpdate = true;
}

function labelSprite(text) {
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

function box(w, h, d, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export class Avatar {
  constructor(options = {}) {
    const {
      name = "",
      color = PALETTE[0],
      texture = null,
      atlas = null,
      skin = AVATAR_SKIN,
      shirt = color,
      pants = AVATAR_PANTS,
      armsForward = false,
    } = options;

    this.texture = texture;
    this.atlas = atlas;
    this.armsForward = armsForward;
    this.walkPhase = 0;
    this.idleTime = Math.random() * 10;
    this.swingTime = -1;
    this.amp = 0;
    this.speed = 0;
    this.heldId = -1;
    this.armorState = [0, 0, 0, 0];
    this.materials = [];

    this.group = new THREE.Group();
    this.container = new THREE.Group();
    this.group.add(this.container);

    const skinMat = this.track(new THREE.MeshLambertMaterial({ color: skin }));
    const shirtMat = this.track(new THREE.MeshLambertMaterial({ color: shirt }));
    const pantsMat = this.track(new THREE.MeshLambertMaterial({ color: pants }));

    this.parts = {};

    const legL = new THREE.Group();
    legL.position.set(-0.16, 0.7, 0);
    const legLMesh = box(0.24, 0.7, 0.24, pantsMat);
    legLMesh.position.y = -0.35;
    legL.add(legLMesh);
    this.parts.legL = legL;

    const legR = new THREE.Group();
    legR.position.set(0.16, 0.7, 0);
    const legRMesh = box(0.24, 0.7, 0.24, pantsMat);
    legRMesh.position.y = -0.35;
    legR.add(legRMesh);
    this.parts.legR = legR;

    const bodyMesh = box(0.62, 0.7, 0.34, shirtMat);
    bodyMesh.position.y = 1.05;
    this.parts.body = bodyMesh;

    const armL = new THREE.Group();
    armL.position.set(-0.4, 1.35, 0);
    const armLMesh = box(0.18, 0.7, 0.18, shirtMat);
    armLMesh.position.y = -0.35;
    armL.add(armLMesh);
    this.parts.armL = armL;

    const armR = new THREE.Group();
    armR.position.set(0.4, 1.35, 0);
    const armRMesh = box(0.18, 0.7, 0.18, shirtMat);
    armRMesh.position.y = -0.35;
    armR.add(armRMesh);
    this.parts.armR = armR;

    const head = new THREE.Group();
    head.position.set(0, 1.4, 0);
    const headMesh = box(0.5, 0.5, 0.5, skinMat);
    headMesh.position.y = 0.25;
    head.add(headMesh);
    this.parts.head = head;

    this.heldAnchor = new THREE.Group();
    this.heldAnchor.position.set(0, -0.6, -0.02);
    armR.add(this.heldAnchor);

    this.container.add(legL, legR, bodyMesh, armL, armR, head);

    this.label = null;
    if (name) this.setName(name);
    if (armsForward) {
      armL.rotation.x = -1.45;
      armR.rotation.x = -1.45;
    }
  }

  track(material) {
    this.materials.push(material);
    return material;
  }

  setName(text) {
    if (this.label) {
      this.container.remove(this.label);
      this.label.material.map?.dispose();
      this.label.material.dispose();
    }
    this.label = labelSprite(text);
    this.container.add(this.label);
  }

  setHeld(id) {
    if (id === this.heldId) return;
    this.heldId = id;
    if (this.heldMesh) {
      this.heldAnchor.remove(this.heldMesh);
      this.heldMesh.geometry.dispose();
      if (!this.heldMesh.material.userData.shared) this.heldMesh.material.dispose();
      this.heldMesh = null;
    }
    if (!id || id === 0) return;
    if (isItem(id)) {
      const rect = this.atlas?.uvs[iconTile(id)];
      if (!rect || !this.texture) return;
      const geometry = new THREE.PlaneGeometry(0.42, 0.42);
      const uv = geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        const u = uv.getX(i);
        const v = uv.getY(i);
        uv.setXY(i, rect.u0 + u * (rect.u1 - rect.u0), rect.v0 + v * (rect.v1 - rect.v0));
      }
      uv.needsUpdate = true;
      const material = this.track(
        new THREE.MeshLambertMaterial({ map: this.texture, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide })
      );
      material.userData.shared = true;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.set(0.15, Math.PI / 2, -0.45);
      mesh.position.set(0, 0, -0.02);
      this.heldMesh = mesh;
      this.heldAnchor.add(mesh);
      return;
    }
    const def = BLOCKS[id];
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    if (this.atlas) applyFaceUVs(geometry, this.atlas.uvs, id);
    const material = this.track(
      new THREE.MeshLambertMaterial({
        map: this.texture,
        transparent: !!def?.liquid,
        opacity: def?.liquid ? 0.78 : 1,
        alphaTest: def && !def.opaque && !def.liquid ? 0.5 : 0,
      })
    );
    material.userData.shared = true;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(0.3);
    mesh.position.set(0, 0, -0.08);
    this.heldMesh = mesh;
    this.heldAnchor.add(mesh);
  }

  setArmor(list) {
    const next = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) next[i] = list?.[i] || 0;
    if (next.every((id, i) => id === this.armorState[i])) return;
    this.armorState = next;
    if (!this.armorMeshes) this.armorMeshes = [];
    for (const mesh of this.armorMeshes) {
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.armorMeshes = [];
    const add = (id, w, h, d, x, y, z, parent) => {
      const def = ITEMS[id];
      if (!def) return;
      const material = new THREE.MeshLambertMaterial({ color: def.color });
      const mesh = box(w, h, d, material);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      this.armorMeshes.push(mesh);
    };
    const [helmet, chest, legs, boots] = next;
    add(helmet, 0.56, 0.32, 0.56, 0, 0.34, 0, this.parts.head);
    add(chest, 0.68, 0.46, 0.4, 0, 0.21, 0, this.parts.body);
    if (legs) {
      add(legs, 0.28, 0.34, 0.28, 0, -0.16, 0, this.parts.legL);
      add(legs, 0.28, 0.34, 0.28, 0, -0.16, 0, this.parts.legR);
    }
    if (boots) {
      add(boots, 0.28, 0.22, 0.32, 0, -0.6, -0.02, this.parts.legL);
      add(boots, 0.28, 0.22, 0.32, 0, -0.6, -0.02, this.parts.legR);
    }
  }

  triggerSwing() {
    if (this.swingTime < 0) this.swingTime = 0;
  }

  update(dt, { speed = 0, moving = false, pitch = 0, inWater = false } = {}) {
    this.idleTime += dt;
    const targetAmp = moving ? Math.min(1, speed / 4.6) : 0;
    this.amp += (targetAmp - this.amp) * Math.min(1, dt * 8);
    if (moving) this.walkPhase += dt * (5 + speed * 1.5);

    const legSwing = Math.sin(this.walkPhase) * 0.75 * this.amp;
    this.parts.legL.rotation.x = legSwing;
    this.parts.legR.rotation.x = -legSwing;

    let armL = -Math.sin(this.walkPhase) * 0.55 * this.amp;
    let armR = Math.sin(this.walkPhase) * 0.55 * this.amp;
    if (this.amp < 0.05) {
      armL = Math.sin(this.idleTime * 1.4) * 0.045;
      armR = -Math.sin(this.idleTime * 1.4) * 0.045;
    }
    if (inWater) {
      armL = -1.1 + Math.sin(this.idleTime * 2.2) * 0.25;
      armR = -1.1 - Math.sin(this.idleTime * 2.2) * 0.25;
    }

    if (this.swingTime >= 0) {
      this.swingTime += dt / 0.3;
      const s = Math.sin(Math.min(1, this.swingTime) * Math.PI);
      armR -= s * 1.9;
      this.parts.armR.rotation.z = -s * 0.28;
      if (this.swingTime >= 1) {
        this.swingTime = -1;
        this.parts.armR.rotation.z = 0;
      }
    }

    if (this.armsForward) {
      this.parts.armL.rotation.x = -1.45 + (armL + Math.sin(this.idleTime * 1.7) * 0.06) * 0.3;
      this.parts.armR.rotation.x = -1.45 + (armR + Math.sin(this.idleTime * 1.7) * 0.06) * 0.3;
    } else {
      this.parts.armL.rotation.x = armL;
      this.parts.armR.rotation.x = armR;
    }

    this.parts.head.rotation.x = THREE.MathUtils.clamp(pitch * 0.85, -0.85, 0.85);
    this.parts.head.rotation.z = Math.sin(this.idleTime * 0.7) * 0.02;
    this.container.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.035 * this.amp;
  }

  dispose() {
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material && !child.material.userData.shared) {
        child.material.map?.dispose();
        child.material.dispose();
      }
    });
  }
}
