# iglesia-web-frontend

Sitio público de la Iglesia Evangélica de Dios Pentecostal de Talca.

HTML, CSS y JavaScript sin framework ni compilación: se abre con cualquier
servidor estático. Bootstrap 5 se carga desde CDN.

> Este proyecto **no usa React ni Vite**. El README anterior era la plantilla
> por defecto de `create-vite` y no describía nada de lo que hay aquí.

## Estructura

```
index.html            Portada: hero, quiénes somos, templos y pie de página
documentos.html       Listado completo, con filtros por categoría
varones.html          ┐
dorcas.html           │ Una rama por página, en dos columnas: agenda del mes
jovenes.html          ├ y avisos a la izquierda, documentos con scroll propio
coro.html             │ a la derecha. Todo filtrado por data-categoria.
escuela.html          ┘
radio.html            En blanco: la Radio del menú va a un sitio aparte
login.html            Inicio de sesión
register.html         Registro
gestion-documentos.html  Subir, editar y borrar documentos (editor/admin)
aprobaciones.html        Aprobar o rechazar registros (solo admin)
usuarios.html            Cambiar rol, correo y contraseña (solo admin)

components/navbar.html   Navbar compartida, inyectada por fetch
components/footer.html   Pie compartido, inyectado por fetch
404.html                 Página de error
site.webmanifest         Nombre e íconos al guardar el sitio en el móvil
css/base.css             Tipografía, variables de color, animaciones
css/navbar.css           Navbar
css/index.css            Portada
css/paginas.css          Páginas interiores y formularios
js/config.js             URL de la API  ← cambiar al desplegar
js/api.js                Cliente de la API y sesión
js/navbar.js             Carga la navbar y el estado de sesión
js/inicio.js             Carrusel y próxima reunión
js/portada.js            Versículo del hero, editable por editores
js/pie.js                Carga el pie compartido
js/documentos.js         Listado de documentos
js/acceso.js             Bloquea la caja de documentos si no hay sesión
js/rama.js               Calendario de actividades y avisos de la rama
js/gestion-documentos.js Subida y edición de documentos
js/aprobaciones.js       Panel de solicitudes de registro
js/usuarios.js           Panel de cuentas
js/auth-formularios.js   Login y registro
```

## Acceso

`index.html`, `login.html` y `register.html` son abiertas. El resto no:

| Página | Quién entra |
|---|---|
| `documentos.html` | cualquier cuenta con sesión |
| Calendario y avisos de una rama | cualquiera, con cuenta o sin ella |
| Caja de documentos de una rama | cualquier cuenta con sesión |
| Crear o editar actividades y avisos | editor y admin |
| Cambiar el versículo de la portada | editor y admin |
| `gestion-documentos.html` | editor y admin |
| `aprobaciones.html` y `usuarios.html` | solo admin |

`js/acceso.js` se carga **antes** que `js/documentos.js` y, si no hay sesión,
deja en gris el contenedor marcado con `data-requiere-sesion`, con un aviso y
un enlace a `login.html?volver=<página>`. Al quitar el atributo
`data-documentos`, el listado ni siquiera llega a pedir nada a la API.

En una rama ese atributo está **solo en la caja de documentos**: una página de
rama no es únicamente un listado de archivos, así que el calendario y los
avisos se siguen viendo. En `documentos.html`, donde no hay otra cosa, se
bloquea la página entera.

El versículo del hero se pide a `/api/contenido`. Si el servidor no responde,
se queda el texto escrito en `index.html`, que actúa de respaldo: la portada
nunca sale vacía por una caída del backend.

Nada de esto es seguridad: ocultar un enlace o pintar un aviso solo evita un
callejón sin salida. Quien escriba la URL a mano o borre el aviso desde el
inspector se topa igual con el `401`/`403` del servidor, que es la barrera de
verdad.

## Cómo ejecutarlo

Las páginas cargan la navbar con `fetch`, que **no funciona con `file://`**.
Hace falta un servidor:

- **VS Code + Live Server** — clic derecho en `index.html` → *Open with Live Server*.
  El puerto por defecto es 5500, que ya está autorizado en el CORS del backend.
- **Alternativa** — `npx serve .` o `python -m http.server 5500`.

Para que los listados de documentos y el login funcionen, el backend debe
estar corriendo:

```bash
cd ../iglesia-web-backend
npm install
npm run dev
```

## Datos de relleno pendientes

El pie de `index.html` lleva **teléfono, correo y redes sociales inventados**,
marcados con un comentario en el HTML. Los horarios y la dirección sí son los
reales. Hay que reemplazar los de relleno antes de publicar el sitio.

## Configuración

La URL de la API está en `js/config.js`:

```js
window.APP_CONFIG = { API_URL: 'http://localhost:3000/api' };
```

Al desplegar, cámbiala por la URL pública del backend y añade el dominio del
sitio a `CORS_ORIGIN` en el `.env` del backend.

## Cómo añadir documentos a una página

Cada listado se declara con un solo atributo:

```html
<div data-documentos data-categoria="Coro"></div>   <!-- solo una categoría -->
<div data-documentos data-filtros></div>            <!-- todas, con filtros -->
```

`js/documentos.js` se encarga del resto: carga, estados de vacío y error,
paginación y escapado del texto.

Categorías válidas: `Varones`, `Dorcas`, `Jovenes`, `Coro`, `EBD`, `General`.

## Notas

- Los horarios de reunión se editan en la constante `REUNIONES`, arriba del
  todo en `js/inicio.js`.
- La sesión se guarda en `localStorage` (`iedp_token`, `iedp_usuario`) y el
  token caduca a las 2 horas.
- Todo el texto que viene de la API se pinta con `textContent`, nunca con
  `innerHTML`, para que un título con HTML dentro no pueda ejecutar scripts.

## Pendiente

- Contenido de `radio.html` (el enlace del menú apunta al sitio externo
  de la radio; el archivo sigue en blanco a la espera de contenido propio)
- Panel para que editores y administradores suban documentos desde el sitio
- Página de detalle de cada rama (historia, encargados, horarios)
