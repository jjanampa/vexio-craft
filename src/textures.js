import { mulberry32 } from "./noise.js";

const TILE = 32;
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

function pebbles(ctx, rng, s, count, colors) {
  for (let i = 0; i < count; i++) {
    const size = 2 + ((rng() * 4) | 0);
    ctx.fillStyle = colors[(rng() * colors.length) | 0];
    ctx.fillRect((rng() * (s - size)) | 0, (rng() * (s - size)) | 0, size, size);
  }
}

const PAINTERS = {
  grass_top(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#4f9e28", "#57a92d", "#5fb233", "#4a9524", "#62b838"], "#3c7d1c", "#74ca46", 0.1, 0.08);
    for (let i = 0; i < 26; i++) {
      const x = (rng() * s) | 0;
      const y = 2 + ((rng() * (s - 6)) | 0);
      const h = 2 + ((rng() * 4) | 0);
      ctx.fillStyle = rng() < 0.5 ? "#74ca46" : "#3f8a1f";
      ctx.fillRect(x, y, 1, h);
    }
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect((rng() * s) | 0, (rng() * s) | 0, 3, 2);
    }
  },

  grass_side(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#8b5a2b", "#946034", "#815228", "#9c6836"], "#6b421e", "#a8753f", 0.12, 0.12);
    pebbles(ctx, rng, s, 8, ["#744a22", "#a06a35", "#6b421e"]);
    const base = 8;
    for (let x = 0; x < s; x++) {
      const h = base + ((rng() * 5) | 0);
      ctx.fillStyle = "#57a92d";
      ctx.fillRect(x, 0, 1, h);
      ctx.fillStyle = rng() < 0.5 ? "#4a9524" : "#62b838";
      ctx.fillRect(x, 0, 1, 2);
      if (rng() < 0.35) {
        ctx.fillStyle = "#4a9524";
        ctx.fillRect(x, h, 1, 1 + ((rng() * 2) | 0));
      }
    }
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(0, base + 5, s, 1);
  },

  dirt(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#8b5a2b", "#946034", "#815228", "#9c6836"], "#6b421e", "#a8753f", 0.14, 0.12);
    pebbles(ctx, rng, s, 12, ["#744a22", "#a06a35", "#6b421e", "#b07f4a"]);
    for (let i = 0; i < 14; i++) px(ctx, (rng() * s) | 0, (rng() * s) | 0, "#5e3a1a");
  },

  stone(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#8d8d8d", "#949494", "#858585", "#9b9b9b"], "#757575", "#a8a8a8", 0.12, 0.1);
    for (let i = 0; i < 3; i++) {
      let x = (rng() * s) | 0;
      let y = (rng() * s) | 0;
      ctx.fillStyle = "rgba(60,60,60,0.55)";
      for (let j = 0; j < 10; j++) {
        ctx.fillRect(x, y, 2, 1);
        x += 1 + ((rng() * 3) | 0);
        y += (rng() * 3) | 0;
        if (x >= s - 1 || y >= s - 1) break;
      }
    }
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = "#b5b5b5";
      ctx.fillRect((rng() * s) | 0, (rng() * s) | 0, 2, 1);
    }
  },

  cobble(ctx, s, rng) {
    fill(ctx, s, "#4f4f4f");
    const stones = [
      [1, 1, 13, 9],
      [15, 0, 16, 11],
      [0, 11, 9, 10],
      [10, 12, 11, 8],
      [22, 12, 9, 9],
      [0, 22, 8, 9],
      [9, 21, 9, 11],
      [19, 22, 12, 9],
      [26, 2, 6, 9],
    ];
    for (const [x, y, w, h] of stones) {
      const shade = 110 + ((rng() * 45) | 0);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(x, y, w, 1);
      ctx.fillRect(x, y, 1, h);
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(x, y + h - 1, w, 1);
      ctx.fillRect(x + w - 1, y, 1, h);
      for (let i = 0; i < 6; i++) {
        const c = rng() < 0.5 ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)";
        ctx.fillStyle = c;
        ctx.fillRect(x + 1 + ((rng() * (w - 2)) | 0), y + 1 + ((rng() * (h - 2)) | 0), 2, 2);
      }
    }
  },

  sand(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#e3d9a6", "#ded29a", "#e9e0b2", "#d8ca8e"], "#c9bb80", "#f2ecc4", 0.1, 0.1);
    for (let y = 2; y < s; y += 7) {
      ctx.fillStyle = "rgba(180,160,105,0.28)";
      ctx.fillRect(0, y, s, 1);
      ctx.fillStyle = "rgba(255,250,215,0.35)";
      ctx.fillRect(0, y + 1, s, 1);
    }
    pebbles(ctx, rng, s, 6, ["#c9bb80", "#f2ecc4"]);
  },

  water(ctx, s, rng) {
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = "rgba(38,102,214,0.78)";
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 8) {
      const off = (rng() * s) | 0;
      ctx.fillStyle = "rgba(120,185,255,0.22)";
      ctx.fillRect(0, y + 2, s, 2);
      ctx.fillStyle = "rgba(180,220,255,0.16)";
      ctx.fillRect(off, y + 1, 10, 1);
      ctx.fillRect((off + 17) % s, y + 5, 7, 1);
    }
    speckleWater(ctx, rng, s);
    function speckleWater(c, r, size) {
      for (let i = 0; i < 60; i++) {
        c.fillStyle = r() < 0.5 ? "rgba(20,60,150,0.35)" : "rgba(160,210,255,0.3)";
        c.fillRect((r() * size) | 0, (r() * size) | 0, 2, 1);
      }
    }
  },

  log_side(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#6e4b2a", "#77522f", "#654427", "#7c5730"], "#553a1f", "#8a6136", 0.12, 0.1);
    for (let x = 0; x < s; x += 3) {
      ctx.fillStyle = rng() < 0.5 ? "rgba(70,45,22,0.55)" : "rgba(140,100,60,0.4)";
      ctx.fillRect(x, 0, 1, s);
    }
    for (let i = 0; i < 3; i++) {
      const cx = 4 + ((rng() * (s - 8)) | 0);
      const cy = 6 + ((rng() * (s - 12)) | 0);
      ctx.fillStyle = "rgba(50,30,14,0.7)";
      ctx.fillRect(cx, cy, 3, 5);
      ctx.fillStyle = "rgba(150,110,70,0.5)";
      ctx.fillRect(cx - 1, cy - 1, 5, 1);
    }
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, 0, 2, s);
    ctx.fillRect(s - 2, 0, 2, s);
  },

  log_top(ctx, s, rng) {
    fill(ctx, s, "#b08a54");
    const cx = s / 2 - 0.5;
    for (let r = 13; r >= 2; r -= 3) {
      ctx.strokeStyle = r % 2 === 0 ? "rgba(120,90,50,0.75)" : "rgba(160,125,80,0.75)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx + (rng() - 0.5), cx + (rng() - 0.5), r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#7a5a33";
    ctx.fillRect(cx - 1, cx - 1, 3, 3);
    ctx.strokeStyle = "rgba(80,55,28,0.8)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, s - 2, s - 2);
    noiseFill(ctx, rng, s, ["#b08a54"], "#a07c4a", "#c09a63", 0.08, 0.08);
  },

  leaves(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#3e8b2f", "#459a34", "#377c29", "#4da33a"], "#2a6520", "#5cb446", 0.16, 0.12);
    for (let i = 0; i < 26; i++) {
      const x = (rng() * s) | 0;
      const y = (rng() * s) | 0;
      ctx.clearRect(x, y, 2, 2);
    }
    for (let i = 0; i < 40; i++) {
      ctx.clearRect((rng() * s) | 0, (rng() * s) | 0, 1, 1);
    }
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = "#246019";
      ctx.fillRect((rng() * s) | 0, (rng() * s) | 0, 2, 1);
    }
  },

  planks(ctx, s, rng) {
    const rows = 4;
    const h = s / rows;
    for (let r = 0; r < rows; r++) {
      const shades = ["#b98a4f", "#ae7f46", "#c19257", "#a97a42"];
      fill(ctx, s, shades[r % shades.length]);
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(0, r * h, s, h);
      for (let i = 0; i < 26; i++) {
        const y = r * h + 1 + ((rng() * (h - 2)) | 0);
        const x = (rng() * s) | 0;
        const w = 3 + ((rng() * 10) | 0);
        ctx.fillStyle = rng() < 0.5 ? "rgba(120,85,45,0.5)" : "rgba(210,170,115,0.45)";
        ctx.fillRect(x, y, w, 1);
      }
      ctx.fillStyle = "rgba(70,45,20,0.85)";
      ctx.fillRect(0, r * h + h - 1, s, 1);
      const joint = 4 + ((rng() * (s - 8)) | 0);
      ctx.fillRect(joint, r * h, 1, h - 1);
    }
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 0, s, 1);
  },

  glass(ctx, s) {
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = "rgba(200,235,255,0.10)";
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(225,245,255,0.95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, s - 2, s - 2);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.moveTo(5, 16);
    ctx.lineTo(14, 4);
    ctx.lineTo(17, 4);
    ctx.lineTo(6, 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.moveTo(10, 26);
    ctx.lineTo(24, 8);
    ctx.lineTo(26, 11);
    ctx.lineTo(12, 28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(180,220,245,0.5)";
    ctx.fillRect(2, s - 4, s - 4, 2);
  },

  brick(ctx, s, rng) {
    fill(ctx, s, "#c9b7a6");
    const rowH = 8;
    for (let row = 0; row < 4; row++) {
      const y = row * rowH;
      const offset = row % 2 === 0 ? 0 : 8;
      for (let x = -16; x < s; x += 16) {
        const bx = x + offset;
        const r = 150 + ((rng() * 35) | 0);
        ctx.fillStyle = `rgb(${r + 25},${(r * 0.42) | 0},${(r * 0.32) | 0})`;
        ctx.fillRect(bx + 1, y + 1, 14, rowH - 2);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(bx + 1, y + 1, 14, 1);
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(bx + 1, y + rowH - 2, 14, 1);
      }
    }
    pebbles(ctx, rng, s, 6, ["#b09a86", "#d9c8b6"]);
  },

  snow(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#f2f6ff", "#e9effb", "#f8fbff", "#e3ebf9"], "#d3dff2", "#ffffff", 0.1, 0.12);
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = "rgba(190,210,240,0.4)";
      ctx.fillRect((rng() * s) | 0, (rng() * s) | 0, 3, 1);
    }
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect((rng() * s) | 0, (rng() * s) | 0, 1, 1);
    }
  },

  bedrock(ctx, s, rng) {
    fill(ctx, s, "#3f3f3f");
    const chunks = [
      [1, 1, 12, 10],
      [14, 0, 10, 8],
      [25, 2, 6, 12],
      [0, 13, 9, 9],
      [10, 10, 12, 12],
      [23, 15, 8, 10],
      [2, 24, 12, 7],
      [15, 24, 9, 8],
      [25, 26, 6, 6],
    ];
    for (const [x, y, w, h] of chunks) {
      const shade = 40 + ((rng() * 55) | 0);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x, y, w, 1);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(x, y + h - 1, w, 1);
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = rng() < 0.5 ? "rgba(0,0,0,0.35)" : "rgba(120,120,120,0.3)";
      ctx.fillRect((rng() * s) | 0, (rng() * s) | 0, 2, 2);
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
      let x = 4 + ((rng() * (TILE - 8)) | 0);
      let y = 4 + ((rng() * (TILE - 8)) | 0);
      let dir = rng() * Math.PI * 2;
      const segments = 4 + Math.floor((stage / 9) * 16) + ((rng() * 6) | 0);
      ctx.fillStyle = `rgba(20,16,12,${0.35 + (stage / 9) * 0.4})`;
      for (let i = 0; i < segments; i++) {
        dir += (rng() - 0.5) * 1.1;
        const len = 2 + ((rng() * 3) | 0);
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
