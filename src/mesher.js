import * as THREE from "three";
import { CHUNK_SIZE, WORLD_HEIGHT } from "./config.js";
import { AIR, BLOCKS, BEDROCK, faceTile, isOpaqueBlock } from "./blocks.js";

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

export function buildChunkGeometry(world, chunk, uvs) {
  const groups = {
    opaque: makeBuffers(),
    alpha: makeBuffers(),
    water: makeBuffers(),
  };
  const bx0 = chunk.cx * CS;
  const bz0 = chunk.cz * CS;
  const blocks = chunk.blocks;

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let lz = 0; lz < CS; lz++) {
      for (let lx = 0; lx < CS; lx++) {
        const id = blocks[(y * CS + lz) * CS + lx];
        if (id === AIR) continue;
        const def = BLOCKS[id];
        if (!def) continue;
        const buffers = def.liquid ? groups.water : def.opaque ? groups.opaque : groups.alpha;
        const wx = bx0 + lx;
        const wz = bz0 + lz;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nx = wx + face.n[0];
          const ny = y + face.n[1];
          const nz = wz + face.n[2];
          const other = ny < 0 ? BEDROCK : ny >= WORLD_HEIGHT ? AIR : world.getBlock(nx, ny, nz);
          if (!faceVisible(id, other)) continue;

          const tile = faceTile(id, f);
          const rect = uvs[tile];
          if (!rect) continue;
          const baseIndex = buffers.positions.length / 3;
          const isWater = !!def.liquid;

          for (let v = 0; v < 4; v++) {
            const vert = face.verts[v];
            buffers.positions.push(wx + vert[0], y + vert[1], wz + vert[2]);
            buffers.normals.push(face.n[0], face.n[1], face.n[2]);
            let brightness = face.shade;
            if (!isWater) brightness *= vertexAO(world, wx, y, wz, face, vert);
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
