// ===== Cabecera sólida al bajar =====
// Vigilamos un marcador invisible que hay encima de la cabecera:
// cuando deja de verse, es que hemos hecho scroll.
const cabecera = document.querySelector(".cabecera");
const marcador = document.querySelector(".marcador-cabecera");

new IntersectionObserver(([entrada]) => {
  cabecera.classList.toggle("solida", !entrada.isIntersecting);
}).observe(marcador);

// ===== Aparición de bloques al hacer scroll =====
// Cuando un bloque entra en pantalla le ponemos la clase .visible
// y dejamos de vigilarlo, para que solo se anime la primera vez.
const observadorRevelar = new IntersectionObserver(
  (entradas, observador) => {
    entradas.forEach((entrada) => {
      if (entrada.isIntersecting) {
        entrada.target.classList.add("visible");
        // Si es la fila de cafés, mostramos todas sus tarjetas a la vez
        entrada.target.querySelectorAll(".revelar").forEach((hijo) => hijo.classList.add("visible"));
        observador.unobserve(entrada.target);
      }
    });
  },
  { rootMargin: "0px 0px -10% 0px" }
);

// Las tarjetas de café van en una fila con scroll lateral: en el móvil
// algunas empiezan fuera de pantalla, así que vigilamos la fila entera.
document.querySelectorAll(".revelar").forEach((elemento) => {
  observadorRevelar.observe(elemento.closest(".cafes") ?? elemento);
});

// ===== Formulario de reserva =====
// Formulario de demostración: no envía los datos a ningún sitio,
// solo los comprueba y simula que la reserva ha llegado.
const formulario = document.querySelector(".formulario");
const boton = formulario.querySelector(".boton");
const textoBoton = boton.querySelector(".boton-texto");
const estado = formulario.querySelector(".form-estado");

// Muestra u oculta el error de un campo
function marcarError(campo, mensaje) {
  const error = document.querySelector(`#error-${campo.id}`);
  error.textContent = mensaje;
  campo.setAttribute("aria-invalid", mensaje ? "true" : "false");
  if (mensaje) {
    campo.setAttribute("aria-describedby", error.id);
  } else {
    campo.removeAttribute("aria-describedby");
  }
}

// Cambia el texto del botón con un fundido (ver .cambiando en el CSS)
function cambiarTextoBoton(texto) {
  boton.classList.add("cambiando");
  setTimeout(() => {
    textoBoton.textContent = texto;
    boton.classList.remove("cambiando");
  }, 200);
}

formulario.addEventListener("submit", (evento) => {
  evento.preventDefault();

  const nombre = formulario.nombre;
  const correo = formulario.correo;

  marcarError(nombre, nombre.value.trim() ? "" : "Dinos cómo te llamas.");
  marcarError(correo, correo.validity.valid ? "" : "Revisa el correo: falta algo.");

  // Si hay algún error, llevamos el foco al primer campo que falla
  const primerError = formulario.querySelector('[aria-invalid="true"]');
  if (primerError) {
    primerError.focus();
    return;
  }

  const primerNombre = nombre.value.trim().split(" ")[0];
  const fecha = formulario.fecha.value;

  cambiarTextoBoton("Reservando…");

  // Simulamos la espera de un servidor
  setTimeout(() => {
    cambiarTextoBoton("Plaza reservada");
    estado.textContent = `¡Nos vemos el ${fecha}, ${primerNombre}! (Es una demo: tus datos no se han enviado a ningún sitio.)`;
    formulario.reset();

    // Pasado un rato, el botón vuelve a su texto normal
    setTimeout(() => cambiarTextoBoton("Reservar plaza"), 3000);
  }, 900);
});
