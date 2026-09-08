/* Renderiza un listado de documentos desde la API.
   Se activa solo si la página tiene un contenedor [data-documentos].
   El atributo data-categoria fija el filtro (vacío = todas). */
(function () {
  'use strict';

  const contenedor = document.querySelector('[data-documentos]');
  if (!contenedor) return;

  const categoriaFija = contenedor.dataset.categoria || '';
  const conFiltros = contenedor.hasAttribute('data-filtros');
  const CATEGORIAS = ['Varones', 'Dorcas', 'Jovenes', 'Coro', 'EBD', 'General'];
  const LIMITE = 12;

  let categoria = categoriaFija;
  let pagina = 1;
  let totalPaginas = 1;

  const lista = document.createElement('ul');
  lista.className = 'documentos-lista';

  const estado = document.createElement('div');
  estado.setAttribute('role', 'status');
  estado.setAttribute('aria-live', 'polite');

  const paginacion = crearPaginacion();

  if (conFiltros) contenedor.appendChild(crearFiltros());
  contenedor.append(estado, lista, paginacion.elemento);

  cargar();

  /* ===================== Carga ===================== */

  async function cargar() {
    mostrarEstado('cargando', 'Cargando documentos…');
    lista.innerHTML = '';
    paginacion.elemento.hidden = true;

    try {
      const datos = await window.API.documentos.listar({
        categoria: categoria || undefined,
        pagina,
        limite: LIMITE
      });

      totalPaginas = datos.paginas || 1;

      if (!datos.documentos.length) {
        mostrarEstado('vacio', categoria
          ? 'Todavía no hay documentos publicados en esta sección.'
          : 'Todavía no hay documentos publicados.');
        return;
      }

      ocultarEstado();
      datos.documentos.forEach(doc => lista.appendChild(tarjeta(doc)));
      paginacion.actualizar(pagina, totalPaginas, datos.total);

    } catch (error) {
      mostrarEstado('error', error.status === 0
        ? 'No se pudo conectar con el servidor. Inténtalo más tarde.'
        : `No se pudieron cargar los documentos: ${error.message}`);
    }
  }

  /* ===================== Tarjeta ===================== */

  function tarjeta(doc) {
    const li = document.createElement('li');
    li.className = 'documento-card';

    const cabecera = document.createElement('div');
    cabecera.className = 'documento-cabecera';

    const titulo = document.createElement('h3');
    titulo.className = 'documento-titulo';
    // textContent en todo: los títulos y descripciones los escriben personas
    // y no deben interpretarse como HTML.
    titulo.textContent = doc.titulo;

    const tipo = document.createElement('span');
    tipo.className = 'documento-tipo';
    tipo.textContent = doc.tipoArchivo || 'archivo';

    cabecera.append(titulo, tipo);
    li.appendChild(cabecera);

    if (doc.descripcion) {
      const descripcion = document.createElement('p');
      descripcion.className = 'documento-descripcion';
      descripcion.textContent = doc.descripcion;
      li.appendChild(descripcion);
    }

    const meta = document.createElement('div');
    meta.className = 'documento-meta';
    meta.appendChild(dato(formatearFecha(doc.fechaSubida)));
    if (!categoria) meta.appendChild(dato(doc.categoria));
    if (doc.tamanoBytes) meta.appendChild(dato(formatearTamano(doc.tamanoBytes)));
    if (doc.subidoPor?.nombre) meta.appendChild(dato(`Subido por ${doc.subidoPor.nombre}`));
    li.appendChild(meta);

    const acciones = document.createElement('div');
    acciones.className = 'documento-acciones';

    const descargar = document.createElement('a');
    descargar.className = 'documento-descargar';
    descargar.href = doc.urlDescarga || doc.archivoURL;
    descargar.target = '_blank';
    descargar.rel = 'noopener noreferrer';
    descargar.textContent = 'Descargar';
    // El nombre del archivo va en el aria-label para que un lector de
    // pantalla no anuncie doce veces "Descargar" sin contexto.
    descargar.setAttribute('aria-label', `Descargar ${doc.titulo}`);

    acciones.appendChild(descargar);
    li.appendChild(acciones);

    return li;
  }

  function dato(texto) {
    const span = document.createElement('span');
    span.textContent = texto;
    return span;
  }

  /* ===================== Filtros ===================== */

  function crearFiltros() {
    const grupo = document.createElement('div');
    grupo.className = 'filtros';
    grupo.setAttribute('role', 'group');
    grupo.setAttribute('aria-label', 'Filtrar documentos por categoría');

    const opciones = [{ valor: '', etiqueta: 'Todos' }]
      .concat(CATEGORIAS.map(c => ({ valor: c, etiqueta: c === 'EBD' ? 'Escuela Bíblica' : c })));

    opciones.forEach(({ valor, etiqueta }) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'filtro-btn';
      boton.textContent = etiqueta;
      boton.setAttribute('aria-pressed', String(valor === categoria));

      boton.addEventListener('click', () => {
        if (valor === categoria) return;
        categoria = valor;
        pagina = 1;
        grupo.querySelectorAll('.filtro-btn').forEach(b =>
          b.setAttribute('aria-pressed', String(b === boton)));
        cargar();
      });

      grupo.appendChild(boton);
    });

    return grupo;
  }

  /* ===================== Paginación ===================== */

  function crearPaginacion() {
    const elemento = document.createElement('nav');
    elemento.className = 'paginacion';
    elemento.setAttribute('aria-label', 'Paginación de documentos');
    elemento.hidden = true;

    const anterior = document.createElement('button');
    anterior.type = 'button';
    anterior.textContent = '‹ Anterior';

    const info = document.createElement('span');
    info.className = 'paginacion-info';

    const siguiente = document.createElement('button');
    siguiente.type = 'button';
    siguiente.textContent = 'Siguiente ›';

    anterior.addEventListener('click', () => {
      if (pagina > 1) { pagina--; cargar(); scrollArriba(); }
    });

    siguiente.addEventListener('click', () => {
      if (pagina < totalPaginas) { pagina++; cargar(); scrollArriba(); }
    });

    elemento.append(anterior, info, siguiente);

    return {
      elemento,
      actualizar(actual, paginas, total) {
        elemento.hidden = paginas <= 1;
        anterior.disabled = actual <= 1;
        siguiente.disabled = actual >= paginas;
        info.textContent = `Página ${actual} de ${paginas} · ${total} documento${total === 1 ? '' : 's'}`;
      }
    };
  }

  function scrollArriba() {
    contenedor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ===================== Estados y formato ===================== */

  function mostrarEstado(tipo, mensaje) {
    estado.className = `estado estado-${tipo}`;
    estado.textContent = mensaje;
    estado.hidden = false;
  }

  function ocultarEstado() {
    estado.hidden = true;
    estado.textContent = '';
  }

  function formatearFecha(iso) {
    if (!iso) return '';
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return '';
    return fecha.toLocaleDateString('es-CL', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  function formatearTamano(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
})();
