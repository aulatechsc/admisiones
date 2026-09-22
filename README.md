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
- **[`docs/sitio.md`](docs/sitio.md)** — desplegar el sitio, configurar el
  envío de mails y cómo llegan las respuestas a cada directora.
- **[`docs/esquema-unificado.md`](docs/esquema-unificado.md)** — relevamiento
  de las 4 planillas, esquema, problemas detectados y decisiones.

## Estado actual

Lo que hay andando:

- Planilla única con sus 5 solapas
- Ingesta idempotente desde la planilla del sitio
- Sitio de gestión: listado, ficha, recorrido, acciones
- Envío de mails desde `admision@` con copia a cada dirección
- Registro del intercambio: respuestas de las familias, llamadas y notas
- Fichas PDF para los tres niveles
- Plantillas de mail editables desde el sitio

Lo que falta:

- Migrar el histórico de las tres planillas de nivel

## Estructura

    docs/
      esquema-unificado.md    Relevamiento y diseño del modelo de datos
      instalacion.md          Puesta en marcha paso a paso
    apps-script/
      config.gs               Esquema de solapas y mapeo desde el sitio
      setup.gs                Crea la planilla única
      ingesta.gs              Importa solicitudes desde la planilla del sitio
      datos.gs                Lectura y escritura de admisiones y eventos
      plantillas.gs           Motor de plantillas de mail
      mailer.gs               Envío, copias y registro de respuestas
      fichas.gs               Ficha PDF por nivel
      api.gs                  Backend del sitio, con permisos por nivel
      legacy/                 Copia de los scripts hoy en producción
    web/
      index.html              El sitio (Apps Script o Vercel, el mismo archivo)
    test/
      plantillas.test.js      Plantillas, con regresión contra los scripts actuales
      ingesta.test.js         Mapeo, huellas, inclusión e integridad del esquema
      mailer.test.js          Headers del mail y formato de las fichas
      web.test.js             Sitio, escapado y permisos

## Tests

    npm test

98 tests. Las funciones puras no tocan SpreadsheetApp y corren con el runner
de node, sin necesidad de una planilla. Los de regresión verifican que las
plantillas migradas producen exactamente el mismo texto que los scripts hoy en
producción.

## Nota sobre datos personales

Las planillas contienen datos de menores y sus familias. **Ningún dato personal
se versiona en este repositorio** — sólo nombres de columnas, estructura y
código.
