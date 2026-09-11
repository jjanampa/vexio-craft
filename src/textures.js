import { mulberry32 } from "./noise.js";

const TILE = 16;
const COLS = 8;
const ROWS = 8;

function fill(ctx, s, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, s, s);
}

function speckle(ctx, rng, s, amount, dark, light) {
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const r = rng();
      if (r < amount * 0.5) {
        ctx.fillStyle = dark;
        ctx.fillRect(x, y, 1, 1);
      } else if (r > 1 - amount * 0.5) {
        ctx.fillStyle = light;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

const PAINTERS = {
  grass_top(ctx, s, rng) {
    fill(ctx, s, "#5cab2e");
    speckle(ctx, rng, s, 0.5, "#4c9426", "#6fc23c");
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = rng() < 0.5 ? "#3f7d1e" : "#79cc45";
      ctx.fillRect((rng() * s) | 0, (rng() * s) | 0, 1, 1);
    }
  },

  grass_side(ctx, s, rng) {
    fill(ctx, s, "#8b5a2b");
    speckle(ctx, rng, s, 0.45, "#7a4c22", "#9c6836");
    const top = 4;
    for (let x = 0; x < s; x++) {
      const h = top + ((rng() * 3) | 0);
      ctx.fillStyle = "#5cab2e";
      ctx.fillRect(x, 0, 1, h);
      ctx.fillStyle = rng() < 0.5 ? "#4c9426" : "#6fc23c";
      ctx.fillRect(x, h - 1, 1, 1);
    }
  },

  dirt(ctx, s, rng) {
    fill(ctx, s, "#8b5a2b");
    speckle(ctx, rng, s, 0.55, "#744a22", "#a06a35");
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = "#6b421e";
      ctx.fillRect((rng() * s) | 0, (rng() * s) | 0, 1, 1);
    }
  },

  stone(ctx, s, rng) {
    fill(ctx, s, "#8d8d8d");
    speckle(ctx, rng, s, 0.5, "#7c7c7c", "#9e9e9e");
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = rng() < 0.5 ? "#757575" : "#a8a8a8";
      ctx.fillRect((rng() * s) | 0, (rng() * s) | 0, 2, 1);
    }
  },

  cobble(ctx, s, rng) {
    fill(ctx, s, "#5f5f5f");
    const cells = [
      [0, 0, 7, 4],
      [8, 0, 8, 6],
      [0, 5, 4, 5],
      [5, 5, 5, 4],
      [11, 7, 5, 4],
      [0, 11, 6, 5],
      [7, 10, 4, 6],
      [12, 12, 4, 4],
    ];
    for (const [x, y, w, h] of cells) {
      const shade = 110 + ((rng() * 45) | 0);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(x, y, w, 1);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(x, y + h - 1, w, 1);
    }
    speckle(ctx, rng, s, 0.25, "#6b6b6b", "#b5b5b5");
  },

  sand(ctx, s, rng) {
    fill(ctx, s, "#e3d9a6");
    speckle(ctx, rng, s, 0.5, "#d4c78f", "#f0e8bd");
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = "#c9bb80";
      ctx.fillRect((rng() * s) | 0, (rng() * s) | 0, 2, 1);
    }
  },

  water(ctx, s, rng) {
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = "rgba(42,104,214,0.78)";
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 4) {
      const off = (rng() * s) | 0;
      ctx.fillStyle = "rgba(120,180,255,0.28)";
      ctx.fillRect(off, y + 1, 6, 1);
      ctx.fillRect((off + 9) % s, y + 3, 4, 1);
    }
    speckle(ctx, rng, s, 0.18, "rgba(24,70,160,0.5)", "rgba(150,200,255,0.4)");
  },

  log_side(ctx, s, rng) {
    fill(ctx, s, "#6e4b2a");
    for (let x = 0; x < s; x += 2) {
      ctx.fillStyle = rng() < 0.5 ? "#5a3b20" : "#7c5730";
      ctx.fillRect(x, 0, 1, s);
    }
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = "#4d321b";
      ctx.fillRect((rng() * s) | 0, (rng() * s) | 0, 1, 3);
    }
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(0, 0, 1, s);
    ctx.fillRect(s - 1, 0, 1, s);
  },

  log_top(ctx, s, rng) {
    fill(ctx, s, "#b08a54");
    const cx = s / 2 - 0.5;
    for (let r = 6; r >= 1; r -= 2) {
      ctx.strokeStyle = r % 4 === 0 ? "#8f6c3e" : "#9c7847";
      ctx.beginPath();
      ctx.arc(cx, cx, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#7a5a33";
    ctx.fillRect(cx, cx, 1, 1);
    speckle(ctx, rng, s, 0.2, "#a07c4a", "#c09a63");
  },

  leaves(ctx, s, rng) {
    fill(ctx, s, "#3e8b2f");
    speckle(ctx, rng, s, 0.6, "#2e6b24", "#54a83c");
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        if (rng() < 0.16) ctx.clearRect(x, y, 1, 1);
      }
    }
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = "#246019";
      ctx.fillRect((rng() * s) | 0, (rng() * s) | 0, 1, 1);
    }
  },

  planks(ctx, s, rng) {
    fill(ctx, s, "#b98a4f");
    speckle(ctx, rng, s, 0.35, "#a87a42", "#c99a5e");
    for (let y = 3; y < s; y += 4) {
      ctx.fillStyle = "#8a6136";
      ctx.fillRect(0, y, s, 1);
    }
    for (let row = 0; row < 4; row++) {
      const x = ((rng() * s) | 0) % s;
      ctx.fillStyle = "#8a6136";
      ctx.fillRect(x, row * 4, 1, 3);
    }
  },

  glass(ctx, s) {
    ctx.clearRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(225,245,255,0.95)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, s - 1, s - 1);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(2, 2, 1, 5);
    ctx.fillRect(3, 2, 1, 3);
    ctx.fillRect(s - 4, s - 6, 1, 4);
    ctx.fillStyle = "rgba(180,220,245,0.35)";
    ctx.fillRect(2, s - 3, s - 4, 1);
  },

  brick(ctx, s, rng) {
    fill(ctx, s, "#c9b7a6");
    const rowH = 4;
    for (let row = 0; row < 4; row++) {
      const y = row * rowH;
      const offset = row % 2 === 0 ? 0 : 4;
      for (let x = -8; x < s; x += 8) {
        const bx = x + offset;
        const shade = 150 + ((rng() * 30) | 0);
        ctx.fillStyle = `rgb(${shade + 20},${shade * 0.45 + 20},${shade * 0.35})`;
        ctx.fillRect(bx + 1, y + 1, 6, rowH - 2);
      }
    }
    speckle(ctx, rng, s, 0.18, "#9b8977", "#e0d0bd");
  },

  snow(ctx, s, rng) {
    fill(ctx, s, "#f2f6ff");
    speckle(ctx, rng, s, 0.35, "#dde6f5", "#ffffff");
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = "#d3dff2";
      ctx.fillRect((rng() * s) | 0, (rng() * s) | 0, 2, 1);
    }
  },

  bedrock(ctx, s, rng) {
    fill(ctx, s, "#4c4c4c");
    for (let i = 0; i < 14; i++) {
      const shade = 40 + ((rng() * 55) | 0);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      const w = 2 + ((rng() * 5) | 0);
      const h = 2 + ((rng() * 5) | 0);
      ctx.fillRect((rng() * s) | 0, (rng() * s) | 0, w, h);
    }
    speckle(ctx, rng, s, 0.3, "#333333", "#6b6b6b");
  },
};

export function createAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const uvs = {};
  const names = Object.keys(PAINTERS);
  names.forEach((name, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    ctx.save();
    ctx.translate(col * TILE, row * TILE);
    ctx.beginPath();
    ctx.rect(0, 0, TILE, TILE);
    ctx.clip();
    PAINTERS[name](ctx, TILE, mulberry32(9173 + i * 7919));
    ctx.restore();
    uvs[name] = {
      u0: col / COLS,
      v0: 1 - (row + 1) / ROWS,
      u1: (col + 1) / COLS,
      v1: 1 - row / ROWS,
    };
  });
  return { canvas, uvs, tile: TILE, cols: COLS };
}

export function drawTileIcon(atlas, tileName, size) {
  const uv = atlas.uvs[tileName];
  if (!uv) return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const sx = Math.round(uv.u0 * atlas.canvas.width);
  const sy = Math.round((1 - uv.v1) * atlas.canvas.height);
  ctx.drawImage(atlas.canvas, sx, sy, atlas.tile, atlas.tile, 0, 0, size, size);
  return canvas;
}
