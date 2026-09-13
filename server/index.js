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

let seed = Math.floor(Math.random() * 1e9);
const edits = new Map();

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

function loadWorld() {
  try {
    const data = JSON.parse(fs.readFileSync(worldFile, "utf8"));
    if (Number.isInteger(data.seed)) seed = data.seed;
    for (const edit of data.edits || []) {
      const [x, y, z, id] = edit;
      if (validEdit(x, y, z, id)) edits.set(`${x},${y},${z}`, [x, y, z, id]);
    }
    console.log(`Mundo cargado: semilla ${seed}, ${edits.size} ediciones`);
  } catch {
    console.log(`Mundo nuevo: semilla ${seed}`);
  }
}

function saveWorld() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(worldFile, JSON.stringify({ seed, edits: [...edits.values()] }));
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
  res.json({ ok: true, seed, edits: edits.size, players: players.size });
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
  return { id: p.id, name: p.name, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch };
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
    stateStart: 0,
    stateCount: 0,
    editStart: 0,
    editCount: 0,
  };
  players.set(ws, player);

  send(ws, {
    t: "welcome",
    id: player.id,
    seed,
    players: [...players.values()].filter((p) => p !== player).map(publicPlayer),
    edits: [...edits.values()],
  });
  broadcast({ t: "join", player: publicPlayer(player) }, ws);

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
      const { x, y, z, yaw, pitch } = msg;
      if (![x, y, z, yaw, pitch].every((v) => typeof v === "number" && Number.isFinite(v))) return;
      player.x = Math.max(-COORD_LIMIT, Math.min(COORD_LIMIT, x));
      player.y = Math.max(-64, Math.min(WORLD_HEIGHT + 64, y));
      player.z = Math.max(-COORD_LIMIT, Math.min(COORD_LIMIT, z));
      player.yaw = yaw;
      player.pitch = pitch;
    } else if (msg.t === "edit") {
      if (!withinRate(player, "edit", 40)) return;
      const { x, y, z, id: blockId } = msg;
      if (!validEdit(x, y, z, blockId)) return;
      edits.set(`${x},${y},${z}`, [x, y, z, blockId]);
      scheduleSave();
      broadcast({ t: "edit", x, y, z, id: blockId }, ws);
    } else if (msg.t === "rename") {
      const name = sanitizeName(msg.name);
      if (!name || name === player.name) return;
      player.name = name;
      broadcast({ t: "rename", id: player.id, name });
    }
  });

  ws.on("close", () => {
    players.delete(ws);
    broadcast({ t: "leave", id: player.id, name: player.name });
  });
  ws.on("error", () => {});
});

setInterval(() => {
  if (players.size === 0) return;
  broadcast({ t: "state", players: [...players.values()].map(publicPlayer) });
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
