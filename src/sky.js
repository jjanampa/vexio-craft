import * as THREE from "three";
import { RENDER_DISTANCE, CHUNK_SIZE, IS_TOUCH } from "./config.js";
import { mulberry32 } from "./noise.js";

const SKY_VERTEX = `
varying vec3 vWorldPosition;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAGMENT = `
uniform vec3 topColor;
uniform vec3 bottomColor;
uniform float offset;
uniform float exponent;
varying vec3 vWorldPosition;
void main() {
  float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
  vec3 color = mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0));
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const PALETTES = {
  day: {
    top: new THREE.Color(0x5b8ff0),
    bottom: new THREE.Color(0xcfe4ff),
    hemiSky: new THREE.Color(0xdfeaff),
    hemiGround: new THREE.Color(0x4a5d3a),
    sun: new THREE.Color(0xfff3dd),
    sunIntensity: 1.25,
    hemiIntensity: 0.7,
  },
  dusk: {
    top: new THREE.Color(0x2c3a6e),
    bottom: new THREE.Color(0xff9d5c),
    hemiSky: new THREE.Color(0xffb98a),
    hemiGround: new THREE.Color(0x503b30),
    sun: new THREE.Color(0xffab5e),
    sunIntensity: 0.9,
    hemiIntensity: 0.55,
  },
  night: {
    top: new THREE.Color(0x030714),
    bottom: new THREE.Color(0x0d1838),
    hemiSky: new THREE.Color(0x33477a),
    hemiGround: new THREE.Color(0x1a2336),
    sun: new THREE.Color(0x9fb6ff),
    sunIntensity: 0.22,
    hemiIntensity: 0.34,
  },
};

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function makeSunTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = "#fffbe0";
  ctx.fillRect(4, 0, 24, 32);
  ctx.fillRect(0, 4, 32, 24);
  ctx.fillStyle = "#fff4b8";
  ctx.fillRect(6, 2, 20, 28);
  ctx.fillRect(2, 6, 28, 20);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(10, 6, 12, 12);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

function makeMoonTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = "#e9edf5";
  ctx.fillRect(4, 0, 24, 32);
  ctx.fillRect(0, 4, 32, 24);
  ctx.fillStyle = "#c8d0de";
  const craters = [
    [7, 8, 4, 3],
    [18, 6, 5, 4],
    [10, 16, 6, 5],
    [19, 19, 4, 4],
    [6, 21, 3, 3],
  ];
  for (const [x, y, w, h] of craters) {
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#aeb8c9";
    ctx.fillRect(x, y, w, 1);
    ctx.fillStyle = "#c8d0de";
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

function makeCloudTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  const rng = mulberry32(20240913);
  const cell = 16;
  const grid = size / cell;
  const solid = Array.from({ length: grid }, () => new Array(grid).fill(false));
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      if (rng() < 0.08) solid[y][x] = true;
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        if (solid[y][x]) continue;
        const near =
          solid[(y + 1) % grid][x] ||
          solid[(y - 1 + grid) % grid][x] ||
          solid[y][(x + 1) % grid] ||
          solid[y][(x - 1 + grid) % grid];
        if (near && rng() < 0.28) solid[y][x] = true;
      }
    }
  }
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      if (solid[y][x]) ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.repeat.set(5, 5);
  return texture;
}

export class Sky {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    const uniforms = {
      topColor: { value: new THREE.Color(0x3f7fe8) },
      bottomColor: { value: new THREE.Color(0xbfe0ff) },
      offset: { value: 33 },
      exponent: { value: 0.7 },
    };
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(500, 24, 16),
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      })
    );
    this.group.add(dome);
    this.uniforms = uniforms;

    const starCount = 700;
    const starPositions = new Float32Array(starCount * 3);
    const rng = mulberry32(4242);
    for (let i = 0; i < starCount; i++) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(rng() * 0.95);
      const r = 470;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    this.starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.7,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    const stars = new THREE.Points(starGeometry, this.starMaterial);
    this.group.add(stars);

    this.sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeSunTexture(),
        transparent: true,
        depthWrite: false,
        fog: false,
      })
    );
    this.sunSprite.scale.set(56, 56, 1);
    this.group.add(this.sunSprite);

    this.moonSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeMoonTexture(),
        transparent: true,
        depthWrite: false,
        fog: false,
      })
    );
    this.moonSprite.scale.set(42, 42, 1);
    this.group.add(this.moonSprite);

    this.sun = new THREE.DirectionalLight(0xfff3dd, 1.3);
    this.sun.target.position.set(0, 0, 0);
    scene.add(this.sun);
    scene.add(this.sun.target);

    if (!IS_TOUCH) {
      this.sun.castShadow = true;
      const shadow = this.sun.shadow;
      shadow.mapSize.set(2048, 2048);
      shadow.camera.left = -70;
      shadow.camera.right = 70;
      shadow.camera.top = 70;
      shadow.camera.bottom = -70;
      shadow.camera.near = 10;
      shadow.camera.far = 420;
      shadow.bias = -0.0006;
      shadow.normalBias = 0.06;
    }

    this.hemi = new THREE.HemisphereLight(0xcfe6ff, 0x4a5d3a, 0.72);
    scene.add(this.hemi);

    this.cloudTexture = makeCloudTexture();
    this.cloudMaterial = new THREE.MeshBasicMaterial({
      map: this.cloudTexture,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      fog: false,
    });
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(1024, 1024), this.cloudMaterial);
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.position.y = 126;
    this.group.add(this.clouds);

    this.brightness = 1;
    this.fogColor = new THREE.Color(0xbfe0ff);
    this.near = RENDER_DISTANCE * CHUNK_SIZE * 0.5;
    this.far = RENDER_DISTANCE * CHUNK_SIZE * 0.95;
    this.weights = { day: 1, dusk: 0, night: 0 };
    this.tmpColor = new THREE.Color();
  }

  update(dt, playerPos, time, camera) {
    const angle = (time - 0.25) * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.cos(angle) * 0.55, Math.sin(angle), 0.42).normalize();
    const elevation = sunDir.y;

    const day = smoothstep(0.12, 0.4, elevation);
    const dusk = Math.max(0, 1 - Math.abs(elevation) / 0.35) * (elevation > -0.3 ? 1 : 0);
    const night = 1 - smoothstep(-0.26, 0.0, elevation);
    const total = day + dusk + night || 1;
    const wDay = day / total;
    const wDusk = dusk / total;
    const wNight = night / total;
    this.weights = { day: wDay, dusk: wDusk, night: wNight };

    const mix3 = (key, out) => {
      out.setRGB(
        PALETTES.day[key].r * wDay + PALETTES.dusk[key].r * wDusk + PALETTES.night[key].r * wNight,
        PALETTES.day[key].g * wDay + PALETTES.dusk[key].g * wDusk + PALETTES.night[key].g * wNight,
        PALETTES.day[key].b * wDay + PALETTES.dusk[key].b * wDusk + PALETTES.night[key].b * wNight
      );
      return out;
    };

    mix3("top", this.uniforms.topColor.value);
    mix3("bottom", this.uniforms.bottomColor.value);
    mix3("bottom", this.fogColor);
    mix3("hemiSky", this.hemi.color);
    mix3("hemiGround", this.hemi.groundColor);

    const sunColor = mix3("sun", this.tmpColor);
    this.sun.color.copy(sunColor);
    const sunIntensity =
      PALETTES.day.sunIntensity * wDay +
      PALETTES.dusk.sunIntensity * wDusk +
      PALETTES.night.sunIntensity * wNight;
    const hemiIntensity =
      PALETTES.day.hemiIntensity * wDay +
      PALETTES.dusk.hemiIntensity * wDusk +
      PALETTES.night.hemiIntensity * wNight;
    this.sun.intensity = sunIntensity;
    this.hemi.intensity = hemiIntensity;

    const lightDir = elevation < 0 ? sunDir.clone().negate() : sunDir;
    this.sun.position.copy(playerPos).addScaledVector(lightDir, 160);
    this.sun.target.position.copy(playerPos);
    this.sun.target.updateMatrixWorld();

    const sunVisible = elevation > -0.18;
    this.sunSprite.visible = sunVisible;
    if (sunVisible) {
      this.sunSprite.position.copy(playerPos).addScaledVector(sunDir, 430);
    }
    const moonVisible = elevation < 0.18;
    this.moonSprite.visible = moonVisible;
    if (moonVisible) {
      this.moonSprite.position.copy(playerPos).addScaledVector(sunDir.clone().negate(), 430);
    }

    this.starMaterial.opacity = Math.min(1, wNight * 1.4);

    this.group.position.copy(playerPos);

    this.cloudTexture.offset.x = (this.cloudTexture.offset.x + dt * 0.0007) % 1;
    const cloudShade = Math.min(1, 0.05 + wDay * 0.95 + wDusk * 0.38);
    this.cloudMaterial.color.setScalar(cloudShade);

    this.brightness = Math.min(1, 0.22 + wDay * 0.78 + wDusk * 0.5);

    return sunDir;
  }
}
