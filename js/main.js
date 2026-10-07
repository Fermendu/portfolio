// ===== Formulario de contacto =====
// Envía el formulario a Formspree sin salir de la página y muestra el resultado.

const formulario = document.querySelector(".formulario");
const estado = document.querySelector(".form-estado");
const botonEnviar = formulario.querySelector("button[type='submit']");

formulario.addEventListener("submit", async (evento) => {
  // Evita que el navegador vaya a la página de Formspree
  evento.preventDefault();

  botonEnviar.disabled = true;
  estado.className = "form-estado";
  estado.textContent = "Enviando…";

  try {
    const respuesta = await fetch(formulario.action, {
      method: "POST",
      body: new FormData(formulario),
      headers: { Accept: "application/json" },
    });

    if (respuesta.ok) {
      formulario.reset();
      estado.classList.add("form-estado-ok");
      estado.textContent = "¡Gracias! He recibido tu mensaje y te responderé pronto.";
    } else {
      throw new Error("Formspree ha respondido con un error");
    }
  } catch (error) {
    estado.classList.add("form-estado-error");
    estado.textContent = "No se ha podido enviar el mensaje. Inténtalo de nuevo en unos minutos.";
  } finally {
    botonEnviar.disabled = false;
  }
});
