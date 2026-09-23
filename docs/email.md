# Configurar el envío de mails

Con la cuenta `admision@sancarlos.edu.ar` ya creada, hay dos caminos. El
primero es más simple y es el que conviene.

---

## Antes de empezar: ¿qué es `admision@`?

| Si es… | Camino |
|---|---|
| Una **cuenta de Google Workspace** con su propia contraseña | **Camino A** — mover el proyecto ahí |
| Un **alias** de otra cuenta, sin contraseña propia | **Camino B** — configurar "Enviar como" |

Para saberlo: intentá iniciar sesión en Gmail con `admision@sancarlos.edu.ar`.
Si entra, es cuenta propia (camino A). Si dice que no existe, es un alias
(camino B).

---

# Camino A — el proyecto vive en `admision@`

Es el más limpio: el script envía desde su propia casilla, sin alias, y lee
las respuestas del mismo buzón. Menos piezas, menos para romperse.

## A1. Compartir las planillas con `admision@`

Desde `aulatech@`, abrir cada planilla y compartir con
`admision@sancarlos.edu.ar` **como editor**:

- La planilla del sistema (la que creaste con `setup()`)
- `Admisiones - Respuestas Sitio Web`

Sin esto el script no puede leer ni escribir nada.

## A2. Mover el proyecto

En la planilla del sistema: `Compartir` > agregar `admision@` como **editor**.
El proyecto de Apps Script viaja con la planilla, así que con eso alcanza.

## A3. Entrar como `admision@` y desplegar

1. Iniciar sesión en Google con `admision@sancarlos.edu.ar`
2. Abrir la planilla del sistema > `Extensiones` > `Apps Script`
3. `Servicios` > `+` > **Gmail API** > Agregar
4. Elegir la función `setup` y Ejecutar — pide autorización, aceptar
5. `Implementar` > `Nueva implementación` > `Aplicación web`
   - Ejecutar como: **Yo (admision@sancarlos.edu.ar)**
   - Quién tiene acceso: **Usuarios de sancarlos.edu.ar**

## A4. Cargar a las personas

En la solapa `Usuarios`, agregar a quien vaya a entrar al sitio. Si no está
ahí, no entra, aunque tenga cuenta del colegio.

---

# Camino B — `admision@` es un alias

El proyecto sigue en `aulatech@` y se configura el alias para poder enviar
desde esa dirección.

## B1. Agregar el alias

En Gmail, con la sesión de `aulatech@`:

1. ⚙️ > `Ver toda la configuración` > pestaña **Cuentas e importación**
2. En "Enviar mensajes como": **Añadir otra dirección de correo**
3. Nombre: `Admisiones - Colegio San Carlos Diálogos`
4. Dirección: `admision@sancarlos.edu.ar`
5. Destildar "Tratar como un alias"
6. Google manda un código de verificación **a `admision@`** — hay que entrar a
   esa casilla y confirmarlo

Ese último paso es el que suele frenar todo: si nadie puede abrir `admision@`
para leer el código, el alias no se puede verificar y hay que ir por el
camino A.

## B2. Activar la Gmail API

En el editor de Apps Script: `Servicios` > `+` > **Gmail API** > Agregar.

## B3. Volver a implementar

`Implementar` > `Administrar implementaciones` > ✏️ > Versión: **Nueva**.

### Lo que hay que saber del camino B

Las respuestas de las familias llegan a la casilla de `admision@`, pero el
script corre como `aulatech@` y **sólo puede leer el buzón de `aulatech@`**.
Para que las respuestas se registren en el recorrido hace falta, además, un
reenvío automático de `admision@` hacia `aulatech@` (en Gmail de `admision@`:
Configuración > Reenvío).

Es una pieza más que se puede desconfigurar sola. Por eso conviene el camino A.

---

## Probar antes de escribirle a una familia

1. Entrar al sitio y abrir cualquier admisión
2. Cambiar el mail de la ficha por el tuyo, y guardar
3. Tocar **Enviar mail**
4. Revisar la previsualización: de quién sale, a quién le llega la copia, a
   dónde responden
5. Enviar, y revisar que llegue bien: remitente, tildes, firma
6. **Responder ese mail** desde tu casilla y esperar 15 minutos
7. Volver a abrir la admisión: la respuesta tiene que aparecer en el recorrido
8. Devolver el mail original de la familia en la ficha

El paso 6 es el que verifica de verdad que el circuito cierra. Si la respuesta
no aparece, el problema está en el buzón, no en el sitio.

---

## Cómo sale cada mail

    De:         Admisiones - Colegio San Carlos Diálogos <admision@sancarlos.edu.ar>
    Para:       la familia
    Cc:         la directora del nivel
    Reply-To:   admision@sancarlos.edu.ar, la directora del nivel

El `Reply-To` con **dos** direcciones es lo que sostiene el esquema: cuando la
familia toca "Responder" — no "Responder a todos", que casi nadie usa — la
respuesta llega a la directora, que sigue la conversación desde su bandeja, y
a `admision@`, donde el sistema la registra.

Quién recibe copia por nivel se cambia en `COPIAS_POR_NIVEL`, dentro de
`Codigo.gs`:

```js
var COPIAS_POR_NIVEL = {
  Inicial: ['elianawaichman@sancarlos.edu.ar'],
  Primaria: ['rhalperin@sancarlos.edu.ar'],
  Secundaria: ['andreapandolfo@sancarlos.edu.ar', ...]
};
```

## Registrar las respuestas

`instalarTriggerRespuestas()`, una vez. Revisa cada 15 minutos los hilos con
mail enviado y suma las respuestas nuevas al recorrido. Es idempotente:
compara contra lo ya registrado, así que correrlo de más no duplica.

## Si algo falla

| Error | Qué pasa |
|---|---|
| `Gmail is not defined` | Falta activar la Gmail API (paso A3.3 / B2) |
| `Invalid from header` | El alias no está verificado, o el From no coincide con la cuenta |
| El mail sale de `aulatech@` | Estás en el camino B y el alias no quedó configurado |
| Las respuestas no aparecen | Falta `instalarTriggerRespuestas()`, o el reenvío del camino B |
| `Faltan datos para completar el mail` | No es un error: la plantilla tiene un campo vacío y el sistema frena a propósito |
