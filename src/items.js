import { BLOCKS, GRASS, STONE, LOG, PLANKS, GLASS, LEAVES, isPlant } from "./blocks.js";

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
