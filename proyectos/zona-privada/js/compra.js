// ===== Lista de la compra =====
// Funciones puras: a partir del menú de la semana calcula qué comprar, agrupado por sección del súper.
//
// Lo que se guarda de la compra (lo que tocáis a mano):
// { tachados: [clave…], enCasa: [clave…], extras: [{ id, texto, seccion, tachado }] }

import { MOMENTOS } from "./menu.js";
import { NOMBRES_DIAS } from "./fechas.js";

export const SECCIONES = [
  "Fruta y verdura",
  "Carne",
  "Pescado y marisco",
  "Charcutería y quesos",
  "Huevos, lácteos y frescos",
  "Pan y tortillas",
  "Despensa",
  "Congelados",
  "Platos preparados",
  "Otros",
];

export function compraVacia() {
  return { tachados: [], enCasa: [], extras: [] };
}

// Quita tildes y pasa a minúsculas para comparar textos
export function normalizarTexto(texto) {
  return (texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// Cosas que casi siempre hay en casa: van aparte, "mira si te queda"
const BASICOS = [
  /^sal\b/, /\bpimienta\b/, /aceite/, /vinagre/, /en polvo/, /\bcomino/, /oregano/,
  /\bcurri/, /pimenton/, /canela/, /curcuma/, /\blaurel/, /salsa de soja/, /especias/, /edulcorante|estevia|sucralosa/,
];

// Reglas para adivinar la sección. Van en orden: gana la primera que encaja.
const REGLAS_SECCION = [
  [/congelad/, "Congelados"],
  [/preparad|precocinad/, "Platos preparados"],
  [/\blatas?\b|\bbotes?\b|\bbrick\b|conserva|tomate (natural )?triturado|tomate frito|pan rallado/, "Despensa"],
  [/queso fresco batido|skyr|yogur|cottage|requeson|\bnata\b|leche\b|\bhuev|clara|noqui|gnocchi|tofu|hummus/, "Huevos, lácteos y frescos"],
  [/queso|jamon|lomo embuchado|fiambre|pavo recomendable|carpaccio/, "Charcutería y quesos"],
  [/pollo|pavo|ternera|cerdo|solomillo|contramuslo|muslo|pechuga|carne|hamburguesa|lomo\b/, "Carne"],
  [/salmon|atun|merluza|bacalao|gamba|langostino|sepia|calamar|chipiron|mejillon|berberecho|marisco|pescado|huevas/, "Pescado y marisco"],
  [/\bpan\b|tortillas? de (trigo|maiz)|fajitas? de|tostas|thins|wasa/, "Pan y tortillas"],
  [/pasta|espagueti|arroz|quinoa|cuscus|lenteja|garbanzo|alubia|guisante en lata|harina|avena|sazonador|miel|mostaza|pisto|sopa|caldo|salsa|aceituna|tahini|leche de coco|maiz|edamame|soja texturizada|semillas|frutos secos|anacardo|chocolate|cacao|mermelada|crema de/, "Despensa"],
  [/pimiento|cebolla|cebolleta|chalota|puerro|\bajos?\b|tomate|cherri|calabacin|berenjena|brocoli|coliflor|lechuga|cogollo|espinaca|rucula|canonigo|zanahoria|patata|papa|boniato|seta|shiitake|champinon|limon|lima|naranja|aguacate|perejil|cilantro|albahaca|esparrago|pepino|judia|calabaza|repollo|jengibre fresco|guisante|platano|manzana|fresa|fruta|verdura/, "Fruta y verdura"],
];

export function seccionDe(nombre) {
  const texto = normalizarTexto(nombre);
  for (const [regla, seccion] of REGLAS_SECCION) if (regla.test(texto)) return seccion;
  return "Otros";
}

function capitalizar(texto) {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : texto;
}

export function esBasico(nombre) {
  const texto = normalizarTexto(nombre);
  return BASICOS.some((regla) => regla.test(texto));
}

// "tomates (de rama)" → { principal: "tomates", detalle: "de rama" }
// Lo que va desde el primer paréntesis es una aclaración: se enseña en pequeño.
export function separarNombre(nombre = "") {
  const inicio = nombre.indexOf("(");
  if (inicio <= 0) return { principal: nombre.trim(), detalle: "" };
  return {
    principal: nombre.slice(0, inicio).trim().replace(/,$/, ""),
    detalle: nombre.slice(inicio).replace(/[()]/g, "").trim(),
  };
}

// Cuánto hay que multiplicar las cantidades de la receta
function factorRaciones(pieza, ingrediente, personas) {
  if (pieza.raciones) return personas / pieza.raciones;
  // "arroz (90 g por persona)": la cantidad ya es por persona
  if (/por persona/i.test(ingrediente.nombre)) return personas;
  // Sin saber cuántas raciones salen, se deja tal cual
  return 1;
}

// Calcula la lista. Devuelve { secciones, basicos, enCasa, extras, porRevisar, totales }
export function calcularCompra(menu, piezas, estado = compraVacia()) {
  const items = new Map();
  const porRevisar = new Set();

  // Junta en una línea todo lo que se llama igual (el mismo ingrediente en dos platos distintos).
  // Solo se separa si tiene cantidades en unidades distintas (500 g y 2 ud no se pueden sumar).
  const anotar = (datos, uso) => {
    const base = normalizarTexto(datos.nombre);
    const existente = items.get(base);
    const clave =
      existente && datos.cantidad != null && existente.cantidad != null && existente.unidad !== datos.unidad
        ? `${base}|${datos.unidad}`
        : base;

    if (!items.has(clave)) {
      items.set(clave, { clave, ...datos, nombre: capitalizar(datos.nombre), cantidad: null, faltaCantidad: false, usos: [] });
    }
    const item = items.get(clave);
    if (datos.cantidad == null) {
      item.faltaCantidad = true;
    } else {
      if (item.cantidad == null) item.unidad = datos.unidad;
      item.cantidad = (item.cantidad ?? 0) + datos.cantidad;
    }
    if (!item.detalle && datos.detalle) item.detalle = datos.detalle;
    if (!item.usos.includes(uso)) item.usos.push(uso);
  };

  menu?.dias?.forEach((dia, d) => {
    for (const momento of MOMENTOS) {
      const hueco = dia[momento];
      // Las sobras y las comidas fuera no suman a la compra
      if (hueco.estado !== "cocinar") continue;
      const uso = `${NOMBRES_DIAS[d].slice(0, 3).toLowerCase()} ${momento}`;

      for (const clavePlato of hueco.platos) {
        const pieza = piezas.get(clavePlato);
        if (!pieza) continue;

        const conDatos = pieza.ingredientes.filter((i) => i.nombre);
        if (!conDatos.length) {
          // Plato sin ingredientes en el catálogo: sale el propio plato para no olvidarlo
          porRevisar.add(pieza.nombre);
          const { principal } = separarNombre(pieza.nombre);
          const seccion = seccionDe(principal);
          anotar(
            { nombre: principal, detalle: "ingredientes sin apuntar", unidad: null, cantidad: null,
              seccion: seccion === "Otros" ? "Sin detallar" : seccion, basico: false },
            uso
          );
          continue;
        }

        if (!pieza.raciones || conDatos.some((i) => i.cantidad == null)) porRevisar.add(pieza.nombre);

        for (const ingrediente of conDatos) {
          const { principal, detalle } = separarNombre(ingrediente.nombre);
          const cantidad =
            ingrediente.cantidad == null ? null : ingrediente.cantidad * factorRaciones(pieza, ingrediente, hueco.personas);
          anotar(
            { nombre: principal, detalle, unidad: ingrediente.unidad ?? null, cantidad,
              seccion: seccionDe(principal), basico: esBasico(principal) },
            uso
          );
        }
      }
    }
  });

  const tachados = new Set(estado.tachados ?? []);
  const enCasaClaves = new Set(estado.enCasa ?? []);
  const lista = [...items.values()].map((item) => ({
    ...item,
    texto: textoCantidad(item),
    tachado: tachados.has(item.clave),
    enCasa: enCasaClaves.has(item.clave),
  }));

  const ordenAlfabetico = (a, b) => a.nombre.localeCompare(b.nombre, "es");
  const visibles = lista.filter((i) => !i.enCasa && !i.basico);
  const nombresSecciones = [...SECCIONES, "Sin detallar"];

  const extras = (estado.extras ?? []).map((e) => ({ ...e }));
  const secciones = nombresSecciones
    .map((nombre) => ({
      nombre,
      items: visibles.filter((i) => i.seccion === nombre).sort(ordenAlfabetico),
      extras: extras.filter((e) => (e.seccion || "Otros") === nombre),
    }))
    .filter((s) => s.items.length || s.extras.length);

  const basicos = lista.filter((i) => i.basico && !i.enCasa).sort(ordenAlfabetico);
  const enCasa = lista.filter((i) => i.enCasa).sort(ordenAlfabetico);

  const pendientes = [...visibles, ...basicos].filter((i) => !i.tachado).length + extras.filter((e) => !e.tachado).length;
  const total = visibles.length + basicos.length + extras.length;

  return { secciones, basicos, enCasa, porRevisar: [...porRevisar].sort(), totales: { total, pendientes } };
}

// "250 g", "1,5 kg", "3 ud", "2 cdta"; con "≈" si alguna parte no tiene cantidad
export function textoCantidad(item) {
  if (item.cantidad == null || !item.cantidad) return "";
  let cantidad = item.cantidad;
  let unidad = item.unidad ?? "";

  if (unidad === "g" && cantidad >= 1000) {
    cantidad /= 1000;
    unidad = "kg";
  } else if (unidad === "ml" && cantidad >= 1000) {
    cantidad /= 1000;
    unidad = "l";
  }

  // Unidades sueltas: se redondea hacia arriba a medias (1,5 pimientos)
  if (unidad === "ud") cantidad = Math.ceil(cantidad * 2) / 2;
  else if (unidad === "g" || unidad === "ml") cantidad = Math.round(cantidad);
  else cantidad = Math.round(cantidad * 10) / 10;

  const numero = cantidad.toLocaleString("es-ES", { maximumFractionDigits: 2 });
  const texto = unidad ? `${numero} ${unidad}` : numero;
  return item.faltaCantidad ? `≈ ${texto} o más` : texto;
}

// Texto para compartir por WhatsApp o Notas: solo lo que falta por comprar
export function textoParaCompartir(resultado, titulo) {
  const lineas = [titulo, ""];
  for (const seccion of resultado.secciones) {
    const pendientes = [
      ...seccion.items.filter((i) => !i.tachado).map((i) => `- ${i.nombre}${i.texto ? ` · ${i.texto}` : ""}`),
      ...seccion.extras.filter((e) => !e.tachado).map((e) => `- ${e.texto}`),
    ];
    if (!pendientes.length) continue;
    lineas.push(`*${seccion.nombre}*`, ...pendientes, "");
  }
  const basicos = resultado.basicos.filter((i) => !i.tachado);
  if (basicos.length) {
    lineas.push("*Básicos (mira si queda)*", ...basicos.map((i) => `- ${i.nombre}`), "");
  }
  return lineas.join("\n").trim();
}
