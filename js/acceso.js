/* Puerta de acceso para las páginas de contenido interno (documentos y ramas).

   Se activa en cualquier contenedor marcado con [data-requiere-sesion]. Si no
   hay sesión iniciada, deja la zona en gris con un aviso en vez de dejar que
   la página pida a la API un listado que va a responder 401.

   Este archivo debe cargarse ANTES que js/documentos.js: quita el atributo
   [data-documentos] del contenedor, y así el listado ni siquiera arranca.

   Esto es comodidad visual, no seguridad. Quien borre el aviso desde el
   inspector no consigue nada: el servidor exige el token igual. */
(function () {
  'use strict';

  const zonas = document.querySelectorAll('[data-requiere-sesion]');
  if (!zonas.length) return;

  // Sin window.API no se puede saber si hay sesión. Antes que dejar la página
  // en blanco, se deja pasar: el listado fallará con su propio mensaje.
  if (!window.API || window.API.sesion.activa) return;

  const pagina = location.pathname.split('/').pop() || 'index.html';

  zonas.forEach(bloquear);

  function bloquear(zona) {
    // Desactiva los ganchos de las páginas que se cargan después.
    zona.removeAttribute('data-documentos');
    zona.removeAttribute('data-filtros');

    zona.innerHTML = '';
    zona.classList.add('acceso-zona');
    zona.append(fantasma(), aviso());
  }

  /* Tarjetas grises de relleno: dan a entender que ahí debajo hay contenido,
     sin mostrar ni un dato real. */
  function fantasma() {
    const caja = document.createElement('div');
    caja.className = 'acceso-fantasma';
    caja.setAttribute('aria-hidden', 'true');

    for (let i = 0; i < 3; i++) {
      const tarjeta = document.createElement('div');
      tarjeta.className = 'acceso-fantasma-card';

      const titulo = document.createElement('span');
      titulo.className = 'acceso-barra acceso-barra-titulo';

      const linea = document.createElement('span');
      linea.className = 'acceso-barra';

      const corta = document.createElement('span');
      corta.className = 'acceso-barra acceso-barra-corta';

      tarjeta.append(titulo, linea, corta);
      caja.appendChild(tarjeta);
    }

    return caja;
  }

  function aviso() {
    const caja = document.createElement('div');
    caja.className = 'acceso-aviso';
    caja.setAttribute('role', 'status');

    const candado = document.createElement('span');
    candado.className = 'acceso-candado';
    candado.setAttribute('aria-hidden', 'true');
    candado.textContent = '🔒';

    const titulo = document.createElement('h2');
    titulo.className = 'acceso-titulo';
    titulo.textContent = 'Contenido solo para la congregación';

    const texto = document.createElement('p');
    texto.className = 'acceso-texto';
    texto.textContent = 'Necesitas iniciar sesión para ver y descargar los '
      + 'documentos de esta página.';

    const acciones = document.createElement('div');
    acciones.className = 'acceso-acciones';
    acciones.append(
      // Al entrar, login.html devuelve al usuario a la página que quería ver.
      enlace(`login.html?volver=${encodeURIComponent(pagina)}`, 'Iniciar sesión', 'acceso-btn'),
      enlace('register.html', 'Crear una cuenta', 'acceso-btn acceso-btn-suave')
    );

    const nota = document.createElement('p');
    nota.className = 'acceso-nota';
    nota.textContent = 'Si ya te registraste, un administrador debe aprobar tu '
      + 'cuenta antes de que puedas entrar.';

    caja.append(candado, titulo, texto, acciones, nota);
    return caja;
  }

  function enlace(href, texto, clase) {
    const a = document.createElement('a');
    a.className = clase;
    a.href = href;
    a.textContent = texto;
    return a;
  }
})();
