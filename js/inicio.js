/* Portada: carrusel de templos y estado de la próxima reunión. */
(function () {
  'use strict';

  /* =================================================================
     REUNIONES — edita aquí si cambian los horarios.
     dia: 0 = domingo, 1 = lunes … 6 = sábado
     duracion: minutos que dura la reunión
     ================================================================= */
  const REUNIONES = [
    { dia: 2, hora: 20, minuto: 0, duracion: 80 },   // martes
    { dia: 4, hora: 20, minuto: 0, duracion: 80 },   // jueves
    { dia: 0, hora: 18, minuto: 0, duracion: 180 }   // domingo
  ];

  /* ===================== Carrusel de templos ===================== */

  const grid = document.getElementById('templesGrid');
  const flechaIzq = document.querySelector('.temples-arrow-left');
  const flechaDer = document.querySelector('.temples-arrow-right');

  if (grid && flechaIzq && flechaDer) {
    // Antes era un salto fijo de 380px. Medir la tarjeta real hace que el
    // desplazamiento coincida con el ancho de una tarjeta en cada pantalla.
    const paso = () => {
      const tarjeta = grid.querySelector('.temple-card');
      if (!tarjeta) return 340;
      const separacion = parseFloat(getComputedStyle(grid).columnGap) || 22;
      return tarjeta.offsetWidth + separacion;
    };

    flechaIzq.addEventListener('click', () =>
      grid.scrollBy({ left: -paso(), behavior: 'smooth' }));

    flechaDer.addEventListener('click', () =>
      grid.scrollBy({ left: paso(), behavior: 'smooth' }));
  }

  /* ===================== Próxima reunión ===================== */

  const etiqueta = document.getElementById('meetingLabel');
  const textoDia = document.getElementById('meetingDay');
  const textoHora = document.getElementById('meetingTime');
  const distintivo = document.getElementById('meetingBadge');

  if (!etiqueta || !textoDia || !textoHora || !distintivo) return;

  /* Devuelve la próxima vez que ocurre esta reunión.
     Si está ocurriendo ahora mismo, devuelve la de hoy (ya empezada). */
  function proximaOcurrencia(reunion, ahora) {
    const inicio = new Date(ahora);
    inicio.setHours(reunion.hora, reunion.minuto, 0, 0);

    const diasHasta = (reunion.dia - ahora.getDay() + 7) % 7;
    inicio.setDate(inicio.getDate() + diasHasta);

    // Si la de esta semana ya terminó, la siguiente es dentro de 7 días.
    if (inicio.getTime() + reunion.duracion * 60000 <= ahora.getTime()) {
      inicio.setDate(inicio.getDate() + 7);
    }

    return inicio;
  }

  function actualizar() {
    const ahora = new Date();

    // Se compara con fechas reales en vez de con "días de diferencia": así
    // sigue siendo correcto aunque haya dos reuniones el mismo día.
    const proxima = REUNIONES
      .map(reunion => ({ reunion, inicio: proximaOcurrencia(reunion, ahora) }))
      .sort((a, b) => a.inicio - b.inicio)[0];

    const enCurso = ahora >= proxima.inicio;

    if (enCurso) {
      etiqueta.textContent = '';
      textoDia.textContent = 'Te esperamos';
      distintivo.style.display = 'flex';
    } else {
      etiqueta.textContent = 'Próxima reunión';
      textoDia.textContent = formatearDia(proxima.inicio);
      distintivo.style.display = 'none';
    }

    pintarHora(proxima.reunion.hora, proxima.reunion.minuto);
  }

  function formatearDia(fecha) {
    const texto = fecha
      .toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
      .replace(',', '');
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  function pintarHora(hora, minuto) {
    textoHora.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
        viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      ${hora}:${String(minuto).padStart(2, '0')} hrs.`;
  }

  actualizar();

  // Antes se calculaba una sola vez al cargar: si alguien dejaba la pestaña
  // abierta, el distintivo "En curso" no aparecía nunca.
  setInterval(actualizar, 60000);

  // Al volver a la pestaña, refresca de inmediato en vez de esperar al minuto.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) actualizar();
  });
})();
