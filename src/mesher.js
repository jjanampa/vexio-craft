import * as THREE from "three";
import { CHUNK_SIZE, WORLD_HEIGHT } from "./config.js";
import { AIR, BLOCKS, BEDROCK, faceTile, isOpaqueBlock } from "./blocks.js";
import { BIOME_LIST } from "./world.js";
import { hash2 } from "./noise.js";

const CS = CHUNK_SIZE;

const FACES = [
  { n: [1, 0, 0], axis: 0, verts: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.8 },
  { n: [-1, 0, 0], axis: 0, verts: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.8 },
  { n: [0, 1, 0], axis: 1, verts: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0 },
  { n: [0, -1, 0], axis: 1, verts: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.5 },
  { n: [0, 0, 1], axis: 2, verts: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.68 },
  { n: [0, 0, -1], axis: 2, verts: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.68 },
];

const UV_CORNERS = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

const AO_LEVELS = [0.46, 0.68, 0.85, 1.0];
const TOP_GRID = CS + 2;

function buildTopMap(world, bx0, bz0) {
  const map = new Int16Array(TOP_GRID * TOP_GRID);
  for (let dz = -1; dz <= CS; dz++) {
    for (let dx = -1; dx <= CS; dx++) {
      const wx = bx0 + dx;
      const wz = bz0 + dz;
      let top = 0;
      for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
        const id = world.getBlock(wx, y, wz);
        if (isOpaqueBlock(id)) {
          top = y;
          break;
        }
      }
      map[(dz + 1) * TOP_GRID + (dx + 1)] = top;
    }
  }
  return map;
}

function skyShade(topMap, bx0, bz0, x, y, z) {
  const dx = Math.floor(x) - bx0 + 1;
  const dz = Math.floor(z) - bz0 + 1;
  if (dx < 0 || dx >= TOP_GRID || dz < 0 || dz >= TOP_GRID) return 1;
  const depth = topMap[dz * TOP_GRID + dx] - y;
  if (depth <= 1) return 1;
  return Math.max(0.52, 1 - (depth - 1) * 0.06);
}

function faceVisible(self, other) {
  if (other === AIR) return true;
  const def = BLOCKS[other];
  if (!def) return true;
  if (def.opaque) return false;
  if (def.liquid && BLOCKS[self].liquid) return false;
  if (other === self) return false;
  return true;
}

function vertexAO(world, wx, y, wz, face, vert) {
  const axis = face.axis;
  const t1 = (axis + 1) % 3;
  const t2 = (axis + 2) % 3;
  const base = [wx + face.n[0], y + face.n[1], wz + face.n[2]];
  const c1 = vert[t1] === 1 ? 1 : -1;
  const c2 = vert[t2] === 1 ? 1 : -1;
  const p1 = base.slice();
  p1[t1] += c1;
  const p2 = base.slice();
  p2[t2] += c2;
  const p3 = base.slice();
  p3[t1] += c1;
  p3[t2] += c2;
  const s1 = isOpaqueBlock(world.getBlock(p1[0], p1[1], p1[2])) ? 1 : 0;
  const s2 = isOpaqueBlock(world.getBlock(p2[0], p2[1], p2[2])) ? 1 : 0;
  const sc = isOpaqueBlock(world.getBlock(p3[0], p3[1], p3[2])) ? 1 : 0;
  if (s1 && s2) return AO_LEVELS[0];
  return AO_LEVELS[3 - (s1 + s2 + sc)];
}

function makeBuffers() {
  return { positions: [], normals: [], colors: [], uvs: [], indices: [] };
}

function finish(buffers) {
  if (buffers.indices.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(buffers.normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(buffers.colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(buffers.uvs, 2));
  geometry.setIndex(buffers.indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function pushPlant(world, chunk, buffers, uvs, rect, topMap, wx, y, wz) {
  const shade = skyShade(topMap, chunk.cx * CS, chunk.cz * CS, wx + 0.5, y + 0.5, wz + 0.5);
  const tint = 0.94 + hash2(wx * 7 + 13, wz * 7 + 29, 8891) * 0.08;
  const brightness = shade * tint;
  const quads = [
    [
      [wx + 0.06, y, wz + 0.06],
      [wx + 0.94, y, wz + 0.94],
      [wx + 0.94, y + 1, wz + 0.94],
      [wx + 0.06, y + 1, wz + 0.06],
    ],
    [
      [wx + 0.94, y, wz + 0.06],
      [wx + 0.06, y, wz + 0.94],
      [wx + 0.06, y + 1, wz + 0.94],
      [wx + 0.94, y + 1, wz + 0.06],
    ],
  ];
  for (const quad of quads) {
    const baseIndex = buffers.positions.length / 3;
    for (const [x, yy, z] of quad) {
      buffers.positions.push(x, yy, z);
      buffers.normals.push(0, 1, 0);
      buffers.colors.push(brightness, brightness, brightness);
    }
    buffers.uvs.push(rect.u0, rect.v0, rect.u1, rect.v0, rect.u1, rect.v1, rect.u0, rect.v1);
    buffers.indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);
  }
}

export function buildChunkGeometry(world, chunk, uvs) {
  const groups = {
    opaque: makeBuffers(),
    alpha: makeBuffers(),
    water: makeBuffers(),
    lava: makeBuffers(),
    portal: makeBuffers(),
  };
  const bx0 = chunk.cx * CS;
  const bz0 = chunk.cz * CS;
  const blocks = chunk.blocks;
  const topMap = buildTopMap(world, bx0, bz0);

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let lz = 0; lz < CS; lz++) {
      for (let lx = 0; lx < CS; lx++) {
        const id = blocks[(y * CS + lz) * CS + lx];
        if (id === AIR) continue;
        const def = BLOCKS[id];
        if (!def) continue;
        const wx = bx0 + lx;
        const wz = bz0 + lz;
        const biome = BIOME_LIST[chunk.biomes[lz * CS + lx]] || "plains";
        if (def.plant) {
          const plantRect = uvs[faceTile(id, 2, biome)];
          if (plantRect) pushPlant(world, chunk, groups.alpha, uvs, plantRect, topMap, wx, y, wz);
          continue;
        }
        const buffers = def.liquid
          ? def.lava
            ? groups.lava
            : groups.water
          : def.portal
            ? groups.portal
            : def.opaque
              ? groups.opaque
              : groups.alpha;
        const waterTop =
          def.liquid && (y + 1 >= WORLD_HEIGHT || world.getBlock(wx, y + 1, wz) !== id) ? 0.875 : 1;
        const tint = def.liquid ? 1 : 0.94 + hash2(wx * 7 + 13, wz * 7 + 29, 8891) * 0.08;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nx = wx + face.n[0];
          const ny = y + face.n[1];
          const nz = wz + face.n[2];
          const other = ny < 0 ? BEDROCK : ny >= WORLD_HEIGHT ? AIR : world.getBlock(nx, ny, nz);
          if (!faceVisible(id, other)) continue;

          const tile = faceTile(id, f, biome);
          const rect = uvs[tile];
          if (!rect) continue;
          const baseIndex = buffers.positions.length / 3;
          const isWater = !!def.liquid;

          for (let v = 0; v < 4; v++) {
            const vert = face.verts[v];
            const vy = vert[1] === 1 ? waterTop : 0;
            buffers.positions.push(wx + vert[0], y + vy, wz + vert[2]);
            buffers.normals.push(face.n[0], face.n[1], face.n[2]);
            let brightness = face.shade * tint;
            if (!isWater) brightness *= vertexAO(world, wx, y, wz, face, vert);
            brightness *= skyShade(topMap, bx0, bz0, wx + vert[0], y + vy, wz + vert[2]);
            buffers.colors.push(brightness, brightness, brightness);
            const uc = UV_CORNERS[v];
            const u = uc[0] === 0 ? rect.u0 : rect.u1;
            const vv = uc[1] === 0 ? rect.v0 : rect.v1;
            buffers.uvs.push(u, vv);
          }

          buffers.indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);
        }
      }
    }
  }

  return {
    opaque: finish(groups.opaque),
    alpha: finish(groups.alpha),
    water: finish(groups.water),
    lava: finish(groups.lava),
    portal: finish(groups.portal),
  };
}

export function disposeChunkMeshes(chunk, scene) {
  if (!chunk.meshes) return;
  for (const mesh of chunk.meshes) {
    scene.remove(mesh);
    mesh.geometry.dispose();
  }
  chunk.meshes = null;
}
