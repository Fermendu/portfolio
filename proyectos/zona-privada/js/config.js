// ===== Conexión con Supabase =====
// Copia aquí los dos datos de tu proyecto: Supabase → Project Settings → API Keys
// (pestaña "Publishable and secret API keys").
//
// ¿Es seguro que esto esté en el repo público? Sí:
// la clave "publishable" está pensada para ir en el navegador. Por sí sola no da acceso a nada;
// lo que protege los datos son las reglas (RLS) de supabase/esquema.sql, que solo dejan
// leer y escribir a los usuarios de la tabla "miembros".
// La que NUNCA debe aparecer aquí es la "secret" (sb_secret_…).

export const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
export const SUPABASE_KEY = "sb_publishable_PEGA_AQUI_TU_CLAVE";
