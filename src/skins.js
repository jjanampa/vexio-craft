import * as THREE from "three";

export const CHARACTERS = [
  {
    id: "steve",
    name: "Steve",
    skin: "#c68e63",
    skinShade: "#a8724c",
    hair: "#3f2a18",
    hairLight: "#5c3f26",
    eyes: "#4a3f9f",
    shirt: "#00a8a8",
    shirtShade: "#008a8a",
    shirtLight: "#5fd6d6",
    sleeves: "#00a8a8",
    pants: "#3b4a8f",
    pantsShade: "#2e3a72",
    shoes: "#4a4a4a",
    mouth: "#8a4a3a",
  },
  {
    id: "alex",
    name: "Alex",
    skin: "#e8c197",
    skinShade: "#c99e73",
    hair: "#b5611f",
    hairLight: "#d47a2c",
    eyes: "#3f9f5a",
    shirt: "#6fa858",
    shirtShade: "#578a42",
    shirtLight: "#9cc882",
    sleeves: "#6fa858",
    pants: "#7a5a3a",
    pantsShade: "#5f452c",
    shoes: "#4a3a2a",
    mouth: "#a05a4a",
    longHair: true,
  },
  {
    id: "bruno",
    name: "Bruno",
    skin: "#6b4a2f",
    skinShade: "#563a24",
    hair: "#1d1510",
    hairLight: "#332419",
    eyes: "#5a3f1f",
    shirt: "#b53a3a",
    shirtShade: "#8f2c2c",
    shirtLight: "#d86767",
    sleeves: "#b53a3a",
    pants: "#3a3a42",
    pantsShade: "#2c2c33",
    shoes: "#26262b",
    mouth: "#4a3222",
  },
  {
    id: "luna",
    name: "Luna",
    skin: "#e8b89a",
    skinShade: "#c99478",
    hair: "#e070a8",
    hairLight: "#f29cc6",
    eyes: "#8a3f9f",
    shirt: "#7a4fc0",
    shirtShade: "#5f3a9c",
    shirtLight: "#a480dd",
    sleeves: "#7a4fc0",
    pants: "#4f4f5c",
    pantsShade: "#3c3c47",
    shoes: "#33333c",
    mouth: "#a05a5a",
    longHair: true,
  },
  {
    id: "kai",
    name: "Kai",
    skin: "#c98f5a",
    skinShade: "#a87244",
    hair: "#141414",
    hairLight: "#2c2c2c",
    eyes: "#2f5fa8",
    shirt: "#e8c02f",
    shirtShade: "#c09a1f",
    shirtLight: "#f5da70",
    sleeves: "#e8c02f",
    pants: "#3f5a8f",
    pantsShade: "#324870",
    shoes: "#3a3a3a",
    mouth: "#8a4a3a",
  },
  {
    id: "nova",
    name: "Nova",
    skin: "#8a5f3f",
    skinShade: "#6e4a2f",
    hair: "#e8e8e8",
    hairLight: "#ffffff",
    eyes: "#3fa8b5",
    shirt: "#3fb5c0",
    shirtShade: "#2f8f9a",
    shirtLight: "#7fd8e0",
    sleeves: "#3fb5c0",
    pants: "#2c2c33",
    pantsShade: "#1f1f24",
    shoes: "#18181c",
    mouth: "#5a3a2a",
    longHair: true,
  },
  {
    id: "max",
    name: "Max",
    skin: "#e0ac82",
    skinShade: "#c08a5e",
    hair: "#d8b45a",
    hairLight: "#e8cc80",
    eyes: "#3f6f3f",
    shirt: "#4a8f3f",
    shirtShade: "#3a7030",
    shirtLight: "#78b86a",
    sleeves: "#4a8f3f",
    pants: "#3b4a8f",
    pantsShade: "#2e3a72",
    shoes: "#4a4a4a",
    mouth: "#9a5a4a",
  },
  {
    id: "vera",
    name: "Vera",
    skin: "#e8c8a8",
    skinShade: "#c9a382",
    hair: "#b5502a",
    hairLight: "#d4703f",
    eyes: "#7a5a2f",
    shirt: "#d87a2a",
    shirtShade: "#b5611c",
    shirtLight: "#f0a860",
    sleeves: "#d87a2a",
    pants: "#5a4a3a",
    pantsShade: "#453829",
    shoes: "#3a3026",
    mouth: "#a05a4a",
    pattern: "stripe",
  },
];

export const DEFAULT_CHARACTER = "steve";

export function getCharacter(id) {
  return CHARACTERS.find((character) => character.id === id) || CHARACTERS[0];
}

export function characterIdForSeed(seed) {
  return CHARACTERS[Math.abs(seed | 0) % CHARACTERS.length].id;
}

const HEAD = {
  top: [8, 0, 8, 8],
  bottom: [16, 0, 8, 8],
  right: [0, 8, 8, 8],
  front: [8, 8, 8, 8],
  left: [16, 8, 8, 8],
  back: [24, 8, 8, 8],
};

const BODY = {
  top: [20, 16, 8, 4],
  bottom: [28, 16, 8, 4],
  right: [16, 20, 4, 12],
  front: [20, 20, 8, 12],
  left: [28, 20, 4, 12],
  back: [32, 20, 8, 12],
};

const ARM = {
  top: [44, 16, 4, 4],
  bottom: [48, 16, 4, 4],
  right: [40, 20, 4, 12],
  front: [44, 20, 4, 12],
  left: [48, 20, 4, 12],
  back: [52, 20, 4, 12],
};

const LEG = {
  top: [4, 16, 4, 4],
  bottom: [8, 16, 4, 4],
  right: [0, 20, 4, 12],
  front: [4, 20, 4, 12],
  left: [8, 20, 4, 12],
  back: [12, 20, 4, 12],
};

function fill(ctx, r, color) {
  ctx.fillStyle = color;
  ctx.fillRect(r[0], r[1], r[2], r[3]);
}

function px(ctx, r, x, y, color, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(r[0] + x, r[1] + y, w, h);
}

function drawHeadFace(ctx, r, c) {
  fill(ctx, r, c.skin);
  px(ctx, r, 0, 0, c.hair, 8, 2);
  px(ctx, r, 0, 2, c.hair, 2, 1);
  px(ctx, r, 6, 2, c.hair, 2, 1);
  px(ctx, r, 1, 4, "#ffffff", 2, 1);
  px(ctx, r, 5, 4, "#ffffff", 2, 1);
  px(ctx, r, 2, 4, c.eyes, 1, 1);
  px(ctx, r, 5, 4, c.eyes, 1, 1);
  px(ctx, r, 3, 5, c.skinShade, 2, 1);
  px(ctx, r, 2, 6, c.mouth, 4, 1);
  px(ctx, r, 0, 7, c.skinShade, 8, 1);
}

function drawHeadSide(ctx, r, c) {
  fill(ctx, r, c.hair);
  px(ctx, r, 0, 3, c.hairLight, 8, 1);
  px(ctx, r, 0, 4, c.skin, 8, 4);
  px(ctx, r, 6, 4, c.hair, 2, 4);
  px(ctx, r, 0, 7, c.skinShade, 8, 1);
  px(ctx, r, 3, 5, c.skinShade, 2, 2);
}

function drawHeadBack(ctx, r, c) {
  fill(ctx, r, c.hair);
  px(ctx, r, 0, 3, c.hairLight, 8, 1);
  px(ctx, r, 0, 7, c.skinShade, 8, 1);
}

function drawHeadTop(ctx, r, c) {
  fill(ctx, r, c.hair);
  px(ctx, r, 2, 2, c.hairLight, 4, 2);
}

function drawBodyFront(ctx, r, c) {
  fill(ctx, r, c.shirt);
  px(ctx, r, 0, 0, c.skinShade, 8, 1);
  px(ctx, r, 0, 1, c.shirtLight, 8, 1);
  if (c.pattern === "stripe") {
    px(ctx, r, 0, 4, c.shirtShade, 8, 2);
    px(ctx, r, 0, 9, c.shirtShade, 8, 1);
  } else if (c.pattern === "hoodie") {
    px(ctx, r, 2, 4, c.shirtShade, 4, 3);
    px(ctx, r, 3, 3, c.shirtShade, 2, 1);
  } else {
    px(ctx, r, 3, 3, c.shirtLight, 2, 2);
    px(ctx, r, 3, 8, c.shirtShade, 2, 2);
  }
  px(ctx, r, 0, 11, c.shirtShade, 8, 1);
}

function drawBodySide(ctx, r, c) {
  fill(ctx, r, c.shirt);
  px(ctx, r, 0, 0, c.skinShade, 4, 1);
  px(ctx, r, 0, 1, c.shirtLight, 4, 1);
  px(ctx, r, 3, 1, c.shirtShade, 1, 10);
  px(ctx, r, 0, 11, c.shirtShade, 4, 1);
}

function drawBodyTop(ctx, r, c) {
  fill(ctx, r, c.shirtLight);
  px(ctx, r, 2, 1, c.skinShade, 4, 2);
}

function drawArm(ctx, r, c) {
  fill(ctx, r, c.sleeves);
  px(ctx, r, 0, 3, c.shirtShade, r[2], 1);
  px(ctx, r, 0, 4, c.skin, r[2], 8);
  px(ctx, r, 0, 4, c.skin, r[2], 1);
  px(ctx, r, r[2] - 1, 4, c.skinShade, 1, 8);
  px(ctx, r, 0, 11, c.skinShade, r[2], 1);
  if (r[2] === 4) px(ctx, r, 1, 6, c.skinShade, 2, 1);
}

function drawHand(ctx, r, c) {
  fill(ctx, r, c.skinShade);
}

function drawLeg(ctx, r, c) {
  fill(ctx, r, c.pants);
  px(ctx, r, 0, 8, c.pantsShade, r[2], 1);
  px(ctx, r, 0, 9, c.shoes, r[2], 3);
  px(ctx, r, r[2] - 1, 0, c.pantsShade, 1, 8);
}

function drawLegTop(ctx, r, c) {
  fill(ctx, r, c.pantsShade);
}

function drawShoeBottom(ctx, r, c) {
  fill(ctx, r, c.shoes);
}

export function buildSkinCanvas(character) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  for (const r of [HEAD.right, HEAD.left]) drawHeadSide(ctx, r, character);
  drawHeadFace(ctx, HEAD.front, character);
  drawHeadBack(ctx, HEAD.back, character);
  drawHeadTop(ctx, HEAD.top, character);
  fill(ctx, HEAD.bottom, character.skinShade);

  drawBodyFront(ctx, BODY.front, character);
  drawBodyFront(ctx, BODY.back, character);
  drawBodySide(ctx, BODY.right, character);
  drawBodySide(ctx, BODY.left, character);
  drawBodyTop(ctx, BODY.top, character);
  fill(ctx, BODY.bottom, character.shirtShade);

  drawArm(ctx, ARM.front, character);
  drawArm(ctx, ARM.back, character);
  drawArm(ctx, ARM.right, character);
  drawArm(ctx, ARM.left, character);
  fill(ctx, ARM.top, character.sleeves);
  drawHand(ctx, ARM.bottom, character);

  drawLeg(ctx, LEG.front, character);
  drawLeg(ctx, LEG.back, character);
  drawLeg(ctx, LEG.right, character);
  drawLeg(ctx, LEG.left, character);
  drawLegTop(ctx, LEG.top, character);
  drawShoeBottom(ctx, LEG.bottom, character);

  return canvas;
}

export function skinTexture(character) {
  const canvas = buildSkinCanvas(character);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const FACE_ORDER = { right: 0, left: 1, top: 2, bottom: 3, front: 4, back: 5 };

export function applySkinUVs(geometry, regions) {
  const uv = geometry.attributes.uv;
  for (const [name, face] of Object.entries(FACE_ORDER)) {
    const r = regions[name];
    if (!r) continue;
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      const u = uv.getX(i);
      const w = uv.getY(i);
      uv.setXY(i, (r[0] + u * r[2]) / 64, 1 - (r[1] + (1 - w) * r[3]) / 64);
    }
  }
  uv.needsUpdate = true;
}

export function skinRegions(part) {
  if (part === "head") return HEAD;
  if (part === "body") return BODY;
  if (part === "arm") return ARM;
  return LEG;
}

export function buildHeadCanvas(character, size = 48) {
  const skin = buildSkinCanvas(character);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(skin, HEAD.front[0], HEAD.front[1], 8, 8, 0, 0, size, size);
  return canvas;
}

const headUrlCache = new Map();

export function headDataUrl(characterId) {
  let url = headUrlCache.get(characterId);
  if (!url) {
    const character = getCharacter(characterId);
    url = buildHeadCanvas(character, 48).toDataURL();
    headUrlCache.set(characterId, url);
  }
  return url;
}
