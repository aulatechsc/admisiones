# Instalación de la planilla nueva

Son 10 minutos. No toca nada de lo que está funcionando hoy: las tres
planillas de nivel siguen operando igual, y la planilla del sitio se lee pero
no se modifica.

## 1. Crear la planilla

Desde **`aulatech@sancarlos.edu.ar`**, crear una planilla nueva en un Drive
compartido (no en "Mi unidad" de una persona) y llamarla, por ejemplo,
**Admisiones - Sistema**.

## 2. Pegar el código

`Extensiones > Apps Script`. Crear un archivo por cada uno de estos y pegar su
contenido:

| Archivo en el repo | Archivo en Apps Script |
|---|---|
| `apps-script/config.gs` | `config.gs` |
| `apps-script/plantillas.gs` | `plantillas.gs` |
| `apps-script/ingesta.gs` | `ingesta.gs` |
| `apps-script/setup.gs` | `setup.gs` |

> **No pegar nada de `apps-script/legacy/`.** Esos archivos son la copia de
> respaldo de los scripts que hoy corren dentro de las planillas de cada
> nivel. Tienen funciones con el mismo nombre (`setup`, `instalarTrigger`),
> así que mezclarlos rompe las dos cosas.

Guardar con el disquete.

## 3. Correr el setup

En el desplegable de funciones (arriba, al lado de "Depurar") elegir **`setup`**
y tocar **Ejecutar** (▶). La primera vez pide autorización — aceptar.

Crea las 5 solapas:

| Solapa | Qué guarda |
|---|---|
| `Admisiones` | Una fila por postulante, los 3 niveles juntos |
| `Eventos` | El recorrido: mails, llamadas, cambios de estado, notas |
| `Usuarios` | Quién entra al sitio y a qué nivel |
| `Plantillas` | Los textos de los mails, editables |
| `Estados` | El pipeline de admisión |

Es seguro correrlo de nuevo: si una solapa ya tiene datos, la deja como está.

El setup carga automáticamente los 9 estados, las 4 plantillas actuales de
Inicial y Primaria, y deja cargado como admin a quien lo ejecutó — si no,
nadie podría entrar al sitio después.

## 4. Traer las solicitudes

Elegir **`importarDesdeSitio`** y Ejecutar. Trae todo lo que haya en
"Admisiones - Respuestas Sitio Web" y devuelve un resumen con cuántas importó
por nivel.

Se puede correr las veces que haga falta: cada solicitud deja una `huella` y
las corridas siguientes saltean lo ya importado. No duplica.

## 5. Automatizar la importación

Elegir **`instalarTriggerIngesta`** y Ejecutar, una sola vez. A partir de ahí
importa cada 15 minutos.

## 6. Cargar al equipo

En la solapa `Usuarios`, una fila por persona:

| email | nombre | niveles | rol | activo |
|---|---|---|---|---|
| elianawaichman@sancarlos.edu.ar | Eliana Waichman | Inicial | editor | TRUE |
| rhalperin@sancarlos.edu.ar | Rocío Halperin | Primaria | editor | TRUE |
| aulatech@sancarlos.edu.ar | Aulatech | Inicial,Primaria,Secundaria | admin | TRUE |

`niveles` separados por coma. `rol` es `admin` o `editor`.

## Qué NO hace todavía

- El sitio web (login, listado, ficha, timeline). Es el paso siguiente.
- Enviar mails. El motor de plantillas está y testeado, pero falta conectarlo
  al envío y al registro del hilo de Gmail.
- Migrar el histórico de las tres planillas de nivel.

## Un hueco a resolver: inclusión en Primaria

El script de Primaria elige entre sus dos mails según la columna `Inclusión`:
si está marcada manda el de "no hay vacante de inclusión", si no el estándar.

Pero **el formulario del sitio de Primaria no pregunta por inclusión.** Sólo lo
pregunta el de Secundaria (`Solicita proyecto de inclusión`). Se puede verificar
en `SHEETS_CONFIG` de `legacy/sitio-web.gs`: Primaria tiene `Bilingüe inglés`
pero ningún campo de inclusión.

Consecuencia: toda solicitud de Primaria que entre por el sitio llega con
`inclusion_solicitada` vacío y cae en la plantilla estándar. El circuito de
inclusión nunca se dispara solo.

Hay dos caminos, y es una decisión del equipo:

1. **Agregar la pregunta al formulario del sitio** para Primaria, como ya la
   tiene Secundaria. Queda automático.
2. **Dejarlo manual**: el sitio muestra la casilla en la ficha y Rocío la marca
   cuando corresponde, antes de enviar.

La opción 2 probablemente sea la correcta: que una familia se autodeclare en un
formulario web no es lo mismo que una evaluación del equipo, y el mail que se
manda cuando está marcada es una negativa de vacante. Conviene que sea una
decisión explícita de alguien, no el resultado automático de una casilla.
