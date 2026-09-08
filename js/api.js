/* Cliente de la API. Centraliza la URL base, el token y el manejo de errores
   para que ninguna página tenga que repetir esa lógica. */
(function () {
  'use strict';

  const BASE = (window.APP_CONFIG && window.APP_CONFIG.API_URL) || 'http://localhost:3000/api';
  const CLAVE_TOKEN = 'iedp_token';
  const CLAVE_USUARIO = 'iedp_usuario';

  /* ===== Sesión (localStorage) ===== */

  const sesion = {
    get token() {
      try { return localStorage.getItem(CLAVE_TOKEN); } catch { return null; }
    },

    get usuario() {
      try {
        const bruto = localStorage.getItem(CLAVE_USUARIO);
        return bruto ? JSON.parse(bruto) : null;
      } catch { return null; }
    },

    get activa() {
      return Boolean(this.token);
    },

    guardar(token, usuario) {
      try {
        localStorage.setItem(CLAVE_TOKEN, token);
        localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
      } catch {
        // Modo privado o almacenamiento bloqueado: la sesión durará
        // solo mientras la página esté abierta.
      }
    },

    cerrar() {
      try {
        localStorage.removeItem(CLAVE_TOKEN);
        localStorage.removeItem(CLAVE_USUARIO);
      } catch { /* nada que limpiar */ }
    },

    tieneRol(...roles) {
      const usuario = this.usuario;
      return Boolean(usuario && roles.includes(usuario.rol));
    }
  };

  /* ===== Error con el status HTTP a mano ===== */

  class ErrorAPI extends Error {
    constructor(mensaje, status) {
      super(mensaje);
      this.name = 'ErrorAPI';
      this.status = status;
    }
  }

  /* ===== Petición ===== */

  async function peticion(ruta, opciones = {}) {
    const { autenticada = false, ...resto } = opciones;
    const cabeceras = { ...(resto.headers || {}) };

    // FormData define su propio Content-Type con el boundary; ponerlo a mano
    // rompe la subida.
    if (resto.body && !(resto.body instanceof FormData)) {
      cabeceras['Content-Type'] = 'application/json';
    }

    if (autenticada) {
      const token = sesion.token;
      if (!token) throw new ErrorAPI('Necesitas iniciar sesión', 401);
      cabeceras.Authorization = `Bearer ${token}`;
    }

    let respuesta;
    try {
      respuesta = await fetch(`${BASE}${ruta}`, { ...resto, headers: cabeceras });
    } catch {
      // Sitio publicado pero sin backend todavía: el mensaje lo explica en vez
      // de dar un error de conexión que parece una avería.
      throw new ErrorAPI(
        window.APP_CONFIG && window.APP_CONFIG.CONFIGURADA === false
          ? 'Esta sección necesita el servidor de la iglesia, que todavía no está publicado.'
          : 'No se pudo conectar con el servidor. ¿Está encendido?',
        0);
    }

    // 204 y otras respuestas sin cuerpo.
    const texto = await respuesta.text();
    let datos = {};
    if (texto) {
      try { datos = JSON.parse(texto); } catch { datos = { error: texto }; }
    }

    if (!respuesta.ok) {
      // Token caducado o inválido: la sesión guardada ya no sirve.
      if (respuesta.status === 401 && sesion.activa) {
        sesion.cerrar();
      }
      throw new ErrorAPI(datos.error || `Error ${respuesta.status}`, respuesta.status);
    }

    return datos;
  }

  /* ===== API pública ===== */

  window.API = {
    sesion,
    ErrorAPI,

    auth: {
      registrar: (datos) =>
        peticion('/auth/register', { method: 'POST', body: JSON.stringify(datos) }),

      login: (datos) =>
        peticion('/auth/login', { method: 'POST', body: JSON.stringify(datos) }),

      perfil: () =>
        peticion('/auth/perfil', { autenticada: true })
    },

    usuarios: {
      listar({ estado, pagina = 1, limite = 50 } = {}) {
        const params = new URLSearchParams({ pagina, limite });
        if (estado) params.set('estado', estado);
        return peticion(`/usuarios?${params}`, { autenticada: true });
      },

      aprobar: (id) =>
        peticion(`/usuarios/${id}/aprobar`, { method: 'PUT', autenticada: true }),

      rechazar: (id) =>
        peticion(`/usuarios/${id}/rechazar`, { method: 'PUT', autenticada: true }),

      actualizar: (id, datos) =>
        peticion(`/usuarios/${id}`, {
          method: 'PUT', body: JSON.stringify(datos), autenticada: true
        }),

      eliminar: (id) =>
        peticion(`/usuarios/${id}`, { method: 'DELETE', autenticada: true })
    },

    documentos: {
      listar({ categoria, pagina = 1, limite = 20 } = {}) {
        const params = new URLSearchParams({ pagina, limite });
        if (categoria) params.set('categoria', categoria);
        // El listado dejó de ser público: sin token el servidor responde 401.
        return peticion(`/documentos?${params}`, { autenticada: true });
      },

      subir(formData) {
        return peticion('/documentos', { method: 'POST', body: formData, autenticada: true });
      },

      actualizar: (id, datos) =>
        peticion(`/documentos/${id}`, {
          method: 'PUT', body: JSON.stringify(datos), autenticada: true
        }),

      eliminar: (id) =>
        peticion(`/documentos/${id}`, { method: 'DELETE', autenticada: true })
    },

    // Actividades y avisos: leerlos es abierto, cambiarlos no.
    actividades: recursoAbierto('actividades'),
    avisos: recursoAbierto('avisos'),

    // Textos de la portada que un editor puede cambiar.
    contenido: {
      listar: () => peticion('/contenido'),
      guardar: (clave, valor) => peticion(`/contenido/${clave}`, {
        method: 'PUT', body: JSON.stringify({ valor }), autenticada: true
      })
    }
  };

  /* Los dos recursos de las ramas tienen exactamente la misma forma: un
     listado público filtrado por categoría y un CRUD para editores y admins. */
  function recursoAbierto(nombre) {
    return {
      listar(filtros = {}) {
        const params = new URLSearchParams();
        Object.entries(filtros).forEach(([clave, valor]) => {
          if (valor !== undefined && valor !== '') params.set(clave, valor);
        });
        const cadena = params.toString();
        return peticion(`/${nombre}${cadena ? '?' + cadena : ''}`);
      },

      crear: (datos) => peticion(`/${nombre}`, {
        method: 'POST', body: JSON.stringify(datos), autenticada: true
      }),

      actualizar: (id, datos) => peticion(`/${nombre}/${id}`, {
        method: 'PUT', body: JSON.stringify(datos), autenticada: true
      }),

      eliminar: (id) => peticion(`/${nombre}/${id}`, {
        method: 'DELETE', autenticada: true
      })
    };
  }
})();
