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

export const TALL_GRASS = 14;
export const FLOWER_RED = 15;
export const FLOWER_YELLOW = 16;
export const DEAD_BUSH = 17;
export const CACTUS = 18;

export const SPRUCE_LOG = 19;
export const SPRUCE_LEAVES = 20;
export const SPRUCE_PLANKS = 21;
export const BIRCH_LOG = 22;
export const BIRCH_LEAVES = 23;
export const BIRCH_PLANKS = 24;
export const JUNGLE_LOG = 25;
export const JUNGLE_LEAVES = 26;
export const JUNGLE_PLANKS = 27;
export const ACACIA_LOG = 28;
export const ACACIA_LEAVES = 29;
export const ACACIA_PLANKS = 30;

export const PODZOL = 31;
export const COARSE_DIRT = 32;
export const RED_SAND = 33;
export const SANDSTONE = 34;
export const RED_SANDSTONE = 35;
export const TERRACOTTA = 36;
export const WHITE_TERRACOTTA = 37;
export const ORANGE_TERRACOTTA = 38;
export const RED_TERRACOTTA = 39;
export const MOSSY_COBBLE = 40;
export const STONE_BRICKS = 41;
export const GRASS_SNOWY = 42;

export const NETHERRACK = 43;
export const SOUL_SAND = 44;
export const GLOWSTONE = 45;
export const NETHER_BRICKS = 46;
export const LAVA = 47;
export const OBSIDIAN = 48;
export const NETHER_PORTAL = 49;
export const QUARTZ_ORE = 50;

export const END_STONE = 51;
export const PURPUR = 52;
export const END_PORTAL_FRAME = 53;
export const END_PORTAL = 54;
export const SPAWNER = 55;

export const IRON_ORE = 56;
export const DIAMOND_ORE = 57;
export const WOOL = 58;

export const BLOCKS = {
  [AIR]: { name: "Aire", solid: false, opaque: false },
  [GRASS]: { name: "Césped", solid: true, opaque: true, sound: "grass", hardness: 0.35, tiles: { top: "grass_top", bottom: "dirt", side: "grass_side" } },
  [DIRT]: { name: "Tierra", solid: true, opaque: true, sound: "dirt", hardness: 0.35, tiles: { all: "dirt" } },
  [STONE]: { name: "Piedra", solid: true, opaque: true, sound: "stone", hardness: 1.15, pickaxe: 0, tiles: { all: "stone" } },
  [COBBLE]: { name: "Adoquín", solid: true, opaque: true, sound: "stone", hardness: 1.1, pickaxe: 0, tiles: { all: "cobble" } },
  [SAND]: { name: "Arena", solid: true, opaque: true, sound: "sand", hardness: 0.3, tiles: { all: "sand" } },
  [WATER]: { name: "Agua", solid: false, opaque: false, liquid: true, water: true, sound: "water", hardness: Infinity, tiles: { all: "water" } },
  [LOG]: { name: "Roble", solid: true, opaque: true, sound: "wood", hardness: 0.7, tiles: { top: "log_top", bottom: "log_top", side: "log_side" } },
  [LEAVES]: { name: "Hojas de roble", solid: true, opaque: false, sound: "grass", hardness: 0.18, tiles: { all: "leaves" } },
  [PLANKS]: { name: "Tablas de roble", solid: true, opaque: true, sound: "wood", hardness: 0.65, tiles: { all: "planks" } },
  [GLASS]: { name: "Cristal", solid: true, opaque: false, sound: "glass", hardness: 0.22, tiles: { all: "glass" } },
  [BRICK]: { name: "Ladrillo", solid: true, opaque: true, sound: "stone", hardness: 1.25, pickaxe: 0, tiles: { all: "brick" } },
  [SNOW]: { name: "Nieve", solid: true, opaque: true, sound: "snow", hardness: 0.25, tiles: { all: "snow" } },
  [BEDROCK]: { name: "Roca madre", solid: true, opaque: true, unbreakable: true, sound: "stone", hardness: Infinity, tiles: { all: "bedrock" } },

  [TALL_GRASS]: { name: "Hierba alta", solid: false, opaque: false, plant: true, sound: "grass", hardness: 0.05, tiles: { all: "tall_grass" } },
  [FLOWER_RED]: { name: "Amapola", solid: false, opaque: false, plant: true, sound: "grass", hardness: 0.05, tiles: { all: "flower_red" } },
  [FLOWER_YELLOW]: { name: "Diente de león", solid: false, opaque: false, plant: true, sound: "grass", hardness: 0.05, tiles: { all: "flower_yellow" } },
  [DEAD_BUSH]: { name: "Arbusto seco", solid: false, opaque: false, plant: true, sound: "grass", hardness: 0.05, tiles: { all: "dead_bush" } },
  [CACTUS]: { name: "Cactus", solid: true, opaque: true, sound: "grass", hardness: 0.4, tiles: { top: "cactus_top", bottom: "cactus_top", side: "cactus_side" } },

  [SPRUCE_LOG]: { name: "Abeto", solid: true, opaque: true, sound: "wood", hardness: 0.7, tiles: { top: "spruce_log_top", bottom: "spruce_log_top", side: "spruce_log_side" } },
  [SPRUCE_LEAVES]: { name: "Hojas de abeto", solid: true, opaque: false, sound: "grass", hardness: 0.18, tiles: { all: "spruce_leaves" } },
  [SPRUCE_PLANKS]: { name: "Tablas de abeto", solid: true, opaque: true, sound: "wood", hardness: 0.65, tiles: { all: "spruce_planks" } },
  [BIRCH_LOG]: { name: "Abedul", solid: true, opaque: true, sound: "wood", hardness: 0.7, tiles: { top: "birch_log_top", bottom: "birch_log_top", side: "birch_log_side" } },
  [BIRCH_LEAVES]: { name: "Hojas de abedul", solid: true, opaque: false, sound: "grass", hardness: 0.18, tiles: { all: "birch_leaves" } },
  [BIRCH_PLANKS]: { name: "Tablas de abedul", solid: true, opaque: true, sound: "wood", hardness: 0.65, tiles: { all: "birch_planks" } },
  [JUNGLE_LOG]: { name: "Jungla", solid: true, opaque: true, sound: "wood", hardness: 0.7, tiles: { top: "jungle_log_top", bottom: "jungle_log_top", side: "jungle_log_side" } },
  [JUNGLE_LEAVES]: { name: "Hojas de jungla", solid: true, opaque: false, sound: "grass", hardness: 0.18, tiles: { all: "jungle_leaves" } },
  [JUNGLE_PLANKS]: { name: "Tablas de jungla", solid: true, opaque: true, sound: "wood", hardness: 0.65, tiles: { all: "jungle_planks" } },
  [ACACIA_LOG]: { name: "Acacia", solid: true, opaque: true, sound: "wood", hardness: 0.7, tiles: { top: "acacia_log_top", bottom: "acacia_log_top", side: "acacia_log_side" } },
  [ACACIA_LEAVES]: { name: "Hojas de acacia", solid: true, opaque: false, sound: "grass", hardness: 0.18, tiles: { all: "acacia_leaves" } },
  [ACACIA_PLANKS]: { name: "Tablas de acacia", solid: true, opaque: true, sound: "wood", hardness: 0.65, tiles: { all: "acacia_planks" } },

  [PODZOL]: { name: "Podzol", solid: true, opaque: true, sound: "dirt", hardness: 0.35, tiles: { top: "podzol_top", bottom: "dirt", side: "podzol_side" } },
  [COARSE_DIRT]: { name: "Tierra estéril", solid: true, opaque: true, sound: "dirt", hardness: 0.35, tiles: { all: "coarse_dirt" } },
  [RED_SAND]: { name: "Arena roja", solid: true, opaque: true, sound: "sand", hardness: 0.3, tiles: { all: "red_sand" } },
  [SANDSTONE]: { name: "Arenisca", solid: true, opaque: true, sound: "stone", hardness: 0.9, pickaxe: 0, tiles: { top: "sandstone_top", bottom: "sandstone_top", side: "sandstone_side" } },
  [RED_SANDSTONE]: { name: "Arenisca roja", solid: true, opaque: true, sound: "stone", hardness: 0.9, pickaxe: 0, tiles: { top: "red_sandstone_top", bottom: "red_sandstone_top", side: "red_sandstone_side" } },
  [TERRACOTTA]: { name: "Terracota", solid: true, opaque: true, sound: "stone", hardness: 0.7, pickaxe: 0, tiles: { all: "terracotta" } },
  [WHITE_TERRACOTTA]: { name: "Terracota blanca", solid: true, opaque: true, sound: "stone", hardness: 0.7, pickaxe: 0, tiles: { all: "white_terracotta" } },
  [ORANGE_TERRACOTTA]: { name: "Terracota naranja", solid: true, opaque: true, sound: "stone", hardness: 0.7, pickaxe: 0, tiles: { all: "orange_terracotta" } },
  [RED_TERRACOTTA]: { name: "Terracota roja", solid: true, opaque: true, sound: "stone", hardness: 0.7, pickaxe: 0, tiles: { all: "red_terracotta" } },
  [MOSSY_COBBLE]: { name: "Adoquín musgoso", solid: true, opaque: true, sound: "stone", hardness: 1.1, pickaxe: 0, tiles: { all: "mossy_cobble" } },
  [STONE_BRICKS]: { name: "Ladrillos de piedra", solid: true, opaque: true, sound: "stone", hardness: 1.2, pickaxe: 0, tiles: { all: "stone_bricks" } },
  [GRASS_SNOWY]: { name: "Césped nevado", solid: true, opaque: true, sound: "grass", hardness: 0.35, tiles: { top: "snow", bottom: "dirt", side: "snow_side" } },

  [NETHERRACK]: { name: "Infrapiedra", solid: true, opaque: true, sound: "stone", hardness: 0.5, pickaxe: 0, tiles: { all: "netherrack" } },
  [SOUL_SAND]: { name: "Arena de almas", solid: true, opaque: true, sound: "sand", hardness: 0.5, tiles: { all: "soul_sand" } },
  [GLOWSTONE]: { name: "Piedra luminosa", solid: true, opaque: true, sound: "glass", hardness: 0.4, tiles: { all: "glowstone" } },
  [NETHER_BRICKS]: { name: "Ladrillos del Nether", solid: true, opaque: true, sound: "stone", hardness: 1.3, pickaxe: 0, tiles: { all: "nether_bricks" } },
  [LAVA]: { name: "Lava", solid: false, opaque: false, liquid: true, lava: true, sound: "water", hardness: Infinity, tiles: { all: "lava" } },
  [OBSIDIAN]: { name: "Obsidiana", solid: true, opaque: true, sound: "stone", hardness: 3.5, pickaxe: 3, tiles: { all: "obsidian" } },
  [NETHER_PORTAL]: { name: "Portal", solid: false, opaque: false, portal: true, sound: "glass", hardness: Infinity, tiles: { all: "nether_portal" } },
  [QUARTZ_ORE]: { name: "Mena de cuarzo", solid: true, opaque: true, sound: "stone", hardness: 1.1, pickaxe: 0, tiles: { all: "quartz_ore" } },

  [END_STONE]: { name: "Piedra del End", solid: true, opaque: true, sound: "stone", hardness: 1.1, pickaxe: 0, tiles: { all: "end_stone" } },
  [PURPUR]: { name: "Púrpur", solid: true, opaque: true, sound: "stone", hardness: 1.0, pickaxe: 0, tiles: { all: "purpur" } },
  [END_PORTAL_FRAME]: { name: "Marco del End", solid: true, opaque: true, sound: "stone", hardness: Infinity, unbreakable: true, tiles: { top: "end_portal_frame_top", bottom: "end_stone", side: "end_portal_frame_side" } },
  [END_PORTAL]: { name: "Portal del End", solid: false, opaque: false, portal: true, endPortal: true, sound: "glass", hardness: Infinity, tiles: { all: "end_portal" } },
  [SPAWNER]: { name: "Generador", solid: true, opaque: true, sound: "stone", hardness: 1.5, pickaxe: 0, tiles: { all: "spawner" } },

  [IRON_ORE]: { name: "Mena de hierro", solid: true, opaque: true, sound: "stone", hardness: 1.6, pickaxe: 1, tiles: { all: "iron_ore" } },
  [DIAMOND_ORE]: { name: "Mena de diamante", solid: true, opaque: true, sound: "stone", hardness: 2.2, pickaxe: 2, tiles: { all: "diamond_ore" } },
  [WOOL]: { name: "Lana", solid: true, opaque: true, sound: "snow", hardness: 0.3, tiles: { all: "wool" } },
};

const GRASS_TINT = {
  forest: "grass_top_forest",
  birch: "grass_top_forest",
  taiga: "grass_top_forest",
  savanna: "grass_top_savanna",
  swamp: "grass_top_swamp",
  badlands: "grass_top_badlands",
  mountains: "grass_top",
  plains: "grass_top",
  snowy: "grass_top",
  beach: "grass_top",
  ocean: "grass_top",
  desert: "grass_top",
  jungle: "grass_top_forest",
};

export function isSolid(id) {
  return id !== AIR && !!BLOCKS[id]?.solid;
}

export function isOpaqueBlock(id) {
  return id !== AIR && !!BLOCKS[id]?.opaque;
}

export function isLiquid(id) {
  return id !== AIR && !!BLOCKS[id]?.liquid;
}

export function isWater(id) {
  return id !== AIR && !!BLOCKS[id]?.water;
}

export function isLava(id) {
  return id !== AIR && !!BLOCKS[id]?.lava;
}

export function isPortal(id) {
  return id !== AIR && !!BLOCKS[id]?.portal;
}

export function isPlant(id) {
  return id !== AIR && !!BLOCKS[id]?.plant;
}

export function isUnbreakable(id) {
  return !!BLOCKS[id]?.unbreakable;
}

export function breakTime(id) {
  const h = BLOCKS[id]?.hardness;
  return Number.isFinite(h) && h > 0 ? h : 0.5;
}

export function faceTile(id, face, biome) {
  const t = BLOCKS[id]?.tiles;
  if (!t) return null;
  if (t.all) return t.all;
  if (face === 2) {
    if (t.top === "grass_top" && biome && GRASS_TINT[biome]) return GRASS_TINT[biome];
    return t.top;
  }
  if (face === 3) return t.bottom;
  return t.side;
}
