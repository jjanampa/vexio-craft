import { mulberry32 } from "./noise.js";

const TILE = 16;
const PAD = 4;
const CELL = TILE + PAD * 2;
const COLS = 8;
const ROWS = 14;

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

function logSidePainter(ctx, s, rng, palette, dark, light) {
  noiseFill(ctx, rng, s, palette, dark, light, 0.12, 0.1);
  for (let x = 0; x < s; x += 3) {
    rect(ctx, x, 0, 1, s, rng() < 0.5 ? "rgba(40,28,14,0.45)" : "rgba(160,125,80,0.3)");
  }
  for (let i = 0; i < 2; i++) {
    const x = 3 + ((rng() * (s - 6)) | 0);
    const y = 4 + ((rng() * (s - 8)) | 0);
    rect(ctx, x, y, 2, 3, "rgba(35,22,10,0.7)");
  }
  rect(ctx, 0, 0, 1, s, "rgba(0,0,0,0.2)");
  rect(ctx, s - 1, 0, 1, s, "rgba(0,0,0,0.2)");
}

function logTopPainter(ctx, s, rng, base, palette, dark, light, ring1, ring2, knot) {
  noiseFill(ctx, rng, s, palette, dark, light, 0.1, 0.1);
  const rings = [
    [1, ring1],
    [3, ring2],
    [5, ring1],
    [7, ring2],
  ];
  for (const [inset, color] of rings) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(inset + 0.5, inset + 0.5, s - inset * 2 - 1, s - inset * 2 - 1);
  }
  rect(ctx, 7, 7, 2, 2, knot);
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.strokeRect(0.5, 0.5, s - 1, s - 1);
}

function leavesPainter(ctx, s, rng, palette, dark, light, holes) {
  noiseFill(ctx, rng, s, palette, dark, light, 0.18, 0.12);
  for (let i = 0; i < holes; i++) ctx.clearRect((rng() * s) | 0, (rng() * s) | 0, 2, 2);
  for (let i = 0; i < holes * 2; i++) ctx.clearRect((rng() * s) | 0, (rng() * s) | 0, 1, 1);
  for (let i = 0; i < 8; i++) rect(ctx, (rng() * s) | 0, (rng() * s) | 0, 2, 1, dark);
}

function planksPainter(ctx, s, rng, shades, line, grainDark, grainLight) {
  const rowH = 4;
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
        rng() < 0.5 ? grainDark : grainLight
      );
    }
    rect(ctx, 0, y + rowH - 1, s, 1, line);
    const joint = ((row % 2) * 7 + 3) % s;
    rect(ctx, joint, y, 1, rowH - 1, line);
  }
  rect(ctx, 0, 0, s, 1, "rgba(0,0,0,0.22)");
}

const WOODS = {
  spruce: {
    bark: ["#5c4526", "#4f3b20", "#684e2b", "#573f23"],
    barkDark: "#3f2f19",
    barkLight: "#7a5c34",
    top: "#8a6a3c",
    topPalette: ["#8a6a3c", "#7e5f35", "#967444"],
    topDark: "#6b4f2c",
    topLight: "#a07c4a",
    leaves: ["#2f5233", "#294a2d", "#365c3a", "#244227"],
    leavesDark: "#1c351f",
    leavesLight: "#42694a",
    planks: ["#6b5130", "#614829", "#755a36", "#5b4325"],
    planksLine: "#3f2f19",
  },
  birch: {
    bark: ["#d7d2c6", "#cfc9bd", "#e0dbd0", "#c5bfb2"],
    barkDark: "#a8a294",
    barkLight: "#efeadf",
    top: "#b09a6a",
    topPalette: ["#b09a6a", "#a58f60", "#bba575", "#9c8658"],
    topDark: "#8f7a4e",
    topLight: "#c4ae7c",
    leaves: ["#5d8f45", "#54853d", "#679a4e", "#4b7a35"],
    leavesDark: "#3f6b2c",
    leavesLight: "#78ab5c",
    planks: ["#c9bf9e", "#bfb493", "#d3c9a8", "#b5aa8a"],
    planksLine: "#8f8468",
  },
  jungle: {
    bark: ["#55421f", "#4a391a", "#604b24", "#513f1d"],
    barkDark: "#3a2c13",
    barkLight: "#6e5629",
    top: "#a08454",
    topPalette: ["#a08454", "#957a4c", "#ab8f5c", "#8b7145"],
    topDark: "#7a6238",
    topLight: "#b3976a",
    leaves: ["#2f6b1f", "#295f1b", "#377a26", "#235416"],
    leavesDark: "#1c4510",
    leavesLight: "#479a32",
    planks: ["#9a7444", "#8f6a3d", "#a68050", "#855f34"],
    planksLine: "#5c4322",
  },
  acacia: {
    bark: ["#6b4a2c", "#5f4026", "#77532f", "#664527"],
    barkDark: "#4a3019",
    barkLight: "#8a6338",
    top: "#a55d33",
    topPalette: ["#a55d33", "#9a552d", "#b0653a", "#8f4d28"],
    topDark: "#7a3f20",
    topLight: "#bd7042",
    leaves: ["#4f7a26", "#46701f", "#588530", "#3f651b"],
    leavesDark: "#345414",
    leavesLight: "#6a9c3e",
    planks: ["#a3602f", "#985829", "#ad6a35", "#8d5024"],
    planksLine: "#6b3d1a",
  },
};

for (const [name, wood] of Object.entries(WOODS)) {
  PAINTERS[`${name}_log_side`] = (ctx, s, rng) =>
    logSidePainter(ctx, s, rng, wood.bark, wood.barkDark, wood.barkLight);
  PAINTERS[`${name}_log_top`] = (ctx, s, rng) =>
    logTopPainter(
      ctx,
      s,
      rng,
      wood.top,
      wood.topPalette,
      wood.topDark,
      wood.topLight,
      wood.topDark,
      wood.topLight,
      wood.topDark
    );
  PAINTERS[`${name}_leaves`] = (ctx, s, rng) =>
    leavesPainter(ctx, s, rng, wood.leaves, wood.leavesDark, wood.leavesLight, 8);
  PAINTERS[`${name}_planks`] = (ctx, s, rng) =>
    planksPainter(ctx, s, rng, wood.planks, wood.planksLine, "rgba(60,40,20,0.5)", "rgba(220,190,140,0.4)");
}

function plantBase(ctx, s) {
  ctx.clearRect(0, 0, s, s);
}

Object.assign(PAINTERS, {
  tall_grass(ctx, s, rng) {
    plantBase(ctx, s);
    for (let i = 0; i < 10; i++) {
      const x = 1 + ((rng() * (s - 2)) | 0);
      const h = 5 + ((rng() * 8) | 0);
      const bend = rng() < 0.4 ? 1 : 0;
      const color = ["#4f9e37", "#5fae45", "#438c2e", "#6bbb52"][(rng() * 4) | 0];
      for (let j = 0; j < h; j++) {
        const px = Math.min(s - 1, x + (j > h * 0.6 ? bend : 0));
        px_(ctx, px, s - 1 - j, color);
      }
    }
  },
  flower_red(ctx, s, rng) {
    plantBase(ctx, s);
    stem(ctx, s, rng, "#3f7a2c", 6);
    rect(ctx, 6, 2, 4, 4, "#c0392b");
    rect(ctx, 7, 1, 2, 1, "#e74c3c");
    rect(ctx, 5, 3, 1, 2, "#e74c3c");
    rect(ctx, 10, 3, 1, 2, "#8e2a20");
    rect(ctx, 7, 3, 2, 2, "#5a1a12");
  },
  flower_yellow(ctx, s, rng) {
    plantBase(ctx, s);
    stem(ctx, s, rng, "#3f7a2c", 7);
    rect(ctx, 6, 2, 4, 4, "#d9b62b");
    rect(ctx, 7, 1, 2, 1, "#f0d34a");
    rect(ctx, 5, 3, 1, 2, "#f0d34a");
    rect(ctx, 10, 3, 1, 2, "#a8861a");
    rect(ctx, 7, 3, 2, 2, "#7a5f10");
  },
  dead_bush(ctx, s, rng) {
    plantBase(ctx, s);
    for (let i = 0; i < 9; i++) {
      let x = 3 + ((rng() * (s - 6)) | 0);
      let y = s - 2;
      const h = 4 + ((rng() * 8) | 0);
      const color = rng() < 0.5 ? "#6b4a1f" : "#7d5a28";
      for (let j = 0; j < h; j++) {
        px_(ctx, x, y, color);
        if (rng() < 0.35) x += rng() < 0.5 ? -1 : 1;
        y--;
        if (y < 2) break;
      }
    }
  },
  cactus_side(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#48752c", "#426d28", "#4e7d31", "#3d6624"], "#33561d", "#5b8f3a", 0.1, 0.08);
    rect(ctx, 0, 0, 1, s, "#2f4f1a");
    rect(ctx, s - 1, 0, 1, s, "#2f4f1a");
    for (let x = 3; x < s; x += 5) {
      rect(ctx, x, 0, 1, s, "rgba(30,60,18,0.55)");
    }
    for (let i = 0; i < 14; i++) {
      px_(ctx, (rng() * s) | 0, (rng() * s) | 0, "#d8e6b0");
    }
  },
  cactus_top(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#5b8f3a", "#548534", "#639a41"], "#447028", "#6fac49", 0.1, 0.1);
    ctx.strokeStyle = "rgba(40,70,24,0.7)";
    ctx.lineWidth = 1;
    ctx.strokeRect(1.5, 1.5, s - 3, s - 3);
    rect(ctx, 6, 6, 4, 4, "#3f6b26");
  },
  podzol_top(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#7a5a2a", "#6f5124", "#856430", "#63481f"], "#543c18", "#967440", 0.13, 0.1);
    for (let i = 0; i < 10; i++) {
      rect(ctx, (rng() * s) | 0, (rng() * s) | 0, 1 + ((rng() * 2) | 0), 1, "#4e6b28");
    }
  },
  podzol_side(ctx, s, rng) {
    PAINTERS.dirt(ctx, s, rng);
    for (let x = 0; x < s; x++) {
      const h = 3 + ((rng() * 3) | 0);
      rect(ctx, x, 0, 1, h, rng() < 0.5 ? "#7a5a2a" : "#6f5124");
      rect(ctx, x, 0, 1, 1, "#856430");
    }
  },
  coarse_dirt(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#7d5636", "#735031", "#88603e", "#69492c"], "#5c3d24", "#946a45", 0.15, 0.1);
    speckles(ctx, rng, s, 16, ["#5e3d25", "#b08055", "#6b4a2e"], 2);
  },
  red_sand(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#c67b45", "#bd7140", "#d18a52", "#b56739"], "#a35c31", "#dd9761", 0.1, 0.1);
    for (let y = 2; y < s; y += 5) {
      rect(ctx, 0, y, s, 1, "rgba(140,75,40,0.35)");
      rect(ctx, 0, y + 1, s, 1, "rgba(240,180,130,0.25)");
    }
  },
  sandstone_top(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#e3d9a6", "#ded29a", "#e9e0b2", "#d8ca8e"], "#c9bb80", "#f2ecc4", 0.1, 0.1);
  },
  sandstone_side(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#e0d6a2", "#dbcf96", "#e6ddac", "#d5c88a"], "#c6b87c", "#efe8bd", 0.08, 0.08);
    rectangleBands(ctx, s, "#c2b478", "#f0e9c0");
  },
  red_sandstone_top(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#c67b45", "#bd7140", "#d18a52", "#b56739"], "#a35c31", "#dd9761", 0.1, 0.1);
  },
  red_sandstone_side(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#c17543", "#bd7140", "#c9804a", "#b56739"], "#a35c31", "#d18a52", 0.08, 0.08);
    rectangleBands(ctx, s, "#9c552c", "#dd9761");
  },
  terracotta(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#985e43", "#905841", "#a06649", "#8a533d"], "#7a4834", "#ac7154", 0.12, 0.1);
  },
  white_terracotta(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#d5c2b0", "#cdbaa8", "#ddcbb9", "#c5b2a0"], "#b8a494", "#e6d6c6", 0.12, 0.1);
  },
  orange_terracotta(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#c96b3a", "#c06433", "#d27641", "#b85e2e"], "#a35427", "#de854f", 0.12, 0.1);
  },
  red_terracotta(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#8f3d2a", "#873824", "#9a442f", "#7f3320"], "#6e2c1b", "#a95138", 0.12, 0.1);
  },
  mossy_cobble(ctx, s, rng) {
    PAINTERS.cobble(ctx, s, rng);
    for (let i = 0; i < 22; i++) {
      rect(
        ctx,
        (rng() * s) | 0,
        (rng() * s) | 0,
        1 + ((rng() * 2) | 0),
        1 + ((rng() * 2) | 0),
        rng() < 0.6 ? "rgba(70,110,45,0.65)" : "rgba(90,135,60,0.55)"
      );
    }
  },
  stone_bricks(ctx, s, rng) {
    fill(ctx, s, "#5f5f5f");
    const rows = 4;
    const rowH = 4;
    for (let row = 0; row < rows; row++) {
      const y = row * rowH;
      const offset = row % 2 === 0 ? 0 : 4;
      for (let x = -8; x < s; x += 8) {
        const bx = x + offset;
        const g = 118 + ((rng() * 22) | 0);
        rect(ctx, bx + 1, y, 7, rowH - 1, `rgb(${g},${g},${g})`);
        rect(ctx, bx + 1, y, 7, 1, "rgba(255,255,255,0.14)");
        rect(ctx, bx + 1, y + rowH - 2, 7, 1, "rgba(0,0,0,0.22)");
      }
    }
  },
  snow_side(ctx, s, rng) {
    PAINTERS.dirt(ctx, s, rng);
    for (let x = 0; x < s; x++) {
      const h = 3 + ((rng() * 3) | 0);
      rect(ctx, x, 0, 1, h, rng() < 0.5 ? "#f4f7fb" : "#e8eef6");
      rect(ctx, x, 0, 1, 1, "#ffffff");
      if (rng() < 0.6) px_(ctx, x, h, "#d3dff2");
    }
  },
  netherrack(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#6b1f1f", "#611b1b", "#752424", "#571717"], "#4a1212", "#8a2e2e", 0.14, 0.1);
    for (let i = 0; i < 12; i++) {
      rect(ctx, (rng() * s) | 0, (rng() * s) | 0, 1 + ((rng() * 2) | 0), 1, "#3f0f0f");
    }
  },
  soul_sand(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#4a3b2f", "#44352a", "#514034", "#3d2f25"], "#33281f", "#5c4a3a", 0.14, 0.1);
    for (let i = 0; i < 7; i++) {
      const x = (rng() * (s - 3)) | 0;
      const y = (rng() * (s - 3)) | 0;
      rect(ctx, x, y, 3, 3, "#2b211a");
      rect(ctx, x, y, 3, 1, "#3d2f25");
    }
  },
  glowstone(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#a08040", "#96773a", "#aa8a47", "#8c6d34"], "#7a5e2c", "#bb9a52", 0.15, 0.12);
    for (let i = 0; i < 26; i++) {
      const x = (rng() * s) | 0;
      const y = (rng() * s) | 0;
      rect(ctx, x, y, 1 + ((rng() * 2) | 0), 1 + ((rng() * 2) | 0), rng() < 0.6 ? "#ffdd66" : "#e8bb4a");
    }
  },
  nether_bricks(ctx, s, rng) {
    fill(ctx, s, "#2b1010");
    const rowH = 4;
    for (let row = 0; row < s / rowH; row++) {
      const y = row * rowH;
      const offset = row % 2 === 0 ? 0 : 4;
      for (let x = -8; x < s; x += 8) {
        const bx = x + offset;
        const g = 50 + ((rng() * 20) | 0);
        rect(ctx, bx + 1, y, 6, rowH - 1, `rgb(${g + 20},${(g * 0.45) | 0},${(g * 0.45) | 0})`);
        rect(ctx, bx + 1, y, 6, 1, "rgba(255,120,120,0.12)");
        rect(ctx, bx + 1, y + rowH - 2, 6, 1, "rgba(0,0,0,0.3)");
      }
    }
  },
  lava(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#d44a10", "#c9430e", "#e05414", "#b93c0c"], "#9e320a", "#f06a1a", 0.13, 0.12);
    for (let i = 0; i < 14; i++) {
      const x = (rng() * (s - 2)) | 0;
      const y = (rng() * (s - 2)) | 0;
      rect(ctx, x, y, 2, 2, rng() < 0.5 ? "#ffdd44" : "#f08a1a");
    }
    for (let i = 0; i < 8; i++) {
      rect(ctx, (rng() * s) | 0, (rng() * s) | 0, 2, 1, "#7a2508");
    }
  },
  obsidian(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#100a1a", "#0c0714", "#151020", "#0a0611"], "#07040d", "#1d1430", 0.15, 0.1);
    for (let i = 0; i < 14; i++) {
      rect(
        ctx,
        (rng() * s) | 0,
        (rng() * s) | 0,
        1,
        1 + ((rng() * 2) | 0),
        rng() < 0.5 ? "rgba(90,60,160,0.5)" : "rgba(50,30,90,0.6)"
      );
    }
  },
  nether_portal(ctx, s, rng) {
    ctx.clearRect(0, 0, s, s);
    rect(ctx, 0, 0, s, s, "rgba(122,48,192,0.88)");
    for (let i = 0; i < 26; i++) {
      const x = (rng() * s) | 0;
      const y = (rng() * s) | 0;
      rect(ctx, x, y, 1 + ((rng() * 2) | 0), 1, rng() < 0.5 ? "rgba(190,120,240,0.8)" : "rgba(80,20,140,0.8)");
    }
    for (let y = 0; y < s; y += 4) {
      rect(ctx, 0, y, s, 1, "rgba(170,90,230,0.35)");
    }
  },
  quartz_ore(ctx, s, rng) {
    PAINTERS.netherrack(ctx, s, rng);
    for (let i = 0; i < 6; i++) {
      const x = 1 + ((rng() * (s - 4)) | 0);
      const y = 1 + ((rng() * (s - 4)) | 0);
      rect(ctx, x, y, 2, 2, "#e8e4dc");
      rect(ctx, x, y, 2, 1, "#ffffff");
      px_(ctx, x, y + 2, "#b8b4ac");
    }
  },
  end_stone(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#dbdba0", "#d4d499", "#e2e2a8", "#cbcb90"], "#bdbd84", "#eeeeb8", 0.12, 0.1);
    for (let i = 0; i < 10; i++) {
      rect(ctx, (rng() * s) | 0, (rng() * s) | 0, 1 + ((rng() * 2) | 0), 1 + ((rng() * 2) | 0), "rgba(150,150,100,0.4)");
    }
  },
  purpur(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#a678b0", "#9d70a8", "#b080ba", "#946899"], "#855a8f", "#bd8cc7", 0.12, 0.1);
    for (let i = 0; i < 8; i++) {
      const x = (rng() * (s - 4)) | 0;
      const y = (rng() * (s - 4)) | 0;
      rect(ctx, x, y, 4, 1, "rgba(60,30,70,0.35)");
      rect(ctx, x, y + 1, 1, 3, "rgba(60,30,70,0.25)");
    }
  },
  end_portal_frame_top(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#2f6b5a", "#2a6152", "#357362", "#265a4b"], "#1f4c40", "#3f806e", 0.12, 0.1);
    rect(ctx, 5, 5, 6, 6, "#12332b");
    rect(ctx, 6, 6, 4, 4, "#0a1f1a");
    rect(ctx, 7, 7, 2, 2, "#4fae8f");
  },
  end_portal_frame_side(ctx, s, rng) {
    noiseFill(ctx, rng, s, ["#2f6b5a", "#2a6152", "#357362", "#265a4b"], "#1f4c40", "#3f806e", 0.12, 0.1);
    for (let i = 0; i < 6; i++) {
      rect(ctx, (rng() * s) | 0, (rng() * s) | 0, 1, 1, "#9fd8c4");
    }
  },
  end_portal(ctx, s, rng) {
    fill(ctx, s, "#05030a");
    for (let i = 0; i < 22; i++) {
      const x = (rng() * s) | 0;
      const y = (rng() * s) | 0;
      rect(ctx, x, y, 1, 1, rng() < 0.6 ? "#d8d4ff" : "#8a7ac0");
    }
    for (let i = 0; i < 6; i++) {
      const x = (rng() * s) | 0;
      const y = (rng() * s) | 0;
      rect(ctx, x, y, 2, 1, "rgba(120,60,180,0.35)");
    }
  },
  spawner(ctx, s, rng) {
    fill(ctx, s, "#1c1c22");
    ctx.strokeStyle = "#4a4a54";
    ctx.lineWidth = 1;
    for (let i = 2; i < s; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i + 0.5, 1);
      ctx.lineTo(i + 0.5, s - 1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(1, i + 0.5);
      ctx.lineTo(s - 1, i + 0.5);
      ctx.stroke();
    }
    for (let i = 0; i < 10; i++) {
      rect(ctx, (rng() * s) | 0, (rng() * s) | 0, 1, 1, "#6a6a78");
    }
    rect(ctx, 6, 6, 4, 4, "rgba(160,40,40,0.5)");
  },
});

function px_(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function stem(ctx, s, rng, color, top) {
  const x = 7 + (rng() < 0.5 ? 1 : 0);
  for (let y = top; y < s - 1; y++) {
    px_(ctx, x, y, color);
  }
  px_(ctx, x - 1, s - 5, color);
  px_(ctx, x + 1, s - 7, color);
}

function rectangleBands(ctx, s, dark, light) {
  for (let y = 3; y < s; y += 4) {
    rect(ctx, 0, y, s, 1, dark);
    rect(ctx, 0, y + 1, s, 1, light);
  }
}

function makeGrassTint(palette, dark, light) {
  return (ctx, s, rng) => {
    noiseFill(ctx, rng, s, palette, dark, light, 0.12, 0.08);
    for (let i = 0; i < 12; i++) {
      rect(ctx, (rng() * s) | 0, (rng() * s) | 0, 1 + ((rng() * 2) | 0), 1, dark);
    }
    for (let i = 0; i < 5; i++) {
      rect(ctx, (rng() * s) | 0, (rng() * s) | 0, 2, 1, "rgba(0,0,0,0.1)");
    }
  };
}

PAINTERS.grass_top_forest = makeGrassTint(["#4f9e37", "#489631", "#57a63f", "#428c2b"], "#397a25", "#66bb4c");
PAINTERS.grass_top_savanna = makeGrassTint(["#8a9a3a", "#829234", "#94a344", "#7a8a2e"], "#6b7826", "#a5b455");
PAINTERS.grass_top_swamp = makeGrassTint(["#4a6b2a", "#445f24", "#527630", "#3d5720"], "#354c1a", "#5f8538");
PAINTERS.grass_top_badlands = makeGrassTint(["#6b6b2a", "#635f24", "#777730", "#5b5720"], "#4e4a1a", "#8a8a3e");

const TOOL_MATS = {
  wood: { main: "#9a6b3a", dark: "#6f4a24", light: "#c08a4e", handle: "#7a5230", handleDark: "#54371d" },
  stone: { main: "#9a9a9a", dark: "#6e6e6e", light: "#c8c8c8", handle: "#7a5230", handleDark: "#54371d" },
  iron: { main: "#d8d8d8", dark: "#a0a0a0", light: "#ffffff", handle: "#7a5230", handleDark: "#54371d" },
  diamond: { main: "#4fd8c8", dark: "#2a9a8c", light: "#a5f5ec", handle: "#7a5230", handleDark: "#54371d" },
};

const ARMOR_MATS = {
  leather: { main: "#9a6432", dark: "#6b4220", light: "#c08a4e" },
  iron: { main: "#cfcfcf", dark: "#969696", light: "#f2f2f2" },
  diamond: { main: "#4fd8c8", dark: "#2a9a8c", light: "#a5f5ec" },
};

function diagPixels(ctx, x0, y0, steps, dx, dy, color) {
  let x = x0;
  let y = y0;
  for (let i = 0; i < steps; i++) {
    px_(ctx, x, y, color);
    x += dx;
    y += dy;
  }
}

function toolHandle(ctx) {
  diagPixels(ctx, 1, 14, 7, 1, -1, "#54371d");
  diagPixels(ctx, 2, 14, 7, 1, -1, "#7a5230");
  diagPixels(ctx, 3, 14, 5, 1, -1, "#8f6238");
}

function swordPainter(c) {
  return (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    toolHandle(ctx);
    rect(ctx, 3, 10, 6, 1, c.dark);
    rect(ctx, 4, 11, 5, 1, c.main);
    rect(ctx, 5, 12, 3, 1, c.dark);
    for (let i = 0; i < 7; i++) {
      px_(ctx, 7 + i, 9 - i, c.light);
      px_(ctx, 8 + i, 9 - i, c.main);
      px_(ctx, 8 + i, 10 - i, c.dark);
    }
    px_(ctx, 14, 2, c.light);
    px_(ctx, 15, 3, c.main);
    px_(ctx, 15, 4, c.dark);
  };
}

function pickaxePainter(c) {
  return (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    toolHandle(ctx);
    rect(ctx, 5, 3, 7, 2, c.main);
    rect(ctx, 3, 4, 3, 4, c.main);
    rect(ctx, 11, 4, 3, 4, c.main);
    rect(ctx, 5, 2, 6, 1, c.light);
    rect(ctx, 6, 5, 5, 1, c.dark);
    px_(ctx, 3, 8, c.dark);
    px_(ctx, 13, 8, c.dark);
    px_(ctx, 4, 4, c.light);
    px_(ctx, 12, 4, c.light);
    rect(ctx, 3, 3, 2, 1, c.light);
    rect(ctx, 12, 3, 2, 1, c.light);
  };
}

function axePainter(c) {
  return (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    toolHandle(ctx);
    rect(ctx, 7, 2, 6, 7, c.main);
    rect(ctx, 8, 1, 4, 1, c.main);
    rect(ctx, 7, 2, 5, 1, c.light);
    rect(ctx, 13, 3, 1, 5, c.dark);
    rect(ctx, 7, 8, 6, 1, c.dark);
    rect(ctx, 8, 4, 2, 2, c.dark);
    px_(ctx, 12, 5, c.light);
    px_(ctx, 8, 1, c.light);
  };
}

function shovelPainter(c) {
  return (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    toolHandle(ctx);
    rect(ctx, 9, 2, 5, 5, c.main);
    rect(ctx, 10, 1, 3, 1, c.main);
    rect(ctx, 9, 2, 4, 1, c.light);
    rect(ctx, 9, 6, 5, 1, c.dark);
    rect(ctx, 13, 3, 1, 3, c.dark);
    px_(ctx, 10, 1, c.light);
  };
}

function helmetPainter(c) {
  return (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    rect(ctx, 5, 2, 6, 1, c.light);
    rect(ctx, 4, 3, 8, 2, c.main);
    rect(ctx, 3, 5, 10, 3, c.main);
    rect(ctx, 4, 5, 1, 2, c.light);
    rect(ctx, 11, 5, 1, 2, c.dark);
    rect(ctx, 3, 8, 10, 1, c.dark);
    rect(ctx, 5, 6, 6, 2, "#241d17");
  };
}

function chestPainter(c) {
  return (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    rect(ctx, 4, 2, 8, 3, c.main);
    rect(ctx, 2, 3, 2, 6, c.main);
    rect(ctx, 12, 3, 2, 6, c.main);
    rect(ctx, 5, 5, 6, 8, c.main);
    rect(ctx, 5, 2, 6, 1, c.light);
    rect(ctx, 2, 3, 1, 5, c.light);
    rect(ctx, 13, 3, 1, 5, c.dark);
    rect(ctx, 5, 12, 6, 1, c.dark);
    rect(ctx, 10, 5, 1, 7, c.dark);
    rect(ctx, 7, 2, 2, 1, "#241d17");
  };
}

function legsPainter(c) {
  return (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    rect(ctx, 4, 2, 8, 2, c.main);
    rect(ctx, 4, 4, 3, 9, c.main);
    rect(ctx, 9, 4, 3, 9, c.main);
    rect(ctx, 4, 2, 8, 1, c.light);
    rect(ctx, 4, 4, 1, 8, c.light);
    rect(ctx, 11, 4, 1, 8, c.dark);
    rect(ctx, 4, 12, 3, 1, c.dark);
    rect(ctx, 9, 12, 3, 1, c.dark);
    rect(ctx, 7, 4, 2, 9, "#241d17");
  };
}

function bootsPainter(c) {
  return (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    rect(ctx, 3, 7, 4, 5, c.main);
    rect(ctx, 9, 7, 4, 5, c.main);
    rect(ctx, 2, 11, 5, 2, c.main);
    rect(ctx, 8, 11, 5, 2, c.main);
    rect(ctx, 3, 7, 4, 1, c.light);
    rect(ctx, 9, 7, 4, 1, c.light);
    rect(ctx, 2, 12, 12, 1, c.dark);
    rect(ctx, 6, 10, 1, 2, c.dark);
    rect(ctx, 12, 10, 1, 2, c.dark);
  };
}

for (const [key, mat] of Object.entries(TOOL_MATS)) {
  PAINTERS[`sword_${key}`] = swordPainter(mat);
  PAINTERS[`pickaxe_${key}`] = pickaxePainter(mat);
  PAINTERS[`axe_${key}`] = axePainter(mat);
  PAINTERS[`shovel_${key}`] = shovelPainter(mat);
}

for (const [key, mat] of Object.entries(ARMOR_MATS)) {
  PAINTERS[`helmet_${key}`] = helmetPainter(mat);
  PAINTERS[`chest_${key}`] = chestPainter(mat);
  PAINTERS[`legs_${key}`] = legsPainter(mat);
  PAINTERS[`boots_${key}`] = bootsPainter(mat);
}

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
