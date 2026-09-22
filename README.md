# Admisiones — Colegio San Carlos Diálogos

Sistema de gestión de admisiones para los tres niveles (Inicial, Primaria,
Secundaria).

## Estado

En diseño. Hoy la operación vive repartida en 4 planillas de Google con
scripts independientes y un paso de copiado manual entre ellas.

El objetivo es centralizar en una planilla única con un sitio interno que
permita ver el recorrido de cada admisión, registrar el intercambio de mails
con las familias, enviar las respuestas desde plantillas y generar la ficha PDF.

## Por dónde empezar

- **[`docs/instalacion.md`](docs/instalacion.md)** — cómo dejar andando la
  planilla nueva. Son 10 minutos y no toca nada de lo que hoy funciona.
- **[`docs/esquema-unificado.md`](docs/esquema-unificado.md)** — relevamiento
  de las 4 planillas, esquema, problemas detectados y decisiones.

## Estado actual

Lo que hay andando:

- Setup de la planilla única con sus 5 solapas
- Ingesta idempotente desde la planilla del sitio
- Motor de plantillas de mail, editable sin tocar código

Lo que falta:

- El sitio web (login por cuenta Google, listado, ficha, timeline)
- Conectar el envío de mails y el registro del hilo de Gmail
- Migrar el histórico de las tres planillas de nivel

## Estructura

    docs/
      esquema-unificado.md    Relevamiento y diseño del modelo de datos
      instalacion.md          Puesta en marcha paso a paso
    apps-script/
      config.gs               Esquema de solapas y mapeo desde el sitio
      setup.gs                Crea la planilla única
      ingesta.gs              Importa solicitudes desde la planilla del sitio
      plantillas.gs           Motor de plantillas de mail
      legacy/                 Copia de los scripts hoy en producción
    test/
      plantillas.test.js      Plantillas, con regresión contra los scripts actuales
      ingesta.test.js         Mapeo, huellas e integridad del esquema

## Tests

    npm test

Las funciones puras de `plantillas.gs` no tocan SpreadsheetApp y corren con el
runner de node. Los tests de regresión verifican que las plantillas migradas
producen exactamente el mismo texto que los scripts hoy en producción.

## Nota sobre datos personales

Las planillas contienen datos de menores y sus familias. **Ningún dato personal
se versiona en este repositorio** — sólo nombres de columnas, estructura y
código.
