# Portfolio de Mendu

Web personal de Fernando Menduiña: informático y profesor de pádel.
Publicada con GitHub Pages: https://fermendu.github.io/portfolio/

## Estructura
- `index.html` — página única con secciones: inicio, sobre mí, proyectos, contacto.
- `css/styles.css` — todos los estilos. Colores y medidas en variables de `:root`.

## Tecnología
- HTML, CSS y JavaScript puros. Sin frameworks ni librerías salvo que lo pida.
- Sin proceso de build: lo que hay en `main` es lo que se publica, de momento, mi intención es ir complicando el proyecto de manera escalonada.

## Convenciones
- Textos de la web, comentarios y nombres de clases en español.
- HTML semántico (header, nav, main, section, article, footer).
- Usar las variables CSS existentes en vez de repetir colores.
- Pensar primero en móvil.

## Cómo quiero trabajar
- Estoy aprendiendo: explícame qué cambias y por qué, en lenguaje sencillo.
- Cambios pequeños y de uno en uno.
- Si algo lo puedo escribir yo, dame pistas en vez de la solución.
- No hagas commits ni push: los hago yo desde Sourcetree.

## Hoja de ruta
- Cada proyecto vive en `proyectos/<nombre>/` con su `index.html`, y su CSS y JS propios.
- Las subpáginas reutilizan `../../css/styles.css` y tienen la misma cabecera con el logo para volver al inicio.
- Las tarjetas de la sección Proyectos del index enlazan a cada proyecto y muestran su estado ("En construcción", "Próximamente").
- Crear cada subpágina solo cuando se empiece ese proyecto.

Proyectos, en orden:
1. Generador de cuadros de torneo de pádel (solo JS): eliminatoria con byes y cabezas de serie → liguilla de grupos → consolación → previas.
2. Landings de marcas inventadas (CSS y formularios). Nunca copiar marcas reales.
3. Zona privada con login y base de datos (p. ej. Supabase): menú semanal y mi Excel, visibles solo para mí.
4. Torneos: guardar y compartir enlace (usa el backend de la zona privada).

Regla: los datos personales nunca van en el repo, porque es público.