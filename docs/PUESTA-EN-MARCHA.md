# Puesta en marcha

Instrucciones desde donde estás: sesión iniciada en
**`admision@sancarlos.edu.ar`**, con la planilla abierta y los triggers
viejos ya borrados.

Son unos 20 minutos. Cada paso dice qué tiene que pasar para saber que salió
bien.

---

## 1. Pegar el código

`Extensiones` > `Apps Script`.

Borrá **todos** los archivos que estén en el proyecto y dejá sólo estos dos:

| Pegar | Nombre del archivo | Tipo |
|---|---|---|
| `dist/Codigo.gs` | `Codigo` | Secuencia de comandos |
| `web/index.html` | `index` | HTML |

El nombre `index` importa: el código hace `createHtmlOutputFromFile('index')`.
Con otro nombre, el sitio no abre.

Guardar 💾.

> **Si sobran archivos viejos**, cada función va a quedar definida dos veces y
> Apps Script usa la última sin avisar. Por eso hay que borrarlos, no dejarlos
> "por las dudas".

## 2. Activar la Gmail API

`Servicios` (el `+` en la barra izquierda) > buscar **Gmail API** > `Agregar`.

Sin esto, enviar un mail falla con `Gmail is not defined`.

## 3. Actualizar la planilla

En el desplegable de funciones (arriba, al lado de 🐞) elegí **`migrarEsquema`**
y tocá **Ejecutar** ▶.

La primera vez pide autorización:

1. `Revisar permisos`
2. Elegir `admision@sancarlos.edu.ar`
3. Google avisa que la app no está verificada → `Configuración avanzada` >
   `Ir a (nombre del proyecto)`
4. `Permitir`

Esa pantalla asusta pero es normal: la app es tuya y no está publicada en
ningún lado.

**Tiene que decir** algo como `Admisiones: + estado_previo` y
`Eventos: + anulado`. Si dice "al día" en todo, también está bien — significa
que las columnas ya estaban.

## 4. Arreglar las fechas viejas

Elegí **`limpiarFechas`** y Ejecutar ▶.

Reescribe en `dd/MM/aaaa` las fechas que habían quedado guardadas como
`Wed Dec 04 2024 00:00:00 GMT-0300 (…)`. Se puede correr las veces que haga
falta.

**Tiene que decir** cuántas arregló, o que no había ninguna.

## 5. Traer las admisiones

Elegí **`importarDesdeSitio`** y Ejecutar ▶.

Trae lo que haya en `Admisiones - Respuestas Sitio Web`, genera las fichas de
las nuevas y avisa por mail a cada nivel.

**Tiene que aparecer** contenido en la solapa `Admisiones`. Como es la primera
corrida con esta cuenta, puede tardar un minuto.

> Si tira un error de permisos sobre la planilla del sitio, falta compartirla
> con `admision@`. Volvé a `aulatech@`, compartila como editor, y repetí.

## 6. Instalar los tres triggers

Uno por uno, elegir y Ejecutar ▶:

| Función | Qué hace |
|---|---|
| `instalarTriggerIngesta` | Importa del sitio cada 15 minutos |
| `instalarTriggerRespuestas` | Trae las respuestas de las familias cada 15 minutos |
| `instalarTriggerFichas` | Genera las fichas pendientes cada hora |

**Verificá** en el reloj ⏰ (Activadores) que estén los tres, y que la columna
de propietario diga `admision@`.

Éste es el paso que se olvida: si los triggers quedaran de otra cuenta, la
sincronización de respuestas miraría el buzón equivocado.

## 7. Desplegar el sitio

`Implementar` > `Nueva implementación` > ⚙️ > `Aplicación web`:

- **Ejecutar como:** Yo (`admision@sancarlos.edu.ar`)
- **Quién tiene acceso:** Usuarios de sancarlos.edu.ar

Copiá la URL que termina en `/exec`.

**Abrila.** Tiene que cargar el listado y, arriba a la derecha, decir **tu
nombre** — no `admision@`. Si dijera `admision@`, avisame antes de seguir: de
eso depende que cada una vea sólo su nivel.

## 8. Cargar al equipo

En la solapa `Usuarios`, una fila por persona:

| email | nombre | niveles | rol | activo |
|---|---|---|---|---|
| elianawaichman@sancarlos.edu.ar | Eliana Waichman | Inicial | editor | TRUE |
| rhalperin@sancarlos.edu.ar | Rocío Halperin | Primaria | editor | TRUE |
| admision@sancarlos.edu.ar | Admisiones | Inicial,Primaria,Secundaria | admin | TRUE |

`niveles` separados por coma, sin espacios de más. `rol` es `admin` (ve todo)
o `editor` (ve sólo sus niveles).

Quien no esté acá no entra, aunque tenga cuenta del colegio.

---

## 9. La prueba antes de escribirle a una familia

No la saltees. Es lo único que confirma que el circuito cierra entero.

1. Abrí cualquier admisión y **cambiá el mail por el tuyo**. `Guardar datos`.
2. `Enviar mail`. Mirá la previsualización: de quién sale, a quién le llega
   la copia, a dónde responden.
3. `Enviar`.
4. Revisá lo que te llegó: remitente *Admisiones - Colegio San Carlos
   Diálogos*, tildes bien, firma correcta.
5. **Respondé ese mail** desde tu casilla, con "Responder" (no "Responder a
   todos").
6. Confirmá que la respuesta también le llegó a la directora del nivel.
7. Esperá 15 minutos, volvé a abrir la admisión: **la respuesta tiene que
   aparecer en el recorrido**.
8. Devolvé el mail original de la familia en la ficha.

El paso 7 prueba que el trigger de respuestas corre con la cuenta correcta.
Si no aparece, volvé al punto 6.

---

## 10. Después: el sitio en Vercel

Con esto ya funciona todo. Cuando quieras resolver el tema del celular, está
el paso a paso en [`vercel.md`](vercel.md) — son 15 minutos más y te deja el
sitio en un dominio propio.

Los dos modos conviven: la URL de Apps Script sigue andando como respaldo.

---

## Funciones que podés correr cuando haga falta

| Función | Cuándo |
|---|---|
| `importarDesdeSitio` | Traer admisiones ahora, sin esperar los 15 minutos |
| `sincronizarRespuestas` | Traer respuestas ahora |
| `generarFichasPendientes` | Generar las fichas que hayan quedado |
| `limpiarFechas` | Si volvés a ver una fecha con `GMT-0300` |
| `migrarEsquema` | Después de actualizar el código, por si suma columnas |

`setup` **no** hay que volver a correrla: es sólo para crear la planilla desde
cero.

## Si algo falla

| Síntoma | Causa |
|---|---|
| `Gmail is not defined` | Falta la Gmail API (paso 2) |
| `Falta la solapa "X"` | La planilla no es la del sistema, o falta correr `setup` |
| `La cuenta … no está habilitada` | Falta agregarla en `Usuarios` (paso 8) |
| `No tenés acceso a las admisiones de X` | Esa persona no tiene ese nivel asignado |
| Las respuestas no aparecen en el recorrido | Los triggers no son de `admision@` (paso 6) |
| Se importa dos veces | Quedó un trigger viejo de otra cuenta |
| `Faltan datos para completar el mail` | No es un error: la plantilla tiene un campo vacío y el sistema frena a propósito |
| Una función aparece dos veces | Quedaron archivos viejos en el proyecto (paso 1) |
