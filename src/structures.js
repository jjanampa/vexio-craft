import {
  AIR,
  COBBLE,
  MOSSY_COBBLE,
  STONE_BRICKS,
  PLANKS,
  LOG,
  GLASS,
  SANDSTONE,
  RED_SANDSTONE,
  RED_SAND,
  SNOW,
  SPRUCE_LOG,
  SPRUCE_PLANKS,
  ACACIA_LOG,
  ACACIA_PLANKS,
  JUNGLE_LOG,
  JUNGLE_PLANKS,
  GLOWSTONE,
  NETHER_BRICKS,
  OBSIDIAN,
  NETHERRACK,
  LAVA,
  WATER,
  END_PORTAL_FRAME,
  END_PORTAL,
  SPAWNER,
  COARSE_DIRT,
} from "./blocks.js";

function fillBox(world, chunk, x0, y0, z0, w, h, d, id) {
  for (let y = y0; y < y0 + h; y++) {
    for (let z = z0; z < z0 + d; z++) {
      for (let x = x0; x < x0 + w; x++) {
        world.stamp(chunk, x, y, z, id);
      }
    }
  }
}

function hollowBox(world, chunk, x0, y0, z0, w, h, d, id) {
  for (let y = y0; y < y0 + h; y++) {
    for (let z = z0; z < z0 + d; z++) {
      for (let x = x0; x < x0 + w; x++) {
        const edge = x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + d - 1 || y === y0 || y === y0 + h - 1;
        world.stamp(chunk, x, y, z, edge ? id : AIR);
      }
    }
  }
}

function foundation(world, chunk, x0, z0, w, d, baseY, id) {
  for (let z = z0; z < z0 + d; z++) {
    for (let x = x0; x < x0 + w; x++) {
      const h = world.heightAt(x, z);
      for (let y = h; y < baseY; y++) world.stamp(chunk, x, y, z, id);
    }
  }
}

function pitchedRoof(world, chunk, x0, y0, z0, w, d, id) {
  let x = x0;
  let z = z0;
  let ww = w;
  let dd = d;
  let layer = 0;
  while (ww > 0 && dd > 0 && layer < 4) {
    fillBox(world, chunk, x, y0 + layer, z, ww, 1, dd, id);
    x++;
    z++;
    ww -= 2;
    dd -= 2;
    layer++;
  }
  if (ww <= 0 || dd <= 0) {
    world.stamp(chunk, x0 + ((w / 2) | 0), y0 + layer, z0 + ((d / 2) | 0), id);
  }
}

function house(world, chunk, x0, y0, z0, w, d, h, wallId, roofId, floorId, rng) {
  fillBox(world, chunk, x0, y0 - 1, z0, w, 1, d, floorId);
  for (let y = y0; y < y0 + h; y++) {
    for (let z = z0; z < z0 + d; z++) {
      for (let x = x0; x < x0 + w; x++) {
        const edge = x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + d - 1;
        world.stamp(chunk, x, y, z, edge ? wallId : AIR);
      }
    }
  }
  pitchedRoof(world, chunk, x0 - 1, y0 + h, z0 - 1, w + 2, d + 2, roofId);
  const doorX = x0 + 1 + ((rng() * (w - 2)) | 0);
  world.stamp(chunk, doorX, y0, z0, AIR);
  world.stamp(chunk, doorX, y0 + 1, z0, AIR);
  const winY = y0 + 1;
  world.stamp(chunk, x0, winY, z0 + 1 + ((rng() * (d - 2)) | 0), GLASS);
  world.stamp(chunk, x0 + w - 1, winY, z0 + 1 + ((rng() * (d - 2)) | 0), GLASS);
  world.stamp(chunk, x0 + ((w / 2) | 0), y0 + h - 1, z0 + ((d / 2) | 0), GLOWSTONE);
}

function pyramid(world, chunk, ox, oy, oz, rng) {
  const size = 21;
  const half = (size / 2) | 0;
  for (let layer = 0; layer <= 10; layer++) {
    const r = half - layer;
    if (r < 0) break;
    fillBox(world, chunk, ox - r, oy + layer, oz - r, r * 2 + 1, 1, r * 2 + 1, SANDSTONE);
  }
  hollowBox(world, chunk, ox - 3, oy, oz - 3, 7, 4, 7, AIR);
  fillBox(world, chunk, ox - 3, oy - 1, oz - 3, 7, 1, 7, SANDSTONE);
  fillBox(world, chunk, ox - 1, oy, oz - 1, 3, 1, 3, GLOWSTONE);
  fillBox(world, chunk, ox - 1, oy + 1, oz - 1, 3, 1, 3, AIR);
  for (let i = 0; i < 4; i++) {
    const x = ox - 2 + ((rng() * 5) | 0);
    const z = oz - 2 + ((rng() * 5) | 0);
    world.stamp(chunk, x, oy + 1, z, RED_SANDSTONE);
  }
  world.stamp(chunk, ox, oy + 10, oz, GLOWSTONE);
}

function jungleTemple(world, chunk, ox, oy, oz, rng) {
  const size = 13;
  const half = (size / 2) | 0;
  for (let layer = 0; layer < 5; layer++) {
    const r = half - layer;
    fillBox(world, chunk, ox - r, oy + layer, oz - r, r * 2 + 1, 1, r * 2 + 1, layer % 2 === 0 ? MOSSY_COBBLE : STONE_BRICKS);
  }
  hollowBox(world, chunk, ox - 3, oy, oz - 3, 7, 4, 7, AIR);
  fillBox(world, chunk, ox - 3, oy - 1, oz - 3, 7, 1, 7, STONE_BRICKS);
  fillBox(world, chunk, ox - 2, oy, oz - 2, 5, 1, 5, GLOWSTONE);
  for (let y = 0; y < 5; y++) {
    world.stamp(chunk, ox + half, oy + y, oz, AIR);
    world.stamp(chunk, ox + half, oy + y, oz + 1, AIR);
  }
  for (let i = 0; i < 8; i++) {
    const x = ox - 4 + ((rng() * 9) | 0);
    const z = oz - 4 + ((rng() * 9) | 0);
    world.stamp(chunk, x, oy + 4 + ((rng() * 2) | 0), z, MOSSY_COBBLE);
  }
}

function igloo(world, chunk, ox, oy, oz, rng) {
  const r = 4;
  for (let y = 0; y < 5; y++) {
    const rr = r - Math.floor(y / 1.4);
    for (let z = -rr; z <= rr; z++) {
      for (let x = -rr; x <= rr; x++) {
        const dist = Math.hypot(x, z);
        if (dist > rr + 0.4) continue;
        if (dist < rr - 0.9 && y < 4) continue;
        world.stamp(chunk, ox + x, oy + y, oz + z, SNOW);
      }
    }
  }
  hollowBox(world, chunk, ox - 2, oy, oz - 2, 5, 3, 5, AIR);
  fillBox(world, chunk, ox - 2, oy - 1, oz - 2, 5, 1, 5, SNOW);
  world.stamp(chunk, ox + 2, oy, oz, AIR);
  world.stamp(chunk, ox + 2, oy + 1, oz, AIR);
  world.stamp(chunk, ox, oy + 1, oz, GLOWSTONE);
  if (rng() < 0.5) {
    hollowBox(world, chunk, ox - 6, oy - 3, oz - 2, 5, 3, 5, MOSSY_COBBLE);
    fillBox(world, chunk, ox - 6, oy - 4, oz - 2, 5, 1, 5, MOSSY_COBBLE);
    world.stamp(chunk, ox - 4, oy - 2, oz, GLOWSTONE);
  }
}

function witchHut(world, chunk, ox, oy, oz, rng) {
  const stilts = [
    [-3, -3],
    [-3, 3],
    [3, -3],
    [3, 3],
  ];
  for (const [dx, dz] of stilts) {
    const ground = Math.max(world.heightAt(ox + dx, oz + dz), oy - 4);
    for (let y = ground; y <= oy; y++) world.stamp(chunk, ox + dx, y, oz + dz, SPRUCE_LOG);
  }
  fillBox(world, chunk, ox - 4, oy, oz - 4, 9, 1, 9, SPRUCE_PLANKS);
  fillBox(world, chunk, ox - 3, oy + 1, oz - 3, 7, 4, 7, SPRUCE_PLANKS);
  hollowBox(world, chunk, ox - 3, oy + 1, oz - 3, 7, 4, 7, SPRUCE_PLANKS);
  world.stamp(chunk, ox + 3, oy + 1, oz, AIR);
  world.stamp(chunk, ox + 3, oy + 2, oz, AIR);
  fillBox(world, chunk, ox - 4, oy + 5, oz - 4, 9, 1, 9, SPRUCE_PLANKS);
  world.stamp(chunk, ox, oy + 4, oz, GLOWSTONE);
  for (let i = 0; i < 3; i++) {
    const x = ox - 3 + ((rng() * 7) | 0);
    const z = oz - 3 + ((rng() * 7) | 0);
    world.stamp(chunk, x, oy + 2, z, rng() < 0.5 ? COBBLE : SPRUCE_LOG);
  }
}

function shipwreck(world, chunk, ox, oy, oz, rng) {
  const len = 12;
  const wid = 5;
  for (let dz = 0; dz < len; dz++) {
    const taper = dz < 3 ? 3 - dz : dz > len - 4 ? dz - (len - 4) : 0;
    const w = Math.max(1, wid - taper);
    const tilt = Math.floor(dz / 5);
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const edge = dy === 0 || dx === 0 || dx === w - 1 || dy === 2;
        if (edge) {
          world.stamp(chunk, ox + dx, oy + dy + tilt, oz + dz, dz % 2 === 0 ? SPRUCE_PLANKS : LOG);
        }
      }
    }
  }
  for (const mz of [2, 8]) {
    const ground = oy;
    for (let y = ground + 3; y < ground + 9; y++) world.stamp(chunk, ox + 2, y, oz + mz, SPRUCE_LOG);
  }
  world.stamp(chunk, ox, oy + 1, oz + 2, GLOWSTONE);
}

function mineshaft(world, chunk, ox, oy, oz, rng) {
  const y = 18 + ((rng() * 14) | 0);
  const len = 44;
  const carve = [];
  for (let d = -len; d <= len; d++) {
    carve.push([ox + d, y, oz]);
    carve.push([ox, y, oz + d]);
  }
  for (const [x, cy, z] of carve) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        world.stamp(chunk, x + dx, cy + dy, z, AIR);
      }
    }
  }
  for (let d = -len + 3; d <= len - 3; d += 6) {
    for (let dy = -1; dy <= 1; dy++) {
      world.stamp(chunk, ox + d, y + dy, oz - 2, SPRUCE_PLANKS);
      world.stamp(chunk, ox + d, y + dy, oz + 2, SPRUCE_PLANKS);
      world.stamp(chunk, ox - 2, y + dy, oz + d, SPRUCE_PLANKS);
      world.stamp(chunk, ox + 2, y + dy, oz + d, SPRUCE_PLANKS);
    }
    world.stamp(chunk, ox + d, y + 2, oz - 2, LOG);
    world.stamp(chunk, ox + d, y + 2, oz + 2, LOG);
    world.stamp(chunk, ox - 2, y + 2, oz + d, LOG);
    world.stamp(chunk, ox + 2, y + 2, oz + d, LOG);
  }
  world.stamp(chunk, ox, y + 1, oz, GLOWSTONE);
  world.stamp(chunk, ox + len - 2, y + 1, oz, GLOWSTONE);
  world.stamp(chunk, ox - len + 2, y + 1, oz, GLOWSTONE);
}

function dungeon(world, chunk, ox, oy, oz, rng) {
  const y = 14 + ((rng() * 16) | 0);
  fillBox(world, chunk, ox - 3, y - 1, oz - 3, 7, 1, 7, COBBLE);
  hollowBox(world, chunk, ox - 3, y, oz - 3, 7, 4, 7, MOSSY_COBBLE);
  world.stamp(chunk, ox, y + 1, oz, SPAWNER);
  for (let i = 0; i < 3; i++) {
    const x = ox - 2 + ((rng() * 5) | 0);
    const z = oz - 2 + ((rng() * 5) | 0);
    world.stamp(chunk, x, y, z, i === 0 ? GLOWSTONE : rng() < 0.5 ? COBBLE : AIR);
  }
}

function strongholdRoom(world, chunk, ox, oy, oz, rng) {
  const y = 8 + ((rng() * 6) | 0);
  fillBox(world, chunk, ox - 6, y - 1, oz - 6, 13, 1, 13, STONE_BRICKS);
  hollowBox(world, chunk, ox - 6, y, oz - 6, 13, 6, 13, STONE_BRICKS);
  for (let i = -5; i <= 5; i += 5) {
    for (let j = -5; j <= 5; j += 5) {
      world.stamp(chunk, ox + i, y + 3, oz + j, GLOWSTONE);
    }
  }
  for (let x = -1; x <= 1; x++) {
    for (let z = -1; z <= 1; z++) {
      world.stamp(chunk, ox + x, y, oz + z, x === 0 && z === 0 ? END_PORTAL : AIR);
      world.stamp(chunk, ox + x, y - 1, oz + z, STONE_BRICKS);
    }
  }
  for (let x = -2; x <= 2; x++) {
    for (let z = -2; z <= 2; z++) {
      if (Math.abs(x) === 2 || Math.abs(z) === 2) world.stamp(chunk, ox + x, y, oz + z, END_PORTAL_FRAME);
    }
  }
  hollowBox(world, chunk, ox + 6, y, oz - 1, 8, 3, 3, STONE_BRICKS);
  for (let x = 6; x <= 13; x++) world.stamp(chunk, ox + x, y, oz, AIR);
  for (let x = 6; x <= 13; x++) world.stamp(chunk, ox + x, y + 1, oz, AIR);
  world.stamp(chunk, ox + 12, y + 2, oz, AIR);
}

function ruinedPortal(world, chunk, ox, oy, oz, rng) {
  const w = 4;
  const h = 5;
  for (let x = 0; x < w; x++) {
    if (rng() < 0.7) world.stamp(chunk, ox + x, oy, oz, OBSIDIAN);
    if (rng() < 0.7) world.stamp(chunk, ox + x, oy + h - 1, oz, OBSIDIAN);
  }
  for (let y = 0; y < h; y++) {
    if (rng() < 0.8) {
      world.stamp(chunk, ox, oy + y, oz, OBSIDIAN);
      world.stamp(chunk, ox + w - 1, oy + y, oz, OBSIDIAN);
    }
  }
  for (let i = 0; i < 10; i++) {
    const x = ox - 2 + ((rng() * 8) | 0);
    const z = oz - 2 + ((rng() * 8) | 0);
    world.stamp(chunk, x, oy - 1, z, rng() < 0.6 ? NETHERRACK : rng() < 0.3 ? LAVA : COBBLE);
  }
  world.stamp(chunk, ox + 1, oy + 1, oz, GLOWSTONE);
}

function netherFortress(world, chunk, ox, oy, oz, rng) {
  const y = 40 + ((rng() * 8) | 0);
  const dirX = rng() < 0.5;
  const len = 48;
  for (let d = -len; d <= len; d++) {
    const x = dirX ? ox + d : ox;
    const z = dirX ? oz : oz + d;
    fillBox(world, chunk, x - 1, y, z - 1, 3, 1, 3, NETHER_BRICKS);
    for (const [px, pz] of [
      [-2, -2],
      [2, -2],
      [-2, 2],
      [2, 2],
    ]) {
      for (let py = y - 5; py < y; py++) world.stamp(chunk, x + px, py, z + pz, NETHER_BRICKS);
    }
    if (d % 12 === 0) {
      for (let py = y + 1; py < y + 6; py++) {
        world.stamp(chunk, x - 2, py, z - 2, NETHER_BRICKS);
        world.stamp(chunk, x + 2, py, z + 2, NETHER_BRICKS);
      }
      fillBox(world, chunk, x - 2, y + 5, z - 2, 5, 1, 5, NETHER_BRICKS);
    }
  }
  const rx = dirX ? ox : ox + 10;
  const rz = dirX ? oz + 10 : oz;
  fillBox(world, chunk, rx - 4, y, rz - 4, 9, 1, 9, NETHER_BRICKS);
  hollowBox(world, chunk, rx - 4, y + 1, rz - 4, 9, 4, 9, NETHER_BRICKS);
  world.stamp(chunk, rx - 3, y + 2, rz, AIR);
  world.stamp(chunk, rx + 3, y + 2, rz, AIR);
  world.stamp(chunk, rx, y + 3, rz, GLOWSTONE);
}

export const STRUCTURES = [
  {
    id: "village",
    dimension: "overworld",
    cell: 8,
    chance: 0.62,
    radius: 26,
    biomes: ["plains", "savanna", "desert", "taiga", "birch"],
    build(world, chunk, ox, oy, oz, rng, biome) {
      let wallId = PLANKS;
      let roofId = COBBLE;
      let floorId = COARSE_DIRT;
      if (biome === "desert") {
        wallId = SANDSTONE;
        roofId = RED_SANDSTONE;
        floorId = RED_SAND;
      } else if (biome === "savanna") {
        wallId = ACACIA_PLANKS;
        roofId = ACACIA_LOG;
      } else if (biome === "taiga") {
        wallId = SPRUCE_PLANKS;
        roofId = SPRUCE_LOG;
      }
      const houses = 3 + ((rng() * 3) | 0);
      for (let i = 0; i < houses; i++) {
        const angle = (i / houses) * Math.PI * 2 + rng();
        const dist = 9 + rng() * 6;
        const hx = ox + Math.round(Math.cos(angle) * dist);
        const hz = oz + Math.round(Math.sin(angle) * dist);
        const w = 6 + ((rng() * 3) | 0);
        const d = 5 + ((rng() * 3) | 0);
        const by = world.heightAt(hx, hz);
        if (by <= 30) continue;
        foundation(world, chunk, hx, hz, w, d, by, wallId);
        house(world, chunk, hx, by, hz, w, d, 4, wallId, roofId, floorId, rng);
      }
      fillBox(world, chunk, ox - 2, world.heightAt(ox, oz) - 1, oz - 2, 5, 1, 5, COBBLE);
      for (let x = -1; x <= 1; x++) {
        for (let z = -1; z <= 1; z++) world.stamp(chunk, ox + x, world.heightAt(ox, oz), oz + z, x === 0 && z === 0 ? WATER : COBBLE);
      }
      for (let i = 0; i < 8; i++) {
        const px = ox + ((rng() * 24) | 0) - 12;
        const pz = oz + ((rng() * 24) | 0) - 12;
        const by = world.heightAt(px, pz);
        if (by <= 30) continue;
        for (let k = 0; k < 3; k++) world.stamp(chunk, px + k, by, pz, floorId);
      }
    },
  },
  {
    id: "pyramid",
    dimension: "overworld",
    cell: 16,
    chance: 0.55,
    radius: 12,
    biomes: ["desert"],
    build(world, chunk, ox, oy, oz, rng) {
      pyramid(world, chunk, ox, oy, oz, rng);
    },
  },
  {
    id: "jungle_temple",
    dimension: "overworld",
    cell: 16,
    chance: 0.5,
    radius: 10,
    biomes: ["jungle"],
    build(world, chunk, ox, oy, oz, rng) {
      jungleTemple(world, chunk, ox, oy, oz, rng);
    },
  },
  {
    id: "igloo",
    dimension: "overworld",
    cell: 10,
    chance: 0.5,
    radius: 8,
    biomes: ["snowy", "taiga"],
    build(world, chunk, ox, oy, oz, rng) {
      igloo(world, chunk, ox, oy, oz, rng);
    },
  },
  {
    id: "witch_hut",
    dimension: "overworld",
    cell: 12,
    chance: 0.5,
    radius: 8,
    biomes: ["swamp"],
    build(world, chunk, ox, oy, oz, rng) {
      witchHut(world, chunk, ox, oy, oz, rng);
    },
  },
  {
    id: "shipwreck",
    dimension: "overworld",
    cell: 12,
    chance: 0.5,
    radius: 10,
    biomes: ["ocean", "beach"],
    build(world, chunk, ox, oy, oz, rng) {
      shipwreck(world, chunk, ox, oy, oz, rng);
    },
  },
  {
    id: "mineshaft",
    dimension: "overworld",
    cell: 6,
    chance: 0.4,
    radius: 48,
    biomes: [],
    build(world, chunk, ox, oy, oz, rng) {
      mineshaft(world, chunk, ox, oy, oz, rng);
    },
  },
  {
    id: "dungeon",
    dimension: "overworld",
    cell: 5,
    chance: 0.35,
    radius: 6,
    biomes: [],
    build(world, chunk, ox, oy, oz, rng) {
      dungeon(world, chunk, ox, oy, oz, rng);
    },
  },
  {
    id: "stronghold",
    dimension: "overworld",
    cell: 28,
    chance: 0.55,
    radius: 18,
    biomes: [],
    build(world, chunk, ox, oy, oz, rng) {
      strongholdRoom(world, chunk, ox, oy, oz, rng);
    },
  },
  {
    id: "ruined_portal",
    dimension: "overworld",
    cell: 10,
    chance: 0.45,
    radius: 8,
    biomes: [],
    build(world, chunk, ox, oy, oz, rng) {
      ruinedPortal(world, chunk, ox, oy, oz, rng);
    },
  },
  {
    id: "nether_fortress",
    dimension: "nether",
    cell: 8,
    chance: 0.65,
    radius: 60,
    biomes: [],
    build(world, chunk, ox, oy, oz, rng) {
      netherFortress(world, chunk, ox, oy, oz, rng);
    },
  },
];
