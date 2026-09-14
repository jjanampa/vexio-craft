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

- [x] **8. Supervivencia completa**:
  - Inventario real de 36 huecos (9 barra rápida + 27 mochila) con cantidades: mover y apilar con clic, repartir con clic derecho, cursor de objeto y contadores en la hotbar.
  - Minar suelta recursos al inventario y colocar los consume; sin pico la piedra no da drop y las menas exigen pico de piedra (hierro) o de hierro (diamante), con minado más lento si falta la herramienta correcta.
  - Crafteo por recetas (34): tablas de cada madera, palos, 16 herramientas y 12 piezas de armadura, con ingredientes disponibles resaltados.
  - Menas de hierro y diamante repartidas por el subsuelo y lana de oveja como bloque colocable.
  - Hambre con barra de 10 muslos: agotamiento al caminar/correr/saltar/regenerar, regeneración de vida solo con hambre alta e inanición a 0; comer con clic derecho (chuleta, carne de res, de oveja y podrida).
  - Criaturas: nueva vaca (carne y cuero), drops al morir para cerdo/oveja/zombi y ahogamiento con burbujas de oxígeno.
  - Guardado de inventario, hambre y armadura por partida.

- [x] **9. Personajes estilo Minecraft y más contenido**:
  - Skins procedurales 64×64 con formato Minecraft (cara con ojos y boca, pelo, camiseta, pantalones y zapatos) aplicadas a los avatares y al brazo en primera persona.
  - 8 personajes seleccionables en el menú (Steve, Alex, Bruno, Luna, Kai, Nova, Max y Vera) con vista previa de la cara, guardado local y sincronización con el servidor para que los demás lo vean.
  - Bloques nuevos: mena de oro, bloques de hierro/oro/diamante, mesa de crafteo, horno, TNT, calabaza y hielo (congela lagos de biomas nevados).
  - TNT: se enciende al golpearla, mecha de 3 s parpadeante, explosión con cráter, partículas, daño y empuje; reacciones en cadena y sincronización multijugador (mensajes prime/boom + cola de ediciones).
  - Creeper: criatura hostil que persigue, se infla con un silbido y explota; suelta pólvora.
  - Crafteo ampliado a 43 recetas, incluidos bloques metálicos (ida y vuelta), mesa de crafteo, horno y TNT.

## Siguientes ideas (etapa 10)

- [ ] Horno funcional para cocinar carne y fundir menas.
- [ ] Durabilidad de herramientas y armadura.
- [ ] Aldeanos, cofres y camas.
- [ ] Chat de texto entre jugadores.
- [ ] Sincronizar hora del día y clima desde el servidor.
- [ ] Inventario persistente por jugador en el servidor y criaturas sincronizadas.

## Desarrollo local

```sh
npm install
npm run server   # servidor de mundo + WS en :3000 (datos en ./data)
npm run dev      # cliente Vite en :5173 con proxy /ws
```

Producción: `npm run build` + `npm start` (un solo proceso sirve el cliente y el WebSocket).

## Arquitectura

- `src/` — cliente (Vite). `src/net.js` conexión WS, `src/remotePlayers.js` avatares remotos, `src/avatar.js` avatar articulado compartido, `src/items.js` objetos/recetas, `src/inventory.js` inventario con cantidades, `src/mobs.js` criaturas.
- `server/index.js` — sirve `dist/` y gestiona el mundo compartido por WS.
- Persistencia: `DATA_DIR/world.json` (por defecto `/data`, volumen en Dokploy).
- Deploy: Dokploy construye el `Dockerfile` y publica en `vexio-craft.vexio.dev` (auto-deploy al hacer push a `main`).
