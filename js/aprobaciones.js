/* Panel de aprobación de registros. Solo para administradores.
   Se activa con el contenedor [data-aprobaciones]. */
(function () {
  'use strict';

  const contenedor = document.querySelector('[data-aprobaciones]');
  if (!contenedor) return;

  const LIMITE = 50;

  const VISTAS = [
    { valor: 'pendiente', etiqueta: 'Pendientes' },
    { valor: 'aprobado', etiqueta: 'Aprobados' },
    { valor: 'rechazado', etiqueta: 'Rechazados' },
    { valor: '', etiqueta: 'Todos' }
  ];

  const ETIQUETA_ESTADO = {
    pendiente: 'En espera',
    aprobado: 'Aprobado',
    rechazado: 'Rechazado'
  };

  let vista = 'pendiente';

  /* ===================== Control de acceso ===================== */

  // Ocultar el enlace en la navbar no protege nada: cualquiera puede escribir
  // la URL. La API rechaza igualmente a quien no sea admin, pero conviene dar
  // un mensaje claro en vez de dejar la página cargando en vano.
  const sesion = window.API.sesion;

  if (!sesion.activa) {
    window.location.replace('login.html?volver=aprobaciones.html');
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
    mostrarEstado('cargando', 'Cargando solicitudes…');
    lista.innerHTML = '';

    try {
      const datos = await window.API.usuarios.listar({
        estado: vista || undefined,
        limite: LIMITE
      });

      if (!datos.usuarios.length) {
        mostrarEstado('vacio', vista === 'pendiente'
          ? 'No hay solicitudes en espera. Todo al día.'
          : 'No hay cuentas en esta categoría.');
        return;
      }

      ocultarEstado();
      datos.usuarios.forEach(u => lista.appendChild(tarjeta(u)));

    } catch (error) {
      mostrarEstado('error', mensajeDeError(error, 'No se pudieron cargar las solicitudes'));
    }
  }

  /* ===================== Tarjeta ===================== */

  function tarjeta(usuario) {
    const li = document.createElement('li');
    li.className = 'solicitud-card';

    const cabecera = document.createElement('div');
    cabecera.className = 'solicitud-cabecera';

    const nombre = document.createElement('h3');
    nombre.className = 'solicitud-nombre';
    // textContent siempre: nombre y email los escribe quien se registra.
    nombre.textContent = usuario.nombre;

    const insignia = document.createElement('span');
    insignia.className = `solicitud-estado solicitud-estado-${usuario.estado}`;
    insignia.textContent = ETIQUETA_ESTADO[usuario.estado] || usuario.estado;

    cabecera.append(nombre, insignia);

    const meta = document.createElement('div');
    meta.className = 'solicitud-meta';
    meta.appendChild(dato(usuario.email));
    meta.appendChild(dato(`Rol: ${usuario.rol}`));
    if (usuario.fechaRegistro) {
      meta.appendChild(dato(`Solicitado el ${formatearFecha(usuario.fechaRegistro)}`));
    }

    li.append(cabecera, meta);

    const acciones = document.createElement('div');
    acciones.className = 'solicitud-acciones';

    // La API impide que un admin se cambie el estado a sí mismo; aquí ni
    // siquiera se ofrecen los botones.
    const esUnoMismo = usuario.id === sesion.usuario?.id;

    if (esUnoMismo) {
      const aviso = document.createElement('span');
      aviso.className = 'solicitud-aviso';
      aviso.textContent = 'Tu propia cuenta';
      acciones.appendChild(aviso);
    } else {
      if (usuario.estado !== 'aprobado') {
        acciones.appendChild(botonAccion('Aprobar', 'aprobar', usuario, li));
      }
      if (usuario.estado !== 'rechazado') {
        acciones.appendChild(botonAccion('Rechazar', 'rechazar', usuario, li));
      }
    }

    li.appendChild(acciones);

    return li;
  }

  function botonAccion(texto, accion, usuario, li) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = `btn-solicitud btn-${accion}`;
    boton.textContent = texto;
    boton.setAttribute('aria-label', `${texto} la cuenta de ${usuario.nombre}`);

    boton.addEventListener('click', async () => {
      if (accion === 'rechazar') {
        const seguro = window.confirm(
          `¿Rechazar la solicitud de ${usuario.nombre} (${usuario.email})?\n\n`
          + 'No podrá iniciar sesión. Puedes revertirlo después aprobándola.'
        );
        if (!seguro) return;
      }

      bloquearFila(li, true);

      try {
        const respuesta = await window.API.usuarios[accion](usuario.id);
        avisoEnFila(li, 'ok', respuesta.mensaje);

        // Refresca para que la tarjeta salga de la vista si ya no corresponde.
        setTimeout(cargar, 900);

      } catch (error) {
        avisoEnFila(li, 'error', mensajeDeError(error, 'No se pudo completar la acción'));
        bloquearFila(li, false);
      }
    });

    return boton;
  }

  /* ===================== Filtros ===================== */

  function crearFiltros() {
    const grupo = document.createElement('div');
    grupo.className = 'filtros';
    grupo.setAttribute('role', 'group');
    grupo.setAttribute('aria-label', 'Filtrar solicitudes por estado');

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
    li.querySelectorAll('button').forEach(b => { b.disabled = activo; });
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
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor. ¿Está encendido?';
    }
    if (error.status === 401) {
      return 'Tu sesión caducó. Vuelve a iniciar sesión.';
    }
    if (error.status === 403) {
      return 'No tienes permisos para hacer esto.';
    }
    return `${prefijo}: ${error.message}`;
  }

  function mostrarEstado(tipo, mensaje) {
    // Cuando el acceso se deniega antes de montar nada, el div de estado
    // todavía no existe: se crea al vuelo.
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
