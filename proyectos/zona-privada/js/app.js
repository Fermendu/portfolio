// ===== Zona privada: menú semanal y lista de la compra =====
// Este archivo maneja la página: pinta, escucha clics y guarda.
// Las reglas del menú están en menu.js, las de la compra en compra.js y Supabase en datos.js.

import * as datos from "./datos.js";
import {
  crearPiezas, proponerSemana, proponerHueco, intercambiar, avisosHueco, copiar, MOMENTOS, PERSONAS_POR_DEFECTO,
} from "./menu.js";
import { calcularCompra, compraVacia, textoParaCompartir, textoCantidad, separarNombre, SECCIONES } from "./compra.js";
import { NOMBRES_DIAS, lunesDe, sumarDias, fechaCorta, semanasEntre, aTexto } from "./fechas.js";

const $ = (selector) => document.querySelector(selector);

// Todo lo que la página necesita recordar mientras está abierta
const estado = {
  nombre: "",
  catalogo: null,
  catalogoFecha: null,
  mario: null,
  marioFecha: null,
  piezas: new Map(),
  lunes: lunesDe(),
  menu: null,
  compra: compraVacia(),
  historial: null, // { lunes, historial, semanaAnterior } de la semana que se está viendo
  pestana: "menu",
  huecoAbierto: null, // { dia, momento }
};

// ---------- Utilidades ----------

// Escapa el texto antes de meterlo en HTML (por si un nombre lleva < o &)
function esc(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function nombreCorto(nombre) {
  return separarNombre(nombre).principal;
}

let temporizadorAviso;
function avisar(texto, tipo = "ok") {
  const aviso = $("#aviso");
  aviso.textContent = texto;
  aviso.className = `aviso aviso-visible aviso-${tipo}`;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => aviso.classList.remove("aviso-visible"), tipo === "error" ? 5000 : 2200);
}

// Guardado con un pequeño retraso: si tocas varias cosas seguidas, se guarda una sola vez
const guardadosPendientes = { menu: null, compra: null };
function programarGuardado(que) {
  const lunes = estado.lunes;
  const valor = estado[que];
  clearTimeout(guardadosPendientes[que]);
  guardadosPendientes[que] = setTimeout(async () => {
    guardadosPendientes[que] = null;
    try {
      if (que === "menu") await datos.guardarMenu(lunes, valor);
      else await datos.guardarCompra(lunes, valor);
    } catch (error) {
      console.error(error);
      avisar("No se ha podido guardar. Revisa la conexión y vuelve a intentarlo.", "error");
    }
  }, 500);
}

function hayGuardadosPendientes() {
  return Boolean(guardadosPendientes.menu || guardadosPendientes.compra);
}

// ---------- Arranque y sesión ----------

async function iniciar() {
  conectarEventos();

  if (!datos.configurado) {
    mostrarAcceso("Falta conectar Supabase: rellena js/config.js (los pasos están en LEEME.md).");
    return;
  }
  try {
    const sesion = await datos.sesionActual();
    if (sesion) await entrar();
    else mostrarAcceso();
  } catch (error) {
    console.error(error);
    mostrarAcceso("No se ha podido conectar. Prueba a recargar la página.");
  }
}

function mostrarAcceso(mensaje = "") {
  $("#cargando").hidden = true;
  $("#panel").hidden = true;
  $("#acceso").hidden = false;
  const estadoAcceso = $("#acceso-estado");
  estadoAcceso.textContent = mensaje;
  estadoAcceso.className = mensaje ? "form-estado form-estado-error" : "form-estado";
}

async function entrar() {
  const nombre = await datos.leerMiembro();
  if (!nombre) {
    await datos.cerrarSesion();
    mostrarAcceso("Esta cuenta no tiene acceso a la zona privada.");
    return;
  }
  estado.nombre = nombre;
  await cargarDocumentos();

  $("#cargando").hidden = true;
  $("#acceso").hidden = true;
  $("#panel").hidden = false;
  $("#nombre-miembro").textContent = nombre;
  await cargarSemana(estado.lunes);
}

async function enviarAcceso(evento) {
  evento.preventDefault();
  const boton = evento.target.querySelector("button[type='submit']");
  const estadoAcceso = $("#acceso-estado");
  boton.disabled = true;
  estadoAcceso.className = "form-estado";
  estadoAcceso.textContent = "Entrando…";
  try {
    await datos.iniciarSesion($("#email").value.trim(), $("#contrasena").value);
    $("#contrasena").value = "";
    await entrar();
  } catch (error) {
    console.error(error);
    const credenciales = /invalid login credentials/i.test(error.message ?? "");
    mostrarAcceso(credenciales ? "Email o contraseña incorrectos." : "No se ha podido entrar. Inténtalo de nuevo.");
  } finally {
    boton.disabled = false;
  }
}

async function salir() {
  await datos.cerrarSesion();
  Object.assign(estado, { nombre: "", catalogo: null, mario: null, piezas: new Map(), menu: null, compra: compraVacia(), historial: null });
  mostrarAcceso();
}

// ---------- Carga de datos ----------

async function cargarDocumentos() {
  const [catalogo, mario] = await Promise.all([datos.leerDocumento("catalogo"), datos.leerDocumento("mario")]);
  estado.catalogo = catalogo?.contenido ?? null;
  estado.catalogoFecha = catalogo?.actualizado ?? null;
  estado.mario = mario?.contenido ?? null;
  estado.marioFecha = mario?.actualizado ?? null;
  estado.piezas = crearPiezas(estado.catalogo, estado.mario);
}

async function cargarSemana(lunes) {
  estado.lunes = lunes;
  estado.historial = null;
  pintarCabecera();
  $("#vista-menu").innerHTML = `<p class="nota">Cargando la semana…</p>`;
  try {
    const fila = await datos.leerSemana(lunes);
    if (lunes !== estado.lunes) return; // se cambió de semana mientras cargaba
    estado.menu = fila?.menu ?? null;
    estado.compra = { ...compraVacia(), ...(fila?.compra ?? {}) };
    pintar();
  } catch (error) {
    console.error(error);
    $("#vista-menu").innerHTML = `<p class="nota">No se ha podido cargar la semana. Prueba a recargar.</p>`;
  }
}

// Semanas anteriores, para las reglas de "frecuencia" (mensual, quincenal) y para no repetir proteína el lunes
async function leerHistorial() {
  if (estado.historial?.lunes === estado.lunes) return estado.historial;
  const filas = await datos.leerSemanasEntre(sumarDias(estado.lunes, -28), sumarDias(estado.lunes, -7));
  const historial = filas.map((f) => ({ semanasAtras: semanasEntre(f.lunes, estado.lunes), menu: f.menu }));
  estado.historial = {
    lunes: estado.lunes,
    historial,
    semanaAnterior: historial.find((h) => h.semanasAtras === 1)?.menu ?? null,
  };
  return estado.historial;
}

// ---------- Pintar ----------

function pintar() {
  pintarCabecera();
  pintarMenu();
  pintarCompra();
  pintarAjustes();
}

function pintarCabecera() {
  const domingo = sumarDias(estado.lunes, 6);
  $("#titulo-semana").textContent = `${fechaCorta(estado.lunes)} – ${fechaCorta(domingo)}`;
  $("#ir-a-hoy").hidden = estado.lunes === lunesDe();
}

function pintarMenu() {
  const vista = $("#vista-menu");

  if (!estado.catalogo) {
    vista.innerHTML = `
      <div class="vacio">
        <p>Todavía no hay catálogo de platos.</p>
        <p>Súbelo en <button type="button" class="enlace-boton" data-ir="ajustes">Ajustes</button> con el archivo <code>catalogo-platos.json</code>.</p>
      </div>`;
    return;
  }

  if (!estado.menu) {
    vista.innerHTML = `
      <div class="vacio">
        <p>Aún no hay menú para esta semana.</p>
        <button type="button" class="boton" data-accion="proponer">Proponer menú</button>
        <p class="nota">Saldrá con vuestros platos y 1 o 2 recetas de Mario marcadas como nuevas. Luego podéis cambiar lo que queráis.</p>
      </div>`;
    return;
  }

  const hoy = aTexto(new Date());
  const dias = estado.menu.dias
    .map((dia, d) => {
      const fecha = sumarDias(estado.lunes, d);
      const esHoy = fecha === hoy;
      return `
        <article class="dia${esHoy ? " dia-hoy" : ""}">
          <h2 class="dia-titulo">${NOMBRES_DIAS[d]} <span class="dia-fecha">${fechaCorta(fecha)}</span>${esHoy ? ` <span class="chip chip-hoy">Hoy</span>` : ""}</h2>
          ${MOMENTOS.map((momento) => botonHueco(d, momento)).join("")}
        </article>`;
    })
    .join("");

  vista.innerHTML = `
    <div class="menu-barra">
      <p class="nota">Toca una comida para cambiarla.</p>
      <button type="button" class="boton-secundario" data-accion="proponer">Proponer otra semana</button>
    </div>
    <div class="dias">${dias}</div>`;
}

function botonHueco(d, momento) {
  const hueco = estado.menu.dias[d][momento];
  const piezas = hueco.platos.map((c) => estado.piezas.get(c)).filter(Boolean);

  let texto;
  if (hueco.estado === "fuera") {
    texto = `<span class="hueco-principal hueco-apagado">Fuera de casa</span>`;
  } else if (!piezas.length) {
    texto = `<span class="hueco-principal hueco-apagado">${hueco.platos.length ? "Plato que ya no está en el catálogo" : "Sin plato: toca para elegir"}</span>`;
  } else {
    texto = `<span class="hueco-principal">${esc(nombreCorto(piezas[0].nombre))}</span>`;
    if (piezas.length > 1) {
      texto += `<span class="hueco-con">con ${piezas.slice(1).map((p) => esc(nombreCorto(p.nombre).toLowerCase())).join(" y ")}</span>`;
    }
  }

  const chips = [];
  if (hueco.estado === "sobras") chips.push(`<span class="chip">Sobras</span>`);
  if (hueco.estado !== "fuera" && piezas.some((p) => p.origen === "mario")) chips.push(`<span class="chip chip-mario">Mario · nueva</span>`);
  if (hueco.estado !== "fuera" && hueco.personas === 1) chips.push(`<span class="chip">Solo yo</span>`);
  for (const aviso of avisosHueco(estado.menu, d, momento, estado.piezas)) {
    chips.push(`<span class="chip chip-aviso">${esc(aviso)}</span>`);
  }

  return `
    <button type="button" class="hueco hueco-${hueco.estado}" data-dia="${d}" data-momento="${momento}">
      <span class="hueco-momento">${momento === "comida" ? "Comida" : "Cena"}</span>
      <span class="hueco-texto">${texto}</span>
      ${chips.length ? `<span class="hueco-chips">${chips.join("")}</span>` : ""}
    </button>`;
}

function pintarCompra() {
  const vista = $("#vista-compra");
  const contador = $("#contador-compra");

  if (!estado.menu) {
    contador.textContent = "";
    vista.innerHTML = `<div class="vacio"><p>Cuando haya menú para esta semana, aquí saldrá la lista de la compra.</p></div>`;
    return;
  }

  const r = calcularCompra(estado.menu, estado.piezas, estado.compra);
  contador.textContent = r.totales.pendientes || "";

  const opcionesSeccion = SECCIONES.map((s) => `<option${s === "Otros" ? " selected" : ""}>${esc(s)}</option>`).join("");

  const secciones = r.secciones
    .map(
      (s) => `
      <section class="seccion-compra">
        <h2>${esc(s.nombre)}</h2>
        <ul class="items">${s.items.map(itemCompra).join("")}${s.extras.map(itemExtra).join("")}</ul>
      </section>`
    )
    .join("");

  const basicos = r.basicos.length
    ? `<section class="seccion-compra seccion-basicos">
        <h2>Básicos: mira si os queda</h2>
        <ul class="items">${r.basicos.map(itemCompra).join("")}</ul>
      </section>`
    : "";

  const enCasa = r.enCasa.length
    ? `<details class="desplegable">
        <summary>Ya en casa (${r.enCasa.length})</summary>
        <ul class="items">${r.enCasa
          .map(
            (i) => `
            <li class="item item-en-casa">
              <span class="item-texto"><span class="item-nombre">${esc(i.nombre)}</span></span>
              <button type="button" class="item-boton" data-devolver="${esc(i.clave)}">Devolver</button>
            </li>`
          )
          .join("")}</ul>
      </details>`
    : "";

  const porRevisar = r.porRevisar.length
    ? `<details class="desplegable">
        <summary>Platos sin cantidades en el catálogo (${r.porRevisar.length})</summary>
        <p class="nota">En estos la lista no puede decir cuánto comprar. Cuéntaselos a Claude en el chat del proyecto cuando los vayáis haciendo y se completan.</p>
        <ul class="lista-simple">${r.porRevisar.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
      </details>`
    : "";

  vista.innerHTML = `
    <div class="compra-barra">
      <p class="compra-resumen"><strong>${r.totales.pendientes}</strong> por comprar de ${r.totales.total}</p>
      <button type="button" class="boton" data-accion="compartir">Compartir</button>
    </div>

    <form id="form-extra" class="form-extra">
      <label for="extra-texto" class="visualmente-oculto">Añadir a la lista</label>
      <input type="text" id="extra-texto" placeholder="Añadir: fruta, papel de cocina…" autocomplete="off" required>
      <label for="extra-seccion" class="visualmente-oculto">Sección</label>
      <select id="extra-seccion">${opcionesSeccion}</select>
      <button type="submit" class="boton">Añadir</button>
    </form>

    ${secciones || `<p class="nota">No hay nada que comprar esta semana.</p>`}
    ${basicos}
    ${enCasa}
    ${porRevisar}`;
}

function itemCompra(item) {
  const detalle = [item.detalle, item.usos.join(", ")].filter(Boolean).join(" · ");
  return `
    <li class="item${item.tachado ? " item-tachado" : ""}">
      <label class="item-marca">
        <input type="checkbox" data-tachar="${esc(item.clave)}"${item.tachado ? " checked" : ""}>
        <span class="item-texto">
          <span class="item-nombre">${esc(item.nombre)}</span>${item.texto ? ` <span class="item-cantidad">${esc(item.texto)}</span>` : ""}
          ${detalle ? `<span class="item-detalle">${esc(detalle)}</span>` : ""}
        </span>
      </label>
      <button type="button" class="item-boton" data-en-casa="${esc(item.clave)}" aria-label="Ya tenemos ${esc(item.nombre)} en casa">Lo tengo</button>
    </li>`;
}

function itemExtra(extra) {
  return `
    <li class="item item-extra${extra.tachado ? " item-tachado" : ""}">
      <label class="item-marca">
        <input type="checkbox" data-tachar-extra="${esc(extra.id)}"${extra.tachado ? " checked" : ""}>
        <span class="item-texto"><span class="item-nombre">${esc(extra.texto)}</span><span class="item-detalle">añadido a mano</span></span>
      </label>
      <button type="button" class="item-boton" data-quitar-extra="${esc(extra.id)}" aria-label="Quitar ${esc(extra.texto)}">Quitar</button>
    </li>`;
}

function pintarAjustes() {
  const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long" }) : "");
  const platos = estado.catalogo?.platos?.length ?? 0;
  const recetas = estado.mario?.recetas?.filter((r) => !r.pasada_a_catalogo).length ?? 0;

  $("#vista-ajustes").innerHTML = `
    <section class="ajuste">
      <h2>Catálogo de platos</h2>
      <p>${estado.catalogo ? `${platos} platos · subido el ${fecha(estado.catalogoFecha)}` : "Aún no se ha subido."}</p>
      <label class="boton-secundario boton-archivo">
        Subir catalogo-platos.json
        <input type="file" accept=".json,application/json" data-documento="catalogo" class="visualmente-oculto">
      </label>
      <p class="nota">Cuando Claude te pase el catálogo actualizado, súbelo aquí. Los menús ya hechos no cambian; los nuevos usan los platos nuevos.</p>
    </section>

    <section class="ajuste">
      <h2>Recetas de Mario</h2>
      <p>${estado.mario ? `${recetas} recetas que la web puede proponer · subido el ${fecha(estado.marioFecha)}` : "Aún no se han subido."}</p>
      <label class="boton-secundario boton-archivo">
        Subir mario-web.json
        <input type="file" accept=".json,application/json" data-documento="mario" class="visualmente-oculto">
      </label>
    </section>

    <section class="ajuste">
      <h2>Sesión</h2>
      <p>Has entrado como ${esc(estado.nombre)}.</p>
      <button type="button" class="boton-secundario" data-accion="salir">Cerrar sesión</button>
    </section>

    <section class="ajuste">
      <h2>Cómo se protege</h2>
      <p class="nota">El código de esta página es público (está en GitHub), pero los datos no: viven en Supabase y una regla de la base de datos solo se los entrega a nuestras dos cuentas.</p>
    </section>`;
}

// ---------- Ventana de una comida o cena ----------

function abrirHueco(dia, momento) {
  estado.huecoAbierto = { dia, momento };
  pintarDialogo();
  $("#dialogo-hueco").showModal();
}

function pintarDialogo() {
  const { dia, momento } = estado.huecoAbierto;
  const hueco = estado.menu.dias[dia][momento];
  const piezas = hueco.platos.map((c) => estado.piezas.get(c)).filter(Boolean);
  const avisos = avisosHueco(estado.menu, dia, momento, estado.piezas);

  $("#dialogo-titulo").textContent = `${NOMBRES_DIAS[dia]} · ${momento}`;

  const opcion = (nombre, valor, texto, marcado) => `
    <label class="segmento">
      <input type="radio" name="${nombre}" value="${valor}"${marcado ? " checked" : ""}>
      <span>${texto}</span>
    </label>`;

  const notaEstado = {
    cocinar: "",
    sobras: "Tiráis de lo que sobró: no suma a la compra.",
    fuera: "Coméis fuera: no suma a la compra ni cuenta para repetir proteína.",
  }[hueco.estado];

  $("#dialogo-cuerpo").innerHTML = `
    <fieldset class="segmentado">
      <legend>¿Qué hacemos?</legend>
      ${opcion("estado", "cocinar", "Cocinar", hueco.estado === "cocinar")}
      ${opcion("estado", "sobras", "Sobras", hueco.estado === "sobras")}
      ${opcion("estado", "fuera", "Fuera", hueco.estado === "fuera")}
    </fieldset>
    ${notaEstado ? `<p class="nota">${notaEstado}</p>` : ""}

    <fieldset class="segmentado"${hueco.estado === "fuera" ? " disabled" : ""}>
      <legend>¿Cuántos sois?</legend>
      ${opcion("personas", "1", "Solo yo", hueco.personas === 1)}
      ${opcion("personas", "2", "Los dos", hueco.personas === 2)}
    </fieldset>

    <h3 class="dialogo-subtitulo">Platos</h3>
    ${piezas.length ? `<ul class="lista-platos">${piezas.map(platoDialogo).join("")}</ul>` : `<p class="nota">Aún no hay ningún plato.</p>`}
    ${avisos.length ? `<p class="aviso-hueco">${avisos.map(esc).join(". ")}.</p>` : ""}

    <label for="anadir-plato" class="etiqueta">Añadir un plato</label>
    <select id="anadir-plato">${opcionesPlatos(momento, hueco.platos)}</select>

    <button type="button" class="boton-secundario" data-accion="otra-propuesta">Otra propuesta para este hueco</button>

    <label for="mover-a" class="etiqueta">Cambiar con otro día</label>
    <select id="mover-a">${opcionesMover(dia, momento)}</select>`;
}

function platoDialogo(pieza) {
  const ingredientes = pieza.ingredientes.filter((i) => i.nombre);
  const listaIngredientes = ingredientes.length
    ? `<ul class="lista-simple">${ingredientes
        .map((i) => {
          const cantidad = textoCantidad({ cantidad: i.cantidad, unidad: i.unidad });
          return `<li>${esc(i.nombre)}${cantidad ? ` · ${esc(cantidad)}` : ""}</li>`;
        })
        .join("")}</ul>`
    : `<p class="nota">Sin ingredientes apuntados todavía.</p>`;

  const raciones = pieza.raciones ? `Cantidades de la receta entera (salen ${pieza.raciones} ${pieza.raciones === 1 ? "ración" : "raciones"}).` : "";
  const pasos = pieza.pasos.length ? `<ol class="lista-simple">${pieza.pasos.map((p) => `<li>${esc(p)}</li>`).join("")}</ol>` : "";

  return `
    <li class="plato">
      <div class="plato-fila">
        <span class="plato-nombre">${esc(pieza.nombre)}${pieza.origen === "mario" ? ` <span class="chip chip-mario">Mario · nueva</span>` : ""}</span>
        <button type="button" class="enlace-boton" data-quitar="${esc(pieza.clave)}">Quitar</button>
      </div>
      <details>
        <summary>Ingredientes${pasos ? " y pasos" : ""}</summary>
        ${raciones ? `<p class="nota">${raciones}</p>` : ""}
        ${listaIngredientes}
        ${pasos}
        ${pieza.nota ? `<p class="nota">${esc(pieza.nota)}</p>` : ""}
        ${pieza.origen === "mario" ? `<p class="nota">Los pasos están en el libro de Mario.</p>` : ""}
        ${pieza.pendiente ? `<p class="nota">Falta por apuntar: ${esc(pieza.pendiente)}</p>` : ""}
      </details>
    </li>`;
}

function opcionesPlatos(momento, yaPuestos) {
  const disponibles = [...estado.piezas.values()].filter((p) => !yaPuestos.includes(p.clave));
  const deEsteMomento = disponibles.filter((p) => p.momento.includes(momento));
  const otros = disponibles.filter((p) => !p.momento.includes(momento));
  const ordenar = (lista) => [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const grupo = (titulo, lista) =>
    lista.length
      ? `<optgroup label="${esc(titulo)}">${ordenar(lista).map((p) => `<option value="${esc(p.clave)}">${esc(p.nombre)}</option>`).join("")}</optgroup>`
      : "";

  const catalogo = deEsteMomento.filter((p) => p.origen === "catalogo");
  return `
    <option value="">Elige…</option>
    ${grupo("Platos únicos", catalogo.filter((p) => p.tipo === "plato-unico"))}
    ${grupo("Primeros", catalogo.filter((p) => p.tipo === "primero"))}
    ${grupo("Segundos", catalogo.filter((p) => p.tipo === "segundo"))}
    ${grupo("Guarniciones", catalogo.filter((p) => p.tipo === "guarnicion"))}
    ${grupo("Recetas de Mario (nuevas)", deEsteMomento.filter((p) => p.origen === "mario"))}
    ${grupo(`Normalmente no son de ${momento}`, otros)}`;
}

function opcionesMover(diaActual, momentoActual) {
  const opciones = [];
  estado.menu.dias.forEach((dia, d) => {
    for (const momento of MOMENTOS) {
      if (d === diaActual && momento === momentoActual) continue;
      const hueco = dia[momento];
      const primero = estado.piezas.get(hueco.platos[0]);
      const resumen = hueco.estado === "fuera" ? "fuera" : primero ? nombreCorto(primero.nombre) : "vacío";
      opciones.push(`<option value="${d}-${momento}">${NOMBRES_DIAS[d]} ${momento} · ${esc(resumen)}</option>`);
    }
  });
  return `<option value="">Elige comida o cena…</option>${opciones.join("")}`;
}

// Aplica un cambio al hueco abierto, repinta y guarda
function cambiarHueco(cambio) {
  const { dia, momento } = estado.huecoAbierto;
  const menu = copiar(estado.menu);
  cambio(menu.dias[dia][momento]);
  estado.menu = menu;
  pintarMenu();
  pintarCompra();
  pintarDialogo();
  programarGuardado("menu");
}

async function otraPropuesta() {
  const { dia, momento } = estado.huecoAbierto;
  try {
    const { historial, semanaAnterior } = await leerHistorial();
    const platos = proponerHueco(estado.piezas, estado.menu, dia, momento, { historial, semanaAnterior });
    if (!platos) {
      avisar("No encuentro otra opción que cumpla las reglas. Elige un plato a mano.", "error");
      return;
    }
    cambiarHueco((hueco) => {
      hueco.platos = platos;
      hueco.estado = "cocinar";
    });
  } catch (error) {
    console.error(error);
    avisar("No se ha podido proponer otra cosa. Revisa la conexión.", "error");
  }
}

function moverHueco(destino) {
  const [d, momento] = destino.split("-");
  const origen = estado.huecoAbierto;
  estado.menu = intercambiar(estado.menu, origen, { dia: Number(d), momento });
  $("#dialogo-hueco").close();
  pintarMenu();
  pintarCompra();
  programarGuardado("menu");
  avisar(`Cambiado con el ${NOMBRES_DIAS[d].toLowerCase()} (${momento})`);
}

// ---------- Acciones de la semana y la compra ----------

async function proponerMenu() {
  if (estado.menu && !confirm("¿Cambiar el menú de toda la semana por una propuesta nueva? Se pierden los cambios que hayáis hecho.")) return;
  try {
    const { historial, semanaAnterior } = await leerHistorial();
    estado.menu = proponerSemana(estado.piezas, { historial, semanaAnterior, personas: PERSONAS_POR_DEFECTO });
    // Lo tachado era de la lista anterior; lo que hay en casa y lo añadido a mano se mantiene
    estado.compra = { ...estado.compra, tachados: [] };
    pintar();
    await datos.guardarMenu(estado.lunes, estado.menu);
    await datos.guardarCompra(estado.lunes, estado.compra);
    avisar("Menú propuesto y guardado");
  } catch (error) {
    console.error(error);
    avisar("No se ha podido guardar el menú. Revisa la conexión.", "error");
  }
}

function alternar(lista, valor) {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}

function cambiarCompra(cambio, enfocar) {
  const compra = copiar(estado.compra);
  cambio(compra);
  estado.compra = compra;
  pintarCompra();
  programarGuardado("compra");
  // Tras repintar, se vuelve a poner el foco donde estaba (útil con teclado)
  if (enfocar) document.querySelector(enfocar)?.focus();
}

async function compartirCompra() {
  const r = calcularCompra(estado.menu, estado.piezas, estado.compra);
  const texto = textoParaCompartir(r, `Compra · semana del ${fechaCorta(estado.lunes)}`);
  try {
    if (navigator.share) {
      await navigator.share({ title: "Lista de la compra", text: texto });
    } else {
      await navigator.clipboard.writeText(texto);
      avisar("Lista copiada: pégala en WhatsApp o Notas");
    }
  } catch (error) {
    // Si se cierra el menú de compartir sin elegir nada, no es un error
    if (error.name !== "AbortError") avisar("No se ha podido compartir.", "error");
  }
}

async function subirDocumento(input) {
  const clave = input.dataset.documento;
  const archivo = input.files[0];
  if (!archivo) return;
  try {
    const contenido = JSON.parse(await archivo.text());
    const valido = clave === "catalogo" ? Array.isArray(contenido.platos) : Array.isArray(contenido.recetas);
    if (!valido) {
      avisar(clave === "catalogo" ? "Ese archivo no parece el catálogo de platos." : "Ese archivo no parece el de recetas de Mario.", "error");
      return;
    }
    await datos.guardarDocumento(clave, contenido);
    await cargarDocumentos();
    pintar();
    avisar(clave === "catalogo" ? `Catálogo actualizado: ${contenido.platos.length} platos` : "Recetas de Mario actualizadas");
  } catch (error) {
    console.error(error);
    avisar(error instanceof SyntaxError ? "El archivo no es un JSON válido." : "No se ha podido subir. Revisa la conexión.", "error");
  } finally {
    input.value = "";
  }
}

function cambiarPestana(nombre) {
  estado.pestana = nombre;
  for (const pestana of ["menu", "compra", "ajustes"]) {
    const activa = pestana === nombre;
    const boton = $(`#pestana-${pestana}`);
    boton.setAttribute("aria-selected", String(activa));
    boton.tabIndex = activa ? 0 : -1;
    $(`#vista-${pestana}`).hidden = !activa;
  }
}

// ---------- Eventos ----------

function conectarEventos() {
  $("#form-acceso").addEventListener("submit", enviarAcceso);

  $("#semana-anterior").addEventListener("click", () => cargarSemana(sumarDias(estado.lunes, -7)));
  $("#semana-siguiente").addEventListener("click", () => cargarSemana(sumarDias(estado.lunes, 7)));
  $("#ir-a-hoy").addEventListener("click", () => cargarSemana(lunesDe()));

  // Pestañas: clic y flechas del teclado
  const pestanas = ["menu", "compra", "ajustes"];
  for (const nombre of pestanas) {
    $(`#pestana-${nombre}`).addEventListener("click", () => cambiarPestana(nombre));
  }
  $(".pestanas").addEventListener("keydown", (evento) => {
    if (evento.key !== "ArrowRight" && evento.key !== "ArrowLeft") return;
    const paso = evento.key === "ArrowRight" ? 1 : -1;
    const siguiente = pestanas[(pestanas.indexOf(estado.pestana) + paso + pestanas.length) % pestanas.length];
    cambiarPestana(siguiente);
    $(`#pestana-${siguiente}`).focus();
  });

  // Un solo "escuchador" para todo el panel: mira qué se ha pulsado
  $("#panel").addEventListener("click", (evento) => {
    const objetivo = evento.target.closest("button");
    if (!objetivo) return;
    if (objetivo.dataset.dia) return abrirHueco(Number(objetivo.dataset.dia), objetivo.dataset.momento);
    if (objetivo.dataset.ir) return cambiarPestana(objetivo.dataset.ir);
    if (objetivo.dataset.accion === "proponer") return proponerMenu();
    if (objetivo.dataset.accion === "compartir") return compartirCompra();
    if (objetivo.dataset.accion === "salir") return salir();
    if (objetivo.dataset.enCasa) {
      const clave = objetivo.dataset.enCasa;
      return cambiarCompra((c) => (c.enCasa = alternar(c.enCasa, clave)));
    }
    if (objetivo.dataset.devolver) {
      const clave = objetivo.dataset.devolver;
      return cambiarCompra((c) => (c.enCasa = c.enCasa.filter((v) => v !== clave)));
    }
    if (objetivo.dataset.quitarExtra) {
      const id = objetivo.dataset.quitarExtra;
      return cambiarCompra((c) => (c.extras = c.extras.filter((e) => e.id !== id)));
    }
  });

  $("#panel").addEventListener("change", (evento) => {
    const objetivo = evento.target;
    if (objetivo.dataset.tachar) {
      const clave = objetivo.dataset.tachar;
      return cambiarCompra((c) => (c.tachados = alternar(c.tachados, clave)), `[data-tachar="${CSS.escape(clave)}"]`);
    }
    if (objetivo.dataset.tacharExtra) {
      const id = objetivo.dataset.tacharExtra;
      return cambiarCompra(
        (c) => c.extras.forEach((e) => { if (e.id === id) e.tachado = !e.tachado; }),
        `[data-tachar-extra="${CSS.escape(id)}"]`
      );
    }
    if (objetivo.dataset.documento) return subirDocumento(objetivo);
  });

  $("#panel").addEventListener("submit", (evento) => {
    if (evento.target.id !== "form-extra") return;
    evento.preventDefault();
    const texto = $("#extra-texto").value.trim();
    if (!texto) return;
    const seccion = $("#extra-seccion").value;
    cambiarCompra((c) => c.extras.push({ id: crypto.randomUUID(), texto, seccion, tachado: false }), "#extra-texto");
  });

  // Ventana de comida/cena
  const dialogo = $("#dialogo-hueco");
  dialogo.addEventListener("click", (evento) => {
    // Clic en el fondo oscuro o en un botón de cerrar
    if (evento.target === dialogo || evento.target.closest("[data-cerrar]")) return dialogo.close();
    const objetivo = evento.target.closest("button");
    if (!objetivo) return;
    if (objetivo.dataset.quitar) {
      const clave = objetivo.dataset.quitar;
      return cambiarHueco((h) => (h.platos = h.platos.filter((c) => c !== clave)));
    }
    if (objetivo.dataset.accion === "otra-propuesta") return otraPropuesta();
  });
  dialogo.addEventListener("change", (evento) => {
    const objetivo = evento.target;
    if (objetivo.name === "estado") return cambiarHueco((h) => (h.estado = objetivo.value));
    if (objetivo.name === "personas") return cambiarHueco((h) => (h.personas = Number(objetivo.value)));
    if (objetivo.id === "anadir-plato" && objetivo.value) {
      const clave = objetivo.value;
      return cambiarHueco((h) => {
        h.platos.push(clave);
        if (h.estado === "fuera") h.estado = "cocinar";
      });
    }
    if (objetivo.id === "mover-a" && objetivo.value) return moverHueco(objetivo.value);
  });
  dialogo.addEventListener("close", () => (estado.huecoAbierto = null));

  // Al volver a la pestaña del navegador, se recarga la semana por si la otra persona ha cambiado algo
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible" || $("#panel").hidden) return;
    if (hayGuardadosPendientes() || estado.huecoAbierto) return;
    try {
      const fila = await datos.leerSemana(estado.lunes);
      const menu = fila?.menu ?? null;
      const compra = { ...compraVacia(), ...(fila?.compra ?? {}) };
      if (JSON.stringify(menu) !== JSON.stringify(estado.menu) || JSON.stringify(compra) !== JSON.stringify(estado.compra)) {
        estado.menu = menu;
        estado.compra = compra;
        pintar();
      }
    } catch (error) {
      console.error(error);
    }
  });
}

iniciar();
