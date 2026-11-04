# Contexto del despliegue de LOTIFI en Railway

Configurado el 2026-11-04 desde la **laptop** (que tiene una versión anterior del proyecto). La **PC** tiene cambios más recientes sin subir.

## Pendiente al abrir el proyecto en la PC

1. **Respaldar `backend/.env`** antes de hacer pull: el commit `45dfa41` lo sacó del repo y `git pull` puede borrarlo. Si desaparece, restaurar la copia (sigue ignorado por `.gitignore`).
2. `git pull`, resolver conflictos y luego `git push`. Si hay conflicto en `backend/config/db.js`, conservar la versión que lee `process.env.DB_*` (Railway la necesita).
3. **Crear las tablas en la MySQL de Railway** desde la base local de la PC (la de la laptop está desactualizada). Hacerlo con `mysqldump` (`C:\Program Files\MySQL\MySQL Server 8.0\bin`) o con el SQL de `backend/sql/` quitando `CREATE DATABASE lotifi` / `USE lotifi`.
4. Cuando la base esté lista, desactivar el acceso público (TCP Proxy) de MySQL si ya no se usa.

## Commits hechos desde la laptop

- `45dfa41`: `db.js` lee `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`; `backend/.env` fuera del repo.
- `69fc14d`: `package.json` en la raíz (`build` compila el frontend e instala el backend; `start` arranca `backend/server.js`).

## Proyecto en Railway: `lotifi`

| Servicio | Detalle |
|---|---|
| **lotifi-app** | Repo `kpachgo/lotifi`, rama `main`. Cada push redespliega. URL: https://lotifi-app-production.up.railway.app |
| **MySQL** | Base **`railway`** (no `lotifi`). Las tablas deben crearse ahí. |

- **Variables de lotifi-app:** `DB_*` apuntan a `${{MySQL.MYSQL*}}` (host interno `mysql.railway.internal`).
- **Start command (configurado en Railway):** `cd backend && mkdir -p backend/uploads/comprobantes && node server.js`. El `mkdir` existe porque multer no crea la carpeta `comprobantes`.
- **Volumen `lotifi-uploads`:** montado en `/app/backend/backend/uploads` para que los archivos subidos no se pierdan al redesplegar.
- **Acceso desde Workbench:** host `viaduct.proxy.rlwy.net`, puerto `19059`, usuario `root`, schema `railway`. La contraseña está en Railway → MySQL → Variables (`MYSQLPASSWORD`); no se guarda en el repo.
