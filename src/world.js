import { CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL, RENDER_DISTANCE } from "./config.js";
import {
  AIR,
  GRASS,
  DIRT,
  STONE,
  SAND,
  WATER,
  LOG,
  LEAVES,
  SNOW,
  BEDROCK,
  TALL_GRASS,
  FLOWER_RED,
  FLOWER_YELLOW,
  DEAD_BUSH,
  CACTUS,
  SPRUCE_LOG,
  SPRUCE_LEAVES,
  BIRCH_LOG,
  BIRCH_LEAVES,
  JUNGLE_LOG,
  JUNGLE_LEAVES,
  ACACIA_LOG,
  ACACIA_LEAVES,
  PODZOL,
  RED_SAND,
  SANDSTONE,
  TERRACOTTA,
  WHITE_TERRACOTTA,
  ORANGE_TERRACOTTA,
  RED_TERRACOTTA,
  GRASS_SNOWY,
  NETHERRACK,
  SOUL_SAND,
  GLOWSTONE,
  LAVA,
  QUARTZ_ORE,
  END_STONE,
  PURPUR,
  END_PORTAL_FRAME,
  END_PORTAL,
  OBSIDIAN,
  IRON_ORE,
  DIAMOND_ORE,
  GOLD_ORE,
  PUMPKIN,
  ICE,
  isSolid,
  isLiquid,
} from "./blocks.js";
import { fbm2, fbm3, hash2, mulberry32, valueNoise3 } from "./noise.js";
import { STRUCTURES } from "./structures.js";

const CS = CHUNK_SIZE;
const AREA = CS * CS;

export const BIOMES = {
  ocean: 0,
  beach: 1,
  plains: 2,
  forest: 3,
  birch: 4,
  taiga: 5,
  snowy: 6,
  desert: 7,
  savanna: 8,
  jungle: 9,
  swamp: 10,
  badlands: 11,
  mountains: 12,
};

export const BIOME_LIST = Object.keys(BIOMES);

export const BIOME_NAMES = {
  ocean: "Océano",
  beach: "Playa",
  plains: "Llanura",
  forest: "Bosque",
  birch: "Abedular",
  taiga: "Taiga",
  snowy: "Tundra nevada",
  desert: "Desierto",
  savanna: "Sabana",
  jungle: "Jungla",
  swamp: "Pantano",
  badlands: "Badlands",
  mountains: "Montañas",
};

export const DIMENSION_NAMES = {
  overworld: "Superficie",
  nether: "Nether",
  end: "El End",
};

const TREE_DENSITY = {
  plains: 0.12,
  forest: 0.55,
  birch: 0.45,
  taiga: 0.5,
  snowy: 0.14,
  desert: 0,
  savanna: 0.14,
  jungle: 0.6,
  swamp: 0.22,
  badlands: 0,
  mountains: 0.16,
  beach: 0,
  ocean: 0,
};

const TREE_SPECIES = {
  plains: "oak",
  forest: "oak",
  birch: "birch",
  taiga: "spruce",
  snowy: "spruce",
  savanna: "acacia",
  jungle: "jungle",
  swamp: "oak",
  mountains: "spruce",
};

const PLANT_DENSITY = {
  plains: 0.16,
  forest: 0.18,
  birch: 0.16,
  taiga: 0.08,
  snowy: 0.03,
  desert: 0.015,
  savanna: 0.16,
  jungle: 0.3,
  swamp: 0.24,
  badlands: 0.08,
  mountains: 0.1,
  beach: 0.01,
  ocean: 0,
};

export class World {
  constructor(seed, dimension = "overworld") {
    this.seed = seed;
    this.dimension = dimension;
    this.chunks = new Map();
    this.edits = new Map();
    this.editsByChunk = new Map();
  }

  reset(seed, dimension = this.dimension) {
    this.seed = seed;
    this.dimension = dimension;
    this.chunks.clear();
    this.edits.clear();
    this.editsByChunk.clear();
  }

  chunkKey(cx, cz) {
    return cx + "," + cz;
  }

  localIndex(lx, y, lz) {
    return (y * CS + lz) * CS + lx;
  }

  getChunk(cx, cz) {
    return this.chunks.get(this.chunkKey(cx, cz));
  }

  isChunkReadyAt(x, z) {
    const c = this.getChunk(x >> 4, z >> 4);
    return !!c && c.ready;
  }

  ensureChunk(cx, cz) {
    const key = this.chunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = {
        cx,
        cz,
        blocks: new Uint8Array(CS * CS * WORLD_HEIGHT),
        biomes: new Uint8Array(AREA),
        dirty: true,
        ready: false,
        meshes: null,
      };
      this.chunks.set(key, chunk);
      this.generate(chunk);
      chunk.ready = true;
    }
    return chunk;
  }

  getBlock(x, y, z) {
    if (y < 0) return BEDROCK;
    if (y >= WORLD_HEIGHT) return AIR;
    const chunk = this.getChunk(x >> 4, z >> 4);
    if (!chunk || !chunk.ready) return AIR;
    return chunk.blocks[this.localIndex(x & 15, y, z & 15)];
  }

  setBlock(x, y, z, id) {
    if (y < 1 || y >= WORLD_HEIGHT) return;
    const cx = x >> 4;
    const cz = z >> 4;
    const chunk = this.ensureChunk(cx, cz);
    const lx = x & 15;
    const lz = z & 15;
    chunk.blocks[this.localIndex(lx, y, lz)] = id;
    this.recordEdit(cx, cz, lx, y, lz, id);
    chunk.dirty = true;
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === 15) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === 15) this.markDirty(cx, cz + 1);
  }

  markDirty(cx, cz) {
    const chunk = this.getChunk(cx, cz);
    if (chunk) chunk.dirty = true;
  }

  applyEdit(x, y, z, id) {
    if (y < 1 || y >= WORLD_HEIGHT) return;
    const cx = x >> 4;
    const cz = z >> 4;
    this.recordEdit(cx, cz, x & 15, y, z & 15, id);
    const chunk = this.getChunk(cx, cz);
    if (!chunk || !chunk.ready) return;
    chunk.blocks[this.localIndex(x & 15, y, z & 15)] = id;
    chunk.dirty = true;
    if ((x & 15) === 0) this.markDirty(cx - 1, cz);
    if ((x & 15) === 15) this.markDirty(cx + 1, cz);
    if ((z & 15) === 0) this.markDirty(cx, cz - 1);
    if ((z & 15) === 15) this.markDirty(cx, cz + 1);
  }

  stamp(chunk, x, y, z, id) {
    if (y < 1 || y >= WORLD_HEIGHT) return;
    const lx = x - chunk.cx * CS;
    const lz = z - chunk.cz * CS;
    if (lx < 0 || lx >= CS || lz < 0 || lz >= CS) return;
    const idx = this.localIndex(lx, y, lz);
    if (chunk.blocks[idx] === BEDROCK) return;
    chunk.blocks[idx] = id;
  }

  recordEdit(cx, cz, lx, y, lz, id) {
    const key = this.chunkKey(cx, cz);
    let map = this.editsByChunk.get(key);
    if (!map) {
      map = new Map();
      this.editsByChunk.set(key, map);
    }
    const idx = this.localIndex(lx, y, lz);
    map.set(idx, id);
    this.edits.set(`${(cx << 4) + lx},${y},${(cz << 4) + lz}`, id);
  }

  temperatureAt(x, z) {
    return fbm2(x * 0.0028, z * 0.0028, this.seed + 911, 3);
  }

  humidityAt(x, z) {
    return fbm2(x * 0.0033, z * 0.0033, this.seed + 922, 3);
  }

  heightAt(x, z) {
    if (this.dimension === "nether") return 32;
    if (this.dimension === "end") return 44;
    const continent = fbm2(x * 0.0045, z * 0.0045, this.seed, 4);
    const hills = fbm2(x * 0.021, z * 0.021, this.seed + 13, 3);
    let h = SEA_LEVEL + (continent - 0.42) * 48 + (hills - 0.5) * 6;
    if (continent > 0.62) h += (continent - 0.62) * 60;
    h = Math.round(h);
    if (h < 3) h = 3;
    if (h > WORLD_HEIGHT - 8) h = WORLD_HEIGHT - 8;
    return h;
  }

  biomeAt(x, z) {
    if (this.dimension !== "overworld") return this.dimension === "nether" ? "nether" : "end";
    const h = this.heightAt(x, z);
    const t = this.temperatureAt(x, z);
    const w = this.humidityAt(x, z);
    if (h < SEA_LEVEL - 1) return "ocean";
    if (h <= SEA_LEVEL + 1) {
      if (t < 0.3) return "snowy";
      if (w > 0.72 && t > 0.4) return "swamp";
      return "beach";
    }
    if (h > SEA_LEVEL + 26) return "mountains";
    if (t < 0.28) return w > 0.55 ? "taiga" : "snowy";
    if (t < 0.36) return w > 0.5 ? "taiga" : "snowy";
    if (t > 0.68 && w < 0.36) return "desert";
    if (t > 0.58 && w < 0.3) return "badlands";
    if (t > 0.55 && w > 0.68) return "jungle";
    if (t > 0.55 && w < 0.5) return "savanna";
    if (w > 0.72 && h < SEA_LEVEL + 5) return "swamp";
    if (w > 0.58) return "forest";
    if (w > 0.46 && t > 0.36 && t < 0.56) return "birch";
    if (w > 0.5) return "forest";
    return "plains";
  }

  surfaceBlock(biome, h) {
    if (h <= SEA_LEVEL) return SAND;
    switch (biome) {
      case "desert":
      case "beach":
        return SAND;
      case "snowy":
      case "taiga":
        return biome === "snowy" ? GRASS_SNOWY : PODZOL;
      case "badlands":
        return RED_SAND;
      case "mountains":
        return h > SEA_LEVEL + 30 ? STONE : h > SEA_LEVEL + 27 ? SNOW : GRASS;
      default:
        return GRASS;
    }
  }

  generate(chunk) {
    chunk.biomes.fill(BIOMES.plains);
    if (this.dimension === "nether") this.generateNether(chunk);
    else if (this.dimension === "end") this.generateEnd(chunk);
    else this.generateOverworld(chunk);

    const edits = this.editsByChunk.get(this.chunkKey(chunk.cx, chunk.cz));
    if (edits) {
      for (const [idx, id] of edits) {
        chunk.blocks[idx] = id;
      }
    }
  }

  generateOverworld(chunk) {
    const bx0 = chunk.cx * CS;
    const bz0 = chunk.cz * CS;
    const blocks = chunk.blocks;

    for (let lz = 0; lz < CS; lz++) {
      for (let lx = 0; lx < CS; lx++) {
        const wx = bx0 + lx;
        const wz = bz0 + lz;
        const biome = this.biomeAt(wx, wz);
        chunk.biomes[lz * CS + lx] = BIOMES[biome];
        const h = this.heightAt(wx, wz);
        const surface = this.surfaceBlock(biome, h);
        const bandSeed = hash2(wx, wz, this.seed + 4242);
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          let id = AIR;
          if (y === 0) {
            id = BEDROCK;
          } else if (y < h - 3) {
            id = STONE;
          } else if (y < h) {
            if (biome === "desert" && y > h - 5) id = SANDSTONE;
            else if (biome === "badlands" && y > h - 8) {
              const band = Math.floor((h - y) / 2) + Math.floor(bandSeed * 3);
              id = [TERRACOTTA, WHITE_TERRACOTTA, ORANGE_TERRACOTTA, RED_TERRACOTTA][band % 4];
            } else {
              id = surface === SAND && y > h - 2 ? SAND : DIRT;
            }
          } else if (y === h) {
            id = surface;
          } else if (y <= SEA_LEVEL) {
            id = WATER;
            if (y === SEA_LEVEL && biome === "snowy" && h < SEA_LEVEL) id = ICE;
          }
          if (id === STONE && y > 3 && y < h - 2) {
            const cave = fbm3(wx * 0.09, y * 0.13, wz * 0.09, this.seed + 555, 2);
            if (cave > 0.635) id = AIR;
            else if (y < 46 && valueNoise3(wx * 0.16, y * 0.16, wz * 0.16, this.seed + 7777) > 0.86) id = IRON_ORE;
            else if (y < 34 && valueNoise3(wx * 0.19, y * 0.19, wz * 0.19, this.seed + 9999) > 0.875) id = GOLD_ORE;
            else if (y < 18 && valueNoise3(wx * 0.21, y * 0.21, wz * 0.21, this.seed + 8888) > 0.91) id = DIAMOND_ORE;
          }
          if (id !== AIR) blocks[this.localIndex(lx, y, lz)] = id;
        }
      }
    }

    const margin = 3;
    for (let tz = bz0 - margin; tz < bz0 + CS + margin; tz++) {
      for (let tx = bx0 - margin; tx < bx0 + CS + margin; tx++) {
        const tree = this.treeAt(tx, tz);
        if (tree) this.placeTree(chunk, tree);
      }
    }
    this.generateStructures(chunk);
    this.generatePlants(chunk);
  }

  generateNether(chunk) {
    const bx0 = chunk.cx * CS;
    const bz0 = chunk.cz * CS;
    const blocks = chunk.blocks;
    for (let lz = 0; lz < CS; lz++) {
      for (let lx = 0; lx < CS; lx++) {
        const wx = bx0 + lx;
        const wz = bz0 + lz;
        const region = fbm2(wx * 0.012, wz * 0.012, this.seed + 31, 3);
        const floor = 26 + Math.round((region - 0.5) * 10);
        const roofNoise = fbm2(wx * 0.03, wz * 0.03, this.seed + 32, 2);
        const roof = 54 + Math.round((roofNoise - 0.5) * 6);
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          let id = AIR;
          if (y <= 1 || y >= 62) {
            id = BEDROCK;
          } else if (y <= floor) {
            id = NETHERRACK;
            if (y > 3) {
              const cave = fbm3(wx * 0.055, y * 0.09, wz * 0.055, this.seed + 33, 2);
              if (cave > 0.63) id = AIR;
            }
          } else if (y <= 31) {
            id = LAVA;
          } else if (y >= roof) {
            id = NETHERRACK;
          } else {
            const solid = fbm3(wx * 0.05, y * 0.08, wz * 0.05, this.seed + 33, 2);
            if (solid > 0.55) id = NETHERRACK;
          }
          if (id !== AIR) blocks[this.localIndex(lx, y, lz)] = id;
        }
        const col = (wx + wz * 7) | 0;
        if (hash2(col, 5, this.seed + 501) < 0.28) {
          for (let y = roof - 1; y > 33; y--) {
            if (blocks[this.localIndex(lx, y, lz)] === NETHERRACK) {
              blocks[this.localIndex(lx, y - 1, lz)] = GLOWSTONE;
              if (hash2(col, y, this.seed + 502) < 0.5) blocks[this.localIndex(lx, y - 2, lz)] = GLOWSTONE;
              break;
            }
          }
        }
        for (let i = 0; i < 2; i++) {
          if (hash2(col, i, this.seed + 503) < 0.35) {
            const y = floor + 2 + Math.floor(hash2(col, i + 9, this.seed + 504) * (roof - floor - 3));
            const idx = this.localIndex(lx, y, lz);
            if (blocks[idx] === NETHERRACK) blocks[idx] = QUARTZ_ORE;
          }
        }
        if (hash2(col, 7, this.seed + 505) < 0.22) {
          for (let y = Math.min(roof - 1, 40); y > floor; y--) {
            const idx = this.localIndex(lx, y, lz);
            if (blocks[idx] === NETHERRACK) {
              if (blocks[idx - AREA] === AIR || blocks[idx - AREA] === LAVA) {
                const top = this.localIndex(lx, y, lz);
                blocks[top] = SOUL_SAND;
              }
              break;
            }
          }
        }
      }
    }
    this.generateStructures(chunk);
  }

  generateEnd(chunk) {
    const bx0 = chunk.cx * CS;
    const bz0 = chunk.cz * CS;
    const blocks = chunk.blocks;
    for (let lz = 0; lz < CS; lz++) {
      for (let lx = 0; lx < CS; lx++) {
        const wx = bx0 + lx;
        const wz = bz0 + lz;
        const dist = Math.hypot(wx, wz);
        const islandNoise = fbm2(wx * 0.04, wz * 0.04, this.seed + 51, 2);
        const islandRadius = 52 + (islandNoise - 0.5) * 18;
        if (dist < islandRadius) {
          const top = 44 + Math.round((fbm2(wx * 0.06, wz * 0.06, this.seed + 52, 2) - 0.5) * 5);
          const bottom = top - 6 - Math.round(islandNoise * 4);
          for (let y = bottom; y <= top; y++) {
            blocks[this.localIndex(lx, y, lz)] = END_STONE;
          }
          if (hash2(wx, wz, this.seed + 53) < 0.06) blocks[this.localIndex(lx, top, lz)] = PURPUR;
        } else {
          const cell = 40;
          const cX = Math.floor(wx / cell);
          const cZ = Math.floor(wz / cell);
          if (hash2(cX, cZ, this.seed + 77) < 0.32) {
            const ox = cX * cell + hash2(cX, cZ, this.seed + 78) * cell;
            const oz = cZ * cell + hash2(cX, cZ, this.seed + 79) * cell;
            const radius = 6 + hash2(cX, cZ, this.seed + 80) * 9;
            const top = 34 + Math.floor(hash2(cX, cZ, this.seed + 81) * 14);
            const d = Math.hypot(wx - ox, wz - oz);
            if (d < radius) {
              const thickness = Math.round((radius - d) * 0.8);
              for (let y = top - thickness; y <= top; y++) {
                blocks[this.localIndex(lx, y, lz)] = y === top && hash2(wx, wz, this.seed + 82) < 0.12 ? PURPUR : END_STONE;
              }
            }
          }
        }
      }
    }
    this.generateEndPillars(chunk);
    this.generateEndPortal(chunk);
  }

  generateEndPillars(chunk) {
    const bx0 = chunk.cx * CS;
    const bz0 = chunk.cz * CS;
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const px = Math.round(Math.cos(angle) * 40);
      const pz = Math.round(Math.sin(angle) * 40);
      if (px + 2 < bx0 || px - 2 > bx0 + CS - 1 || pz + 2 < bz0 || pz - 2 > bz0 + CS - 1) continue;
      const top = 44 + 8 + Math.floor(hash2(i, 3, this.seed + 91) * 10);
      for (let x = -1; x <= 1; x++) {
        for (let z = -1; z <= 1; z++) {
          for (let y = 41; y <= top; y++) this.stamp(chunk, px + x, y, pz + z, OBSIDIAN);
        }
      }
      for (let x = -1; x <= 1; x++) {
        for (let z = -1; z <= 1; z++) this.stamp(chunk, px + x, top + 1, pz + z, GLOWSTONE);
      }
    }
  }

  generateEndPortal(chunk) {
    const bx0 = chunk.cx * CS;
    const bz0 = chunk.cz * CS;
    if (8 < bx0 || 8 > bx0 + CS - 1 || 8 < bz0 || 8 > bz0 + CS - 1) return;
    const top = 44 + Math.round((fbm2(8 * 0.06, 8 * 0.06, this.seed + 52, 2) - 0.5) * 5) + 1;
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        const edge = Math.abs(x) === 2 || Math.abs(z) === 2;
        this.stamp(chunk, 8 + x, top, 8 + z, edge ? END_PORTAL_FRAME : END_PORTAL);
      }
    }
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        this.stamp(chunk, 8 + x, top - 1, 8 + z, END_STONE);
      }
    }
    this.stamp(chunk, 8, top, 8, END_PORTAL);
  }

  treeAt(x, z) {
    const biome = this.biomeAt(x, z);
    const density = TREE_DENSITY[biome] || 0;
    if (density <= 0) return null;
    const h = this.heightAt(x, z);
    if (h <= SEA_LEVEL + 1 || h >= SEA_LEVEL + 24) return null;
    if (biome === "swamp" && h > SEA_LEVEL + 4) return null;
    const cell = 7;
    const cellX = Math.floor(x / cell);
    const cellZ = Math.floor(z / cell);
    const r = hash2(cellX, cellZ, this.seed + 777);
    if (r > density) return null;
    const ox = 1 + Math.floor(hash2(cellX, cellZ, this.seed + 778) * 5);
    const oz = 1 + Math.floor(hash2(cellX, cellZ, this.seed + 779) * 5);
    if (cellX * cell + ox !== x || cellZ * cell + oz !== z) return null;
    const species = TREE_SPECIES[biome] || "oak";
    const trunk = 4 + Math.floor(hash2(cellX, cellZ, this.seed + 780) * 2) + (species === "jungle" ? 3 : 0);
    return { x, z, h, species, trunk };
  }

  generatePlants(chunk) {
    const bx0 = chunk.cx * CS;
    const bz0 = chunk.cz * CS;
    for (let lz = 0; lz < CS; lz++) {
      for (let lx = 0; lx < CS; lx++) {
        const wx = bx0 + lx;
        const wz = bz0 + lz;
        const biome = this.biomeAt(wx, wz);
        const density = PLANT_DENSITY[biome] || 0;
        if (density <= 0) continue;
        const r = hash2(wx, wz, this.seed + 1234);
        if (r > density) continue;
        const h = this.heightAt(wx, wz);
        if (biome === "desert" || biome === "badlands") {
          if (r < 0.06) {
            const count = 1 + Math.floor(hash2(wx, wz, this.seed + 1235) * 3);
            for (let i = 0; i < count; i++) this.stamp(chunk, wx, h + 1 + i, wz, CACTUS);
          } else if (r < 0.1) {
            this.stamp(chunk, wx, h + 1, wz, DEAD_BUSH);
          }
          continue;
        }
        const surface = this.getLocalBlockAt(chunk, wx, h, wz);
        if (surface !== GRASS && surface !== PODZOL && surface !== GRASS_SNOWY) continue;
        if ((biome === "plains" || biome === "forest") && r < 0.004) {
          this.stamp(chunk, wx, h + 1, wz, PUMPKIN);
          continue;
        }
        const pick = hash2(wx, wz, this.seed + 1236);
        let plant = TALL_GRASS;
        if (pick < 0.08) plant = FLOWER_RED;
        else if (pick < 0.16) plant = FLOWER_YELLOW;
        this.stamp(chunk, wx, h + 1, wz, plant);
      }
    }
  }

  getLocalBlockAt(chunk, x, y, z) {
    const lx = x - chunk.cx * CS;
    const lz = z - chunk.cz * CS;
    if (lx < 0 || lx >= CS || lz < 0 || lz >= CS) return this.getBlock(x, y, z);
    return chunk.blocks[this.localIndex(lx, y, lz)];
  }

  placeTree(chunk, tree) {
    const { x, z, species, trunk } = tree;
    const ground = this.getLocalBlockAt(chunk, x, tree.h, z);
    let base = tree.h + 1;
    if (species === "acacia" && ground === GRASS) {
      this.stampXZ(chunk, x, z, base, ACACIA_LOG);
      this.stampXZ(chunk, x + 1, z, base + 1, ACACIA_LOG);
      this.stampXZ(chunk, x + 1, z, base + 2, ACACIA_LOG);
      this.stampXZ(chunk, x + 2, z, base + 2, ACACIA_LOG);
      const top = base + 2;
      for (let ox = -1; ox <= 3; ox++) {
        for (let oz = -2; oz <= 2; oz++) {
          if (Math.abs(ox) + Math.abs(oz) > 3) continue;
          this.stampLeaves(chunk, x + ox, top + 1, z + oz, ACACIA_LEAVES);
          if (Math.abs(ox - 1) + Math.abs(oz) <= 2) this.stampLeaves(chunk, x + ox, top + 2, z + oz, ACACIA_LEAVES);
        }
      }
      return;
    }
    const logId = species === "spruce" ? SPRUCE_LOG : species === "birch" ? BIRCH_LOG : species === "jungle" ? JUNGLE_LOG : LOG;
    const leafId =
      species === "spruce" ? SPRUCE_LEAVES : species === "birch" ? BIRCH_LEAVES : species === "jungle" ? JUNGLE_LEAVES : LEAVES;
    const height = species === "jungle" ? trunk + 4 : trunk + (species === "spruce" ? 3 : 0);
    for (let y = 0; y < height; y++) {
      this.stampXZ(chunk, x, z, base + y, logId);
    }
    const top = base + height;
    if (species === "spruce") {
      for (let layer = 0; layer < 4; layer++) {
        const radius = layer === 0 ? 1 : layer === 3 ? 0 : 2;
        const y = top + layer;
        for (let ox = -radius; ox <= radius; ox++) {
          for (let oz = -radius; oz <= radius; oz++) {
            if (Math.abs(ox) === 2 && Math.abs(oz) === 2) continue;
            if (radius === 0 && (ox !== 0 || oz !== 0)) continue;
            this.stampLeaves(chunk, x + ox, y, z + oz, leafId);
          }
        }
      }
      this.stampLeaves(chunk, x, top + 4, z, leafId);
    } else {
      for (let oy = -2; oy <= 1; oy++) {
        const radius = oy <= -1 ? 2 : 1;
        for (let ox = -radius; ox <= radius; ox++) {
          for (let oz = -radius; oz <= radius; oz++) {
            if (Math.abs(ox) === radius && Math.abs(oz) === radius && radius > 1) continue;
            if (oy === 1 && Math.abs(ox) + Math.abs(oz) > 1) continue;
            this.stampLeaves(chunk, x + ox, top + oy, z + oz, leafId);
          }
        }
      }
    }
  }

  stampXZ(chunk, x, z, y, id) {
    this.stamp(chunk, x, y, z, id);
  }

  stampLeaves(chunk, x, y, z, id) {
    const lx = x - chunk.cx * CS;
    const lz = z - chunk.cz * CS;
    if (lx < 0 || lx >= CS || lz < 0 || lz >= CS || y < 1 || y >= WORLD_HEIGHT) return;
    const idx = this.localIndex(lx, y, lz);
    if (chunk.blocks[idx] === AIR) chunk.blocks[idx] = id;
  }

  generateStructures(chunk) {
    if (this.dimension !== "overworld" && this.dimension !== "nether") return;
    for (let si = 0; si < STRUCTURES.length; si++) {
      const def = STRUCTURES[si];
      if (def.dimension !== this.dimension) continue;
      const cellBlocks = def.cell * CS;
      const reach = def.radius + 16;
      const minX = chunk.cx * CS;
      const maxX = minX + CS - 1;
      const minZ = chunk.cz * CS;
      const maxZ = minZ + CS - 1;
      const scx0 = Math.floor((minX - reach) / cellBlocks);
      const scx1 = Math.floor((maxX + reach) / cellBlocks);
      const scz0 = Math.floor((minZ - reach) / cellBlocks);
      const scz1 = Math.floor((maxZ + reach) / cellBlocks);
      for (let scx = scx0; scx <= scx1; scx++) {
        for (let scz = scz0; scz <= scz1; scz++) {
          const roll = hash2(scx * 3 + si, scz * 5 - si, this.seed + 6100 + si * 131);
          if (roll > def.chance) continue;
          const ox = scx * cellBlocks + 8 + si * 41;
          const oz = scz * cellBlocks + 8 + si * 53;
          const oy = this.heightAt(ox, oz);
          if (ox - def.radius > maxX || ox + def.radius < minX) continue;
          if (oz - def.radius > maxZ || oz + def.radius < minZ) continue;
          const biome = this.biomeAt(ox, oz);
          if (def.biomes.length > 0 && !def.biomes.includes(biome)) continue;
          if (def.biomes.length === 0 && this.dimension === "overworld" && biome === "ocean") continue;
          if (def.id !== "mineshaft" && def.id !== "dungeon" && def.id !== "stronghold" && oy <= SEA_LEVEL) continue;
          const rng = mulberry32(Math.floor(roll * 1e9) ^ (si * 7919 + 13));
          def.build(this, chunk, ox, oy, oz, rng, biome);
        }
      }
    }
  }

  findStructure(id, maxCells = 40) {
    const si = STRUCTURES.findIndex((d) => d.id === id);
    if (si < 0) return null;
    const def = STRUCTURES[si];
    if (def.dimension !== this.dimension) return null;
    const cellBlocks = def.cell * CS;
    for (let ring = 0; ring <= maxCells; ring++) {
      for (let scx = -ring; scx <= ring; scx++) {
        for (let scz = -ring; scz <= ring; scz++) {
          if (Math.max(Math.abs(scx), Math.abs(scz)) !== ring) continue;
          const roll = hash2(scx * 3 + si, scz * 5 - si, this.seed + 6100 + si * 131);
          if (roll > def.chance) continue;
          const ox = scx * cellBlocks + 8 + si * 41;
          const oz = scz * cellBlocks + 8 + si * 53;
          const oy = this.heightAt(ox, oz);
          if (this.dimension === "overworld" && oy <= SEA_LEVEL) continue;
          const biome = this.biomeAt(ox, oz);
          if (def.biomes.length && !def.biomes.includes(biome)) continue;
          return { x: ox, z: oz, y: oy, biome };
        }
      }
    }
    return null;
  }

  regenerate(chunk, seed, dimension) {
    this.seed = seed;
    this.dimension = dimension;
    chunk.blocks.fill(AIR);
    chunk.biomes.fill(0);
    this.generate(chunk);
  }

  findFloor(x, z, maxY = WORLD_HEIGHT - 2) {
    for (let y = maxY; y > 2; y--) {
      const block = this.getBlock(x, y, z);
      if (isSolid(block) && !isLiquid(block)) {
        const above1 = this.getBlock(x, y + 1, z);
        const above2 = this.getBlock(x, y + 2, z);
        if (!isSolid(above1) && !isSolid(above2)) return y;
      }
    }
    return 1;
  }

  findSpawn() {
    if (this.dimension === "nether") {
      return { x: 8, z: 8, h: this.findFloor(8, 8, 50) };
    }
    if (this.dimension === "end") {
      return { x: 6, z: 8, h: this.findFloor(6, 8, 50) };
    }
    for (let r = 0; r < 12; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = 8 + dx * 8;
          const z = 8 + dz * 8;
          const biome = this.biomeAt(x, z);
          const h = this.heightAt(x, z);
          if (h > SEA_LEVEL + 2 && this.treeAt(x, z) === null && biome !== "ocean") return { x, z, h };
        }
      }
    }
    return { x: 8, z: 8, h: Math.max(SEA_LEVEL + 4, this.heightAt(8, 8)) };
  }

  topSolidAt(x, z, maxY = WORLD_HEIGHT - 1) {
    for (let y = maxY; y > 0; y--) {
      const id = this.getBlock(x, y, z);
      if (id !== AIR && id !== WATER && id !== LAVA) return y;
    }
    return 1;
  }

  serializeEdits() {
    const out = [];
    for (const [key, id] of this.edits) {
      const [x, y, z] = key.split(",");
      out.push([Number(x), Number(y), Number(z), id]);
    }
    return out;
  }

  reapplyEdits() {
    for (const chunk of this.chunks.values()) {
      const edits = this.editsByChunk.get(this.chunkKey(chunk.cx, chunk.cz));
      if (!edits) continue;
      for (const [idx, id] of edits) chunk.blocks[idx] = id;
      chunk.dirty = true;
    }
  }

  loadEdits(list) {
    this.edits.clear();
    this.editsByChunk.clear();
    for (const [x, y, z, id] of list) {
      this.edits.set(`${x},${y},${z}`, id);
      const cx = x >> 4;
      const cz = z >> 4;
      const key = this.chunkKey(cx, cz);
      let map = this.editsByChunk.get(key);
      if (!map) {
        map = new Map();
        this.editsByChunk.set(key, map);
      }
      map.set(this.localIndex(x & 15, y, z & 15), id);
    }
  }

  update(px, pz) {
    const pcx = Math.floor(px / CS);
    const pcz = Math.floor(pz / CS);
    const generate = [];
    const mesh = [];
    const unload = [];
    for (let dz = -RENDER_DISTANCE - 1; dz <= RENDER_DISTANCE + 1; dz++) {
      for (let dx = -RENDER_DISTANCE - 1; dx <= RENDER_DISTANCE + 1; dx++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const chunk = this.getChunk(cx, cz);
        if (dist <= RENDER_DISTANCE + 1 && !chunk) {
          generate.push({ cx, cz, dist });
        } else if (chunk && dist <= RENDER_DISTANCE && chunk.dirty && chunk.ready) {
          mesh.push({ cx, cz, dist });
        }
        if (chunk && dist > RENDER_DISTANCE + 2) {
          unload.push(chunk);
        }
      }
    }
    generate.sort((a, b) => a.dist - b.dist);
    mesh.sort((a, b) => a.dist - b.dist);
    return { generate, mesh, unload };
  }
}
