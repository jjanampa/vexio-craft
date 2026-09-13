# Plan de desarrollo — Vexio Craft

Juego voxel estilo Minecraft en el navegador (Three.js + Vite), desplegado en https://vexio-craft.vexio.dev

## Etapas

- [x] **1. Base voxel**: mundo infinito por chunks, ruido procedural, texturas, hotbar, minar/colocar, guardado local.
- [x] **2. Supervivencia y móvil**: vida, daño por caída, minado por tiempo, controles táctiles (joystick, botones), modo creativo/supervivencia.
- [x] **3. Gráficos**: texturas 32px con mipmaps, sombras, tone mapping, ciclo día/noche con sol y luna, agua animada, grietas de minado, partículas.
- [x] **4. Multijugador**: servidor Node + WebSocket en el mismo dominio (`/ws`), semilla y ediciones autoritativas con persistencia en disco, jugadores remotos con nombre e interpolación, reconexión automática, chat de nombres. Modo un jugador como respaldo si el servidor no responde.
- [x] **5. Fidelidad visual estilo Minecraft**: texturas pixel art 16×16, bloque en la mano con animación de golpe y balanceo, nubes planas de bloques, sol y luna cuadrados, cielo con paletas día/atardecer/noche, oscurecimiento de cuevas por profundidad, crosshair con mezcla por diferencia, FOV 70.
- [x] **6. Biomas, estructuras y dimensiones**:
  - 13 biomas (llanura, bosque, abedular, taiga, tundra nevada, desierto, sabana, jungla, pantano, badlands, montañas, playa, océano) con clima por ruido, bloques de superficie propios, tintes de césped, vegetación (robles, abedules, abetos, acacias, jungla, cactus, arbustos, hierba alta, flores).
  - Estructuras: aldeas (3 paletas), pirámide del desierto, templo de la jungla, iglú, cabaña de bruja, naufragio, minas, mazmorra con generador, stronghold con portal del End, portal en ruinas y fortaleza del Nether.
  - Dimensiones: **Nether** (mares de lava, glowstone, cuarzo, arena de almas, fortalezas) y **El End** (islas flotantes, pilares de obsidiana, portal de retorno). Portales de obsidiana que se encienden solos al completar el marco, viaje con escala 1:8, cooldown y sincronización multijugador por dimensión.

- [x] **7. Combate y equipamiento**:
  - Sonido ampliado: golpes, espada, daño recibido, salto/aterrizaje, equipar armadura, gruñidos de criaturas y muerte (síntesis con WebAudio, sin archivos).
  - Extremidades animadas en avatares: piernas y brazos al caminar/nadar, golpe con el brazo al minar o atacar, cabeza inclinada con el pitch y balanceo en reposo. Visible en jugadores remotos y en tercera persona (F5 / V).
  - 16 herramientas (espada, pico, hacha, pala en madera/piedra/hierro/diamante) con velocidad de minado por material y daño de ataque propio; se ven en la mano en primera persona y en la mano del avatar.
  - 12 piezas de armadura (cuero/hierro/diamante: casco, pechera, grebas, botas) que reducen el daño hasta un 60% y se dibujan sobre el avatar.
  - Inventario (E) con todos los objetos, slots de armadura equipables y hotbar de 9 huecos.
  - Criaturas locales: cerdos y ovejas pasivos que huyen al ser golpeados, y zombis hostiles que aparecen de noche y se queman al amanecer; IA con deambular, persecución, ataque, vida, retroceso y animación.
  - Multijugador: se sincronizan objeto en mano, armadura equipada y animación de golpe.

## Siguientes ideas (etapa 8)

- [ ] Chat de texto entre jugadores.
- [ ] Sincronizar hora del día y clima desde el servidor.
- [ ] Inventario persistente por jugador en el servidor.
- [ ] Criaturas sincronizadas por el servidor y más tipos.
- [ ] Crafteo y drops de criaturas.
- [ ] Panel de administración (expulsar, banear, cambiar semilla en vivo).

## Desarrollo local

```sh
npm install
npm run server   # servidor de mundo + WS en :3000 (datos en ./data)
npm run dev      # cliente Vite en :5173 con proxy /ws
```

Producción: `npm run build` + `npm start` (un solo proceso sirve el cliente y el WebSocket).

## Arquitectura

- `src/` — cliente (Vite). `src/net.js` conexión WS, `src/remotePlayers.js` avatares remotos, `src/avatar.js` avatar articulado compartido, `src/items.js` herramientas/armadura, `src/mobs.js` criaturas.
- `server/index.js` — sirve `dist/` y gestiona el mundo compartido por WS.
- Persistencia: `DATA_DIR/world.json` (por defecto `/data`, volumen en Dokploy).
- Deploy: Dokploy construye el `Dockerfile` y publica en `vexio-craft.vexio.dev` (auto-deploy al hacer push a `main`).
