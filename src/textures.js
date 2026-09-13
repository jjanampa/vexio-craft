import { mulberry32 } from "./noise.js";

const TILE = 16;
const PAD = 4;
const CELL = TILE + PAD * 2;
const COLS = 8;
const ROWS = 8;

function fill(ctx, s, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, s, s);
}

function px(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function noiseFill(ctx, rng, s, palette, dark, light, darkChance, lightChance) {
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const r = rng();
      let color = palette[(rng() * palette.length) | 0];
      if (r < darkChance) color = dark;
      else if (r > 1 - lightChance) color = light;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function speckles(ctx, rng, s, count, colors, maxSize = 2) {
  for (let i = 0; i < count; i++) {
    const size = 1 + ((rng() * maxSize) | 0);
    rect(
      ctx,
      (rng() * (s - size)) | 0,
      (rng() * (s - size)) | 0,
      size,
      size,
      colors[(rng() * colors.length) | 0]
    );
  }
}

const PAINTERS = {
  grass_top(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#5dae45", "#55a63d", "#66b74e", "#4f9e37"], "#438c2e", "#79c95c", 0.12, 0.08);
    for (let i = 0; i < 12; i++) {
      rect(ctx, (rng() * s) | 0, (rng() * s) | 0, 1 + ((rng() * 2) | 0), 1, rng() < 0.5 ? "#468f31" : "#6fc052");
    }
    for (let i = 0; i < 5; i++) {
      rect(ctx, (rng() * s) | 0, (rng() * s) | 0, 2, 1, "rgba(0,0,0,0.12)");
    }
  },

  grass_side(ctx, s, rng) {
    PAINTERS.dirt(ctx, s, rng);
    for (let x = 0; x < s; x++) {
      const h = 3 + ((rng() * 3) | 0);
      rect(ctx, x, 0, 1, h, rng() < 0.5 ? "#57a63f" : "#4f9e37");
      rect(ctx, x, 0, 1, 1, "#63b34a");
      if (rng() < 0.7) px(ctx, x, h, "#3f8a2c");
    }
  },

  dirt(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#8a5f3d", "#7f5636", "#946a45", "#755033"], "#664228", "#a0754e", 0.13, 0.1);
    for (let i = 0; i < 9; i++) {
      rect(ctx, (rng() * s) | 0, (rng() * s) | 0, 1 + ((rng() * 2) | 0), 1, "#5e3d25");
    }
    for (let i = 0; i < 6; i++) px(ctx, (rng() * s) | 0, (rng() * s) | 0, "#b08055");
  },

  stone(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#7d7d7d", "#767676", "#858585", "#707070"], "#636363", "#8e8e8e", 0.12, 0.1);
    const rough = [
      [1, 2, 5, 3],
      [9, 1, 4, 4],
      [3, 8, 6, 3],
      [10, 9, 5, 4],
      [0, 12, 4, 3],
      [7, 13, 6, 2],
    ];
    for (const [x, y, w, h] of rough) rect(ctx, x, y, w, h, "rgba(88,88,88,0.45)");
    const smooth = [
      [6, 2, 3, 2],
      [1, 7, 3, 2],
      [11, 3, 3, 3],
      [5, 10, 3, 2],
    ];
    for (const [x, y, w, h] of smooth) rect(ctx, x, y, w, h, "rgba(160,160,160,0.35)");
  },

  cobble(ctx, s, rng) {
    fill(ctx, s, "#4d4d4d");
    const stones = [
      [0, 0, 6, 5],
      [7, 0, 5, 4],
      [13, 0, 3, 6],
      [0, 6, 4, 4],
      [5, 5, 5, 5],
      [11, 5, 5, 5],
      [0, 11, 6, 5],
      [7, 11, 4, 5],
      [12, 11, 4, 5],
    ];
    for (const [x, y, w, h] of stones) {
      const g = 116 + ((rng() * 32) | 0);
      rect(ctx, x, y, w, h, `rgb(${g},${g},${g})`);
      rect(ctx, x, y, w, 1, "rgba(255,255,255,0.22)");
      rect(ctx, x, y, 1, h, "rgba(255,255,255,0.14)");
      rect(ctx, x, y + h - 1, w, 1, "rgba(0,0,0,0.32)");
      rect(ctx, x + w - 1, y, 1, h, "rgba(0,0,0,0.28)");
      for (let i = 0; i < 3; i++) {
        px(
          ctx,
          x + 1 + ((rng() * Math.max(1, w - 2)) | 0),
          y + 1 + ((rng() * Math.max(1, h - 2)) | 0),
          rng() < 0.5 ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.12)"
        );
      }
    }
  },

  sand(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#dbd3a4", "#d5cb9a", "#e3dcb2", "#cec48e"], "#c3b77e", "#efe9c4", 0.1, 0.1);
    for (let y = 2; y < s; y += 5) {
      rect(ctx, 0, y, s, 1, "rgba(180,165,110,0.35)");
      rect(ctx, 0, y + 1, s, 1, "rgba(255,250,215,0.3)");
    }
    speckles(ctx, rng, s, 5, ["#c3b77e", "#efe9c4"], 1);
  },

  water(ctx, s, rng) {
    ctx.clearRect(0, 0, s, s);
    rect(ctx, 0, 0, s, s, "rgba(50,100,215,0.86)");
    for (let y = 0; y < s; y += 4) {
      const off = (rng() * s) | 0;
      rect(ctx, 0, y, s, 1, "rgba(30,75,185,0.45)");
      rect(ctx, 0, y + 2, s, 1, "rgba(120,175,255,0.2)");
      rect(ctx, off, y + 1, 5 + ((rng() * 4) | 0), 1, "rgba(160,205,255,0.28)");
    }
    for (let i = 0; i < 24; i++) {
      rect(
        ctx,
        (rng() * s) | 0,
        (rng() * s) | 0,
        1,
        1,
        rng() < 0.5 ? "rgba(20,55,150,0.35)" : "rgba(150,200,255,0.28)"
      );
    }
  },

  log_side(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#6b4f2c", "#755634", "#624829", "#7c5c38"], "#513a1f", "#8a6a42", 0.12, 0.1);
    for (let x = 0; x < s; x += 3) {
      rect(ctx, x, 0, 1, s, rng() < 0.5 ? "rgba(60,42,22,0.55)" : "rgba(140,105,65,0.35)");
    }
    for (let i = 0; i < 2; i++) {
      const x = 3 + ((rng() * (s - 6)) | 0);
      const y = 4 + ((rng() * (s - 8)) | 0);
      rect(ctx, x, y, 2, 3, "rgba(45,30,14,0.75)");
      rect(ctx, x - 1, y - 1, 4, 1, "rgba(150,115,70,0.5)");
    }
    rect(ctx, 0, 0, 1, s, "rgba(0,0,0,0.22)");
    rect(ctx, s - 1, 0, 1, s, "rgba(0,0,0,0.22)");
  },

  log_top(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#a8834e", "#a17c49", "#af8a55"], "#9a7645", "#b58f5a", 0.1, 0.1);
    const rings = [
      [1, "rgba(112,84,46,0.85)"],
      [3, "rgba(168,132,82,0.85)"],
      [5, "rgba(112,84,46,0.8)"],
      [7, "rgba(170,134,84,0.7)"],
    ];
    for (const [inset, color] of rings) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(inset + 0.5, inset + 0.5, s - inset * 2 - 1, s - inset * 2 - 1);
    }
    rect(ctx, 7, 7, 2, 2, "#6b502e");
    ctx.strokeStyle = "rgba(70,50,25,0.85)";
    ctx.strokeRect(0.5, 0.5, s - 1, s - 1);
  },

  leaves(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#3a7a26", "#336f21", "#428430", "#2d651c"], "#245415", "#4f9639", 0.18, 0.12);
    for (let i = 0; i < 8; i++) {
      ctx.clearRect((rng() * s) | 0, (rng() * s) | 0, 2, 2);
    }
    for (let i = 0; i < 18; i++) {
      ctx.clearRect((rng() * s) | 0, (rng() * s) | 0, 1, 1);
    }
    for (let i = 0; i < 10; i++) {
      rect(ctx, (rng() * s) | 0, (rng() * s) | 0, 2, 1, "#1e4a10");
    }
  },

  planks(ctx, s, rng) {
    const rowH = 4;
    const shades = ["#a07f4c", "#967545", "#a98652", "#8f7041"];
    for (let row = 0; row < s / rowH; row++) {
      const y = row * rowH;
      rect(ctx, 0, y, s, rowH, shades[row % shades.length]);
      for (let i = 0; i < 7; i++) {
        rect(
          ctx,
          (rng() * s) | 0,
          y + ((rng() * rowH) | 0),
          2 + ((rng() * 4) | 0),
          1,
          rng() < 0.5 ? "rgba(110,80,42,0.5)" : "rgba(205,170,115,0.45)"
        );
      }
      rect(ctx, 0, y + rowH - 1, s, 1, "rgba(70,48,22,0.85)");
      const joint = ((row % 2) * 7 + 3) % s;
      rect(ctx, joint, y, 1, rowH - 1, "rgba(70,48,22,0.8)");
    }
    rect(ctx, 0, 0, s, 1, "rgba(0,0,0,0.22)");
  },

  glass(ctx, s) {
    ctx.clearRect(0, 0, s, s);
    rect(ctx, 0, 0, s, s, "rgba(200,235,255,0.1)");
    ctx.strokeStyle = "rgba(225,245,255,0.9)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, s - 1, s - 1);
    for (let i = 0; i < 4; i++) px(ctx, 3 + i, 5 - i, "rgba(255,255,255,0.7)");
    for (let i = 0; i < 5; i++) px(ctx, 8 + i, 13 - i, "rgba(255,255,255,0.35)");
    rect(ctx, 1, s - 2, s - 2, 1, "rgba(180,220,245,0.5)");
  },

  brick(ctx, s, rng) {
    fill(ctx, s, "#9a8b7a");
    const rowH = 4;
    for (let row = 0; row < s / rowH; row++) {
      const y = row * rowH;
      const offset = row % 2 === 0 ? 0 : 4;
      for (let x = -8; x < s; x += 8) {
        const bx = x + offset;
        const g = 145 + ((rng() * 30) | 0);
        const color = `rgb(${g + 20},${(68 + rng() * 14) | 0},${(54 + rng() * 12) | 0})`;
        rect(ctx, bx + 1, y, 6, rowH - 1, color);
        rect(ctx, bx + 1, y, 6, 1, "rgba(255,255,255,0.14)");
        rect(ctx, bx + 1, y + rowH - 2, 6, 1, "rgba(0,0,0,0.2)");
      }
    }
    speckles(ctx, rng, s, 5, ["#b09a86", "#d9c8b6"], 1);
  },

  snow(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#f4f7fb", "#eef2f8", "#f8fbff", "#e8eef6"], "#dde5f0", "#ffffff", 0.1, 0.12);
    for (let i = 0; i < 8; i++) {
      rect(ctx, (rng() * s) | 0, (rng() * s) | 0, 2, 1, "rgba(200,215,240,0.45)");
    }
    for (let i = 0; i < 8; i++) px(ctx, (rng() * s) | 0, (rng() * s) | 0, "#ffffff");
  },

  bedrock(ctx, s, rng) {
    fill(ctx, s, "#565656");
    const blotches = [
      [0, 0, 6, 5],
      [7, 0, 5, 3],
      [13, 1, 3, 6],
      [1, 6, 5, 5],
      [7, 5, 6, 6],
      [0, 12, 7, 4],
      [8, 12, 8, 4],
      [13, 8, 3, 4],
    ];
    for (const [x, y, w, h] of blotches) {
      const g = 44 + ((rng() * 60) | 0);
      rect(ctx, x, y, w, h, `rgb(${g},${g},${g})`);
      rect(ctx, x, y, w, 1, "rgba(255,255,255,0.08)");
      rect(ctx, x, y + h - 1, w, 1, "rgba(0,0,0,0.3)");
    }
    for (let i = 0; i < 22; i++) {
      rect(
        ctx,
        (rng() * s) | 0,
        (rng() * s) | 0,
        1 + ((rng() * 2) | 0),
        1 + ((rng() * 2) | 0),
        rng() < 0.5 ? "rgba(0,0,0,0.35)" : "rgba(120,120,120,0.3)"
      );
    }
  },
};

const TILE_NAMES = Object.keys(PAINTERS);

function padTile(ctx, canvas, x, y) {
  ctx.drawImage(canvas, x, y, TILE, 1, x, y - PAD, TILE, PAD);
  ctx.drawImage(canvas, x, y + TILE - 1, TILE, 1, x, y + TILE, TILE, PAD);
  ctx.drawImage(canvas, x, y, 1, TILE, x - PAD, y, PAD, TILE);
  ctx.drawImage(canvas, x + TILE - 1, y, 1, TILE, x + TILE, y, PAD, TILE);
  ctx.drawImage(canvas, x, y, 1, 1, x - PAD, y - PAD, PAD, PAD);
  ctx.drawImage(canvas, x + TILE - 1, y, 1, 1, x + TILE, y - PAD, PAD, PAD);
  ctx.drawImage(canvas, x, y + TILE - 1, 1, 1, x - PAD, y + TILE, PAD, PAD);
  ctx.drawImage(canvas, x + TILE - 1, y + TILE - 1, 1, 1, x + TILE, y + TILE, PAD, PAD);
}

export function createAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = COLS * CELL;
  canvas.height = ROWS * CELL;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const uvs = {};
  TILE_NAMES.forEach((name, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * CELL + PAD;
    const y = row * CELL + PAD;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.rect(0, 0, TILE, TILE);
    ctx.clip();
    PAINTERS[name](ctx, TILE, mulberry32(9173 + i * 7919));
    ctx.restore();
    padTile(ctx, canvas, x, y);
    const w = canvas.width;
    const h = canvas.height;
    uvs[name] = {
      u0: (x + 0.5) / w,
      v0: 1 - (y + TILE - 0.5) / h,
      u1: (x + TILE - 0.5) / w,
      v1: 1 - (y + 0.5) / h,
    };
  });
  return { canvas, uvs, tile: TILE, cell: CELL, cols: COLS };
}

export function createCrackStrip() {
  const stages = 10;
  const canvas = document.createElement("canvas");
  canvas.width = stages * TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  for (let stage = 0; stage < stages; stage++) {
    const rng = mulberry32(555 + stage * 131);
    ctx.save();
    ctx.translate(stage * TILE, 0);
    ctx.beginPath();
    ctx.rect(0, 0, TILE, TILE);
    ctx.clip();
    const paths = 1 + stage;
    for (let p = 0; p < paths; p++) {
      let x = 2 + ((rng() * (TILE - 4)) | 0);
      let y = 2 + ((rng() * (TILE - 4)) | 0);
      let dir = rng() * Math.PI * 2;
      const segments = 4 + Math.floor((stage / 9) * 16) + ((rng() * 6) | 0);
      ctx.fillStyle = `rgba(20,16,12,${0.35 + (stage / 9) * 0.4})`;
      for (let i = 0; i < segments; i++) {
        dir += (rng() - 0.5) * 1.1;
        const len = 1 + ((rng() * 3) | 0);
        for (let j = 0; j < len; j++) {
          x = Math.max(0, Math.min(TILE - 1, x + Math.cos(dir)));
          y = Math.max(0, Math.min(TILE - 1, y + Math.sin(dir)));
          ctx.fillRect(x | 0, y | 0, 1, 1);
        }
        if (rng() < 0.35 && stage > 2) {
          const bx = x | 0;
          const by = y | 0;
          ctx.fillRect(bx + ((rng() * 3) | 0) - 1, by + ((rng() * 3) | 0) - 1, 1, 1);
        }
      }
    }
    ctx.restore();
  }
  return canvas;
}

export function averageTileColors(atlas) {
  const { canvas, uvs } = atlas;
  const ctx = canvas.getContext("2d");
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const out = {};
  for (const [name, uv] of Object.entries(uvs)) {
    const x0 = Math.max(0, Math.floor(uv.u0 * canvas.width));
    const x1 = Math.min(canvas.width, Math.ceil(uv.u1 * canvas.width));
    const y0 = Math.max(0, Math.floor((1 - uv.v1) * canvas.height));
    const y1 = Math.min(canvas.height, Math.ceil((1 - uv.v0) * canvas.height));
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * canvas.width + x) * 4;
        if (data[i + 3] > 24) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }
      }
    }
    out[name] = n ? [r / n / 255, g / n / 255, b / n / 255] : [1, 1, 1];
  }
  return out;
}

export function drawTileIcon(atlas, tileName, size) {
  const uv = atlas.uvs[tileName];
  if (!uv) return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const w = atlas.canvas.width;
  const h = atlas.canvas.height;
  const sx = uv.u0 * w;
  const sy = (1 - uv.v1) * h;
  const sw = (uv.u1 - uv.u0) * w;
  const sh = (uv.v1 - uv.v0) * h;
  ctx.drawImage(atlas.canvas, sx, sy, sw, sh, 0, 0, size, size);
  return canvas;
}
