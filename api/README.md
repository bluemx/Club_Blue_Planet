# Club Blue Planet — API

Cloudflare Worker: Hono + Better Auth + D1.

## Local

```bash
npm install
npx wrangler d1 migrations apply club-blue-planet --local
npx wrangler dev --port 8787
```

The SPA expects the API at `http://localhost:8787` (override with `VITE_API_URL`).

## Schema

`src/auth-options.js` is the single source of truth. After changing fields,
plugins or rate-limit config, regenerate and re-apply:

```bash
npx auth@latest generate --config src/auth.cli.js --output migrations/0001_better_auth.sql -y
npx wrangler d1 migrations apply club-blue-planet --local
```

Use the `auth` package, **not** the deprecated `@better-auth/cli` — that one is
pinned to 1.4 and emits a schema the 1.7 runtime rejects (missing
`account.issuer`).

`src/auth.cli.js` exists only so the generator has a concrete instance; it uses
an in-memory SQLite because the emitted SQL depends on the options, not the
database behind them.

## Before deploying

```bash
npx wrangler secret put BETTER_AUTH_SECRET   # openssl rand -base64 32
npx wrangler d1 migrations apply club-blue-planet --remote
npx wrangler deploy
```

Then set in `wrangler.jsonc`:
- `APP_ORIGINS` — comma-separated origins allowed to send cookies
- `BETTER_AUTH_URL` — the deployed Worker URL

## Endpoints

| Method | Path | Who |
|---|---|---|
| GET | `/health` | public |
| POST | `/api/auth/sign-up/email` | public |
| POST | `/api/auth/sign-in/email` | public |
| POST | `/api/auth/sign-out` | session |
| GET | `/api/me` | session |
| GET | `/api/auth/kid-code/children` | parent |
| POST | `/api/auth/kid-code/children` | parent |
| POST | `/api/auth/kid-code/issue` | parent |
| POST | `/api/auth/kid-code/redeem` | public, rate-limited |

Better Auth rejects POSTs without a trusted `Origin` header, so curl needs
`-H 'Origin: http://localhost:9200'`.

## Kid sign-in

Kids are real Better Auth users (`role = 'kid'`, `parentId` set) with a
placeholder `@kid.invalid` email and no credential account — they can only get
a session by redeeming a code.

Codes are stored as SHA-256 hashes; the plaintext is shown to the parent once,
at issue time. One live code per child, 24 h TTL.

A 6-digit code is only ~1e6 wide, so `/kid-code/redeem` is rate-limited to 5
attempts per 5 minutes, counted in D1 (in-memory counters are useless on
Workers — each isolate gets its own).

## Configuration values

| Name | Where | How to get it |
|---|---|---|
| `BETTER_AUTH_SECRET` | secret | `openssl rand -base64 32`. Local: `.dev.vars`. Production: `wrangler secret put`. |
| `BETTER_AUTH_URL` | var | The API's own public URL — the deployed Worker's, e.g. `https://club-blue-planet-api.<subdomain>.workers.dev`. Not the SPA's. |
| `APP_ORIGINS` | var | Comma-separated origins of the **SPA** allowed to send cookies, e.g. `https://app.unmensaje.com`. Scheme + host + port, no trailing slash. |
| `MAIL_FROM` | var | Sender address on the onboarded domain, e.g. `no-reply@unmensaje.com`. |

Never reuse the dev secret in production: rotating it invalidates every session.

## Email

Uses Cloudflare Email Sending (`send_email` binding, beta, Workers Paid plan).

`unmensaje.com` is onboarded (Enabled / DNS Configured), so delivery to
arbitrary recipients works. If a send ever starts failing with
`E_SENDER_NOT_VERIFIED` or `E_RECIPIENT_NOT_ALLOWED`, the domain's status in
the dashboard is the thing to check — not the code.

New accounts start on a conservative daily quota that scales with sending
reputation; sends to addresses verified in the account never count toward it.

Locally nothing is delivered: `MAIL_DEBUG=1` prints the message (and the OTP)
to the Worker log instead.

## Rate limiting and client IP

`advanced.ipAddress.ipAddressHeaders` is set to `cf-connecting-ip`. Without it
Better Auth cannot tell callers apart and collapses every request into one
shared bucket per path — a single attacker would then lock every child out of
redeeming their code. Cloudflare sets that header itself, so it can't be
spoofed. Check the Worker log for "single shared per-path bucket" after
changing anything here.

## Evidencia en fotos (R2)

Bucket `club-blue-planet-evidencias`, binding `EVIDENCE`. Solo fotos: JPG, PNG,
WEBP o HEIC, máximo 8 MB.

Las imágenes **nunca** se sirven directo desde R2. Pasan por el Worker, que
valida la sesión y que quien pide sea de la misma familia. Las llaves son
`familia/hijo/asignacion/uuid`, así borrar a un hijo es un borrado por prefijo.

Borrar a un hijo elimina primero sus objetos en R2 y luego la fila. Si se
hiciera al revés y fallara la segunda mitad, las fotos quedarían huérfanas sin
nada que las apunte — y una foto de un menor no debe sobrevivir a su perfil.

El `<img>` del padre necesita `crossorigin="use-credentials"`: el API está en
otro dominio y sin eso el navegador no manda la cookie y la imagen da 401.

## Familias y tutores

Una familia es una fila real (`family`) con varios adultos (`family_member`).
Antes "familia" era el id del papá, así que un segundo tutor habría sido su
propia isla sin acceso a nada.

`familyId` es lo que da acceso, en todas las tablas. `user.parentId` y
`kid_code.parentId` sobreviven solo como registro de quién agregó a un hijo o
emitió un código — no se usan para permisos.

Todos los tutores son equivalentes: asignan, aprueban, generan códigos y
pueden eliminar hijos. `family_member.role` solo distingue quién creó la
cuenta, para mostrarlo.

Se invita con un código de 6 dígitos (mismo patrón que el infantil, hasheado y
con vencimiento de 24 h).

Al unirse, si el adulto era el único tutor de su familia, **todo se fusiona**:
hijos, misiones, recompensas, asignaciones y canjes pasan a la familia destino
y la vieja se elimina. Si quedaban otros tutores, solo se mueve él — arrastrar
hijos compartidos sería sacárselos a los demás.

Las llaves de R2 conservan el `familyId` con que se escribieron, así que el
borrado de fotos lee las llaves de la base en vez de barrer por prefijo. Con
prefijo, una foto de un hijo fusionado nunca se borraría.

`familyFor()` en `src/routes.js` decide la familia en un solo lugar y crea una
de forma perezosa en la primera petición tras el registro.

## Límites

| Qué | Tope | Por qué |
|---|---|---|
| Hijos por familia | 20 | Nada acotaba las creaciones; un adulto con sesión podía llenar la tabla `user` en un bucle. |
| Tutores por familia | 6 | Dos padres y cuatro abuelos, por ejemplo. |
| `/guardians/join` | 5 intentos / 5 min por IP | Es un código de 6 dígitos que da acceso a los datos y fotos de un menor. |

El limitador de Better Auth **solo cubre `/api/auth/*`**. Las rutas propias de
la app no tenían ninguno, así que `/guardians/join` era fuerza-bruteable.
`src/rate-limit.js` cubre esas rutas contra D1 (los contadores en memoria no
sirven en Workers: cada isolate tiene el suyo).

## Propuestas y canjes

Un hijo propone una aventura y **no es asignable** hasta que un adulto la
acepta: se guarda en `mission` con `status = 'propuesta'`, así aceptarla es un
cambio de estado y no una copia. Los puntos los fija la dificultad (30/50/80) y
el adulto puede ajustarlos al aceptar — nunca los manda el hijo.

Un canje nace como `'pedida'` y el adulto lo marca entregado o rechazado desde
Perfil → Por revisar. Rechazar **devuelve los puntos solo**: el saldo se deriva
y no cuenta las `'rechazada'`, así que no hay que reembolsar a mano.

## Marca e iconos

Los iconos se generan del PNG incrustado en `Logo-Menu.svg` (el SVG solo
referencia un patrón, así que ImageMagick lo rasteriza en blanco — hay que
extraer el base64).

Dos juegos, a propósito:
- **Favicons (16–128 px)**: solo el planeta. El lockup completo es ilegible a
  16 px.
- **Iconos de app y PWA (128–512 px)**: el logo completo sobre `#1467E4`.
  `maskable-512.png` deja ~20 % de margen porque Android recorta los bordes.

`og:image` debe ser URL absoluta: los scrapers de WhatsApp, Twitter y Facebook
no resuelven rutas relativas.

## Saldo, canjes y reversión

El saldo cuenta solo los canjes en `'pedida'` o `'entregada'`. `'rechazada'` y
`'revertida'` liberan los puntos solos — no hay reembolso a mano, porque el
saldo se deriva.

Revertir aplica a un canje ya resuelto (`entregada`) o pendiente (`pedida`);
resolver solo aplica a `pedida`. Por eso los estados de origen permitidos
difieren según la acción. Un canje revertido no se puede volver a revertir.

El historial pagina con `?limit=&offset=&childId=`. Pide una fila de más para
saber si hay página siguiente sin pagar un `COUNT(*)`.

## Notificaciones

Cada cambio que le importa al otro lado deja una notificación **en el mismo
`db.batch()`** que el cambio: si la tabla o el INSERT fallan, falla todo, así
que nunca hay un aviso de algo que no pasó (ni al revés).

| Evento | Quién recibe | `kind` | Enlace |
|---|---|---|---|
| Se asigna una misión | el hijo | `asignada` | `/kid/misiones` |
| El hijo la reporta (PATCH o foto) | todos los tutores | `revision` | `/misiones` |
| Un tutor la aprueba | el hijo | `aprobada` | `/kid/misiones` |
| El hijo pide un premio | todos los tutores | `canje` | `/recompensas` |
| Un tutor entrega / rechaza / revierte | el hijo | `premio` / `devuelto` | `/kid/recompensas` |
| El hijo propone una misión | todos los tutores | `propuesta` | `/pendientes` |
| Un tutor la acepta / descarta | el hijo | `aceptada` / `descartada` | `/kid`, `/kid/nueva` |

Reportar dos veces no avisa dos veces (solo en la transición a `revision`).
Los avisos de `premio` llevan `icon` y `color` del premio: la app los usa para
la celebración a pantalla completa del hijo.

- `GET /api/notifications` → `{ notifications: [30 más recientes], unread }`.
  La app lo consulta cada 30 s mientras está visible; no es push.
- `POST /api/notifications/read { upTo }` → marca leídas hasta ese `createdAt`
  (lo que el usuario vio), y borra las leídas de más de dos meses.

## Canjes: pestañas

`GET /api/redemptions?status=pedida|resueltas` separa lo que falta entregar de
lo ya resuelto, y siempre devuelve `counts: { pedida, resueltas }` para los
contadores de ambas pestañas. El orden es por `resolvedAt` (o `createdAt`), así
lo recién entregado queda arriba del historial.

## Catálogo de hábitos (0010)

Las sugerencias ecológicas quedaron con `status = 'retirada'` — no se borran,
porque las asignaciones pasadas siguen apuntando a ellas. Solo se pueden asignar
misiones `activa`: ni una retirada ni una propuesta sin aceptar, aunque el
cliente conozca su id. Las insignias se derivan de los íconos de esas misiones
(`bed`/`desk`, `clean_hands`, `menu_book`, `directions_run`).
