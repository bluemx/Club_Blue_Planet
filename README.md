# Club Blue Planet

| Pieza | Carpeta | Producción |
|---|---|---|
| Webapp / app móvil (Quasar) | [`app/`](app) | https://clubblueplanet-app.ealbinu.workers.dev |
| API (Worker + Better Auth + D1) | [`api/`](api) | https://clubblueplanet.ealbinu.workers.dev |
| Home page (HTML + Tailwind) | [`home/`](home) | sin desplegar |

## Desplegar

```bash
cd app && npx quasar build && npx wrangler deploy
```

```bash
cd api && npx wrangler deploy
```

El API solo acepta llamadas con cookies desde los orígenes de `APP_ORIGINS`
(`api/wrangler.jsonc`). Si agregas un dominio para el front, va ahí también, o
el navegador recibirá `INVALID_ORIGIN`.

## Trabajar en local

La URL del API es una constante en [`app/src/lib/auth.js`](app/src/lib/auth.js).
Para pegarle a un Worker local, cámbiala a `http://localhost:8787` **y** agrega
`http://localhost:9200` a `APP_ORIGINS` en el Worker local — no en el desplegado.

```bash
cd api && npx wrangler dev --port 8787
cd app && npx quasar dev -p 9200
```

Detalles del backend (esquema, correo, límites): [`api/README.md`](api/README.md).
