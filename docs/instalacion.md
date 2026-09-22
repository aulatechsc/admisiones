# Instalación de la planilla nueva

Son 10 minutos. No toca nada de lo que está funcionando hoy: las tres
planillas de nivel siguen operando igual, y la planilla del sitio se lee pero
no se modifica.

## 1. Crear la planilla

Desde **`aulatech@sancarlos.edu.ar`**, crear una planilla nueva en un Drive
compartido (no en "Mi unidad" de una persona) y llamarla, por ejemplo,
**Admisiones - Sistema**.

## 2. Pegar el código

`Extensiones > Apps Script`. Son **dos archivos**:

| Pegar esto | En un archivo llamado | Tipo |
|---|---|---|
| [`dist/Codigo.gs`](../dist/Codigo.gs) | `Codigo` | Secuencia de comandos |
| [`web/index.html`](../web/index.html) | `index` | HTML |

`Codigo.gs` es generado: junta los nueve módulos de `apps-script/` en un solo
archivo. El código real vive en módulos separados, pero pegarlos de a uno en
el editor es lento y propenso a que alguno quede cortado o sin pegar — y como
todos comparten el mismo scope global, un archivo faltante no falla al pegarlo
sino después, como un `ReferenceError` en otro módulo que sí está.

Para regenerarlo después de tocar el código: `npm run bundle`.

El nombre `index` del HTML importa: `api.gs` hace
`createHtmlOutputFromFile('index')`. Con otro nombre, el sitio no abre.

> **No pegar nada de `apps-script/legacy/`.** Son la copia de respaldo de los
> scripts que hoy corren dentro de las planillas de cada nivel. Tienen
> funciones con el mismo nombre (`setup`, `instalarTrigger`), así que
> mezclarlos rompe las dos cosas.

### Si preferís no copiar y pegar

`clasp` sube los módulos directo desde el repo y te evita todo esto:

    npm i -g @google/clasp
    clasp login
    clasp clone <id-del-proyecto>
    clasp push

Con clasp el bundle no hace falta.

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

## Después del setup

El sitio y el envío de mails necesitan unos pasos más — el alias `admision@`,
el servicio avanzado de Gmail y el despliegue. Está todo en
[`sitio.md`](sitio.md).

## Inclusión en Inicial y Primaria

Esos dos niveles no tienen una pregunta directa de inclusión: la respuesta
viene dentro de "Trayectoria escolar actual". El sistema la deriva sola — ver
la sección correspondiente en [`sitio.md`](sitio.md), que explica también por
qué una de las opciones necesita cuidado especial.

Cuando el texto no coincide con ninguna opción conocida, el campo queda sin
definir y el sitio avisa en la ficha para que alguien lo resuelva antes de
mandar el mail.

## Lo que falta

Migrar el histórico de las tres planillas de nivel. Las viejas siguen
operando en paralelo mientras tanto.
