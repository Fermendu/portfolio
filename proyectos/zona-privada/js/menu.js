// ===== Menú semanal =====
// Funciones "puras": reciben datos y devuelven datos, sin tocar la página ni Supabase.
// Así se pueden probar solas y el resto del código solo las usa.
//
// Cómo se guarda un menú:
// {
//   version: 1,
//   dias: [                                    // 7 días, de lunes a domingo
//     { comida: HUECO, cena: HUECO }, …
//   ]
// }
// HUECO = { platos: ["catalogo:id-de-un-plato", "catalogo:id-de-una-guarnicion"],
//           personas: 2, estado: "cocinar" | "sobras" | "fuera" }

export const MOMENTOS = ["comida", "cena"];
export const ESTADOS = ["cocinar", "sobras", "fuera"];
export const PERSONAS_POR_DEFECTO = 2;

// ---------- Piezas: platos del catálogo y recetas de Mario con la misma forma ----------

// Junta el catálogo y las recetas de Mario en un Map clave → pieza.
export function crearPiezas(catalogo, mario) {
  const piezas = new Map();

  for (const plato of catalogo?.platos ?? []) {
    const pieza = normalizar(plato, "catalogo");
    piezas.set(pieza.clave, pieza);
  }

  for (const receta of mario?.recetas ?? []) {
    // Las de Mario que ya pasaron al catálogo cuentan como platos de Mendu
    if (receta.pasada_a_catalogo) continue;
    const pieza = normalizar({ ...receta, tipo: "plato-unico" }, "mario");
    piezas.set(pieza.clave, pieza);
  }

  return piezas;
}

function normalizar(plato, origen) {
  return {
    clave: `${origen}:${plato.id}`,
    origen,
    id: plato.id,
    nombre: plato.nombre,
    momento: plato.momento ?? [],
    tipo: plato.tipo ?? "plato-unico",
    proteina: plato.proteina_principal ?? null,
    aporta: plato.aporta ?? [],
    etiquetas: plato.etiquetas ?? [],
    frecuencia: plato.frecuencia ?? null,
    raciones: plato.raciones_que_salen ?? null,
    ingredientes: plato.ingredientes ?? [],
    pasos: plato.pasos ?? [],
    pendiente: plato.pendiente ?? "",
    nota: plato.nota ?? "",
  };
}

// Identificador de la proteína de una pieza, o null si no aporta proteína.
// Si el catálogo aún no dice cuál es, se usa una propia del plato para no confundirla con otras.
export function proteinaDe(pieza) {
  if (!pieza) return null;
  if (pieza.proteina) return pieza.proteina;
  return pieza.aporta.includes("proteina") ? `sin-dato:${pieza.clave}` : null;
}

// ---------- Menú vacío y utilidades ----------

export function huecoVacio(personas = PERSONAS_POR_DEFECTO) {
  return { platos: [], personas, estado: "cocinar" };
}

export function menuVacio(personas = PERSONAS_POR_DEFECTO) {
  return {
    version: 1,
    dias: Array.from({ length: 7 }, () => ({ comida: huecoVacio(personas), cena: huecoVacio(personas) })),
  };
}

// Copia profunda sencilla (los menús son JSON)
export function copiar(objeto) {
  return JSON.parse(JSON.stringify(objeto));
}

// Proteínas de un hueco (las comidas fuera no cuentan)
function proteinasHueco(hueco, piezas) {
  const resultado = new Set();
  if (!hueco || hueco.estado === "fuera") return resultado;
  for (const clave of hueco.platos) {
    const proteina = proteinaDe(piezas.get(clave));
    if (proteina) resultado.add(proteina);
  }
  return resultado;
}

function proteinasDia(dia, piezas, excepto = null) {
  const resultado = new Set();
  if (!dia) return resultado;
  for (const momento of MOMENTOS) {
    if (momento === excepto) continue;
    for (const p of proteinasHueco(dia[momento], piezas)) resultado.add(p);
  }
  return resultado;
}

// Cuántas veces sale cada plato en un menú
function contarUsos(menu, excepto = null) {
  const usos = new Map();
  menu.dias.forEach((dia, d) => {
    for (const momento of MOMENTOS) {
      if (excepto && excepto.dia === d && excepto.momento === momento) continue;
      for (const clave of dia[momento].platos) usos.set(clave, (usos.get(clave) ?? 0) + 1);
    }
  });
  return usos;
}

// ---------- Reglas ----------

// ¿Se puede usar este plato esta semana según su "frecuencia" y lo que salió en semanas anteriores?
// historial: [{ semanasAtras: 1, menu }, …]
function frecuenciaPermite(pieza, usosSemana, historial, relajacion) {
  const usadoHace = (n) => historial.some((h) => h.semanasAtras <= n && contarUsos(h.menu).has(pieza.clave));
  const usos = usosSemana.get(pieza.clave) ?? 0;

  switch (pieza.frecuencia) {
    case "mensual":
      return usos === 0 && !usadoHace(3);
    case "quincenal":
      return usos === 0 && !usadoHace(1);
    default:
      // Sin frecuencia o semanal: como mucho una vez por semana (dos si no queda otra)
      return usos < (relajacion >= 1 ? 2 : 1);
  }
}

function sirveParaMomento(pieza, momento) {
  return pieza.momento.includes(momento);
}

// Peso para elegir al azar: lo rápido entre semana, lo de finde el finde
function peso(pieza, esFinde) {
  let p = 1;
  if (pieza.tipo === "plato-unico") p *= 1.5;
  if (pieza.tipo === "primero") p *= 0.6;
  if (pieza.etiquetas.includes("finde") && esFinde) p *= 6;
  if (pieza.etiquetas.includes("rápido") && !esFinde) p *= 1.5;
  return p;
}

// Elige uno al azar según su peso
function elegirPonderado(lista, pesoDe, aleatorio) {
  const total = lista.reduce((suma, x) => suma + pesoDe(x), 0);
  let r = aleatorio() * total;
  for (const x of lista) {
    r -= pesoDe(x);
    if (r <= 0) return x;
  }
  return lista[lista.length - 1];
}

// Desordena una lista según los pesos (los de más peso suelen salir antes)
function ordenarPonderado(lista, pesoDe, aleatorio) {
  const quedan = [...lista];
  const resultado = [];
  while (quedan.length) {
    const elegido = elegirPonderado(quedan, pesoDe, aleatorio);
    resultado.push(elegido);
    quedan.splice(quedan.indexOf(elegido), 1);
  }
  return resultado;
}

// Guarnición menos usada esta semana (con algo de azar para desempatar)
function elegirGuarnicion(piezas, momento, necesidad, usosSemana, aleatorio) {
  const candidatas = [...piezas.values()].filter(
    (p) => p.tipo === "guarnicion" && sirveParaMomento(p, momento) && p.aporta.includes(necesidad) && (usosSemana.get(p.clave) ?? 0) < 5
  );
  if (!candidatas.length) return null;
  const minimo = Math.min(...candidatas.map((p) => usosSemana.get(p.clave) ?? 0));
  const menosUsadas = candidatas.filter((p) => (usosSemana.get(p.clave) ?? 0) === minimo);
  return menosUsadas[Math.floor(aleatorio() * menosUsadas.length)];
}

// A partir de un plato base, añade lo que falte para tener proteína + hidrato + verdura.
// Devuelve la lista de piezas del hueco, o null si no hay forma de cumplir la regla de proteína.
function completarHueco(base, momento, ctx) {
  const { piezas, usosSemana, prohibidas, historial, relajacion, aleatorio, esFinde } = ctx;
  const hueco = [base];
  const cubre = new Set(base.aporta);

  // Proteína: si la base no la trae, se añade un segundo
  if (!cubre.has("proteina")) {
    const segundos = [...piezas.values()].filter(
      (p) =>
        p.tipo === "segundo" &&
        p.origen === "catalogo" &&
        sirveParaMomento(p, momento) &&
        !prohibidas.has(proteinaDe(p)) &&
        frecuenciaPermite(p, usosSemana, historial, relajacion)
    );
    if (!segundos.length) return null;
    const segundo = elegirPonderado(segundos, (p) => peso(p, esFinde), aleatorio);
    hueco.push(segundo);
    segundo.aporta.forEach((a) => cubre.add(a));
  }

  // Con un primero (una sopa, un arroz…) no se añade otro hidrato
  const necesidades = base.tipo === "primero" ? ["verdura"] : ["hidrato", "verdura"];
  for (const necesidad of necesidades) {
    if (cubre.has(necesidad)) continue;
    const guarnicion = elegirGuarnicion(piezas, momento, necesidad, usosSemana, aleatorio);
    if (guarnicion) {
      hueco.push(guarnicion);
      guarnicion.aporta.forEach((a) => cubre.add(a));
    }
  }

  // Regla: proteína en cada comida
  if (!cubre.has("proteina")) return null;
  return hueco;
}

// Bases posibles para un hueco
function basesPara(piezas, momento, esFinde, soloMario) {
  return [...piezas.values()].filter((p) => {
    if (p.tipo === "guarnicion") return false;
    if (!sirveParaMomento(p, momento)) return false;
    if (soloMario !== (p.origen === "mario")) return false;
    // Un plato único sin proteína (p. ej. quesadillas sin relleno definido) no se propone solo
    if (p.tipo === "plato-unico" && !p.aporta.includes("proteina")) return false;
    // Lo de finde, solo el finde
    if (p.etiquetas.includes("finde") && !esFinde) return false;
    return true;
  });
}

// Intenta rellenar un hueco. Devuelve la lista de claves o null.
function proponerPlatos(menu, d, momento, ctx, soloMario) {
  const { piezas, historial, relajacion, aleatorio, semanaAnterior } = ctx;
  const esFinde = d >= 5;
  const usosSemana = contarUsos(menu, { dia: d, momento });

  // Proteínas que no pueden repetirse: la otra comida del día y, salvo relajación fuerte, el día de antes y el de después
  const prohibidas = proteinasDia(menu.dias[d], piezas, momento);
  if (relajacion < 2) {
    const diaAnterior = d > 0 ? menu.dias[d - 1] : semanaAnterior?.dias?.[6];
    for (const p of proteinasDia(diaAnterior, piezas)) prohibidas.add(p);
    if (d < 6) for (const p of proteinasDia(menu.dias[d + 1], piezas)) prohibidas.add(p);

    // Variedad: la misma proteína como mucho 3 veces por semana
    const vecesProteina = new Map();
    menu.dias.forEach((dia, i) => {
      for (const m of MOMENTOS) {
        if (i === d && m === momento) continue;
        for (const p of proteinasHueco(dia[m], piezas)) vecesProteina.set(p, (vecesProteina.get(p) ?? 0) + 1);
      }
    });
    for (const [p, veces] of vecesProteina) if (veces >= 3) prohibidas.add(p);
  }

  const bases = basesPara(piezas, momento, esFinde, soloMario).filter((p) => frecuenciaPermite(p, usosSemana, historial, relajacion));
  const contexto = { ...ctx, usosSemana, prohibidas, esFinde };

  for (const base of ordenarPonderado(bases, (p) => peso(p, esFinde), aleatorio)) {
    if (prohibidas.has(proteinaDe(base))) continue;
    const hueco = completarHueco(base, momento, contexto);
    if (!hueco) continue;
    const proteinas = hueco.map(proteinaDe).filter(Boolean);
    if (proteinas.some((p) => prohibidas.has(p))) continue;
    return hueco.map((p) => p.clave);
  }
  return null;
}

// ---------- Propuestas ----------

// Propone la semana entera.
// opciones: { historial, semanaAnterior, personas, recetasMario (nº o null = 1-2 al azar), aleatorio }
export function proponerSemana(piezas, opciones = {}) {
  const aleatorio = opciones.aleatorio ?? Math.random;
  const personas = opciones.personas ?? PERSONAS_POR_DEFECTO;
  const historial = opciones.historial ?? [];
  const huecos = [];
  for (let d = 0; d < 7; d++) for (const momento of MOMENTOS) huecos.push({ d, momento });

  const hayMario = (momento) => [...piezas.values()].some((p) => p.origen === "mario" && sirveParaMomento(p, momento));
  const cuantasMario = opciones.recetasMario ?? (aleatorio() < 0.5 ? 1 : 2);

  // Se prueba muchas veces al azar; si no sale, se van aflojando las reglas poco a poco
  for (let intento = 0; intento < 400; intento++) {
    const relajacion = Math.floor(intento / 100); // 0 estricto … 3 casi libre
    const ctx = { piezas, historial, relajacion, aleatorio, semanaAnterior: opciones.semanaAnterior };
    const menu = menuVacio(personas);

    // Huecos reservados para recetas de Mario
    const posibles = huecos.filter((h) => hayMario(h.momento));
    const huecosMario = new Set();
    while (huecosMario.size < Math.min(cuantasMario, posibles.length)) {
      const h = posibles[Math.floor(aleatorio() * posibles.length)];
      huecosMario.add(`${h.d}-${h.momento}`);
    }

    let completo = true;
    let marioPuestas = 0;
    for (const { d, momento } of huecos) {
      const esMario = huecosMario.has(`${d}-${momento}`);
      let platos = proponerPlatos(menu, d, momento, ctx, esMario);
      if (platos && esMario) marioPuestas++;
      // Si la de Mario no encaja ese día, se pone un plato propio
      if (!platos && esMario) platos = proponerPlatos(menu, d, momento, ctx, false);
      if (!platos) {
        completo = false;
        break;
      }
      menu.dias[d][momento].platos = platos;
    }
    // Se acepta si está completo; al principio, además, se exige que hayan entrado las de Mario
    if (completo && (marioPuestas >= huecosMario.size || intento >= 150)) return menu;
  }

  // No debería pasar con un catálogo normal: se devuelve vacío para rellenarlo a mano
  return menuVacio(personas);
}

// Propone otra cosa para un solo hueco, respetando el resto de la semana. Solo platos del catálogo.
export function proponerHueco(piezas, menu, d, momento, opciones = {}) {
  const aleatorio = opciones.aleatorio ?? Math.random;
  const actuales = menu.dias[d][momento].platos;
  let soloCambiaGuarnicion = null;
  for (let relajacion = 0; relajacion <= 3; relajacion++) {
    const ctx = { piezas, historial: opciones.historial ?? [], relajacion, aleatorio, semanaAnterior: opciones.semanaAnterior };
    // Varios intentos: se busca otro plato principal, no solo otra guarnición
    for (let intento = 0; intento < 20; intento++) {
      const platos = proponerPlatos(menu, d, momento, ctx, false);
      if (!platos) continue;
      if (platos[0] !== actuales[0]) return platos;
      if (!soloCambiaGuarnicion && platos.some((c) => !actuales.includes(c))) soloCambiaGuarnicion = platos;
    }
  }
  return soloCambiaGuarnicion;
}

// Intercambia dos huecos (p. ej. la cena del martes con la del jueves)
export function intercambiar(menu, a, b) {
  const nuevo = copiar(menu);
  const temporal = nuevo.dias[a.dia][a.momento];
  nuevo.dias[a.dia][a.momento] = nuevo.dias[b.dia][b.momento];
  nuevo.dias[b.dia][b.momento] = temporal;
  return nuevo;
}

// Avisos sobre el menú para enseñar en la web (no bloquean nada)
export function avisosHueco(menu, d, momento, piezas) {
  const hueco = menu.dias[d][momento];
  if (hueco.estado === "fuera") return [];
  const avisos = [];
  const piezasHueco = hueco.platos.map((c) => piezas.get(c)).filter(Boolean);
  const cubre = new Set(piezasHueco.flatMap((p) => p.aporta));
  if (hueco.platos.length && !cubre.has("proteina")) avisos.push("Sin proteína");

  const propias = proteinasHueco(hueco, piezas);
  const vecinos = [d > 0 ? menu.dias[d - 1] : null, d < 6 ? menu.dias[d + 1] : null];
  const repetidas = [...propias].filter(
    (p) => !p.startsWith("sin-dato") && vecinos.some((dia) => proteinasDia(dia, piezas).has(p))
  );
  if (repetidas.length) avisos.push(`Repite ${repetidas.join(", ")} en días seguidos`);
  return avisos;
}
