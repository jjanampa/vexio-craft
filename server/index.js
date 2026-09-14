import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import compression from "compression";
import { WebSocketServer } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", "dist");
const DATA_DIR = process.env.DATA_DIR || "/data";
const PORT = Number(process.env.PORT || 80);
const WORLD_HEIGHT = 64;
const MAX_PLAYERS = 32;
const TICK_MS = 80;
const COORD_LIMIT = 1e7;
const DIMENSIONS = ["overworld", "nether", "end"];

function deriveSeed(seed, n) {
  return Math.abs((seed * 31 + n * 1013904223) % 1000000000);
}

function makeDimension(seed) {
  return { seed, edits: new Map() };
}

let dims = {
  overworld: makeDimension(Math.floor(Math.random() * 1e9)),
  nether: makeDimension(0),
  end: makeDimension(0),
};
dims.nether.seed = deriveSeed(dims.overworld.seed, 1);
dims.end.seed = deriveSeed(dims.overworld.seed, 2);

const worldFile = path.join(DATA_DIR, "world.json");

function validEdit(x, y, z, id) {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    Number.isInteger(z) &&
    Number.isInteger(id) &&
    Math.abs(x) <= COORD_LIMIT &&
    Math.abs(z) <= COORD_LIMIT &&
    y >= 1 &&
    y < WORLD_HEIGHT &&
    id >= 0 &&
    id <= 255
  );
}

function applyEdits(target, list) {
  for (const edit of list || []) {
    const [x, y, z, id] = edit;
    if (validEdit(x, y, z, id)) target.edits.set(`${x},${y},${z}`, [x, y, z, id]);
  }
}

function loadWorld() {
  try {
    const data = JSON.parse(fs.readFileSync(worldFile, "utf8"));
    if (data.dimensions) {
      const seed = data.dimensions.overworld?.seed;
      if (Number.isInteger(seed)) dims.overworld.seed = seed;
      for (const dim of DIMENSIONS) {
        const info = data.dimensions[dim];
        if (!info) continue;
        if (Number.isInteger(info.seed)) dims[dim].seed = info.seed;
        applyEdits(dims[dim], info.edits);
      }
      if (!Number.isInteger(data.dimensions.nether?.seed)) dims.nether.seed = deriveSeed(dims.overworld.seed, 1);
      if (!Number.isInteger(data.dimensions.end?.seed)) dims.end.seed = deriveSeed(dims.overworld.seed, 2);
    } else if (Number.isInteger(data.seed)) {
      dims.overworld.seed = data.seed;
      dims.nether.seed = deriveSeed(data.seed, 1);
      dims.end.seed = deriveSeed(data.seed, 2);
      applyEdits(dims.overworld, data.edits);
    }
    const counts = DIMENSIONS.map((d) => `${d}:${dims[d].edits.size}`).join(" ");
    console.log(`Mundo cargado: semilla ${dims.overworld.seed} (${counts})`);
  } catch {
    console.log(`Mundo nuevo: semilla ${dims.overworld.seed}`);
  }
}

function saveWorld() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const dimensions = {};
    for (const dim of DIMENSIONS) {
      dimensions[dim] = { seed: dims[dim].seed, edits: [...dims[dim].edits.values()] };
    }
    fs.writeFileSync(worldFile, JSON.stringify({ dimensions }));
  } catch (error) {
    console.error("No se pudo guardar el mundo:", error.message);
  }
}

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveWorld();
  }, 1500);
}

loadWorld();

const app = express();
app.use(compression());
app.use(
  express.static(DIST, {
    index: "index.html",
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader("Cache-Control", "public, max-age=604800, immutable");
      } else {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);
app.get("/healthz", (req, res) => {
  const counts = {};
  for (const dim of DIMENSIONS) counts[dim] = { seed: dims[dim].seed, edits: dims[dim].edits.size };
  res.json({ ok: true, dimensions: counts, players: players.size });
});
app.use((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") return res.status(405).end();
  res.sendFile(path.join(DIST, "index.html"));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 64 * 1024 });

const players = new Map();
let nextId = 1;

function sanitizeName(raw) {
  const clean = String(raw || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 16);
  return clean || null;
}

function publicPlayer(p) {
  return {
    id: p.id,
    name: p.name,
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: p.yaw,
    pitch: p.pitch,
    dim: p.dim,
    item: p.item,
    armor: p.armor,
    character: p.character,
  };
}

function send(ws, message) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
}

function broadcast(message, except) {
  const raw = JSON.stringify(message);
  for (const [ws] of players) {
    if (ws === except) continue;
    if (ws.readyState === ws.OPEN) ws.send(raw);
  }
}

function broadcastDim(dim, message, except) {
  const raw = JSON.stringify(message);
  for (const [ws, p] of players) {
    if (ws === except || p.dim !== dim) continue;
    if (ws.readyState === ws.OPEN) ws.send(raw);
  }
}

function welcomePayload(player) {
  const dimsPayload = {};
  for (const dim of DIMENSIONS) {
    dimsPayload[dim] = { seed: dims[dim].seed, edits: [...dims[dim].edits.values()] };
  }
  return {
    t: "welcome",
    id: player.id,
    dim: player.dim,
    dims: dimsPayload,
    players: [...players.values()].filter((p) => p !== player).map(publicPlayer),
  };
}

function withinRate(p, field, limit) {
  const now = Date.now();
  if (now - p[`${field}Start`] > 1000) {
    p[`${field}Start`] = now;
    p[`${field}Count`] = 0;
  }
  p[`${field}Count`]++;
  return p[`${field}Count`] <= limit;
}

wss.on("connection", (ws, req) => {
  if (players.size >= MAX_PLAYERS) {
    ws.close(4000, "Servidor lleno");
    return;
  }
  const url = new URL(req.url, "http://localhost");
  const id = nextId++;
  const player = {
    id,
    name: sanitizeName(url.searchParams.get("name")) || `Jugador ${id}`,
    x: 8.5,
    y: 48,
    z: 8.5,
    yaw: 0,
    pitch: 0,
    dim: "overworld",
    item: 0,
    armor: [0, 0, 0, 0],
    character: "steve",
    stateStart: 0,
    stateCount: 0,
    editStart: 0,
    editCount: 0,
    animStart: 0,
    animCount: 0,
    primeStart: 0,
    primeCount: 0,
    boomStart: 0,
    boomCount: 0,
  };
  players.set(ws, player);

  send(ws, welcomePayload(player));
  broadcastDim(player.dim, { t: "join", player: publicPlayer(player) }, ws);

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;

    if (msg.t === "state") {
      if (!withinRate(player, "state", 60)) return;
      const { x, y, z, yaw, pitch, dim } = msg;
      if (![x, y, z, yaw, pitch].every((v) => typeof v === "number" && Number.isFinite(v))) return;
      player.x = Math.max(-COORD_LIMIT, Math.min(COORD_LIMIT, x));
      player.y = Math.max(-64, Math.min(WORLD_HEIGHT + 64, y));
      player.z = Math.max(-COORD_LIMIT, Math.min(COORD_LIMIT, z));
      player.yaw = yaw;
      player.pitch = pitch;
      if (typeof msg.character === "string" && /^[a-z0-9_-]{1,16}$/.test(msg.character)) player.character = msg.character;
      if (Number.isInteger(msg.item) && msg.item >= 0 && msg.item <= 65535) player.item = msg.item;
      if (
        Array.isArray(msg.armor) &&
        msg.armor.length === 4 &&
        msg.armor.every((v) => Number.isInteger(v) && v >= 0 && v <= 65535)
      ) {
        player.armor = msg.armor;
      }
      if (DIMENSIONS.includes(dim) && dim !== player.dim) {
        broadcastDim(player.dim, { t: "leave", id: player.id, name: player.name });
        player.dim = dim;
        broadcastDim(player.dim, { t: "join", player: publicPlayer(player) });
      }
      return;
    }

    if (msg.t === "dim") {
      if (!DIMENSIONS.includes(msg.dim) || msg.dim === player.dim) return;
      const { x, y, z } = msg;
      if ([x, y, z].every((v) => typeof v === "number" && Number.isFinite(v))) {
        player.x = Math.max(-COORD_LIMIT, Math.min(COORD_LIMIT, x));
        player.y = Math.max(-64, Math.min(WORLD_HEIGHT + 64, y));
        player.z = Math.max(-COORD_LIMIT, Math.min(COORD_LIMIT, z));
      }
      broadcastDim(player.dim, { t: "leave", id: player.id, name: player.name });
      player.dim = msg.dim;
      broadcastDim(player.dim, { t: "join", player: publicPlayer(player) });
      return;
    }

    if (msg.t === "edit") {
      if (!withinRate(player, "edit", 40)) return;
      const dim = DIMENSIONS.includes(msg.dim) ? msg.dim : player.dim;
      const { x, y, z, id: blockId } = msg;
      if (!validEdit(x, y, z, blockId)) return;
      dims[dim].edits.set(`${x},${y},${z}`, [x, y, z, blockId]);
      scheduleSave();
      broadcastDim(dim, { t: "edit", dim, x, y, z, id: blockId }, ws);
      return;
    }

    if (msg.t === "anim") {
      if (!withinRate(player, "anim", 10)) return;
      if (msg.a !== "swing") return;
      broadcastDim(player.dim, { t: "anim", id: player.id, a: "swing" }, ws);
      return;
    }

    if (msg.t === "prime") {
      if (!withinRate(player, "prime", 6)) return;
      const { x, y, z } = msg;
      if (!validEdit(x, y, z, 0)) return;
      broadcastDim(player.dim, { t: "prime", x, y, z }, ws);
      return;
    }

    if (msg.t === "boom") {
      if (!withinRate(player, "boom", 4)) return;
      const { x, y, z, r } = msg;
      if (!validEdit(x, y, z, 0)) return;
      if (!Number.isInteger(r) || r < 1 || r > 8) return;
      broadcastDim(player.dim, { t: "boom", x, y, z, r }, ws);
      return;
    }

    if (msg.t === "rename") {
      const name = sanitizeName(msg.name);
      if (!name || name === player.name) return;
      player.name = name;
      broadcast({ t: "rename", id: player.id, name });
    }
  });

  ws.on("close", () => {
    players.delete(ws);
    broadcastDim(player.dim, { t: "leave", id: player.id, name: player.name });
  });
  ws.on("error", () => {});
});

setInterval(() => {
  if (players.size === 0) return;
  for (const [ws] of players) {
    if (ws.readyState !== ws.OPEN) continue;
    const p = players.get(ws);
    const sameDim = [...players.values()].filter((other) => other.dim === p.dim).map(publicPlayer);
    send(ws, { t: "state", players: sameDim });
  }
}, TICK_MS);

function shutdown() {
  if (saveTimer) clearTimeout(saveTimer);
  saveWorld();
  server.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

server.listen(PORT, () => {
  console.log(`Vexio Craft escuchando en :${PORT}`);
});
