/* Carga el pie de página compartido en cualquier página que tenga <div id="pie">.

   Mismo planteamiento que js/navbar.js: un solo archivo que editar cuando
   cambie un teléfono o un horario, en vez de once copias del mismo HTML. */
(function () {
  'use strict';

  const contenedor = document.getElementById('pie');
  if (!contenedor) return;

  fetch('components/footer.html')
    .then(respuesta => {
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      return respuesta.text();
    })
    .then(html => {
      contenedor.innerHTML = html;
      ponerAnio();
    })
    .catch(error => {
      // Sin pie la página sigue siendo usable: se registra y se sigue.
      console.error('No se pudo cargar el pie de página:', error);
    });

  /* El año va escrito en el HTML como respaldo, pero se refresca solo: si
     nadie toca la página en enero, el copyright no se queda atrasado. */
  function ponerAnio() {
    contenedor.querySelectorAll('[data-anio-actual]').forEach(hueco => {
      hueco.textContent = String(new Date().getFullYear());
    });
  }
})();
