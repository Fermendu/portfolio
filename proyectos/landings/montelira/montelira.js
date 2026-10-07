// Formulario de demostración: no envía los datos a ningún sitio,
// solo muestra un mensaje para simular que la solicitud ha llegado.

const formulario = document.querySelector(".formulario");
const estado = document.querySelector(".form-estado");

formulario.addEventListener("submit", (evento) => {
  evento.preventDefault();

  const nombre = formulario.nombre.value.trim().split(" ")[0];
  formulario.reset();
  estado.textContent = `¡Gracias, ${nombre}! (Es una demo: tus datos no se han enviado a ningún sitio.)`;
});
