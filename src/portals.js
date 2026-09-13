import { AIR, OBSIDIAN, NETHER_PORTAL, LAVA, WATER, BLOCKS, isSolid } from "./blocks.js";

const FRAME_W = 4;
const FRAME_H = 5;

function matchesFrame(world, x, y, z, axis) {
  const dx = axis === "x" ? 1 : 0;
  const dz = axis === "z" ? 1 : 0;
  for (let i = 0; i < FRAME_W; i++) {
    for (let j = 0; j < FRAME_H; j++) {
      const bx = x + dx * i;
      const bz = z + dz * i;
      const by = y + j;
      const id = world.getBlock(bx, by, bz);
      const edge = i === 0 || i === FRAME_W - 1 || j === 0 || j === FRAME_H - 1;
      if (edge) {
        if (id !== OBSIDIAN) return false;
      } else if (id !== AIR && id !== NETHER_PORTAL) {
        return false;
      }
    }
  }
  return true;
}

export function tryIgnitePortal(world, cx, cy, cz, range = 4) {
  for (const axis of ["x", "z"]) {
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        for (let dz = -range; dz <= range; dz++) {
          const x = cx + dx;
          const y = cy + dy;
          const z = cz + dz;
          if (!matchesFrame(world, x, y, z, axis)) continue;
          const changed = [];
          const ix = axis === "x" ? 1 : 0;
          const iz = axis === "z" ? 1 : 0;
          for (let i = 1; i < FRAME_W - 1; i++) {
            for (let j = 1; j < FRAME_H - 1; j++) {
              const bx = x + ix * i;
              const bz = z + iz * i;
              const by = y + j;
              if (world.getBlock(bx, by, bz) === AIR) {
                world.setBlock(bx, by, bz, NETHER_PORTAL);
                changed.push([bx, by, bz, NETHER_PORTAL]);
              }
            }
          }
          return changed;
        }
      }
    }
  }
  return null;
}

function clearArea(world, x0, y0, z0, w, h, d) {
  const cleared = [];
  for (let y = y0; y < y0 + h; y++) {
    for (let z = z0; z < z0 + d; z++) {
      for (let x = x0; x < x0 + w; x++) {
        const id = world.getBlock(x, y, z);
        if (id !== AIR) {
          world.setBlock(x, y, z, AIR);
          cleared.push([x, y, z, AIR]);
        }
      }
    }
  }
  return cleared;
}

export function buildPortal(world, x, y, z, axis = "x") {
  const dx = axis === "x" ? 1 : 0;
  const dz = axis === "z" ? 1 : 0;
  const placed = [];
  const set = (bx, by, bz, id) => {
    world.setBlock(bx, by, bz, id);
    placed.push([bx, by, bz, id]);
  };
  for (let i = 0; i < FRAME_W; i++) {
    for (let j = 0; j < FRAME_H; j++) {
      const edge = i === 0 || i === FRAME_W - 1 || j === 0 || j === FRAME_H - 1;
      if (edge) set(x + dx * i, y + j, z + dz * i, OBSIDIAN);
    }
  }
  const ix = axis === "x" ? 1 : 0;
  const iz = axis === "z" ? 1 : 0;
  for (let i = 1; i < FRAME_W - 1; i++) {
    for (let j = 1; j < FRAME_H - 1; j++) {
      set(x + ix * i, y + j, z + iz * i, NETHER_PORTAL);
    }
  }
  return {
    pos: { x: x + ix + 0.5, y: y + 1, z: z + iz + 0.5 },
    placed,
  };
}

function scanColumn(world, x, z, yMin, yMax) {
  for (let y = yMax; y >= yMin; y--) {
    const id = world.getBlock(x, y, z);
    if (isSolid(id) && id !== LAVA && id !== WATER) {
      const a1 = world.getBlock(x, y + 1, z);
      const a2 = world.getBlock(x, y + 2, z);
      const a3 = world.getBlock(x, y + 3, z);
      if ((a1 === AIR || a1 === NETHER_PORTAL) && (a2 === AIR || a2 === NETHER_PORTAL) && (a3 === AIR || a3 === NETHER_PORTAL)) {
        return y + 1;
      }
    }
  }
  return null;
}

export function findNearestPortal(world, x, z, yMin, yMax, radius = 12) {
  for (let r = 0; r <= radius; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        for (let y = yMax; y >= yMin; y--) {
          if (world.getBlock(x + dx, y, z + dz) === NETHER_PORTAL) {
            return { x: x + dx + 0.5, y, z: z + dz + 0.5 };
          }
        }
      }
    }
  }
  return null;
}

export function ensurePortal(world, x, z, kind) {
  const yMin = kind === "nether" ? 34 : 20;
  const yMax = kind === "nether" ? 50 : 62;
  const found = findNearestPortal(world, x, z, yMin, yMax, 12);
  if (found) return { pos: found, placed: [] };

  let y = scanColumn(world, x, z, yMin, yMax);
  const placed = [];
  if (y === null) {
    y = kind === "nether" ? 40 : 48;
    placed.push(...clearArea(world, x - 2, y, z - 1, 6, 6, 4));
  } else {
    placed.push(...clearArea(world, x - 1, y, z, 4, 5, 2));
  }
  const portal = buildPortal(world, x - 2, y, z, "x");
  placed.push(...portal.placed);
  return { pos: { x: x - 0.5, y: portal.pos.y, z: portal.pos.z }, placed };
}

export function isPortal(id) {
  return !!BLOCKS[id]?.portal;
}
