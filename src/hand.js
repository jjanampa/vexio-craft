import * as THREE from "three";
import { BLOCKS, faceTile } from "./blocks.js";

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

export class Hand {
  constructor(atlas, texture) {
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
    this.rest = { x: 0.5, y: -0.32, z: -0.72 };
    this.group.position.set(this.rest.x, this.rest.y, this.rest.z);
    this.group.rotation.set(-0.14, -0.52, 0.1);
    this.scene.add(this.group);

    this.mesh = null;
    this.blockId = -1;
    this.swingTime = -1;
    this.bobPhase = 0;
    this.materials = new Map();
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

  setBlock(id) {
    if (id === this.blockId || !id) return;
    this.blockId = id;
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    applyFaceUVs(geometry, this.atlas.uvs, id);
    this.mesh = new THREE.Mesh(geometry, this.materialFor(id));
    this.mesh.scale.setScalar(0.3);
    this.group.add(this.mesh);
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
    let rx = 0;
    let rz = 0;
    let dy = 0;
    let dz = 0;
    if (this.swingTime >= 0) {
      const s = Math.sin(this.swingTime * Math.PI);
      rx = -s * 1.05;
      rz = s * 0.28;
      dy = s * 0.1;
      dz = s * 0.16;
    }
    if (moving) this.bobPhase += dt * 7.5;
    const bob = Math.sin(this.bobPhase) * (moving ? 0.02 : 0);
    const sway = Math.cos(this.bobPhase * 0.5) * (moving ? 0.014 : 0);
    this.group.position.set(this.rest.x + sway, this.rest.y + bob + dy, this.rest.z + dz);
    this.group.rotation.set(-0.14 + rx, -0.52, 0.1 + rz);
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
