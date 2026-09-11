export const AIR = 0;
export const GRASS = 1;
export const DIRT = 2;
export const STONE = 3;
export const COBBLE = 4;
export const SAND = 5;
export const WATER = 6;
export const LOG = 7;
export const LEAVES = 8;
export const PLANKS = 9;
export const GLASS = 10;
export const BRICK = 11;
export const SNOW = 12;
export const BEDROCK = 13;

export const BLOCKS = {
  [AIR]: { name: "Aire", solid: false, opaque: false },
  [GRASS]: { name: "Césped", solid: true, opaque: true, sound: "grass", tiles: { top: "grass_top", bottom: "dirt", side: "grass_side" } },
  [DIRT]: { name: "Tierra", solid: true, opaque: true, sound: "dirt", tiles: { all: "dirt" } },
  [STONE]: { name: "Piedra", solid: true, opaque: true, sound: "stone", tiles: { all: "stone" } },
  [COBBLE]: { name: "Adoquín", solid: true, opaque: true, sound: "stone", tiles: { all: "cobble" } },
  [SAND]: { name: "Arena", solid: true, opaque: true, sound: "sand", tiles: { all: "sand" } },
  [WATER]: { name: "Agua", solid: false, opaque: false, liquid: true, sound: "water", tiles: { all: "water" } },
  [LOG]: { name: "Tronco", solid: true, opaque: true, sound: "wood", tiles: { top: "log_top", bottom: "log_top", side: "log_side" } },
  [LEAVES]: { name: "Hojas", solid: true, opaque: false, sound: "grass", tiles: { all: "leaves" } },
  [PLANKS]: { name: "Madera", solid: true, opaque: true, sound: "wood", tiles: { all: "planks" } },
  [GLASS]: { name: "Cristal", solid: true, opaque: false, sound: "glass", tiles: { all: "glass" } },
  [BRICK]: { name: "Ladrillo", solid: true, opaque: true, sound: "stone", tiles: { all: "brick" } },
  [SNOW]: { name: "Nieve", solid: true, opaque: true, sound: "snow", tiles: { all: "snow" } },
  [BEDROCK]: { name: "Roca madre", solid: true, opaque: true, unbreakable: true, sound: "stone", tiles: { all: "bedrock" } },
};

export const HOTBAR = [GRASS, DIRT, STONE, COBBLE, SAND, LOG, PLANKS, LEAVES, GLASS];

export function isSolid(id) {
  return id !== AIR && !!BLOCKS[id]?.solid;
}

export function isOpaqueBlock(id) {
  return id !== AIR && !!BLOCKS[id]?.opaque;
}

export function isLiquid(id) {
  return id !== AIR && !!BLOCKS[id]?.liquid;
}

export function isUnbreakable(id) {
  return !!BLOCKS[id]?.unbreakable;
}

export function faceTile(id, face) {
  const t = BLOCKS[id]?.tiles;
  if (!t) return null;
  if (t.all) return t.all;
  if (face === 2) return t.top;
  if (face === 3) return t.bottom;
  return t.side;
}
