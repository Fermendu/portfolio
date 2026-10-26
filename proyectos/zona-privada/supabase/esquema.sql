-- =====================================================================
-- Zona privada · esquema de la base de datos en Supabase
-- =====================================================================
-- Se pega entero en Supabase → SQL Editor → New query → Run.
-- Solo crea tablas y reglas de acceso: aquí NO hay ningún dato personal,
-- por eso este archivo puede estar en el repo público.
--
-- Idea general:
--   · miembros    → quién puede entrar (las cuentas con acceso).
--   · documentos  → el catálogo de platos y las recetas de Mario (un JSON cada uno).
--   · semanas     → el menú y la lista de la compra de cada semana.
-- Las tres tienen "Row Level Security" (RLS): Supabase solo devuelve filas
-- a un usuario que haya iniciado sesión Y esté en la tabla miembros.
-- Sin sesión (o con una cuenta que no sea vuestra) no se ve nada.
-- =====================================================================


-- ---------- Miembros ----------
create table if not exists public.miembros (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nombre  text not null
);

alter table public.miembros enable row level security;

-- Cada miembro puede ver su propia fila (la web la usa para saludar)
drop policy if exists "cada miembro se ve a sí mismo" on public.miembros;
create policy "cada miembro se ve a sí mismo"
  on public.miembros for select
  to authenticated
  using (user_id = auth.uid());

-- ¿El usuario que hace la petición es miembro?
-- "security definer" permite mirar la tabla miembros desde las reglas de las otras tablas.
create or replace function public.es_miembro()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.miembros where user_id = auth.uid());
$$;


-- ---------- Documentos (catálogo y recetas de Mario) ----------
create table if not exists public.documentos (
  clave       text primary key,          -- 'catalogo' o 'mario'
  contenido   jsonb not null,
  actualizado timestamptz not null default now()
);

alter table public.documentos enable row level security;

drop policy if exists "solo miembros" on public.documentos;
create policy "solo miembros"
  on public.documentos for all
  to authenticated
  using (public.es_miembro())
  with check (public.es_miembro());


-- ---------- Semanas (menú + compra) ----------
create table if not exists public.semanas (
  lunes       date primary key,          -- la semana se identifica por su lunes
  menu        jsonb not null,
  compra      jsonb not null default '{}'::jsonb,
  actualizado timestamptz not null default now()
);

alter table public.semanas enable row level security;

drop policy if exists "solo miembros" on public.semanas;
create policy "solo miembros"
  on public.semanas for all
  to authenticated
  using (public.es_miembro())
  with check (public.es_miembro());


-- ---------- Permisos ----------
-- Se dan a mano por si el proyecto se creó con "Exponer automáticamente
-- nuevas tablas" desactivado (lo recomendado). Solo para "authenticated"
-- (con sesión); "anon" (sin sesión) no recibe nada.
-- Aun con permisos, las reglas RLS de arriba deciden qué filas se ven.
grant usage on schema public to authenticated;

revoke all on public.miembros, public.documentos, public.semanas from anon;
grant select on public.miembros to authenticated;
grant select, insert, update, delete on public.documentos, public.semanas to authenticated;

revoke execute on function public.es_miembro() from public, anon;
grant execute on function public.es_miembro() to authenticated;


-- =====================================================================
-- ÚLTIMO PASO (después de crear vuestros dos usuarios en Authentication):
-- copia estas líneas en otra consulta, pon vuestros emails y ejecútala.
-- No la guardes en el repo con los emails puestos.
--
-- insert into public.miembros (user_id, nombre)
-- select id, 'TU_NOMBRE' from auth.users where email = 'TU_EMAIL';
--
-- insert into public.miembros (user_id, nombre)
-- select id, 'SU_NOMBRE' from auth.users where email = 'SU_EMAIL';
-- =====================================================================
