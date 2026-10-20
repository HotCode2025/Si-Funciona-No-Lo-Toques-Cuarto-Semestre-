# OceanOS

Plataforma de restauración de ecosistemas marinos del Atlántico Sur.
Bosques de cachiyuyo y poblaciones de tiburones en la Patagonia, medidos por
ciencia ciudadana y convertidos en activos verificables.

**Los Sin Chamba** — Lautaro Martinez, Leandro Orozco, Gabriel Maculus,
Jose Rodriguez, Otar.

---

## Qué hace

Tres capas, cada una alimentando a la siguiente:

| Capa | Quién la usa | Qué hace |
|---|---|---|
| **1 · Superficie** | Buzos, pescadores, guías | Reportan avistamientos con GPS y cobran tokens OKN canjeables por ecoturismo |
| **2 · Columna de agua** | Pesqueras, ONGs, áreas protegidas | Panel con salud del ecosistema en vivo, proyectos de restauración y sensores IoT |
| **3 · Lecho marino** | Empresas, fondos ESG | Marketplace de créditos de carbono azul y hectáreas restauradas |

El dato ciudadano de la Capa 1 es lo que hace vendible el panel de la Capa 2,
y la medición de la Capa 2 es lo que permite certificar el carbono de la Capa 3.

## Stack

- **Backend** — Node 20+ con Fastify 5, JWT en cookie httpOnly
- **Frontend** — React 19, Vite 8, Tailwind 4, React Router 7, Recharts
- **Base de datos** — PostgreSQL 18 (funciona de 16 en adelante)

Sin claves de API: el mapa es Leaflet con OpenStreetMap, que no pide registro ni tarjeta.

---

## Cómo levantarlo

### Modo demostración (el que está activo)

Por ahora el sitio es una **versión gratis, sin login y sin base de datos**, pensada
para mostrarlo funcionando. Solo necesitás **Node 20.19+**:

```bash
cd frontend
npm install
npm run dev              # queda en http://localhost:5173
```

Entrá a **http://localhost:5173**. La portada explica el proyecto y el botón
**Ver todas las funciones** lleva a `/funciones`, con un recorrido sugerido de
seis pasos y todas las pantallas ordenadas por capa.

Cómo funciona por dentro:

- `frontend/src/services/demo/` es la API corriendo **dentro del navegador**. Cada
  ruta replica la de `backend/src/routes` y cada regla la de `backend/src/services`:
  premios en tokens, racha, zona nueva, votación ponderada, canjes con stock y
  órdenes que no sobrevenden. Los datos salen de `001_demo.sql` traducido a JS.
- Las páginas no se enteran: `services/api.js` le pasa los pedidos al servidor de
  demo en vez de hacer `fetch` a `/api`, con las mismas rutas y respuestas.
- No hay sesión. La app ciudadana se usa con la cuenta del proyecto, **OceanOS**
  (`demo@oceanos.ar`), que arranca sin reportes y con 200 OKN de bienvenida. Los
  integrantes del equipo aparecen solo como autores de los reportes de ejemplo. El
  panel deja elegir cualquiera de las tres organizaciones.
- Los planes no bloquean nada: no hay tope de proyectos ni 403 en sensores.
- Lo que se hace (reportes, votos, canjes, proyectos, reservas) queda guardado en
  `sessionStorage`: sobrevive a recargar la página y se pierde al cerrar la pestaña.
  **Reiniciar datos**, en la barra lateral o en `/funciones`, vuelve a la semilla.

### Publicarlo en Vercel

El sitio de la demo es una SPA estática: la API corre en el navegador, así que no
necesita base de datos, variables de entorno ni plan pago. Entra entero en el plan
gratuito.

El repositorio tiene dos paquetes, `frontend` y `backend`, así que Vercel lo
detecta como multi-servicio y pide una configuración que no corresponde: el
backend necesita una base de datos y no entra en el plan gratuito. La solución es
apuntar el proyecto a la carpeta del frontend y listo.

`frontend/vercel.json` trae el rewrite de SPA, sin el cual recargar una dirección
como `/app/tokens` devuelve 404 porque no existe un archivo con ese nombre.

Desde el sitio de Vercel:

1. Subir el repositorio a GitHub.
2. En **vercel.com → Add New → Project**, importar el repositorio.
3. En **Directorio Raíz**, tocar *Editar* y elegir **`frontend`**. Vercel detecta
   Vite solo y completa el build (`npm run build`) y la salida (`dist`).
4. **Deploy**. Queda en `https://<nombre>.vercel.app` y se actualiza solo con cada
   push.

O desde la terminal, sin pasar por GitHub:

```bash
npx vercel            # la primera vez pide iniciar sesión y crear el proyecto
npx vercel --prod     # publica la versión definitiva
```

El backend Fastify **no** va a Vercel: necesita un PostgreSQL y un proceso vivo.
Para cuando haga falta, la ruta corta es Supabase (o Neon) para la base y las
funciones de Vercel para la API. La demo no lo necesita.

### Con la API real (para más adelante)

El backend quedó intacto, pero el frontend hoy no lo usa: para volver a conectarlo
hay que devolver `services/api.js` a `fetch` y reponer el login. Estos son los pasos
para levantarlo, que necesitan además **PostgreSQL 16+** (o Docker).

#### 1. Base de datos

Con Docker, que es lo más rápido:

```bash
docker compose up -d
```

O contra un PostgreSQL que ya tengas:

```bash
createdb oceanos
```

#### 2. Backend

```bash
cd backend
npm install
cp .env.example .env     # con Docker: DATABASE_URL=postgres://oceanos:oceanos@localhost:5432/oceanos
npm run db:reset         # crea las tablas y carga los datos de demo
npm run dev              # queda en http://localhost:3000
```

#### Atajo

Desde la raíz del proyecto:

```bash
npm run instalar    # instala backend y frontend
npm run db:up       # levanta PostgreSQL con Docker
npm run db:reset    # migra y carga datos de demo
npm run dev:api     # en una terminal
npm run dev:web     # en otra
```

---

## Cuentas de la base

Solo cuentan con la API real; el modo demostración no tiene login.
Contraseña de todas: **`oceano1234`**

| Correo | Rol | Qué ves |
|---|---|---|
| `demo@oceanos.ar` | Ciudadano | Cuenta del proyecto: sin reportes y con 200 OKN de bienvenida |
| `buzo@oceanos.ar` | Ciudadano | 970 OKN, 23 reportes verificados, racha activa |
| `leandro@oceanos.ar` | Ciudadano | 8 de 8 reportes verificados: tiburones, lobos marinos y una red abandonada |
| `otar@oceanos.ar` | Ciudadano | Reputación alta, puede resolver votaciones |
| `jose@oceanos.ar` | Organización | APN Valdés, reporta las ballenas del área protegida |
| `admin@oceanos.ar` | Admin | Titular de Fundación Kelp, acceso a todas las organizaciones, 12 de 13 reportes verificados |

Los tres planes están abiertos y en cero en `database/seeds/001_demo.sql`. El código
de los planes quedó intacto (`crear` lee `max_projects` y `sensores` lee `has_iot`
en `projects.service.js`): para volver a mostrar el bloqueo, restaurá las tres filas
comentadas arriba del `INSERT` y corré `npm run db:reset`. Ahí `admin@oceanos.ar`,
abriendo los sensores de Pesquera Atlántico Sur (plan Starter), vuelve a recibir el
403 con el mensaje de upgrade.

---

## Estructura

```
oceanos/
├── docs/
│   ├── ECONOMIA-DE-TOKENS.md   La tabla de premios y de dónde la lee la interfaz
│   ├── PROPUESTA-DE-VALOR.md   Personas, mapas de empatía y los dos lienzos
│   └── DOCUMENTOS-A-ACTUALIZAR.md  Coherencia entre los documentos y la plataforma
├── database/
│   ├── migrations/001_init.sql     Esquema completo con vistas calculadas
│   └── seeds/001_demo.sql          Zonas y especies reales de Chubut
├── backend/
│   ├── scripts/                    migrate.js y seed.js
│   └── src/
│       ├── db/                     Pool de pg, helpers one/many/transaction
│       ├── plugins/auth.js         JWT en cookie, guardas de rol y organización
│       ├── services/               Toda la lógica de negocio
│       └── routes/                 Rutas con JSON Schema (obligatorio en Fastify 5)
└── frontend/src/
    ├── services/demo/              La API en el navegador: semilla, vistas y rutas
    ├── contexts/DemoContext.jsx    Persona de ejemplo y organización abierta
    ├── components/mapa/            Mapa real (Leaflet + OpenStreetMap) en modo noche
    ├── pages/publico/              Portada, funciones, ecosistema, mercado
    ├── pages/app/                  Capa 1 — app ciudadana
    └── pages/panel/                Capa 2 — panel de organización
```

---

## Decisiones que conviene conocer

**Todo cuelga de una zona.** Avistamientos, sensores, proyectos y créditos viven
dentro de una zona geográfica. Sin eso no se puede calcular salud de ecosistema ni
certificar carbono sobre un polígono concreto.

**Sin PostGIS.** El modelo usa bounding box y centroide. Alcanza para el MVP y
evita que la instalación dependa de una extensión que no siempre está disponible.

**El saldo de tokens no se guarda.** `token_ledger` es append-only y el saldo es la
suma. Un balance denormalizado se desincroniza tarde o temprano; una suma no.

**Ojo con los JOIN en las vistas.** `user_balances` y `project_summary` usan
`CROSS JOIN LATERAL` en vez de varios `LEFT JOIN`. Con dos ramas independientes
del mismo padre (movimientos + reportes, hitos + créditos), los `LEFT JOIN` hacen
producto cartesiano y multiplican los totales.

**El orden importa en `app.js`.** `await app.register(...)` hace que Fastify
construya ese subárbol en el acto. Si `setErrorHandler` se define después de
registrar las rutas, no las alcanza y se filtran los códigos de error crudos de
Postgres al cliente. Por eso los handlers van antes.

**Mapa real con Leaflet y OpenStreetMap.** Empezó como un mapa SVG propio (sin
conexión, pensado para usarse arriba de un gomón) y pasó a un mapa real para que
se vea la costa. Leaflet y no Google Maps, porque Google pide una clave atada a una
cuenta con facturación; y no CARTO, que ahora también pide clave. OpenStreetMap
no pide nada y permite un uso liviano mostrando la atribución. Solo existe en claro:
el modo noche es un filtro CSS sobre las baldosas (`.leaflet-tile-pane` en
`index.css`). Lo que se resignó es el uso sin conexión: sin red se ven los puntos,
pero sobre agua lisa.

**Los puntos de la demo están en el agua.** El seed SQL reparte las coordenadas por
todo el rectángulo de cada zona, que incluye tierra: sobre el mapa real quedaban
cachiyuyos en Puerto Madryn y ballenas en medio de la península. La semilla de la
demo (`services/demo/semilla.js`) los ubica dentro de espejos de agua medidos sobre
el mapa, y corrige el rectángulo de Golfo Nuevo, que dejaba afuera el tercio este
del golfo. **`001_demo.sql` todavía tiene las coordenadas viejas**: si se vuelve a la
API real, conviene pasarle estos mismos valores.

**Verificación.** Si el clasificador queda por debajo del 80% de confianza, el
reporte va a votación: tres votos ponderados por reputación lo resuelven.

**El flujo de n8n vive en la base.** El MER entregado abstrae la relación entre
usuario y avistamiento como una entidad de alto nivel y la vincula con los flujos
de automatización. Esa agregación es `n8n_trigger_log`: cada fila dice qué reporte,
de qué usuario, disparó qué nodo y cómo terminó. El alta de un avistamiento corre
el flujo completo dentro de la misma transacción —si el reporte no queda, el
registro tampoco— y `/panel/automatizaciones` lo muestra con el diagrama y las
últimas corridas. n8n de verdad no corre en ningún lado: lo que existe es el modelo
de datos que lo sostiene.

**Los premios en tokens siguen el documento fundacional.** La plataforma y los
materiales del MVP aplican 15/25/50/10/100: reporte básico, foto verificada,
racha semanal, voto comunitario y primera zona nueva, respectivamente.

---

## Qué falta para producción

- Subida de fotos (hoy `photo_url` acepta una URL pero no hay almacenamiento)
- El modelo de clasificación on-device — el backend ya recibe `aiConfidence`
- Cobro real en el marketplace: las órdenes quedan en estado `pendiente`
- Notificaciones push de avistamientos cercanos
- Exportación de informes en PDF para BID y GEF
