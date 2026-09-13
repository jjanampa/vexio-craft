import { CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL, RENDER_DISTANCE } from "./config.js";
import { AIR, GRASS, DIRT, STONE, SAND, WATER, LOG, LEAVES, SNOW, BEDROCK } from "./blocks.js";
import { fbm2, fbm3, hash2 } from "./noise.js";

const CS = CHUNK_SIZE;
const AREA = CS * CS;

export class World {
  constructor(seed) {
    this.seed = seed;
    this.chunks = new Map();
    this.edits = new Map();
    this.editsByChunk = new Map();
  }

  reset(seed) {
    this.seed = seed;
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

  heightAt(x, z) {
    const continent = fbm2(x * 0.0045, z * 0.0045, this.seed, 4);
    const hills = fbm2(x * 0.021, z * 0.021, this.seed + 13, 3);
    let h = SEA_LEVEL + (continent - 0.42) * 48 + (hills - 0.5) * 6;
    if (continent > 0.62) h += (continent - 0.62) * 60;
    h = Math.round(h);
    if (h < 3) h = 3;
    if (h > WORLD_HEIGHT - 8) h = WORLD_HEIGHT - 8;
    return h;
  }

  surfaceBlock(h) {
    if (h <= SEA_LEVEL) return SAND;
    if (h >= SEA_LEVEL + 18) return SNOW;
    return GRASS;
  }

  treeAt(x, z) {
    const cellX = Math.floor(x / 7);
    const cellZ = Math.floor(z / 7);
    const r = hash2(cellX, cellZ, this.seed + 777);
    if (r > 0.32) return null;
    const ox = 1 + Math.floor(hash2(cellX, cellZ, this.seed + 778) * 5);
    const oz = 1 + Math.floor(hash2(cellX, cellZ, this.seed + 779) * 5);
    if (cellX * 7 + ox !== x || cellZ * 7 + oz !== z) return null;
    const h = this.heightAt(x, z);
    if (h <= SEA_LEVEL + 1 || h >= SEA_LEVEL + 17) return null;
    return { x, z, h, trunk: 4 + Math.floor(hash2(cellX, cellZ, this.seed + 780) * 2) };
  }

  generate(chunk) {
    const bx0 = chunk.cx * CS;
    const bz0 = chunk.cz * CS;
    const blocks = chunk.blocks;

    for (let lz = 0; lz < CS; lz++) {
      for (let lx = 0; lx < CS; lx++) {
        const wx = bx0 + lx;
        const wz = bz0 + lz;
        const h = this.heightAt(wx, wz);
        const surface = this.surfaceBlock(h);
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          let id = AIR;
          if (y === 0) {
            id = BEDROCK;
          } else if (y < h - 3) {
            id = STONE;
          } else if (y < h) {
            id = surface === SAND && y > h - 2 ? SAND : DIRT;
          } else if (y === h) {
            id = surface;
          } else if (y <= SEA_LEVEL) {
            id = WATER;
          }
          if (id === STONE && y > 3 && y < h - 2) {
            const cave = fbm3(wx * 0.09, y * 0.13, wz * 0.09, this.seed + 555, 2);
            if (cave > 0.635) id = AIR;
          }
          if (id !== AIR) blocks[this.localIndex(lx, y, lz)] = id;
        }
      }
    }

    const margin = 2;
    for (let tz = bz0 - margin; tz < bz0 + CS + margin; tz++) {
      for (let tx = bx0 - margin; tx < bx0 + CS + margin; tx++) {
        const tree = this.treeAt(tx, tz);
        if (!tree) continue;
        const top = tree.h + tree.trunk;
        for (let y = tree.h + 1; y < top; y++) this.setLocal(blocks, chunk, tx, y, tz, LOG);
        for (let oy = -2; oy <= 1; oy++) {
          const radius = oy <= -1 ? 2 : 1;
          for (let ox = -radius; ox <= radius; ox++) {
            for (let oz = -radius; oz <= radius; oz++) {
              if (Math.abs(ox) === radius && Math.abs(oz) === radius && radius > 1) continue;
              if (oy === 1 && Math.abs(ox) + Math.abs(oz) > 1) continue;
              const y = top + oy;
              const existing = this.getLocal(blocks, chunk, tx + ox, y, tz + oz);
              if (existing === AIR || existing === LEAVES) {
                this.setLocal(blocks, chunk, tx + ox, y, tz + oz, LEAVES);
              }
            }
          }
        }
      }
    }

    const edits = this.editsByChunk.get(this.chunkKey(chunk.cx, chunk.cz));
    if (edits) {
      for (const [idx, id] of edits) {
        const y = Math.floor(idx / AREA);
        const rest = idx - y * AREA;
        const lz = Math.floor(rest / CS);
        const lx = rest - lz * CS;
        blocks[this.localIndex(lx, y, lz)] = id;
      }
    }
  }

  getLocal(blocks, chunk, x, y, z) {
    if (y < 0 || y >= WORLD_HEIGHT) return AIR;
    const lx = x - chunk.cx * CS;
    const lz = z - chunk.cz * CS;
    if (lx < 0 || lx >= CS || lz < 0 || lz >= CS) return AIR;
    return blocks[this.localIndex(lx, y, lz)];
  }

  setLocal(blocks, chunk, x, y, z, id) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const lx = x - chunk.cx * CS;
    const lz = z - chunk.cz * CS;
    if (lx < 0 || lx >= CS || lz < 0 || lz >= CS) return;
    blocks[this.localIndex(lx, y, lz)] = id;
  }

  findSpawn() {
    const cx = 0;
    const cz = 0;
    for (let r = 0; r < 12; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = 8 + dx * 8;
          const z = 8 + dz * 8;
          const h = this.heightAt(x, z);
          if (h > SEA_LEVEL + 2 && this.treeAt(x, z) === null) return { x, z, h };
        }
      }
    }
    return { x: 8, z: 8, h: Math.max(SEA_LEVEL + 4, this.heightAt(8, 8)) };
  }

  topSolidAt(x, z) {
    for (let y = WORLD_HEIGHT - 1; y > 0; y--) {
      const id = this.getBlock(x, y, z);
      if (id !== AIR && id !== WATER) return y;
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
