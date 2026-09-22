# El sitio de gestión

Un solo archivo, `web/index.html`, que funciona de dos maneras. Conviene
arrancar por la primera.

## Modo A — servido por Apps Script (recomendado para empezar)

Google autentica al usuario antes de entregar la página, así que no hay que
configurar nada de login ni pelear con CORS. Es el modo que conviene para
probar que todo el circuito funciona.

1. En el editor de Apps Script: `+` > `HTML` > nombrarlo **`index`**
   (sin `.html`; Apps Script agrega la extensión solo).
2. Pegar el contenido de `web/index.html`.
3. `Implementar` > `Nueva implementación` > `Aplicación web`:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Usuarios de sancarlos.edu.ar**
4. Abrir la URL que devuelve.

Esa segunda opción importa: con "Cualquier usuario", cualquiera con el link
entra con los permisos de la cuenta que lo desplegó.

## Modo B — servido desde Vercel

Da una URL propia, pero hay que configurar el login a mano.

1. **Client ID de OAuth.** Google Cloud Console > Credenciales > Crear
   credenciales > ID de cliente de OAuth > Aplicación web. En "Orígenes
   autorizados de JavaScript" poner el dominio de Vercel
   (`https://admisiones.vercel.app` o el que sea).
2. **Cargarlo en el código.** En `api.gs`, `OAUTH_CLIENT_ID`. En
   `web/index.html`, `CLIENT_ID` y `URL_API` (la URL de la web app).
3. **Redesplegar la web app** con acceso **"Cualquier usuario"** — el pedido
   llega desde Vercel sin sesión de Google, así que Apps Script no puede
   identificar al usuario por su cuenta.
4. **Subir a Vercel** el contenido de `web/`.

El punto 3 suena peligroso y conviene entender por qué no lo es: la web app
queda abierta, pero `doPost` rechaza cualquier pedido sin un ID token de
Google válido, emitido para este Client ID, de una cuenta `@sancarlos.edu.ar`
verificada y sin vencer. Recién después chequea que esa persona esté activa
en la solapa `Usuarios`. Sin el token, no responde nada.

### La parte frágil

El navegador hace la llamada cross-origin con `Content-Type: text/plain`, a
propósito: así el pedido cuenta como "simple request" y no dispara el
preflight `OPTIONS`, que las web apps de Apps Script no saben contestar.
Funciona, pero depende de cómo Google maneje el redirect a
`googleusercontent.com`, que es algo que ellos pueden cambiar.

Si algún día el sitio deja de cargar desde Vercel con un error de CORS, no
está roto el código: probalo en modo A para confirmarlo. La salida de fondo
sería poner una función serverless de Vercel que haga de intermediaria, y ahí
el problema desaparece porque la llamada pasa a ser servidor-a-servidor.

## Antes de mandar el primer mail

Tres cosas, todas fuera del código.

### 1. El alias de envío

`admision@sancarlos.edu.ar` tiene que estar dado de alta como alias de la
cuenta que corre el script: Gmail > Configuración > Cuentas e importación >
"Enviar como" > Agregar otra dirección. Sin eso Gmail rechaza el `From` y el
envío falla.

### 2. El servicio avanzado de Gmail

En el editor de Apps Script: `Servicios` > `+` > **Gmail API** > Agregar.

Hace falta porque `GmailApp.sendEmail()` no devuelve el identificador del
hilo, y sin ese identificador no hay forma de atar las respuestas de la
familia a su admisión. También permite armar los headers a mano, que es lo
que resuelve el punto siguiente.

### 3. Cómo llegan las respuestas

Cada mail sale así:

    De:         Admisiones - Colegio San Carlos Diálogos <admision@sancarlos.edu.ar>
    Para:       la familia
    Cc:         la directora del nivel
    Reply-To:   admision@sancarlos.edu.ar, la directora del nivel

El `Reply-To` con **dos** direcciones es lo que hace funcionar todo el
esquema. Cuando la familia toca "Responder" — no "Responder a todos", que casi
nadie usa — la respuesta le llega a las dos:

- A la **directora**, en su bandeja de siempre, y sigue la conversación desde
  ahí como venía haciéndolo.
- A **admision@**, donde el sistema la levanta y la guarda en `Eventos`, así
  queda en el recorrido de la admisión.

Con un `Reply-To` simple habría que elegir: o la directora se entera, o el
sistema registra. Las dos cosas a la vez necesitan los dos destinos.

Quién recibe copia de cada nivel se configura en `COPIAS_POR_NIVEL`, en
`config.gs`.

### Para que las respuestas se registren

`instalarTriggerRespuestas()`, una vez. Revisa cada 15 minutos los hilos con
mail enviado y suma las respuestas nuevas a `Eventos`. Es idempotente: compara
contra los mensajes ya registrados, así que correrlo de más no duplica nada.

## Qué se puede hacer desde el sitio

| Acción | Qué deja registrado |
|---|---|
| Ver y filtrar admisiones | — |
| Editar datos de la ficha | — |
| Cambiar de estado | `cambio_estado`, con nota opcional |
| Enviar mail | `mail_enviado`, con el texto completo |
| Registrar llamada | `llamada` — el primer contacto en Secundaria |
| Agregar nota interna | `nota` |
| Generar ficha PDF | `pdf_generado`, con el link |
| Editar plantillas | — |
| Importar del sitio | `alta` por cada solicitud nueva |

Cada quien ve sólo los niveles que tiene asignados en la solapa `Usuarios`.
El filtro se aplica en el servidor, no en la pantalla: pedir una admisión de
otro nivel devuelve error aunque se conozca el id.

Antes de enviar, el sitio muestra el mail completo: qué plantilla eligió, el
texto ya armado con los datos de esa familia, y a quién le llega la copia. Se
puede cambiar de plantilla o editar el texto ahí mismo.

Si a la plantilla le falta algún dato — por ejemplo, la familia no cargó el
nombre del tutor — el sistema **no envía** y dice cuál falta. Los scripts
viejos en ese caso mandaban un mail que arrancaba "Estimada/o :".

## Las fichas PDF

Mismo diseño que la ficha del jardín, ahora también para Primaria y
Secundaria, con el vocabulario de cada nivel: "sala" contra "grado" contra
"curso", "jardín anterior" contra "colegio anterior".

La ficha suma dos cosas que la de Inicial no tenía: la edad calculada al
momento de generarla, y el proyecto de inclusión junto con la trayectoria
declarada por la familia — que es lo que define el circuito de admisión.

Los PDF se guardan en una carpeta de Drive llamada `Fichas de admisión`, no
sueltos en la raíz, y el link queda en la admisión para volver a abrirlo sin
regenerarlo.

## Inclusión: cómo se detecta

Inicial y Primaria no preguntan por inclusión de forma directa. La respuesta
está dentro de "Trayectoria escolar actual", que tiene tres opciones:

| Opción | ¿Inclusión? |
|---|---|
| Mi hijo/a cuenta con un proyecto de inclusión y equipo de apoyo (MAI/AP/AE). | **Sí** |
| Mi hijo/a no tiene proyecto de inclusión, pero recibe terapias externas (…). | No |
| Mi hijo/a realiza una trayectoria escolar de nivel sin apoyos externos. | No |

Secundaria sí tiene la pregunta directa y se usa esa.

Ojo con la opción del medio: dice "**no** tiene proyecto de inclusión", pero
contiene la misma frase que la afirmativa. Buscar "inclusión" por substring
marca como inclusión a una familia que declaró exactamente lo contrario, y le
manda la negativa de vacante. Por eso `derivarInclusion()` descarta la
negación antes que nada, y hay un test específico para ese caso.

Cuando el texto no coincide con ninguna de las tres, el campo queda **sin
definir** en vez de asumir que no. El sitio lo muestra con un aviso arriba de
la ficha, para que alguien lo resuelva antes de mandar el mail.
