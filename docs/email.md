# Pasar el sistema a `admision@sancarlos.edu.ar`

`admision@` es una cuenta propia, así que el sistema se muda ahí. **No se crea
nada de nuevo**: la planilla y el proyecto de Apps Script se comparten, y el
proyecto viaja dentro de la planilla.

## Por qué hace falta mudarlo

Dos funciones del sistema operan sobre el buzón de **la cuenta que ejecuta el
script**, no sobre una dirección que se le indique:

| Función | Qué hace |
|---|---|
| `Gmail.Users.Messages.send` | Envía desde el buzón de quien ejecuta |
| `GmailApp.getThreadById` | Lee el buzón de quien ejecuta |

Mientras el script corra como `aulatech@`, los mails salen de `aulatech@` y
las respuestas que busca son las de `aulatech@` — nunca va a ver lo que llega
a `admision@`.

Y de ahí sale **el paso que más se olvida**: los triggers pertenecen a la
cuenta que los creó. Los que instalaste desde `aulatech@` van a seguir
corriendo como `aulatech@` aunque después despliegues desde `admision@`. Hay
que borrarlos y volver a instalarlos. Es el punto 5.

---

## 1. Compartir las dos planillas

Con la sesión de **`aulatech@`**, abrir cada una y compartir con
`admision@sancarlos.edu.ar` **como editor**:

- La planilla del sistema (la que creaste con `setup()`)
- `Admisiones - Respuestas Sitio Web`

La segunda es de donde salen las solicitudes. Sin acceso, la importación
falla.

> Si podés, transferí también la **propiedad** de la planilla del sistema a
> `admision@` (Compartir > el ícono junto a `admision@` > Transferir
> propiedad). No es obligatorio, pero deja el sistema sin depender de una
> cuenta que puede cambiar de manos.

## 2. Borrar los triggers viejos

Todavía con la sesión de **`aulatech@`**, en el editor de Apps Script:

1. Reloj ⏰ (Activadores) en la barra izquierda
2. Borrar **todos** los que estén — el de importar, el de respuestas, el de
   fichas

Si quedan, vas a tener dos importaciones corriendo en paralelo desde cuentas
distintas.

## 3. Entrar como `admision@`

Cerrar sesión, o abrir una ventana de incógnito, y entrar con
`admision@sancarlos.edu.ar`.

Abrir la planilla del sistema (desde "Compartido conmigo" en Drive) >
`Extensiones` > `Apps Script`.

## 4. Activar la Gmail API y autorizar

1. `Servicios` (con el `+`) en la barra izquierda > buscar **Gmail API** >
   Agregar
2. Elegir la función `migrarEsquema` en el desplegable de arriba y Ejecutar ▶
3. Va a pedir autorización: **Revisar permisos** > elegir `admision@` >
   "Configuración avanzada" > "Ir a (nombre del proyecto)" > Permitir

Ese tercer paso asusta porque Google avisa que la app no está verificada. Es
normal: la app es tuya, no está publicada en ningún lado.

Si `migrarEsquema` devuelve algo como `Admisiones: + estado_previo`, quedó
todo bien.

## 5. Reinstalar los triggers — como `admision@`

Elegir cada una y Ejecutar ▶, una por una:

    instalarTriggerIngesta        → importa del sitio cada 15 minutos
    instalarTriggerRespuestas     → trae las respuestas cada 15 minutos
    instalarTriggerFichas         → genera las fichas pendientes cada hora

Ahora sí corren como `admision@` y miran el buzón correcto.

## 6. Desplegar el sitio — como `admision@`

`Implementar` > `Nueva implementación` > ⚙️ > `Aplicación web`:

- **Ejecutar como:** Yo (`admision@sancarlos.edu.ar`)
- **Quién tiene acceso:** Usuarios de sancarlos.edu.ar

Te da una URL nueva. **Ésa es la buena** — la que tenías de `aulatech@` ya no
sirve, avisale a quien la tenga guardada.

> "Ejecutar como: Yo" es obligatorio acá. Con "Usuario que accede", cada
> directora ejecutaría con sus propios permisos y no podría ni enviar desde
> `admision@` ni leer ese buzón.

## 7. Verificar que reconoce a cada persona

Entrá al sitio y mirá arriba a la derecha: tiene que decir **tu nombre**, no
`admision@`.

Pedile a Eliana o a Rocío que entren y verifiquen lo mismo. Si a ellas les
dice `admision@`, avisame — significa que `Session.getActiveUser()` no está
devolviendo el usuario real y hay que resolverlo de otra forma.

También revisá que cada una vea **sólo su nivel**.

---

## 8. La prueba antes de escribirle a una familia

No la saltees. Es lo único que confirma que el circuito cierra.

1. Abrí cualquier admisión y **cambiá el mail por el tuyo**. Guardar datos.
2. **Enviar mail**. Revisá la previsualización: de quién sale, a quién le
   llega la copia, a dónde responden.
3. Enviar.
4. Revisá lo que te llegó: que el remitente diga *Admisiones - Colegio San
   Carlos Diálogos*, que las tildes estén bien, que la firma sea la correcta.
5. **Respondé ese mail** desde tu casilla, como lo haría una familia —
   "Responder", no "Responder a todos".
6. Fijate que la respuesta le haya llegado también a la directora del nivel.
7. Esperá 15 minutos y volvé a abrir la admisión: **la respuesta tiene que
   aparecer en el recorrido**.
8. Devolvé el mail original de la familia en la ficha.

El paso 7 es el que prueba que `sincronizarRespuestas` corre con la cuenta
correcta. Si la respuesta no aparece, el trigger quedó instalado desde
`aulatech@` — volvé al punto 2.

---

## Cómo sale cada mail

    De:         Admisiones - Colegio San Carlos Diálogos <admision@sancarlos.edu.ar>
    Para:       la familia
    Cc:         la directora del nivel
    Reply-To:   admision@sancarlos.edu.ar, la directora del nivel

El `Reply-To` con **dos** direcciones es lo que sostiene el esquema: cuando la
familia toca "Responder" — no "Responder a todos", que casi nadie usa — la
respuesta llega a la directora, que sigue la conversación desde su bandeja, y
a `admision@`, donde el sistema la registra en el recorrido.

Quién recibe copia por nivel se cambia en `COPIAS_POR_NIVEL`, dentro de
`Codigo.gs`:

```js
var COPIAS_POR_NIVEL = {
  Inicial: ['elianawaichman@sancarlos.edu.ar'],
  Primaria: ['rhalperin@sancarlos.edu.ar'],
  Secundaria: ['andreapandolfo@sancarlos.edu.ar', ...]
};
```

---

## Si algo falla

| Síntoma | Causa |
|---|---|
| `Gmail is not defined` | Falta activar la Gmail API (punto 4) |
| El mail sale de `aulatech@` | Desplegaste desde la cuenta equivocada (punto 6) |
| Las respuestas no aparecen en el recorrido | El trigger quedó instalado desde `aulatech@` (puntos 2 y 5) |
| Se importa dos veces | Quedó el trigger viejo de `aulatech@` sin borrar (punto 2) |
| `No tenés acceso a las admisiones de X` | La persona no tiene ese nivel en la solapa `Usuarios` |
| `La cuenta … no está habilitada` | Falta agregarla en `Usuarios` con `activo` en TRUE |
| `Faltan datos para completar el mail` | No es un error: la plantilla tiene un campo vacío y el sistema frena a propósito |

## Qué queda en `aulatech@`

Nada del sistema nuevo. Las tres planillas viejas de nivel siguen como están,
con sus scripts, operando en paralelo — no se tocan hasta que decidas apagarlas.
