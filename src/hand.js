import * as THREE from "three";
import { BLOCKS, faceTile } from "./blocks.js";
import { isItem, iconTile } from "./items.js";
import { getCharacter, skinTexture, skinRegions, applySkinUVs } from "./skins.js";

function applyFaceUVs(geometry, uvs, id, rect = null) {
  const uv = geometry.attributes.uv;
  for (let face = 0; face < 6; face++) {
    const faceRect = rect || uvs[faceTile(id, face)];
    if (!faceRect) continue;
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      const u = uv.getX(i);
      const w = uv.getY(i);
      uv.setXY(i, faceRect.u0 + u * (faceRect.u1 - faceRect.u0), faceRect.v0 + w * (faceRect.v1 - faceRect.v0));
    }
  }
  uv.needsUpdate = true;
}

function applyPlaneUVs(geometry, rect) {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    uv.setXY(i, rect.u0 + u * (rect.u1 - rect.u0), rect.v0 + v * (rect.v1 - rect.v0));
  }
  uv.needsUpdate = true;
}

export class Hand {
  constructor(atlas, texture, character = "steve") {
    this.atlas = atlas;
    this.texture = texture;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.01, 8);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.62);
    this.dirLight = new THREE.DirectionalLight(0xffffff, 0.72);
    this.dirLight.position.set(-0.6, 1, 0.8);
    this.scene.add(this.ambient);
    this.scene.add(this.dirLight);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6f6f6f, 0.3));

    this.group = new THREE.Group();
    this.rest = { x: 0.58, y: -0.64, z: -0.2 };
    this.restRot = { x: -0.74, y: -0.12, z: 0.05 };
    this.group.position.set(this.rest.x, this.rest.y, this.rest.z);
    this.group.rotation.set(this.restRot.x, this.restRot.y, this.restRot.z);
    this.scene.add(this.group);

    this.skinMaterial = new THREE.MeshLambertMaterial();
    this.setCharacter(character);

    this.arm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.62, 0.26), this.skinMaterial);
    applySkinUVs(this.arm.geometry, skinRegions("arm"));
    this.arm.rotation.z = Math.PI;
    this.arm.position.set(0, 0.31, 0);
    this.group.add(this.arm);

    this.handAnchor = new THREE.Group();
    this.handAnchor.position.set(0, 0.68, 0);
    this.group.add(this.handAnchor);

    this.mesh = null;
    this.heldId = -1;
    this.swingTime = -1;
    this.bobPhase = 0;
    this.materials = new Map();
    this.itemMaterials = new Map();
  }

  setCharacter(character) {
    const def = typeof character === "string" ? getCharacter(character) : character;
    if (this.character === def.id) return;
    this.character = def.id;
    this.skinTexture?.dispose();
    this.skinTexture = skinTexture(def);
    this.skinMaterial.map = this.skinTexture;
    this.skinMaterial.needsUpdate = true;
  }

  materialFor(id) {
    let material = this.materials.get(id);
    if (!material) {
      const def = BLOCKS[id];
      material = new THREE.MeshLambertMaterial({
        map: this.texture,
        transparent: !!def?.liquid,
        opacity: def?.liquid ? 0.78 : 1,
        alphaTest: def && !def.opaque && !def.liquid ? 0.5 : 0,
      });
      this.materials.set(id, material);
    }
    return material;
  }

  itemMaterial() {
    let material = this.itemMaterials.get("item");
    if (!material) {
      material = new THREE.MeshLambertMaterial({
        map: this.texture,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
      });
      this.itemMaterials.set("item", material);
    }
    return material;
  }

  setHeld(id) {
    if (id === this.heldId) return;
    this.heldId = id;
    if (this.mesh) {
      this.handAnchor.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    if (!id || id === 0) return;
    if (isItem(id)) {
      const rect = this.atlas.uvs[iconTile(id)];
      if (!rect) return;
      const geometry = new THREE.PlaneGeometry(0.34, 0.34);
      applyPlaneUVs(geometry, rect);
      const mesh = new THREE.Mesh(geometry, this.itemMaterial());
      mesh.rotation.set(0.15, -0.35, 0.42);
      mesh.position.set(0.0, 0.08, 0.0);
      this.mesh = mesh;
      this.handAnchor.add(mesh);
      return;
    }
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    applyFaceUVs(geometry, this.atlas.uvs, id);
    const mesh = new THREE.Mesh(geometry, this.materialFor(id));
    mesh.scale.setScalar(0.28);
    mesh.position.set(0, 0.14, -0.05);
    this.mesh = mesh;
    this.handAnchor.add(mesh);
  }

  triggerSwing() {
    if (this.swingTime < 0) this.swingTime = 0;
  }

  update(dt, moving, light = 1) {
    const l = 0.12 + 0.88 * light * light;
    this.ambient.intensity = 0.62 * l;
    this.dirLight.intensity = 0.72 * l;
    if (this.swingTime >= 0) {
      this.swingTime += dt / 0.3;
      if (this.swingTime >= 1) this.swingTime = -1;
    }
    const heavy = isItem(this.heldId);
    let rx = 0;
    let rz = 0;
    let dy = 0;
    let dz = 0;
    let ry = 0;
    if (this.swingTime >= 0) {
      const s = Math.sin(this.swingTime * Math.PI);
      rx = -s * (heavy ? 0.85 : 0.65);
      rz = s * (heavy ? 0.3 : 0.22);
      ry = s * 0.14;
      dy = s * 0.08;
      dz = s * 0.14;
    }
    if (moving) this.bobPhase += dt * 7.5;
    const bob = Math.sin(this.bobPhase) * (moving ? 0.02 : 0);
    const sway = Math.cos(this.bobPhase * 0.5) * (moving ? 0.014 : 0);
    this.group.position.set(this.rest.x + sway, this.rest.y + bob + dy, this.rest.z + dz);
    this.group.rotation.set(this.restRot.x + rx, this.restRot.y + ry, this.restRot.z + rz);
  }

  render(renderer) {
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = autoClear;
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
