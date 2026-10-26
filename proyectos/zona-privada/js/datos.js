// ===== Datos: todo lo que habla con Supabase =====
// El resto de la página no sabe nada de Supabase: solo llama a estas funciones.
// Si un día cambias de base de datos, solo hay que tocar este archivo.

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

export const configurado = !SUPABASE_URL.includes("TU-PROYECTO") && !SUPABASE_KEY.includes("PEGA_AQUI");

// La sesión se guarda en el navegador: no hace falta volver a entrar cada vez
const supabase = configurado ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Supabase devuelve { data, error }: si hay error, lo lanzamos para tratarlo en un solo sitio
function comprobar({ data, error }) {
  if (error) throw error;
  return data;
}

// ---------- Sesión ----------

export async function sesionActual() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function iniciarSesion(email, contrasena) {
  return comprobar(await supabase.auth.signInWithPassword({ email, password: contrasena }));
}

export async function cerrarSesion() {
  await supabase.auth.signOut();
}

// Nombre del miembro (o null si la cuenta existe pero no está en la tabla miembros)
export async function leerMiembro() {
  const fila = comprobar(await supabase.from("miembros").select("nombre").maybeSingle());
  return fila?.nombre ?? null;
}

// ---------- Documentos: catálogo y recetas de Mario ----------

export async function leerDocumento(clave) {
  const fila = comprobar(
    await supabase.from("documentos").select("contenido, actualizado").eq("clave", clave).maybeSingle()
  );
  return fila ? { contenido: fila.contenido, actualizado: fila.actualizado } : null;
}

export async function guardarDocumento(clave, contenido) {
  comprobar(
    await supabase.from("documentos").upsert({ clave, contenido, actualizado: new Date().toISOString() })
  );
}

// ---------- Semanas: menú y compra ----------

export async function leerSemana(lunes) {
  return comprobar(await supabase.from("semanas").select("lunes, menu, compra").eq("lunes", lunes).maybeSingle());
}

// Semanas anteriores (para no repetir platos de frecuencia mensual o quincenal)
export async function leerSemanasEntre(desde, hasta) {
  return comprobar(
    await supabase.from("semanas").select("lunes, menu").gte("lunes", desde).lte("lunes", hasta).order("lunes")
  );
}

// Se guarda solo la columna que cambia, así si una persona toca la compra
// mientras la otra cambia el menú, no se pisan.
export async function guardarMenu(lunes, menu) {
  comprobar(await supabase.from("semanas").upsert({ lunes, menu, actualizado: new Date().toISOString() }));
}

export async function guardarCompra(lunes, compra) {
  comprobar(
    await supabase.from("semanas").update({ compra, actualizado: new Date().toISOString() }).eq("lunes", lunes)
  );
}
