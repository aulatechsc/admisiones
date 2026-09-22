# Esquema unificado de Admisiones

Estado: **propuesta**. Documento de trabajo previo a la migración.

Relevamiento hecho el 2026-09-22 sobre las 4 planillas en uso. Este documento
sólo contiene **nombres de columnas**: ningún dato personal de familias o
alumnos se versiona en este repositorio.

## 1. Situación actual

Cuatro planillas, siete solapas relevantes.

| Planilla | Dueño | Solapas |
|---|---|---|
| Admisión Inicial | agustinmiertorre@ | Respuestas del Form + **solapa operativa** |
| Admisiones Primaria | agustinmiertorre@ | Respuestas del Form + **solapa operativa** |
| Admisión Secundaria 2 | agustinmiertorre@ | **Solapa operativa** + Respuestas del Form |
| Admisiones - Respuestas Sitio Web | aulatech@ | Inicial / Primaria / Secundaria |

Volumen: ~85-90 filas por solapa operativa, ~150 por solapa de formulario.
Del orden de 250-300 admisiones históricas en total. Es un volumen chico:
Apps Script sobra.

Las tres planillas oficiales son propiedad de una **cuenta personal**
(`agustinmiertorre@`), no institucional. La planilla única debería nacer bajo
una cuenta de servicio o un Drive compartido para que no dependa de una
persona.

### Dos orígenes de datos que no se hablan

Cada planilla oficial tiene una solapa de respuestas de Google Form (histórica)
y una solapa operativa donde el equipo trabaja. La planilla del sitio web es un
**tercer** origen que se copia a mano a la solapa operativa. El formulario
viejo de Google y el formulario nuevo del sitio conviven.

## 2. El pipeline ya existe (y es el mismo en los 3 niveles)

Hallazgo principal del relevamiento. Las tres solapas operativas comparten
exactamente estas columnas:

    Agendó entrevista | Asistió entrevista | Visita | Matriculó? | Motivo de la no matriculación?

Es decir: **el "recorrido de la admisión" ya está modelado y es idéntico en los
tres niveles.** No hay que inventarlo, hay que formalizarlo.

Hoy son cuatro checkboxes booleanos independientes, lo que permite estados
imposibles — `Matriculó = TRUE` con `Agendó entrevista = FALSE` — y no guarda
*cuándo* pasó cada cosa. La propuesta es reemplazarlos por un campo `estado`
único más un timestamp por transición, derivando el estado inicial de los
checkboxes actuales durante la migración.

Estados propuestos, alineados a lo que ya usan:

    Nueva → Contactada → Entrevista agendada → Entrevista realizada
          → Visita → Matriculada

Ramas terminales: `No matriculada` (con motivo, que ya existe como columna),
`Lista de espera` (hoy sólo en Secundaria), `Desistió`.

## 3. Columnas homónimas: el problema a resolver antes de migrar

En las tres planillas hay columnas con **nombre repetido** dentro de la misma
solapa. El patrón es consistente: una guarda el texto largo que tipeó la
familia en el formulario, la otra el booleano normalizado que usa el equipo.

| Planilla | Nombre repetido | Contenido real |
|---|---|---|
| Inicial | `Inclusión`, `Inclusión` | texto del form / `TRUE`-`FALSE` |
| Inicial | `Mail` (col. A es el checkbox) | checkbox de envío / mail real |
| Primaria | `Inglés 1`, `Inglés` | `Sí`-`No` / `TRUE`-`FALSE` |
| Primaria | `Inclusión 1`, `Inclusión` | texto del form / `TRUE`-`FALSE` |
| Primaria | `Mail` (col. A), `Mail` (col. Y) | checkbox de envío / mail real |
| Secundaria | `Inglés`, `Inglés` | `Sí`-`No` / `TRUE`-`FALSE` |
| Secundaria | `Inclusión`, `Inclusión` | `Sí`-`No` / `TRUE`-`FALSE` |
| Secundaria | `Fecha`, `Fecha` | fecha de nacimiento / timestamp del form |
| Secundaria | `Mail padre/madre`, `Mail` | dos mails distintos |

Esto es lo que obliga al helper `getValorPorEncabezadoDesde(..., "Mail", 5)`
del script de Inicial: buscar "Mail" desde la columna 5 es un parche para
saltear la columna A, que también se llama "Mail".

`getValorPorEncabezado` usa `findIndex`, que devuelve **la primera coincidencia**.
Hoy ningún script lee `Inclusión` por nombre, así que no explota — pero en
cuanto el sistema centralizado lea ese campo, va a leer el texto largo del
formulario donde esperaba un booleano.

**En el esquema unificado ningún nombre de columna se repite.** El par se
desdobla explícitamente, p. ej. `inclusion_solicitada` (booleano) y
`trayectoria_texto` (el texto de la familia).

## 4. Otros problemas encontrados

- **`#REF!` activo en Secundaria**: las columnas `Inicial` y `Primaria`
  (que marcan si el postulante viene de otro nivel del colegio) tienen
  fórmulas rotas. Hay que decidir si se recuperan o se descartan.
- **Secundaria no tiene script de envío**, pero sí una columna `Mail a enviar`
  — sugiere que eligen la plantilla a mano y envían por fuera del sistema.
  Confirmar con el equipo antes de migrar.
- **Primaria lee columnas por letra fija** (`C`, `T`, `Y`, `M`, `K`, `F`).
  Verificado: hoy el mapeo es correcto. Pero insertar una columna rompe el
  envío en silencio, mandando el mail con datos de otra persona.
- **`instalarTrigger()` de Inicial borra todos los triggers del proyecto**,
  no sólo el suyo. Primaria filtra por `getHandlerFunction()`, que es lo correcto.
- **`SpreadsheetApp.getUi().alert()` en el trigger de Primaria** puede lanzar
  excepción: en contexto de trigger instalable no siempre hay UI disponible.
- **Asunto duplicado en Inicial** para el ciclo ≥2028: queda
  `"2028 - Admisión <alumno> / <sala> / 2028"`.
- **Secundaria ordena las columnas distinto** a Inicial y Primaria, y no tiene
  `Profesión 1` / `Profesión 2` ni `Padre/Madre 2` (sólo `Padre/Madre`).

## 5. Esquema propuesto

Cinco solapas. Una fila por postulante, con `nivel` como columna — no tres
solapas separadas.

### `Admisiones`

| Campo | Notas |
|---|---|
| `id` | Estable y único. Hoy cada nivel numera por separado y se repiten entre niveles. |
| `nivel` | `Inicial` \| `Primaria` \| `Secundaria` |
| `estado` | Ver pipeline arriba |
| `fecha_alta` | Origen: `Marca temporal` / `Fecha de Inscripción` / `Fecha de admisión` |
| `origen` | `form_web` \| `form_google` \| `carga_manual` |
| `alumno_nombre` | `Nombre del Alumno/a` en los 3 |
| `alumno_fecha_nac` | `Fecha de nacimiento` / `Nacimiento` / `Fecha` (Secundaria, col. C) |
| `alumno_dni` | Nuevo: hoy sólo se pide en el PDF y queda vacío |
| `grado_solicitado` | Unifica `Sala Solicitada` / `Grado solicitado` / `Curso Solicitado` |
| `grado_actual` | Unifica `Sala Actual` / `Grado actual` / `Curso actual` |
| `anio_vacante` | `Año de la vacante solicitada` / `Año Solicitado` |
| `escuela_actual` | Unifica `Jardín Actual` / `Colegio Actual` |
| `motivo_cambio` | Presente en los 3 |
| `bilingue` | Booleano. Sólo Primaria y Secundaria; vacío en Inicial |
| `inclusion_solicitada` | Booleano — **la columna normalizada, no el texto** |
| `trayectoria_texto` | El texto largo del formulario que hoy comparte nombre |
| `tutor1_nombre`, `tutor1_profesion` | Secundaria sólo tiene `Padre/Madre` |
| `tutor2_nombre`, `tutor2_profesion` | Ausentes en Secundaria |
| `celular`, `email` | `Mail` real, no el checkbox |
| `como_conocio` | `Como llegó?` en los 3 |
| `comentarios` | `Comentarios` + `Comentarios Adicionales` |
| `motivo_no_matriculacion` | Ya existe en los 3 |
| `lista_espera` | Hoy sólo en Secundaria |
| `thread_id` | Hilo de Gmail. Clave para el registro de intercambio |
| `pdf_url` | Reemplaza la columna `Ficha` con el `HYPERLINK` |
| `responsable` | Quién del equipo lo está llevando |

`Edad Actual` no se migra: es derivable de `alumno_fecha_nac` y se calcula al
vuelo. Guardarla implica que envejece mal.

### `Eventos`

Log append-only. Es lo que habilita "ver el recorrido" y "dejar registrado
todo el intercambio".

    id_admision | timestamp | tipo | usuario | asunto | cuerpo | thread_id | message_id

`tipo`: `mail_enviado` | `mail_recibido` | `llamada` | `cambio_estado` | `nota` |
`pdf_generado`

`llamada` no es opcional: Secundaria hace el primer contacto por teléfono, así
que sin ese tipo de evento su recorrido queda vacío y el sistema no sirve para
ese nivel.

### `Usuarios`

    email | nombre | niveles | rol | activo

Sin contraseñas: el acceso se resuelve con la cuenta Google del colegio y
`Session.getActiveUser().getEmail()`. Esta solapa sólo mapea email → permisos.

### `Plantillas`

    id | nivel | nombre | condicion | asunto | cuerpo

Saca de código los 4 cuerpos de mail hoy hardcodeados (Inicial estándar,
Inicial grupal ≥2028, Primaria inclusión, Primaria estándar) y permite que
cada dirección edite sus propios textos sin tocar el script. Placeholders:
`{{alumno}}`, `{{responsable}}`, `{{grado}}`, `{{anio}}`.

### `Estados`

Catálogo del pipeline con orden y color, para no hardcodearlo en el front.

## 6. El buzón (resuelto)

Para registrar las respuestas de las familias hace falta que el script pueda
**leerlas**. Hoy Inicial envía con `replyTo: elianawaichman@`, así que las
respuestas llegan a una casilla personal que el script no ve.

**Decidido**: todo se gestiona desde `aulatech@sancarlos.edu.ar`, que pasa a
ser remitente y destino de las respuestas, con el proyecto de Apps Script
corriendo desde ahí. Ver la sección 8 para el alias de remitente y el costo
operativo de cambiar el `replyTo`.

Detalle técnico: `GmailApp.sendEmail()` no devuelve el hilo. Para guardar
`thread_id` hay que usar el servicio avanzado de Gmail
(`Gmail.Users.Messages.send`), que devuelve `{id, threadId}`. Sin ese id no hay
forma confiable de atar un hilo a una admisión.

## 7. Orden de trabajo

1. ~~Relevar las 4 planillas y mapear columnas~~ ✅
2. Resolver las decisiones abiertas (abajo)
3. Crear la planilla única + script de migración con deduplicación
4. Verificar que no se perdió nada. Las planillas viejas quedan intactas
5. Backend: listar, filtrar, detalle, cambiar estado, enviar plantilla, PDF
6. Front HtmlService: login Google → tabla filtrable → detalle con timeline
7. Sincronización de respuestas de Gmail
8. Apuntar el formulario del sitio a la nueva estructura y apagar la copia manual

Los pasos 3 y 4 concentran el riesgo. El 5 y 6 son trabajo mecánico.

## 8. Decisiones tomadas

Definidas por el equipo el 2026-09-22.

- **Todo se gestiona desde `aulatech@sancarlos.edu.ar`.** Resuelve de una vez
  el dueño de la planilla única y el buzón desde el que se envía y se leen las
  respuestas. Ver la nota sobre el remitente más abajo.
- **El formulario de Google está inhabilitado.** Las solicitudes entran sólo
  por el formulario del sitio. Las solapas de respuestas del Form quedan como
  histórico de lectura, no como origen activo.
- **Secundaria contacta por teléfono**, no por mail. Por eso no tiene script
  de envío ni plantillas. El sistema necesita registrar llamadas como un tipo
  de evento más (`llamada`), con quién llamó, cuándo y qué se habló — si no,
  el recorrido de Secundaria queda vacío.
- **Las plantillas se editan desde el sitio.** Implementado en
  `apps-script/plantillas.gs`.
- **El histórico se migra.** (Alcance exacto pendiente de confirmar.)

### Nota sobre el remitente

`aulatech@` es una cuenta técnica: si envía sin configurar, las familias
reciben un mail de "aulatech", que no dice nada institucional. Se resuelve con
el parámetro `name` de `GmailApp.sendEmail`, como ya hace hoy el script de
Inicial:

    name: 'Admisiones - Colegio San Carlos Diálogos'

Conviene además crear el alias `admisiones@sancarlos.edu.ar` sobre esa misma
casilla, para que la dirección visible acompañe al nombre.

### El `replyTo` tiene un costo operativo

Hoy Inicial usa `replyTo: elianawaichman@`, así que las respuestas van directo
a la casilla de la directora. Para que el sistema pueda registrarlas, el
`replyTo` tiene que apuntar al buzón que el script lee.

Eso significa que **Eliana y Rocío dejan de recibir las respuestas en su
bandeja** y pasan a verlas en el sitio. Es exactamente lo que se pidió —
registrar el intercambio — pero es un cambio de hábito, no sólo un cambio
técnico. Para que no se sienta como una pérdida, el sistema debería avisarles
por mail cuando entra una respuesta nueva, con el link directo a la ficha.

Conviene acordarlo con ellas antes de cambiarlo.

## 9. Decisiones abiertas

- **Alcance del histórico**: se migra, pero falta definir hasta dónde.
- **Deduplicación**: el mismo alumno puede estar en la solapa del Form y en la
  operativa, y un postulante rechazado un año puede reaparecer al siguiente.
  ¿Clave `alumno + anio_vacante`, o `alumno` con historial de postulaciones?
- **`#REF!` de Secundaria**: ¿se recuperan las columnas `Inicial` / `Primaria`?
