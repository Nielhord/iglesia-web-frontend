/* Carga la navbar compartida e inyecta el estado de sesión.
   Antes: un fetch sin manejo de error; si fallaba, la navbar desaparecía
   en silencio y no había forma de navegar. */
(function () {
  'use strict';

  const contenedor = document.getElementById('navbar');
  if (!contenedor) return;

  // Navbar mínima de emergencia si el fetch falla (por ejemplo, al abrir
  // el HTML con file:// en vez de con un servidor).
  const RESPALDO = `
    <nav class="navbar custom-navbar">
      <div class="container">
        <a class="navbar-brand fw-bold" href="index.html">IEDP Talca</a>
        <a class="nav-link" href="index.html">Inicio</a>
      </div>
    </nav>`;

  fetch('components/navbar.html')
    .then(respuesta => {
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      return respuesta.text();
    })
    .then(html => {
      contenedor.innerHTML = html;
      marcarEnlaceActivo();
      pintarSesion();
      mostrarZonaAdmin();
    })
    .catch(error => {
      console.error('No se pudo cargar la navbar:', error);
      contenedor.innerHTML = RESPALDO;
    });

  /* Resalta el enlace de la página actual. */
  function marcarEnlaceActivo() {
    const actual = location.pathname.split('/').pop() || 'index.html';

    contenedor.querySelectorAll('a[href]').forEach(enlace => {
      const destino = enlace.getAttribute('href');
      if (destino !== actual) return;

      enlace.classList.add('activo');
      enlace.setAttribute('aria-current', 'page');

      // Si el enlace vive dentro del desplegable "Ramas", marca también
      // el propio desplegable.
      const desplegable = enlace.closest('.dropdown');
      if (desplegable) {
        desplegable.querySelector('.dropdown-toggle')?.classList.add('activo');
      }
    });
  }

  /* Sustituye "Iniciar sesión / Registrarse" por el usuario y el botón de salir. */
  function pintarSesion() {
    const zona = contenedor.querySelector('[data-zona-auth]');
    if (!zona || !window.API) return;

    const usuario = window.API.sesion.usuario;
    if (!usuario) return; // se queda con los enlaces por defecto del HTML

    zona.innerHTML = `
      <div class="navbar-usuario">
        <span class="navbar-usuario-nombre"></span>
        <span class="navbar-usuario-rol"></span>
        <button type="button" class="btn-salir">Salir</button>
      </div>`;

    // textContent y no template string: el nombre lo escribe el usuario
    // al registrarse y no debe interpretarse como HTML.
    zona.querySelector('.navbar-usuario-nombre').textContent = usuario.nombre;
    zona.querySelector('.navbar-usuario-rol').textContent = usuario.rol;

    zona.querySelector('.btn-salir').addEventListener('click', () => {
      window.API.sesion.cerrar();
      location.reload();
    });
  }

  /* Muestra los enlaces reservados según el rol.
     Esto es solo comodidad visual: ocultar un enlace no protege nada. Quien
     escriba la URL a mano llega igual, y tanto la página como la API rechazan
     a quien no tenga el rol. */
  function mostrarZonaAdmin() {
    if (!window.API) return;

    const sesion = window.API.sesion;

    // Gestión de documentos: editores y administradores.
    if (sesion.tieneRol('editor', 'admin')) {
      contenedor.querySelectorAll('[data-solo-gestor]').forEach(elemento => {
        elemento.hidden = false;
      });
    }

    // Usuarios y aprobaciones: solo administradores.
    if (!sesion.tieneRol('admin')) return;

    contenedor.querySelectorAll('[data-solo-admin]').forEach(elemento => {
      elemento.hidden = false;
    });

    contarPendientes();
  }

  /* Número de solicitudes en espera, junto al enlace de Aprobaciones. */
  function contarPendientes() {
    const globo = contenedor.querySelector('[data-badge-pendientes]');
    if (!globo) return;

    window.API.usuarios.listar({ estado: 'pendiente', limite: 1 })
      .then(datos => {
        if (!datos.total) return;
        globo.textContent = datos.total > 99 ? '99+' : String(datos.total);
        globo.hidden = false;
      })
      .catch(() => {
        // Servidor caído o token vencido: el enlace sigue ahí, sin el globo.
      });
  }
})();
