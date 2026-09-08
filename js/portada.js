/* Textos editables de la portada. Hoy solo el versículo del hero.

   Cualquiera lo lee; solo un editor o un administrador ve el botón de cambiarlo,
   y la API rechaza a los demás igualmente. Si el servidor no responde, se queda
   el texto que ya viene escrito en index.html, así que la portada nunca sale
   vacía por una caída del backend. */
(function () {
  'use strict';

  const huecos = document.querySelectorAll('[data-contenido]');
  if (!huecos.length || !window.API) return;

  const boton = document.querySelector('[data-editar-versiculo]');
  let actual = null;   // { versiculo_texto, versiculo_referencia }

  window.API.contenido.listar()
    .then(datos => {
      actual = datos.contenido;
      huecos.forEach(hueco => {
        const valor = actual[hueco.dataset.contenido];
        // textContent: el versículo lo escribe una persona desde el navegador.
        // Los saltos de línea se respetan con CSS (white-space: pre-line).
        if (typeof valor === 'string') hueco.textContent = valor;
      });
    })
    .catch(() => {
      // Sin servidor se queda el texto de respaldo del HTML. No se avisa:
      // una visita no tiene nada que hacer con ese error.
    });

  if (!boton || !window.API.sesion.tieneRol('editor', 'admin')) return;

  boton.hidden = false;
  boton.addEventListener('click', abrir);

  /* ===================== Editor ===================== */

  let caja = null;

  function abrir() {
    if (caja) return cerrar();

    caja = document.createElement('form');
    caja.className = 'hero-editor';
    caja.setAttribute('novalidate', '');

    const titulo = document.createElement('h2');
    titulo.className = 'hero-editor-titulo';
    titulo.textContent = 'Versículo de la portada';

    const texto = campo('Versículo', 'textarea');
    const referencia = campo('Referencia (por ejemplo, Salmos 122:1)', 'input');

    // Se rellena con lo que hay puesto ahora mismo en la página, que es lo
    // guardado si la API respondió y el respaldo si no.
    texto.input.value = leer('versiculo_texto');
    referencia.input.value = leer('versiculo_referencia');

    const aviso = document.createElement('p');
    aviso.className = 'hero-editor-aviso';
    aviso.setAttribute('role', 'status');
    aviso.hidden = true;

    const acciones = document.createElement('div');
    acciones.className = 'hero-editor-acciones';

    const guardar = document.createElement('button');
    guardar.type = 'submit';
    guardar.className = 'btn-solicitud btn-guardar';
    guardar.textContent = 'Guardar';

    const cancelar = document.createElement('button');
    cancelar.type = 'button';
    cancelar.className = 'btn-solicitud btn-cancelar';
    cancelar.textContent = 'Cancelar';
    cancelar.addEventListener('click', cerrar);

    acciones.append(guardar, cancelar);
    caja.append(titulo, texto.campo, referencia.campo, aviso, acciones);

    caja.addEventListener('submit', async evento => {
      evento.preventDefault();

      const nuevoTexto = texto.input.value.trim();
      const nuevaRef = referencia.input.value.trim();

      if (!nuevoTexto || !nuevaRef) {
        return fallo(aviso, 'El versículo y la referencia son obligatorios.');
      }

      guardar.disabled = true;
      mostrar(aviso, 'Guardando…', false);

      try {
        // Dos claves, dos peticiones. Si la segunda falla, la primera ya se
        // guardó: se recarga el estado real desde la API para no dejar la
        // pantalla contando algo distinto de lo que hay en la base.
        await window.API.contenido.guardar('versiculo_texto', nuevoTexto);
        await window.API.contenido.guardar('versiculo_referencia', nuevaRef);

        pintar('versiculo_texto', nuevoTexto);
        pintar('versiculo_referencia', nuevaRef);
        cerrar();

      } catch (error) {
        fallo(aviso, error.message);
        window.API.contenido.listar()
          .then(datos => {
            actual = datos.contenido;
            Object.keys(datos.contenido).forEach(c => pintar(c, datos.contenido[c]));
          })
          .catch(() => { /* ya se mostró el error de guardado */ });
      } finally {
        guardar.disabled = false;
      }
    });

    boton.insertAdjacentElement('afterend', caja);
    texto.input.focus();
  }

  function cerrar() {
    if (!caja) return;
    caja.remove();
    caja = null;
    boton.focus();
  }

  /* ===================== Piezas ===================== */

  function pintar(clave, valor) {
    if (actual) actual[clave] = valor;
    document.querySelectorAll(`[data-contenido="${clave}"]`)
      .forEach(hueco => { hueco.textContent = valor; });
  }

  function leer(clave) {
    if (actual && typeof actual[clave] === 'string') return actual[clave];
    const hueco = document.querySelector(`[data-contenido="${clave}"]`);
    // El respaldo del HTML trae saltos y sangría del código: se limpian.
    return hueco ? hueco.textContent.trim().replace(/\n\s+/g, '\n') : '';
  }

  function campo(etiqueta, tipo) {
    const contenedor = document.createElement('label');
    contenedor.className = 'hero-editor-campo';

    const nombre = document.createElement('span');
    nombre.textContent = etiqueta;

    const input = document.createElement(tipo === 'textarea' ? 'textarea' : 'input');
    if (tipo === 'textarea') input.rows = 3;
    else input.type = 'text';

    contenedor.append(nombre, input);
    return { campo: contenedor, input };
  }

  function mostrar(elemento, mensaje, esError) {
    elemento.textContent = mensaje;
    elemento.classList.toggle('hero-editor-error', Boolean(esError));
    elemento.hidden = false;
  }

  function fallo(elemento, mensaje) {
    mostrar(elemento, mensaje, true);
  }
})();
