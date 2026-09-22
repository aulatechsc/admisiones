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

Leer **[`docs/esquema-unificado.md`](docs/esquema-unificado.md)**: tiene el
relevamiento de las 4 planillas, el esquema propuesto, los problemas
detectados en los scripts actuales y las decisiones que faltan tomar.

## Estructura

    docs/
      esquema-unificado.md    Relevamiento y diseño del modelo de datos
    apps-script/
      legacy/                 Copia de los scripts hoy en producción

## Nota sobre datos personales

Las planillas contienen datos de menores y sus familias. **Ningún dato personal
se versiona en este repositorio** — sólo nombres de columnas, estructura y
código.
