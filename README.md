# Vecindo — administración de condominios

Aplicación web responsive (instalable en el celular) para administrar condominios en Costa Rica:
unidades y residentes, cuotas por coeficiente, reporte de pagos SINPE con comprobante, aprobación,
estado de cuenta y morosidad.

**Stack:** Next.js 15 (App Router) · Supabase (PostgreSQL, Auth, Storage) · Tailwind CSS 4 · Vercel.

## Qué incluye esta versión (MVP de cobros)

| Rol | Puede |
| --- | --- |
| Administración | Registrar el condominio, agregar o importar unidades, invitar residentes por correo, crear planes de cuota, generar cuotas del mes, registrar multas, aprobar o rechazar pagos, ver morosidad |
| Residente | Ver su saldo y cargos, reportar un pago con captura del comprobante, ver el estado de sus pagos |

Las reglas de dinero (prorrateo, aplicación FIFO de pagos, saldo a favor, interés de mora) y los
permisos viven en la base de datos (`supabase/migrations`), protegidos con Row Level Security.

## Despliegue

### 1. Supabase
1. Cree un proyecto en [supabase.com](https://supabase.com) — región **East US (North Virginia)**. Guarde la contraseña de la base.
2. Cargue el esquema, de una de dos formas:
   - **Automática (recomendada):** en GitHub → *Settings → Secrets and variables → Actions* agregue
     `SUPABASE_ACCESS_TOKEN` ([crear token](https://supabase.com/dashboard/account/tokens)),
     `SUPABASE_PROJECT_REF` (Project Settings → General → Project ID) y `SUPABASE_DB_PASSWORD`.
     Luego en *Actions → Desplegar base de datos → Run workflow*. Cada cambio futuro en
     `supabase/migrations` se aplica solo.
   - **Manual:** abra *SQL Editor* en Supabase, pegue el contenido de
     `supabase/migrations/20261007000000_esquema_inicial.sql` y ejecútelo.
3. *Authentication → URL Configuration*: **Site URL** = la URL de Vercel (paso 2) y agregue
   `https://SU-DOMINIO/auth/confirm` en **Redirect URLs**.
4. *Authentication → Email Templates*: en **Confirm signup**, **Invite user** y **Reset password**
   cambie el enlace por:
   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
   ```
   (uno en cada plantilla, respectivamente).

### 2. Vercel
1. En [vercel.com](https://vercel.com) → *Add New → Project* → importe `sanyons/condominios`.
2. En *Environment Variables* agregue (valores en Supabase → Project Settings → API):

   | Variable | Valor |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave `anon` / publishable |
   | `SUPABASE_SERVICE_ROLE_KEY` | clave secreta `sb_secret_…` (solo servidor) |
   | `NEXT_PUBLIC_SITE_URL` | opcional: la URL definitiva cuando tenga dominio propio |
3. *Deploy*. Cada push a `main` vuelve a publicar.

### 3. Primer uso
Entre a `/registro`, cree su cuenta de administración, registre el condominio, agregue unidades
(o péguelas desde Excel), cree un plan de cuota, genere el mes e invite a los residentes.

## Desarrollo local

```bash
cp .env.example .env.local   # complete con los datos de Supabase
npm install
npm run dev
```

## Tareas programadas (opcional)
En Supabase → *Database → Extensions* active `pg_cron` y ejecute:
```sql
select cron.schedule('cuotas-mensuales', '5 12 1 * *', $$ select public._generar_cuotas_del_mes() $$);
select cron.schedule('morosidad-diaria', '0 13 * * *', $$ select public._procesar_morosidad() $$);
```
(Horas en UTC: 6:05 a. m. y 7:00 a. m. de Costa Rica.)

## Pruebas
GitHub Actions corre en cada push: aplica las migraciones en PostgreSQL 16, ejecuta
`supabase/tests/01_pruebas_negocio.sql` (cuotas, pagos, mora y permisos por rol) y compila la app.
