/* Maneja los formularios de login y registro.
   Se activa con el atributo data-form-auth="login" | "registro". */
(function () {
  'use strict';

  const formulario = document.querySelector('[data-form-auth]');
  if (!formulario) return;

  const modo = formulario.dataset.formAuth;
  const boton = formulario.querySelector('button[type="submit"]');
  const caja = document.getElementById('mensaje');
  const textoBoton = boton.textContent;

  // Si ya hay sesión, no tiene sentido quedarse aquí.
  if (window.API.sesion.activa) {
    window.location.replace(destinoTrasEntrar());
    return;
  }

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limpiarMensaje();

    const datos = Object.fromEntries(new FormData(formulario));

    if (modo === 'registro' && datos.password !== datos.password2) {
      return mostrar('error', 'Las contraseñas no coinciden.');
    }
    delete datos.password2;

    bloquear(true);

    try {
      // El registro ya no devuelve token: la cuenta queda esperando que un
      // administrador la apruebe, así que no hay sesión que iniciar.
      if (modo === 'registro') {
        const respuesta = await window.API.auth.registrar(datos);
        formulario.reset();
        formulario.hidden = true;
        mostrar('ok', respuesta.mensaje
          || 'Solicitud enviada. Un administrador debe aprobar tu cuenta.');
        return;
      }

      const respuesta = await window.API.auth.login(datos);
      window.API.sesion.guardar(respuesta.token, respuesta.usuario);
      mostrar('ok', '¡Bienvenido! Entrando…');

      // Pequeña pausa para que se alcance a leer el mensaje.
      setTimeout(() => window.location.replace(destinoTrasEntrar()), 700);

    } catch (error) {
      mostrar('error', error.message);
      bloquear(false);
    }
  });

  /* Vuelve a la página desde la que se pidió iniciar sesión, si la hay.
     Solo se aceptan rutas internas: un ?volver=https://otro-sitio sería
     una redirección abierta. */
  function destinoTrasEntrar() {
    const volver = new URLSearchParams(location.search).get('volver');
    const esInterna = volver && /^[a-z0-9_-]+\.html$/i.test(volver);
    return esInterna ? volver : 'index.html';
  }

  function bloquear(activo) {
    boton.disabled = activo;
    boton.textContent = activo ? 'Espera…' : textoBoton;
  }

  function mostrar(tipo, texto) {
    caja.className = `mensaje mensaje-${tipo}`;
    caja.textContent = texto;
    caja.hidden = false;
  }

  function limpiarMensaje() {
    caja.hidden = true;
    caja.textContent = '';
  }
})();
