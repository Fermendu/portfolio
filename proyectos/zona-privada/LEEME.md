# Zona privada: menú semanal y lista de la compra

Página con inicio de sesión para dos personas. La web propone el menú de la semana a partir de un catálogo de platos, se puede retocar y la lista de la compra se recalcula sola.

## Cómo se protege

El repo es público, así que **aquí solo hay código**. Los datos (catálogo, menús, compra) viven en **Supabase**, una base de datos en la nube con inicio de sesión.

- La página usa la clave *publishable* de Supabase. Está pensada para ir en el navegador: por sí sola no da acceso a nada.
- Lo que protege los datos son las reglas **RLS** (*Row Level Security*) de `supabase/esquema.sql`: la base de datos solo devuelve filas a un usuario con sesión iniciada **y** que esté en la tabla `miembros`.
- Los registros nuevos están desactivados: nadie puede crearse una cuenta desde fuera.
- La clave *secret* de Supabase nunca va en el código.

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `index.html` | La página: login, pestañas (Menú, Compra, Ajustes) y la ventana para cambiar una comida. |
| `zona-privada.css` | Estilos propios. Los generales vienen de `../../css/styles.css`. |
| `js/app.js` | Pinta la página, escucha los clics y guarda los cambios. |
| `js/menu.js` | Reglas del menú: proponer la semana, proponer un solo hueco, intercambiar días. |
| `js/compra.js` | Calcula la lista de la compra por secciones del súper. |
| `js/fechas.js` | Lunes de cada semana y fechas en español. |
| `js/datos.js` | Lo único que habla con Supabase. |
| `js/config.js` | La URL del proyecto de Supabase y su clave *publishable*. |
| `supabase/esquema.sql` | Tablas y reglas de acceso. Se pega una vez en Supabase. |

`menu.js` y `compra.js` son funciones "puras": reciben datos y devuelven datos, sin tocar la página ni internet. Por eso se pueden probar por separado.

## Puesta en marcha (una sola vez)

1. **Crear el proyecto.** Entra en [supabase.com](https://supabase.com), crea una cuenta (con GitHub es lo más rápido) y un proyecto nuevo. Guarda la contraseña de la base de datos en tu gestor de contraseñas; aquí no se usa, pero Supabase la pide. Elige una región de Europa.
2. **Crear las tablas.** En el panel: *SQL Editor* → *New query* → pega todo `supabase/esquema.sql` → *Run*.
3. **Cerrar los registros.** *Authentication* → ajustes de inicio de sesión → desactiva **Allow new users to sign up**.
4. **Crear las dos cuentas.** *Authentication* → *Users* → *Add user* → *Create new user*, con email y contraseña. Si aparece la opción de confirmar el usuario automáticamente, márcala. Repite para la segunda persona.
5. **Darles acceso.** En el *SQL Editor*, ejecuta las dos líneas `insert into public.miembros …` del final de `esquema.sql` con vuestros emails y nombres. No guardes esa consulta en el repo.
6. **Conectar la web.** Botón *Connect* (arriba en el panel) o *Project Settings* → *API Keys*: copia la URL del proyecto y la clave **publishable** (`sb_publishable_…`) en `js/config.js`.
7. **Subir los datos.** Publica la web, entra en la zona privada y, en *Ajustes*, sube `catalogo-platos.json` y `mario-web.json`. Esos archivos **no** van al repo (el `.gitignore` los bloquea).
8. **En el móvil.** Abre la zona privada en Safari → *Compartir* → *Añadir a pantalla de inicio*. Queda como una app llamada "Menú".

## Bueno saber

- **Plan gratis de Supabase:** si el proyecto pasa 7 días casi sin uso, se pausa. No se pierde nada: se reactiva desde el panel con *Resume project*. Usándolo cada semana no debería pasar.
- **Actualizar el catálogo:** cuando haya platos nuevos, se sube el `catalogo-platos.json` nuevo en *Ajustes*. Los menús ya hechos no cambian.
- **Dos personas a la vez:** cada cambio se guarda al momento. Al volver a la pestaña, la página recarga la semana por si la otra persona ha tocado algo.
