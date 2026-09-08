/* Gestión de cuentas. Solo para administradores.
   Se activa con el contenedor [data-usuarios]. */
(function () {
  'use strict';

  const contenedor = document.querySelector('[data-usuarios]');
  if (!contenedor) return;

  const LIMITE = 50;
  const ROLES = ['miembro', 'editor', 'admin'];

  const VISTAS = [
    { valor: '', etiqueta: 'Todos' },
    { valor: 'aprobado', etiqueta: 'Aprobados' },
    { valor: 'pendiente', etiqueta: 'Pendientes' },
    { valor: 'rechazado', etiqueta: 'Rechazados' }
  ];

  const ETIQUETA_ESTADO = {
    pendiente: 'En espera',
    aprobado: 'Aprobado',
    rechazado: 'Rechazado'
  };

  let vista = '';

  /* ===================== Control de acceso ===================== */

  const sesion = window.API.sesion;

  if (!sesion.activa) {
    window.location.replace('login.html?volver=usuarios.html');
    return;
  }

  if (!sesion.tieneRol('admin')) {
    mostrarEstado('error', 'Esta página es solo para administradores.');
    return;
  }

  /* ===================== Montaje ===================== */

  const filtros = crearFiltros();

  const estado = document.createElement('div');
  estado.setAttribute('role', 'status');
  estado.setAttribute('aria-live', 'polite');

  const lista = document.createElement('ul');
  lista.className = 'solicitudes-lista';

  contenedor.append(filtros, estado, lista);

  cargar();

  /* ===================== Carga ===================== */

  async function cargar() {
    mostrarEstado('cargando', 'Cargando cuentas…');
    lista.innerHTML = '';

    try {
      const datos = await window.API.usuarios.listar({
        estado: vista || undefined,
        limite: LIMITE
      });

      if (!datos.usuarios.length) {
        mostrarEstado('vacio', 'No hay cuentas en esta categoría.');
        return;
      }

      ocultarEstado();
      datos.usuarios.forEach(u => lista.appendChild(tarjeta(u)));

    } catch (error) {
      mostrarEstado('error', mensajeDeError(error, 'No se pudieron cargar las cuentas'));
    }
  }

  /* ===================== Tarjeta ===================== */

  function tarjeta(usuario) {
    const esUnoMismo = usuario.id === sesion.usuario?.id;

    const li = document.createElement('li');
    li.className = 'solicitud-card';

    const cabecera = document.createElement('div');
    cabecera.className = 'solicitud-cabecera';

    const nombre = document.createElement('h3');
    nombre.className = 'solicitud-nombre';
    // textContent: nombre y email los escribe la propia persona.
    nombre.textContent = usuario.nombre;

    const insignias = document.createElement('span');
    insignias.className = 'usuario-insignias';

    const insigniaRol = document.createElement('span');
    insigniaRol.className = `usuario-rol usuario-rol-${usuario.rol}`;
    insigniaRol.textContent = usuario.rol;

    const insigniaEstado = document.createElement('span');
    insigniaEstado.className = `solicitud-estado solicitud-estado-${usuario.estado}`;
    insigniaEstado.textContent = ETIQUETA_ESTADO[usuario.estado] || usuario.estado;

    insignias.append(insigniaRol, insigniaEstado);
    cabecera.append(nombre, insignias);

    const meta = document.createElement('div');
    meta.className = 'solicitud-meta';
    meta.appendChild(dato(usuario.email));
    if (usuario.fechaRegistro) {
      meta.appendChild(dato(`Registrado el ${formatearFecha(usuario.fechaRegistro)}`));
    }
    if (esUnoMismo) meta.appendChild(dato('— tu cuenta'));

    li.append(cabecera, meta, formulario(usuario, esUnoMismo, li));

    return li;
  }

  /* ===================== Formulario de edición ===================== */

  function formulario(usuario, esUnoMismo, li) {
    const form = document.createElement('form');
    form.className = 'usuario-form';
    form.noValidate = true;

    const campoNombre = campo('Nombre', 'text', usuario.nombre, `nombre-${usuario.id}`);
    const campoEmail = campo('Correo', 'email', usuario.email, `email-${usuario.id}`);

    // El servidor rechaza que un admin se cambie el rol a sí mismo; aquí el
    // selector queda deshabilitado para que no parezca posible.
    const campoRol = selectorRol(usuario, esUnoMismo);

    const campoPassword = campo('Nueva contraseña', 'password', '', `password-${usuario.id}`);
    campoPassword.querySelector('input').placeholder = 'Dejar en blanco para no cambiarla';
    campoPassword.querySelector('input').autocomplete = 'new-password';

    const ayuda = document.createElement('p');
    ayuda.className = 'campo-ayuda';
    ayuda.textContent = 'Mínimo 8 caracteres, con al menos una letra y un número.';
    campoPassword.appendChild(ayuda);

    const rejilla = document.createElement('div');
    rejilla.className = 'usuario-rejilla';
    rejilla.append(campoNombre, campoEmail, campoRol, campoPassword);

    const acciones = document.createElement('div');
    acciones.className = 'solicitud-acciones';

    const guardar = document.createElement('button');
    guardar.type = 'submit';
    guardar.className = 'btn-solicitud btn-aprobar';
    guardar.textContent = 'Guardar cambios';
    acciones.appendChild(guardar);

    if (esUnoMismo) {
      const aviso = document.createElement('span');
      aviso.className = 'solicitud-aviso';
      aviso.textContent = 'No puedes cambiar tu propio rol ni eliminarte';
      acciones.appendChild(aviso);
    } else {
      acciones.appendChild(botonEliminar(usuario, li));
    }

    form.append(rejilla, acciones);

    form.addEventListener('submit', async (evento) => {
      evento.preventDefault();

      const cambios = {};
      const nombreNuevo = campoNombre.querySelector('input').value.trim();
      const emailNuevo = campoEmail.querySelector('input').value.trim();
      const rolNuevo = campoRol.querySelector('select').value;
      const passwordNueva = campoPassword.querySelector('input').value;

      if (nombreNuevo !== usuario.nombre) cambios.nombre = nombreNuevo;
      if (emailNuevo.toLowerCase() !== usuario.email) cambios.email = emailNuevo;
      if (!esUnoMismo && rolNuevo !== usuario.rol) cambios.rol = rolNuevo;
      if (passwordNueva) cambios.password = passwordNueva;

      if (Object.keys(cambios).length === 0) {
        return avisoEnFila(li, 'error', 'No cambiaste nada.');
      }

      if (cambios.password && !window.confirm(
        `¿Cambiar la contraseña de ${usuario.nombre}?\n\n`
        + 'La contraseña actual dejará de funcionar y tendrás que darle la nueva.'
      )) return;

      bloquearFila(li, true);

      try {
        const respuesta = await window.API.usuarios.actualizar(usuario.id, cambios);
        avisoEnFila(li, 'ok', respuesta.mensaje);
        setTimeout(cargar, 900);
      } catch (error) {
        avisoEnFila(li, 'error', mensajeDeError(error, 'No se pudo guardar'));
        bloquearFila(li, false);
      }
    });

    return form;
  }

  function botonEliminar(usuario, li) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'btn-solicitud btn-rechazar';
    boton.textContent = 'Eliminar';
    boton.setAttribute('aria-label', `Eliminar la cuenta de ${usuario.nombre}`);

    boton.addEventListener('click', async () => {
      const seguro = window.confirm(
        `¿Eliminar la cuenta de ${usuario.nombre} (${usuario.email})?\n\n`
        + 'Esta acción no se puede deshacer.'
      );
      if (!seguro) return;

      bloquearFila(li, true);

      try {
        const respuesta = await window.API.usuarios.eliminar(usuario.id);
        avisoEnFila(li, 'ok', respuesta.mensaje);
        setTimeout(cargar, 900);
      } catch (error) {
        avisoEnFila(li, 'error', mensajeDeError(error, 'No se pudo eliminar'));
        bloquearFila(li, false);
      }
    });

    return boton;
  }

  function campo(etiqueta, tipo, valor, id) {
    const envoltorio = document.createElement('div');
    envoltorio.className = 'campo';

    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = etiqueta;

    const input = document.createElement('input');
    input.type = tipo;
    input.id = id;
    input.value = valor;

    envoltorio.append(label, input);
    return envoltorio;
  }

  function selectorRol(usuario, esUnoMismo) {
    const envoltorio = document.createElement('div');
    envoltorio.className = 'campo';

    const id = `rol-${usuario.id}`;

    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = 'Rol';

    const select = document.createElement('select');
    select.id = id;
    select.disabled = esUnoMismo;

    ROLES.forEach(rol => {
      const opcion = document.createElement('option');
      opcion.value = rol;
      opcion.textContent = rol;
      opcion.selected = rol === usuario.rol;
      select.appendChild(opcion);
    });

    envoltorio.append(label, select);
    return envoltorio;
  }

  /* ===================== Filtros ===================== */

  function crearFiltros() {
    const grupo = document.createElement('div');
    grupo.className = 'filtros';
    grupo.setAttribute('role', 'group');
    grupo.setAttribute('aria-label', 'Filtrar cuentas por estado');

    VISTAS.forEach(({ valor, etiqueta }) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'filtro-btn';
      boton.textContent = etiqueta;
      boton.setAttribute('aria-pressed', String(valor === vista));

      boton.addEventListener('click', () => {
        if (valor === vista) return;
        vista = valor;
        grupo.querySelectorAll('.filtro-btn').forEach(b =>
          b.setAttribute('aria-pressed', String(b === boton)));
        cargar();
      });

      grupo.appendChild(boton);
    });

    return grupo;
  }

  /* ===================== Utilidades ===================== */

  function dato(texto) {
    const span = document.createElement('span');
    span.textContent = texto;
    return span;
  }

  function bloquearFila(li, activo) {
    li.classList.toggle('solicitud-ocupada', activo);
    li.querySelectorAll('button, input, select').forEach(c => { c.disabled = activo; });
  }

  function avisoEnFila(li, tipo, texto) {
    let aviso = li.querySelector('.solicitud-resultado');
    if (!aviso) {
      aviso = document.createElement('p');
      li.appendChild(aviso);
    }
    aviso.className = `solicitud-resultado solicitud-resultado-${tipo}`;
    aviso.textContent = texto;
  }

  function mensajeDeError(error, prefijo) {
    if (error.status === 0) return 'No se pudo conectar con el servidor. ¿Está encendido?';
    if (error.status === 401) return 'Tu sesión caducó. Vuelve a iniciar sesión.';
    if (error.status === 403) return 'No tienes permisos para hacer esto.';
    if (error.status === 409) return 'Ese correo ya lo usa otra cuenta.';
    return `${prefijo}: ${error.message}`;
  }

  function mostrarEstado(tipo, mensaje) {
    let caja = contenedor.querySelector('[role="status"]');
    if (!caja) {
      caja = document.createElement('div');
      caja.setAttribute('role', 'status');
      caja.setAttribute('aria-live', 'polite');
      contenedor.appendChild(caja);
    }
    caja.className = `estado estado-${tipo}`;
    caja.textContent = mensaje;
    caja.hidden = false;
  }

  function ocultarEstado() {
    estado.hidden = true;
    estado.textContent = '';
  }

  function formatearFecha(iso) {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return '';
    return fecha.toLocaleDateString('es-CL', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }
})();
