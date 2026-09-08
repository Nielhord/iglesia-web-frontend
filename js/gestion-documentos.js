/* Subida, edición y borrado de documentos. Para editores y administradores.
   Se activa con el contenedor [data-gestion-documentos]. */
(function () {
  'use strict';

  const contenedor = document.querySelector('[data-gestion-documentos]');
  if (!contenedor) return;

  const LIMITE = 50;
  const CATEGORIAS = ['Varones', 'Dorcas', 'Jovenes', 'Coro', 'EBD', 'General'];

  const NOMBRE_CATEGORIA = { EBD: 'Escuela Bíblica' };

  // Espejo de TIPOS_PERMITIDOS en middleware/multer.js. Sirve para que el
  // selector de archivos no ofrezca formatos que el servidor va a rechazar;
  // la validación de verdad la hace el backend con el MIME real.
  const EXTENSIONES = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp3,.txt';

  let categoria = '';

  /* ===================== Control de acceso ===================== */

  const sesion = window.API.sesion;

  if (!sesion.activa) {
    window.location.replace('login.html?volver=gestion-documentos.html');
    return;
  }

  if (!sesion.tieneRol('editor', 'admin')) {
    mostrarEstado('error', 'Esta página es solo para editores y administradores.');
    return;
  }

  /* ===================== Montaje ===================== */

  const formSubida = crearFormularioSubida();
  const filtros = crearFiltros();

  const estado = document.createElement('div');
  estado.setAttribute('role', 'status');
  estado.setAttribute('aria-live', 'polite');

  const lista = document.createElement('ul');
  lista.className = 'solicitudes-lista';

  contenedor.append(formSubida, filtros, estado, lista);

  cargar();

  /* ===================== Subida ===================== */

  function crearFormularioSubida() {
    const seccion = document.createElement('section');
    seccion.className = 'subida-caja';

    const titulo = document.createElement('h2');
    titulo.className = 'subida-titulo';
    titulo.textContent = 'Subir un documento';

    const form = document.createElement('form');
    form.className = 'usuario-form subida-form';
    form.noValidate = true;

    const campoTitulo = campo('Título', 'text', '', 'subida-titulo-campo');
    campoTitulo.querySelector('input').required = true;

    const campoCategoria = document.createElement('div');
    campoCategoria.className = 'campo';
    const labelCat = document.createElement('label');
    labelCat.setAttribute('for', 'subida-categoria');
    labelCat.textContent = 'Categoría';
    const selectCat = document.createElement('select');
    selectCat.id = 'subida-categoria';
    CATEGORIAS.forEach(c => {
      const opcion = document.createElement('option');
      opcion.value = c;
      opcion.textContent = NOMBRE_CATEGORIA[c] || c;
      selectCat.appendChild(opcion);
    });
    campoCategoria.append(labelCat, selectCat);

    const campoArchivo = campo('Archivo', 'file', '', 'subida-archivo');
    const inputArchivo = campoArchivo.querySelector('input');
    inputArchivo.accept = EXTENSIONES;
    inputArchivo.required = true;
    const ayudaArchivo = document.createElement('p');
    ayudaArchivo.className = 'campo-ayuda';
    ayudaArchivo.textContent = 'PDF, Word, Excel, PowerPoint, imágenes, MP3 o texto. Máximo 10 MB.';
    campoArchivo.appendChild(ayudaArchivo);

    const campoDescripcion = document.createElement('div');
    campoDescripcion.className = 'campo campo-ancho';
    const labelDesc = document.createElement('label');
    labelDesc.setAttribute('for', 'subida-descripcion');
    labelDesc.textContent = 'Descripción (opcional)';
    const textarea = document.createElement('textarea');
    textarea.id = 'subida-descripcion';
    textarea.rows = 2;
    campoDescripcion.append(labelDesc, textarea);

    const rejilla = document.createElement('div');
    rejilla.className = 'usuario-rejilla';
    rejilla.append(campoTitulo, campoCategoria, campoArchivo, campoDescripcion);

    const boton = document.createElement('button');
    boton.type = 'submit';
    boton.className = 'btn-solicitud btn-aprobar';
    boton.textContent = 'Subir documento';

    const acciones = document.createElement('div');
    acciones.className = 'solicitud-acciones';
    acciones.appendChild(boton);

    const aviso = document.createElement('p');
    aviso.hidden = true;

    form.append(rejilla, acciones, aviso);
    seccion.append(titulo, form);

    form.addEventListener('submit', async (evento) => {
      evento.preventDefault();

      const archivo = inputArchivo.files[0];
      const tituloValor = campoTitulo.querySelector('input').value.trim();

      if (!tituloValor) return avisar(aviso, 'error', 'El título es obligatorio.');
      if (!archivo) return avisar(aviso, 'error', 'Tienes que elegir un archivo.');

      const datos = new FormData();
      datos.append('titulo', tituloValor);
      datos.append('categoria', selectCat.value);
      datos.append('descripcion', textarea.value.trim());
      datos.append('file', archivo);

      bloquear(form, true);
      avisar(aviso, 'ok', 'Subiendo…');

      try {
        const respuesta = await window.API.documentos.subir(datos);
        avisar(aviso, 'ok', respuesta.mensaje);
        form.reset();
        setTimeout(() => { cargar(); ocultar(aviso); }, 900);
      } catch (error) {
        avisar(aviso, 'error', mensajeDeError(error, 'No se pudo subir'));
      } finally {
        bloquear(form, false);
      }
    });

    return seccion;
  }

  /* ===================== Carga del listado ===================== */

  async function cargar() {
    mostrarEstado('cargando', 'Cargando documentos…');
    lista.innerHTML = '';

    try {
      const datos = await window.API.documentos.listar({
        categoria: categoria || undefined,
        limite: LIMITE
      });

      if (!datos.documentos.length) {
        mostrarEstado('vacio', categoria
          ? 'No hay documentos en esta categoría.'
          : 'Todavía no hay documentos publicados.');
        return;
      }

      ocultarEstado();
      datos.documentos.forEach(doc => lista.appendChild(tarjeta(doc)));

    } catch (error) {
      mostrarEstado('error', mensajeDeError(error, 'No se pudieron cargar los documentos'));
    }
  }

  /* ===================== Tarjeta ===================== */

  function tarjeta(doc) {
    const li = document.createElement('li');
    li.className = 'solicitud-card';

    const cabecera = document.createElement('div');
    cabecera.className = 'solicitud-cabecera';

    const titulo = document.createElement('h3');
    titulo.className = 'solicitud-nombre';
    // textContent: los títulos los escriben personas, no deben interpretarse
    // como HTML.
    titulo.textContent = doc.titulo;

    const tipo = document.createElement('span');
    tipo.className = 'documento-tipo';
    tipo.textContent = doc.tipoArchivo || 'archivo';

    cabecera.append(titulo, tipo);

    const meta = document.createElement('div');
    meta.className = 'solicitud-meta';
    meta.appendChild(dato(NOMBRE_CATEGORIA[doc.categoria] || doc.categoria));
    meta.appendChild(dato(formatearFecha(doc.fechaSubida)));
    if (doc.tamanoBytes) meta.appendChild(dato(formatearTamano(doc.tamanoBytes)));
    if (doc.subidoPor?.nombre) meta.appendChild(dato(`Subido por ${doc.subidoPor.nombre}`));

    li.append(cabecera, meta, formularioEdicion(doc, li));

    return li;
  }

  function formularioEdicion(doc, li) {
    const form = document.createElement('form');
    form.className = 'usuario-form';
    form.noValidate = true;

    const campoTitulo = campo('Título', 'text', doc.titulo, `titulo-${doc.id || doc._id}`);

    const id = doc.id || doc._id;

    const campoCategoria = document.createElement('div');
    campoCategoria.className = 'campo';
    const label = document.createElement('label');
    label.setAttribute('for', `categoria-${id}`);
    label.textContent = 'Categoría';
    const select = document.createElement('select');
    select.id = `categoria-${id}`;
    CATEGORIAS.forEach(c => {
      const opcion = document.createElement('option');
      opcion.value = c;
      opcion.textContent = NOMBRE_CATEGORIA[c] || c;
      opcion.selected = c === doc.categoria;
      select.appendChild(opcion);
    });
    campoCategoria.append(label, select);

    const campoDescripcion = document.createElement('div');
    campoDescripcion.className = 'campo campo-ancho';
    const labelDesc = document.createElement('label');
    labelDesc.setAttribute('for', `descripcion-${id}`);
    labelDesc.textContent = 'Descripción';
    const textarea = document.createElement('textarea');
    textarea.id = `descripcion-${id}`;
    textarea.rows = 2;
    textarea.value = doc.descripcion || '';
    campoDescripcion.append(labelDesc, textarea);

    const rejilla = document.createElement('div');
    rejilla.className = 'usuario-rejilla';
    rejilla.append(campoTitulo, campoCategoria, campoDescripcion);

    const acciones = document.createElement('div');
    acciones.className = 'solicitud-acciones';

    const guardar = document.createElement('button');
    guardar.type = 'submit';
    guardar.className = 'btn-solicitud btn-aprobar';
    guardar.textContent = 'Guardar cambios';

    const descargar = document.createElement('a');
    descargar.className = 'documento-descargar';
    descargar.href = doc.urlDescarga || doc.archivoURL;
    descargar.target = '_blank';
    descargar.rel = 'noopener noreferrer';
    descargar.textContent = 'Descargar';
    descargar.setAttribute('aria-label', `Descargar ${doc.titulo}`);

    acciones.append(guardar, botonEliminar(doc, li), descargar);

    form.append(rejilla, acciones);

    form.addEventListener('submit', async (evento) => {
      evento.preventDefault();

      const cambios = {};
      const tituloNuevo = campoTitulo.querySelector('input').value.trim();
      const descripcionNueva = textarea.value.trim();

      if (tituloNuevo !== doc.titulo) cambios.titulo = tituloNuevo;
      if (select.value !== doc.categoria) cambios.categoria = select.value;
      if (descripcionNueva !== (doc.descripcion || '')) cambios.descripcion = descripcionNueva;

      if (Object.keys(cambios).length === 0) {
        return avisoEnFila(li, 'error', 'No cambiaste nada.');
      }
      if (cambios.titulo === '') {
        return avisoEnFila(li, 'error', 'El título no puede quedar vacío.');
      }

      bloquearFila(li, true);

      try {
        const respuesta = await window.API.documentos.actualizar(id, cambios);
        avisoEnFila(li, 'ok', respuesta.mensaje);
        setTimeout(cargar, 900);
      } catch (error) {
        avisoEnFila(li, 'error', mensajeDeError(error, 'No se pudo guardar'));
        bloquearFila(li, false);
      }
    });

    return form;
  }

  function botonEliminar(doc, li) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'btn-solicitud btn-rechazar';
    boton.textContent = 'Eliminar';
    boton.setAttribute('aria-label', `Eliminar ${doc.titulo}`);

    boton.addEventListener('click', async () => {
      const seguro = window.confirm(
        `¿Eliminar "${doc.titulo}"?\n\n`
        + 'Se borra también el archivo del almacenamiento. No se puede deshacer.'
      );
      if (!seguro) return;

      bloquearFila(li, true);

      try {
        const respuesta = await window.API.documentos.eliminar(doc.id || doc._id);
        avisoEnFila(li, 'ok', respuesta.mensaje);
        setTimeout(cargar, 900);
      } catch (error) {
        avisoEnFila(li, 'error', mensajeDeError(error, 'No se pudo eliminar'));
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
    grupo.setAttribute('aria-label', 'Filtrar documentos por categoría');

    const opciones = [{ valor: '', etiqueta: 'Todos' }]
      .concat(CATEGORIAS.map(c => ({ valor: c, etiqueta: NOMBRE_CATEGORIA[c] || c })));

    opciones.forEach(({ valor, etiqueta }) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'filtro-btn';
      boton.textContent = etiqueta;
      boton.setAttribute('aria-pressed', String(valor === categoria));

      boton.addEventListener('click', () => {
        if (valor === categoria) return;
        categoria = valor;
        grupo.querySelectorAll('.filtro-btn').forEach(b =>
          b.setAttribute('aria-pressed', String(b === boton)));
        cargar();
      });

      grupo.appendChild(boton);
    });

    return grupo;
  }

  /* ===================== Utilidades ===================== */

  function campo(etiqueta, tipo, valor, id) {
    const envoltorio = document.createElement('div');
    envoltorio.className = 'campo';

    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = etiqueta;

    const input = document.createElement('input');
    input.type = tipo;
    input.id = id;
    if (tipo !== 'file') input.value = valor;

    envoltorio.append(label, input);
    return envoltorio;
  }

  function dato(texto) {
    const span = document.createElement('span');
    span.textContent = texto;
    return span;
  }

  function bloquear(form, activo) {
    form.querySelectorAll('button, input, select, textarea').forEach(c => { c.disabled = activo; });
  }

  function bloquearFila(li, activo) {
    li.classList.toggle('solicitud-ocupada', activo);
    li.querySelectorAll('button, input, select, textarea').forEach(c => { c.disabled = activo; });
  }

  function avisar(elemento, tipo, texto) {
    elemento.className = `solicitud-resultado solicitud-resultado-${tipo}`;
    elemento.textContent = texto;
    elemento.hidden = false;
  }

  function ocultar(elemento) {
    elemento.hidden = true;
    elemento.textContent = '';
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
    if (error.status === 415) return 'Ese tipo de archivo no está permitido.';
    if (error.status === 502) return 'El almacenamiento no respondió. Inténtalo de nuevo.';
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
    return fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatearTamano(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
})();
