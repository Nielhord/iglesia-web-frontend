/* Panel izquierdo de las páginas de rama: calendario de actividades y avisos,
   en dos pestañas. Se activa con [data-rama-panel data-categoria="Coro"].

   Cualquiera puede leer ambas cosas. Solo editores y administradores ven los
   botones de crear, editar y borrar; la API rechaza al resto igualmente. */
(function () {
  'use strict';

  const panel = document.querySelector('[data-rama-panel]');
  if (!panel || !window.API) return;

  const categoria = panel.dataset.categoria || 'General';
  const puedeGestionar = window.API.sesion.tieneRol('editor', 'admin');

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  // Mes que se está mirando.
  const hoyISO = diaISO(new Date());
  let anio = Number(hoyISO.slice(0, 4));
  let mes = Number(hoyISO.slice(5, 7)) - 1;   // 0-11
  let actividades = [];

  /* ===================== Montaje ===================== */

  const vistas = {
    calendario: seccion('calendario'),
    avisos: seccion('avisos')
  };

  panel.append(pestanas(), vistas.calendario, vistas.avisos);
  vistas.avisos.hidden = true;

  const calendario = montarCalendario();
  const avisos = montarAvisos();

  cargarActividades();
  cargarAvisos();

  function seccion(nombre) {
    const el = document.createElement('section');
    el.className = 'rama-vista';
    el.dataset.vista = nombre;
    el.setAttribute('role', 'tabpanel');
    el.id = `vista-${nombre}`;
    return el;
  }

  function pestanas() {
    const barra = document.createElement('div');
    barra.className = 'rama-pestanas';
    barra.setAttribute('role', 'tablist');

    ['calendario', 'avisos'].forEach((nombre, i) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'rama-pestana';
      boton.setAttribute('role', 'tab');
      boton.setAttribute('aria-controls', `vista-${nombre}`);
      boton.setAttribute('aria-selected', String(i === 0));
      boton.textContent = nombre === 'calendario' ? 'Calendario' : 'Avisos';

      boton.addEventListener('click', () => {
        barra.querySelectorAll('.rama-pestana').forEach(b =>
          b.setAttribute('aria-selected', String(b === boton)));
        vistas.calendario.hidden = nombre !== 'calendario';
        vistas.avisos.hidden = nombre !== 'avisos';
      });

      barra.appendChild(boton);
    });

    return barra;
  }

  /* ===================== Calendario ===================== */

  function montarCalendario() {
    const cabecera = document.createElement('div');
    cabecera.className = 'cal-cabecera';

    const atras = flecha('‹', 'Mes anterior', () => moverMes(-1));
    const titulo = document.createElement('span');
    titulo.className = 'cal-mes';
    const adelante = flecha('›', 'Mes siguiente', () => moverMes(1));

    cabecera.append(atras, titulo, adelante);

    const estado = crearEstado();

    const lista = document.createElement('ul');
    lista.className = 'agenda-lista';

    const formulario = puedeGestionar ? formActividad() : null;

    vistas.calendario.append(cabecera);
    if (formulario) vistas.calendario.appendChild(formulario.boton);
    vistas.calendario.append(estado.elemento, lista);
    if (formulario) vistas.calendario.appendChild(formulario.caja);

    return { titulo, lista, estado, formulario };
  }

  function flecha(simbolo, etiqueta, alPulsar) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'cal-flecha';
    boton.textContent = simbolo;
    boton.setAttribute('aria-label', etiqueta);
    boton.addEventListener('click', alPulsar);
    return boton;
  }

  function moverMes(paso) {
    mes += paso;
    if (mes < 0) { mes = 11; anio--; }
    if (mes > 11) { mes = 0; anio++; }
    cargarActividades();
  }

  async function cargarActividades() {
    calendario.titulo.textContent = `${MESES[mes]} ${anio}`;
    calendario.estado.mostrar('cargando', 'Cargando actividades…');

    const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
    const dosDigitos = n => String(n).padStart(2, '0');

    try {
      const datos = await window.API.actividades.listar({
        categoria,
        desde: `${anio}-${dosDigitos(mes + 1)}-01`,
        hasta: `${anio}-${dosDigitos(mes + 1)}-${dosDigitos(ultimo)}`
      });
      actividades = datos.actividades || [];
      calendario.estado.ocultar();
    } catch (error) {
      actividades = [];
      calendario.estado.mostrar('error', error.status === 0
        ? 'No se pudo conectar con el servidor.'
        : `No se pudieron cargar las actividades: ${error.message}`);
    }

    pintarAgenda();
  }

  /* La API las devuelve ya ordenadas por fecha y hora ascendente: arriba lo
     que ocurre antes, abajo lo más lejano del mes. */
  function pintarAgenda() {
    calendario.lista.innerHTML = '';

    if (!actividades.length) {
      const vacio = document.createElement('li');
      vacio.className = 'agenda-vacia';
      vacio.textContent = `No hay actividades programadas en ${MESES[mes]}.`;
      calendario.lista.appendChild(vacio);
      return;
    }

    actividades.forEach(a => calendario.lista.appendChild(tarjetaActividad(a)));
  }

  function tarjetaActividad(a) {
    const dia = diaDe(a);

    const li = document.createElement('li');
    li.className = 'agenda-item';
    if (dia === hoyISO) li.classList.add('agenda-hoy');
    if (dia < hoyISO) li.classList.add('agenda-pasada');

    // Bloque de fecha a la izquierda: el número del día bien grande, para
    // localizar de un vistazo cuándo es cada cosa.
    const bloque = document.createElement('div');
    bloque.className = 'agenda-dia';

    const numero = document.createElement('span');
    numero.className = 'agenda-dia-numero';
    numero.textContent = String(Number(dia.slice(8, 10)));

    const mesCorto = document.createElement('span');
    mesCorto.className = 'agenda-dia-mes';
    mesCorto.textContent = MESES_CORTOS[Number(dia.slice(5, 7)) - 1];

    bloque.append(numero, mesCorto);

    const cuerpo = document.createElement('div');
    cuerpo.className = 'agenda-cuerpo';

    const titulo = document.createElement('h3');
    titulo.className = 'agenda-titulo';
    // textContent en todo: lo escriben personas, no debe ser HTML.
    titulo.textContent = a.titulo;
    cuerpo.appendChild(titulo);

    // La fecha completa va también en texto: el bloque grande no la lee un
    // lector de pantalla de forma comprensible.
    const detalle = document.createElement('p');
    detalle.className = 'agenda-detalle';
    const trozos = [fechaLarga(dia)];
    if (a.hora) trozos.push(a.hora);
    if (a.lugar) trozos.push(a.lugar);
    detalle.textContent = trozos.join(' · ');
    cuerpo.appendChild(detalle);

    if (dia === hoyISO) {
      const chip = document.createElement('span');
      chip.className = 'agenda-chip';
      chip.textContent = 'Hoy';
      titulo.appendChild(chip);
    }

    if (a.descripcion) {
      const desc = document.createElement('p');
      desc.className = 'agenda-texto';
      desc.textContent = a.descripcion;
      cuerpo.appendChild(desc);
    }

    if (puedeGestionar) {
      cuerpo.appendChild(acciones(
        () => calendario.formulario.abrir(a),
        () => borrar('actividades', a._id, a.titulo, cargarActividades)
      ));
    }

    li.append(bloque, cuerpo);
    return li;
  }

  function formActividad() {
    const campos = {
      titulo: campo('Título', 'text', true),
      fecha: campo('Fecha', 'date', true),
      hora: campo('Hora (opcional)', 'time'),
      lugar: campo('Lugar (opcional)', 'text'),
      descripcion: campoTexto('Descripción (opcional)')
    };

    return formulario({
      etiquetaBoton: '+ Nueva actividad',
      tituloNuevo: 'Nueva actividad',
      tituloEditar: 'Editar actividad',
      campos,
      recurso: 'actividades',
      recargar: cargarActividades,

      rellenar(a) {
        campos.titulo.input.value = a ? a.titulo : '';
        campos.fecha.input.value = a ? diaDe(a) : primerDiaVisible();
        campos.hora.input.value = a ? (a.hora || '') : '';
        campos.lugar.input.value = a ? (a.lugar || '') : '';
        campos.descripcion.input.value = a ? (a.descripcion || '') : '';
      },

      recoger() {
        const titulo = campos.titulo.input.value.trim();
        const fecha = campos.fecha.input.value;
        if (!titulo) return { error: 'El título es obligatorio.' };
        if (!fecha) return { error: 'La fecha es obligatoria.' };
        return {
          datos: {
            titulo, fecha, categoria,
            hora: campos.hora.input.value,
            lugar: campos.lugar.input.value.trim(),
            descripcion: campos.descripcion.input.value.trim()
          }
        };
      }
    });
  }

  /* ===================== Avisos ===================== */

  function montarAvisos() {
    const estado = crearEstado();
    const lista = document.createElement('ul');
    lista.className = 'avisos-lista';

    const form = puedeGestionar ? formAviso() : null;

    if (form) vistas.avisos.appendChild(form.boton);
    vistas.avisos.append(estado.elemento, lista);
    if (form) vistas.avisos.appendChild(form.caja);

    return { estado, lista, formulario: form };
  }

  async function cargarAvisos() {
    avisos.estado.mostrar('cargando', 'Cargando avisos…');
    avisos.lista.innerHTML = '';

    try {
      const datos = await window.API.avisos.listar({ categoria });
      avisos.estado.ocultar();

      if (!datos.avisos.length) {
        const vacio = document.createElement('li');
        vacio.className = 'agenda-vacia';
        vacio.textContent = 'Todavía no hay avisos publicados.';
        avisos.lista.appendChild(vacio);
        return;
      }

      datos.avisos.forEach(av => avisos.lista.appendChild(tarjetaAviso(av)));

    } catch (error) {
      avisos.estado.mostrar('error', error.status === 0
        ? 'No se pudo conectar con el servidor.'
        : `No se pudieron cargar los avisos: ${error.message}`);
    }
  }

  function tarjetaAviso(av) {
    const li = document.createElement('li');
    li.className = 'aviso-item';
    if (av.fijado) li.classList.add('aviso-fijado');

    const cabecera = document.createElement('div');
    cabecera.className = 'aviso-cabecera';

    const titulo = document.createElement('h3');
    titulo.className = 'aviso-titulo';
    titulo.textContent = av.titulo;
    cabecera.appendChild(titulo);

    if (av.fijado) {
      const chincheta = document.createElement('span');
      chincheta.className = 'aviso-chip';
      chincheta.textContent = 'Fijado';
      cabecera.appendChild(chincheta);
    }

    const cuerpo = document.createElement('p');
    cuerpo.className = 'aviso-cuerpo';
    cuerpo.textContent = av.cuerpo;

    const pie = document.createElement('p');
    pie.className = 'aviso-pie';
    pie.textContent = fechaLarga(diaISO(new Date(av.creadoEn)))
      + (av.creadoPor?.nombre ? ` · ${av.creadoPor.nombre}` : '');

    li.append(cabecera, cuerpo, pie);

    if (puedeGestionar) {
      li.appendChild(acciones(
        () => avisos.formulario.abrir(av),
        () => borrar('avisos', av._id, av.titulo, cargarAvisos)
      ));
    }

    return li;
  }

  function formAviso() {
    const campos = {
      titulo: campo('Título', 'text', true),
      cuerpo: campoTexto('Aviso', true),
      fijado: campoCasilla('Mantenerlo fijado arriba')
    };

    return formulario({
      etiquetaBoton: '+ Nuevo aviso',
      tituloNuevo: 'Nuevo aviso',
      tituloEditar: 'Editar aviso',
      campos,
      recurso: 'avisos',
      recargar: cargarAvisos,

      rellenar(av) {
        campos.titulo.input.value = av ? av.titulo : '';
        campos.cuerpo.input.value = av ? av.cuerpo : '';
        campos.fijado.input.checked = Boolean(av && av.fijado);
      },

      recoger() {
        const titulo = campos.titulo.input.value.trim();
        const cuerpo = campos.cuerpo.input.value.trim();
        if (!titulo) return { error: 'El título es obligatorio.' };
        if (!cuerpo) return { error: 'El aviso no puede ir vacío.' };
        return {
          datos: { titulo, cuerpo, categoria, fijado: campos.fijado.input.checked }
        };
      }
    });
  }

  /* ===================== Formulario compartido ===================== */

  /* Actividades y avisos se crean y se editan igual: un botón que despliega
     una caja, la caja rellena para editar o vacía para crear, y un guardado
     que hace POST o PUT según haya id. */
  function formulario(config) {
    let editando = null;

    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'rama-btn-nuevo';
    boton.textContent = config.etiquetaBoton;

    const caja = document.createElement('form');
    caja.className = 'rama-form';
    caja.hidden = true;
    caja.setAttribute('novalidate', '');

    const titulo = document.createElement('h3');
    titulo.className = 'rama-form-titulo';

    const rejilla = document.createElement('div');
    rejilla.className = 'rama-form-campos';
    Object.values(config.campos).forEach(c => rejilla.appendChild(c.elemento));

    const aviso = crearEstado();

    const barra = document.createElement('div');
    barra.className = 'rama-form-acciones';

    const guardar = document.createElement('button');
    guardar.type = 'submit';
    guardar.className = 'btn-solicitud btn-guardar';
    guardar.textContent = 'Guardar';

    const cancelar = document.createElement('button');
    cancelar.type = 'button';
    cancelar.className = 'btn-solicitud btn-cancelar';
    cancelar.textContent = 'Cancelar';
    cancelar.addEventListener('click', cerrar);

    barra.append(guardar, cancelar);
    caja.append(titulo, rejilla, aviso.elemento, barra);

    boton.addEventListener('click', () => {
      if (caja.hidden) abrir(null); else cerrar();
    });

    caja.addEventListener('submit', async evento => {
      evento.preventDefault();

      const { datos, error } = config.recoger();
      if (error) return aviso.mostrar('error', error);

      guardar.disabled = true;
      aviso.mostrar('cargando', 'Guardando…');

      try {
        const api = window.API[config.recurso];
        if (editando) await api.actualizar(editando, datos);
        else await api.crear(datos);

        cerrar();
        await config.recargar();
      } catch (fallo) {
        aviso.mostrar('error', fallo.message);
      } finally {
        guardar.disabled = false;
      }
    });

    function abrir(elemento) {
      editando = elemento ? elemento._id : null;
      titulo.textContent = elemento ? config.tituloEditar : config.tituloNuevo;
      config.rellenar(elemento);
      aviso.ocultar();
      caja.hidden = false;
      caja.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      Object.values(config.campos)[0].input.focus();
    }

    function cerrar() {
      editando = null;
      caja.hidden = true;
      aviso.ocultar();
    }

    return { boton, caja, abrir };
  }

  async function borrar(recurso, id, nombre, recargar) {
    if (!window.confirm(`¿Eliminar "${nombre}"? No se puede deshacer.`)) return;
    try {
      await window.API[recurso].eliminar(id);
      await recargar();
    } catch (error) {
      window.alert(`No se pudo eliminar: ${error.message}`);
    }
  }

  function acciones(alEditar, alBorrar) {
    const caja = document.createElement('div');
    caja.className = 'rama-acciones';

    const editar = document.createElement('button');
    editar.type = 'button';
    editar.className = 'btn-solicitud btn-editar';
    editar.textContent = 'Editar';
    editar.addEventListener('click', alEditar);

    const eliminar = document.createElement('button');
    eliminar.type = 'button';
    eliminar.className = 'btn-solicitud btn-eliminar';
    eliminar.textContent = 'Eliminar';
    eliminar.addEventListener('click', alBorrar);

    caja.append(editar, eliminar);
    return caja;
  }

  /* ===================== Piezas sueltas ===================== */

  function campo(etiqueta, tipo, requerido = false) {
    const caja = document.createElement('label');
    caja.className = 'campo';

    const texto = document.createElement('span');
    texto.textContent = etiqueta;

    const input = document.createElement('input');
    input.type = tipo;
    if (requerido) input.required = true;

    caja.append(texto, input);
    return { elemento: caja, input };
  }

  function campoTexto(etiqueta, requerido = false) {
    const caja = document.createElement('label');
    caja.className = 'campo campo-ancho';

    const texto = document.createElement('span');
    texto.textContent = etiqueta;

    const input = document.createElement('textarea');
    input.rows = 3;
    if (requerido) input.required = true;

    caja.append(texto, input);
    return { elemento: caja, input };
  }

  function campoCasilla(etiqueta) {
    const caja = document.createElement('label');
    caja.className = 'campo campo-casilla';

    const input = document.createElement('input');
    input.type = 'checkbox';

    const texto = document.createElement('span');
    texto.textContent = etiqueta;

    caja.append(input, texto);
    return { elemento: caja, input };
  }

  function crearEstado() {
    const elemento = document.createElement('div');
    elemento.setAttribute('role', 'status');
    elemento.setAttribute('aria-live', 'polite');
    elemento.hidden = true;

    return {
      elemento,
      mostrar(tipo, mensaje) {
        elemento.className = `estado estado-${tipo}`;
        elemento.textContent = mensaje;
        elemento.hidden = false;
      },
      ocultar() {
        elemento.hidden = true;
        elemento.textContent = '';
      }
    };
  }

  /* El día de una actividad viaja como ISO en UTC; los diez primeros
     caracteres son el día del calendario, sin que el huso pueda moverlo. */
  function diaDe(actividad) {
    return String(actividad.fecha || '').slice(0, 10);
  }

  /* Fecha que se propone al crear: hoy si se está mirando el mes actual, y si
     no, el día 1 del mes que se ve, que es lo que la persona tiene delante. */
  function primerDiaVisible() {
    const mesVisible = `${anio}-${String(mes + 1).padStart(2, '0')}`;
    return hoyISO.startsWith(mesVisible) ? hoyISO : `${mesVisible}-01`;
  }

  function diaISO(fecha) {
    const dos = n => String(n).padStart(2, '0');
    return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
  }

  function fechaLarga(iso) {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!partes) return '';
    const [, a, m, d] = partes;
    return `${Number(d)} de ${MESES[Number(m) - 1]} de ${a}`;
  }
})();
