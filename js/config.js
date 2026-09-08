/* Configuración del frontend.

   La URL de la API se elige sola según dónde esté abierta la página, para no
   depender de acordarse de editar este archivo antes de subir el sitio, que es
   justo el paso que se olvida.

   Al contratar el hosting: cambia PRODUCCION por la URL real del backend. */
(function () {
  'use strict';

  const PRODUCCION = 'https://iglesia-web-api.onrender.com/api';
  const LOCAL = 'http://localhost:3000/api';

  // Live Server, python -m http.server, 127.0.0.1… todo eso es desarrollo.
  const enLocal = ['localhost', '127.0.0.1', '', '0.0.0.0'].includes(location.hostname)
    || location.protocol === 'file:';

  // Mientras PRODUCCION siga con el marcador, el backend no está publicado.
  // js/api.js lo usa para dar un mensaje claro en vez de un error de conexión.
  const configurada = !PRODUCCION.includes('CAMBIAME');

  window.APP_CONFIG = {
    API_URL: enLocal ? LOCAL : PRODUCCION,
    ENTORNO: enLocal ? 'local' : 'produccion',
    CONFIGURADA: enLocal || configurada
  };

  if (!enLocal && !configurada) {
    console.error(
      'js/config.js: falta poner la URL real de la API en PRODUCCION. '
      + 'El sitio no podrá iniciar sesión ni cargar documentos.'
    );
  }
})();
