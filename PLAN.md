# Plan de desarrollo — Vexio Craft

Juego voxel estilo Minecraft en el navegador (Three.js + Vite), desplegado en https://vexio-craft.vexio.dev

## Etapas

- [x] **1. Base voxel**: mundo infinito por chunks, ruido procedural, texturas, hotbar, minar/colocar, guardado local.
- [x] **2. Supervivencia y móvil**: vida, daño por caída, minado por tiempo, controles táctiles (joystick, botones), modo creativo/supervivencia.
- [x] **3. Gráficos**: texturas 32px con mipmaps, sombras, tone mapping, ciclo día/noche con sol y luna, agua animada, grietas de minado, partículas.
- [x] **4. Multijugador**: servidor Node + WebSocket en el mismo dominio (`/ws`), semilla y ediciones autoritativas con persistencia en disco, jugadores remotos con nombre e interpolación, reconexión automática, chat de nombres. Modo un jugador como respaldo si el servidor no responde.

## Siguientes ideas (etapa 5)

- [ ] Chat de texto entre jugadores.
- [ ] Sincronizar hora del día y clima desde el servidor.
- [ ] Inventario persistente por jugador.
- [ ] Mobs / criaturas simples.
- [ ] Panel de administración (expulsar, banear, cambiar semilla en vivo).

## Desarrollo local

```sh
npm install
npm run server   # servidor de mundo + WS en :3000 (datos en ./data)
npm run dev      # cliente Vite en :5173 con proxy /ws
```

Producción: `npm run build` + `npm start` (un solo proceso sirve el cliente y el WebSocket).

## Arquitectura

- `src/` — cliente (Vite). `src/net.js` conexión WS, `src/remotePlayers.js` avatares remotos.
- `server/index.js` — sirve `dist/` y gestiona el mundo compartido por WS.
- Persistencia: `DATA_DIR/world.json` (por defecto `/data`, volumen en Dokploy).
- Deploy: Dokploy construye el `Dockerfile` y publica en `vexio-craft.vexio.dev` (auto-deploy al hacer push a `main`).
