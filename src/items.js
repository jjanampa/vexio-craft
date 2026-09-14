import {
  BLOCKS,
  GRASS,
  GRASS_SNOWY,
  PODZOL,
  DIRT,
  STONE,
  COBBLE,
  LOG,
  SPRUCE_LOG,
  BIRCH_LOG,
  JUNGLE_LOG,
  ACACIA_LOG,
  PLANKS,
  SPRUCE_PLANKS,
  BIRCH_PLANKS,
  JUNGLE_PLANKS,
  ACACIA_PLANKS,
  GLASS,
  LEAVES,
  IRON_ORE,
  DIAMOND_ORE,
  GOLD_ORE,
  IRON_BLOCK,
  GOLD_BLOCK,
  DIAMOND_BLOCK,
  CRAFTING_TABLE,
  FURNACE,
  TNT,
  SAND,
  isPlant,
  breakTime,
} from "./blocks.js";

export const TIERS = [
  { key: "wood", label: "Madera", speed: 2, damage: 2, sword: 4 },
  { key: "stone", label: "Piedra", speed: 4, damage: 3, sword: 5 },
  { key: "iron", label: "Hierro", speed: 6, damage: 4, sword: 6 },
  { key: "diamond", label: "Diamante", speed: 8, damage: 5, sword: 7 },
];

export const TOOL_KINDS = [
  { key: "sword", label: "Espada" },
  { key: "pickaxe", label: "Pico" },
  { key: "axe", label: "Hacha" },
  { key: "shovel", label: "Pala" },
];

export const ARMOR_SLOTS = ["helmet", "chest", "legs", "boots"];
export const ARMOR_SLOT_NAMES = { helmet: "Casco", chest: "Pechera", legs: "Grebas", boots: "Botas" };
export const ARMOR_COLORS = { leather: 0x9a6432, iron: 0xd0d0d0, diamond: 0x4fd8c8 };

const ARMOR_MATERIALS = [
  { key: "leather", label: "Cuero", points: [1, 3, 2, 1] },
  { key: "iron", label: "Hierro", points: [2, 6, 5, 2] },
  { key: "diamond", label: "Diamante", points: [3, 8, 6, 3] },
];

export const ITEMS = {};

TOOL_KINDS.forEach((kind, ki) => {
  TIERS.forEach((tier, ti) => {
    const id = 1000 + ki * 10 + ti;
    ITEMS[id] = {
      id,
      name: `${kind.label} de ${tier.label.toLowerCase()}`,
      icon: `${kind.key}_${tier.key}`,
      kind: "tool",
      tool: kind.key,
      tier: ti,
      speed: tier.speed,
      damage: kind.key === "sword" ? tier.sword : tier.damage,
    };
  });
});

ARMOR_MATERIALS.forEach((mat, mi) => {
  ARMOR_SLOTS.forEach((slot, si) => {
    const id = 1100 + mi * 10 + si;
    ITEMS[id] = {
      id,
      name: `${ARMOR_SLOT_NAMES[slot]} de ${mat.label.toLowerCase()}`,
      icon: `${slot}_${mat.key}`,
      kind: "armor",
      slot,
      material: mat.key,
      armor: mat.points[si],
      color: ARMOR_COLORS[mat.key],
    };
  });
});

export const STONE_SWORD = 1001;
export const STONE_PICKAXE = 1011;
export const STONE_AXE = 1021;
export const STONE_SHOVEL = 1031;

export const PORKCHOP = 1200;
export const BEEF = 1201;
export const MUTTON = 1202;
export const ROTTEN_FLESH = 1203;

export const STICK = 1300;
export const IRON_INGOT = 1301;
export const DIAMOND = 1302;
export const LEATHER = 1303;
export const GOLD_INGOT = 1304;
export const GUNPOWDER = 1305;

const FOODS = {
  [PORKCHOP]: { name: "Chuleta de cerdo", icon: "porkchop", food: 8 },
  [BEEF]: { name: "Carne de res", icon: "beef", food: 8 },
  [MUTTON]: { name: "Carne de oveja", icon: "mutton", food: 6 },
  [ROTTEN_FLESH]: { name: "Carne podrida", icon: "rotten_flesh", food: 4 },
};

const MATERIALS = {
  [STICK]: { name: "Palo", icon: "stick" },
  [IRON_INGOT]: { name: "Lingote de hierro", icon: "iron_ingot" },
  [DIAMOND]: { name: "Diamante", icon: "diamond" },
  [LEATHER]: { name: "Cuero", icon: "leather" },
  [GOLD_INGOT]: { name: "Lingote de oro", icon: "gold_ingot" },
  [GUNPOWDER]: { name: "Pólvora", icon: "gunpowder" },
};

for (const [id, def] of Object.entries(FOODS)) {
  ITEMS[id] = { id: Number(id), kind: "food", ...def };
}

for (const [id, def] of Object.entries(MATERIALS)) {
  ITEMS[id] = { id: Number(id), kind: "material", ...def };
}

export const DEFAULT_HOTBAR = [STONE_SWORD, STONE_PICKAXE, STONE_AXE, STONE_SHOVEL, GRASS, STONE, LOG, PLANKS, GLASS];

export function isItem(id) {
  return id >= 1000;
}

export function itemDef(id) {
  return ITEMS[id] || null;
}

export function isTool(id) {
  return !!ITEMS[id]?.tool;
}

export function isSword(id) {
  return ITEMS[id]?.tool === "sword";
}

export function isArmor(id) {
  return !!ITEMS[id]?.armor;
}

export function armorSlotOf(id) {
  return ARMOR_SLOTS.indexOf(ITEMS[id]?.slot);
}

export function itemName(id) {
  if (!id) return "Vacío";
  return ITEMS[id]?.name || BLOCKS[id]?.name || "?";
}

export function iconTile(id) {
  if (ITEMS[id]) return ITEMS[id].icon;
  const tiles = BLOCKS[id]?.tiles;
  if (!tiles) return "stone";
  return tiles.side || tiles.all || tiles.top || "stone";
}

export function toolForBlock(blockId) {
  const def = BLOCKS[blockId];
  if (!def) return null;
  if (def.plant || blockId === LEAVES) return "sword";
  if (def.sound === "wood") return "axe";
  if (def.sound === "stone" || def.sound === "glass") return "pickaxe";
  if (def.sound === "dirt" || def.sound === "sand" || def.sound === "snow" || def.sound === "grass") {
    return "shovel";
  }
  return null;
}

export function mineSpeed(itemId, blockId) {
  const def = ITEMS[itemId];
  if (!def?.tool) return 1;
  const want = toolForBlock(blockId);
  if (def.tool === want) return def.speed;
  return 1;
}

export function attackPower(itemId) {
  const def = ITEMS[itemId];
  if (!def) return 1;
  return def.damage || 1;
}

export function armorPoints(list) {
  let points = 0;
  for (const id of list) points += ITEMS[id]?.armor || 0;
  return points;
}

export function armorReduction(points) {
  return Math.min(0.6, points * 0.04);
}

export function placeable(id) {
  return !!id && !isItem(id) && !!BLOCKS[id];
}

export function isFood(id) {
  return ITEMS[id]?.kind === "food";
}

export function foodValue(id) {
  return ITEMS[id]?.food || 0;
}

export function stackLimit(id) {
  const def = ITEMS[id];
  if (def && (def.kind === "tool" || def.kind === "armor")) return 1;
  return 64;
}

export function pickaxeTier(itemId) {
  const def = ITEMS[itemId];
  if (!def || def.tool !== "pickaxe") return -1;
  return def.tier;
}

export function canHarvest(blockId, itemId) {
  const required = BLOCKS[blockId]?.pickaxe;
  if (required === undefined) return true;
  return pickaxeTier(itemId) >= required;
}

export function breakTimeWithTool(blockId, itemId) {
  let time = breakTime(blockId) / mineSpeed(itemId, blockId);
  const required = BLOCKS[blockId]?.pickaxe;
  if (required !== undefined && pickaxeTier(itemId) < required) time *= 3;
  return time;
}

export function rollBlockDrop(blockId) {
  if (!blockId || !BLOCKS[blockId]) return null;
  if (blockId === GRASS || blockId === GRASS_SNOWY || blockId === PODZOL) return { id: DIRT, count: 1 };
  if (blockId === STONE) return { id: COBBLE, count: 1 };
  if (blockId === IRON_ORE) return { id: IRON_INGOT, count: 1 };
  if (blockId === DIAMOND_ORE) return { id: DIAMOND, count: 1 };
  if (blockId === GOLD_ORE) return { id: GOLD_INGOT, count: 1 };
  if (blockId === GLASS) return null;
  if (blockId === LEAVES) return Math.random() < 0.33 ? { id: LEAVES, count: 1 } : null;
  if (BLOCKS[blockId].unbreakable || BLOCKS[blockId].portal) return null;
  return { id: blockId, count: 1 };
}

const ANY_PLANKS = [PLANKS, SPRUCE_PLANKS, BIRCH_PLANKS, JUNGLE_PLANKS, ACACIA_PLANKS];
const LOG_TO_PLANKS = [
  [LOG, PLANKS],
  [SPRUCE_LOG, SPRUCE_PLANKS],
  [BIRCH_LOG, BIRCH_PLANKS],
  [JUNGLE_LOG, JUNGLE_PLANKS],
  [ACACIA_LOG, ACACIA_PLANKS],
];

export const RECIPES = [];

function addRecipe(group, outId, outCount, ingredients) {
  RECIPES.push({ group, outId, outCount, ingredients });
}

for (const [log, planks] of LOG_TO_PLANKS) {
  addRecipe("Materiales", planks, 4, [{ ids: [log], count: 1 }]);
}
addRecipe("Materiales", STICK, 4, [{ ids: ANY_PLANKS, count: 2 }]);
addRecipe("Materiales", CRAFTING_TABLE, 1, [{ ids: ANY_PLANKS, count: 4 }]);
addRecipe("Materiales", FURNACE, 1, [{ ids: [COBBLE], count: 8 }]);
addRecipe("Materiales", IRON_BLOCK, 1, [{ ids: [IRON_INGOT], count: 9 }]);
addRecipe("Materiales", IRON_INGOT, 9, [{ ids: [IRON_BLOCK], count: 1 }]);
addRecipe("Materiales", GOLD_BLOCK, 1, [{ ids: [GOLD_INGOT], count: 9 }]);
addRecipe("Materiales", GOLD_INGOT, 9, [{ ids: [GOLD_BLOCK], count: 1 }]);
addRecipe("Materiales", DIAMOND_BLOCK, 1, [{ ids: [DIAMOND], count: 9 }]);
addRecipe("Materiales", DIAMOND, 9, [{ ids: [DIAMOND_BLOCK], count: 1 }]);
addRecipe("Materiales", TNT, 1, [
  { ids: [GUNPOWDER], count: 4 },
  { ids: [SAND], count: 4 },
]);

const TOOL_COSTS = {
  sword: { material: 2, stick: 1 },
  pickaxe: { material: 3, stick: 2 },
  axe: { material: 3, stick: 2 },
  shovel: { material: 1, stick: 2 },
};

const TOOL_MATERIALS = [
  { ids: ANY_PLANKS, tier: 0 },
  { ids: [COBBLE], tier: 1 },
  { ids: [IRON_INGOT], tier: 2 },
  { ids: [DIAMOND], tier: 3 },
];

TOOL_KINDS.forEach((kind, ki) => {
  const cost = TOOL_COSTS[kind.key];
  for (const mat of TOOL_MATERIALS) {
    const outId = 1000 + ki * 10 + mat.tier;
    addRecipe("Herramientas", outId, 1, [
      { ids: mat.ids, count: cost.material },
      { ids: [STICK], count: cost.stick },
    ]);
  }
});

const ARMOR_COSTS = [5, 8, 7, 4];
const ARMOR_CRAFTS = [
  { ids: [LEATHER], mat: 0 },
  { ids: [IRON_INGOT], mat: 1 },
  { ids: [DIAMOND], mat: 2 },
];

ARMOR_CRAFTS.forEach(({ ids, mat }) => {
  ARMOR_SLOTS.forEach((slot, si) => {
    addRecipe("Armadura", 1100 + mat * 10 + si, 1, [{ ids, count: ARMOR_COSTS[si] }]);
  });
});

export function recipeAvailable(recipe, inventory) {
  for (const ing of recipe.ingredients) {
    let available = 0;
    for (const id of ing.ids) available += inventory.countOf(id);
    if (available < ing.count) return false;
  }
  return true;
}

export function consumeIngredients(recipe, inventory) {
  for (const ing of recipe.ingredients) {
    let need = ing.count;
    for (const id of ing.ids) {
      if (need <= 0) break;
      const have = inventory.countOf(id);
      if (have <= 0) continue;
      const use = Math.min(have, need);
      inventory.remove(id, use);
      need -= use;
    }
  }
}
