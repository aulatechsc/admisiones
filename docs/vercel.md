# Publicar el sitio en Vercel

El sitio servido por Apps Script funciona, pero tiene un problema real en el
celular: la URL `script.google.com/macros/s/…/exec` redirige a `/u/0/`, y si
tu cuenta activa en ese navegador no es la primera, da error de permisos o
una pantalla en blanco. En el teléfono, donde suele haber una cuenta personal
y una del trabajo, pasa seguido.

Con Vercel el sitio queda en `admisiones.sancarlos.edu.ar` (o el dominio que
elijas), entra igual desde cualquier dispositivo, y el login es el botón de
Google de siempre.

Son unos 15 minutos.

---

## 1. Crear el Client ID de Google

Es lo que permite que el sitio, alojado fuera de Google, pruebe quién sos.

1. Entrar a [console.cloud.google.com](https://console.cloud.google.com) **con
   `admision@sancarlos.edu.ar`**
2. Arriba a la izquierda, crear un proyecto nuevo: `Admisiones San Carlos`
3. Menú ☰ > `APIs y servicios` > **Pantalla de consentimiento de OAuth**
   - Tipo de usuario: **Interno**
   - Nombre de la app: `Admisiones`
   - Correo de asistencia y de contacto: `admision@sancarlos.edu.ar`
   - Guardar y continuar hasta el final

> **Interno** importa: así la app queda limitada al dominio del colegio y
> Google no pide un proceso de verificación. Con "Externo" te va a mostrar la
> pantalla de "app no verificada" a cada persona.

4. `APIs y servicios` > **Credenciales** > `Crear credenciales` >
   **ID de cliente de OAuth**
   - Tipo: **Aplicación web**
   - Nombre: `Sitio de admisiones`
   - En **Orígenes autorizados de JavaScript**, agregar:
     - `https://admisiones-sancarlos.vercel.app` (la URL que te dé Vercel)
     - `http://localhost:3000` — para poder probar en tu máquina
   - **No** hace falta completar URI de redirección
5. Copiar el **ID de cliente**. Es algo como
   `123456789-abc123.apps.googleusercontent.com`

Si todavía no sabés la URL de Vercel, hacé primero el punto 3 y volvé acá a
agregarla. Sin el origen autorizado, el botón de Google no aparece.

## 2. Completar los dos valores

En **`Codigo.gs`**, arriba de todo:

```js
var OAUTH_CLIENT_ID = '123456789-abc123.apps.googleusercontent.com';
```

En **`index.html`**, en el bloque de transporte:

```js
var URL_API = 'https://script.google.com/macros/s/AKfy…/exec';
var CLIENT_ID = '123456789-abc123.apps.googleusercontent.com';
```

`URL_API` es la URL de la web app que ya tenés desplegada.

## 3. Volver a desplegar la web app

`Implementar` > `Administrar implementaciones` > ✏️ > Versión: **Nueva**, y
cambiar:

- **Quién tiene acceso: Cualquier usuario**

### Por qué esto no es un agujero

Suena mal, y conviene entender por qué no lo es. El pedido llega desde Vercel
sin sesión de Google, así que Apps Script no puede identificar a nadie por su
cuenta: si dejaras "Usuarios de sancarlos.edu.ar", rechazaría todo.

Lo que protege el endpoint es `doPost`, que antes de responder cualquier cosa
verifica que el pedido traiga un ID token de Google:

- emitido para **este** Client ID
- de una cuenta **`@sancarlos.edu.ar`**
- con el mail verificado
- sin vencer

Y recién después chequea que esa persona esté activa en la solapa `Usuarios`.
Sin token válido, la respuesta es un error y nada más.

## 4. Subir a Vercel

1. Entrar a [vercel.com](https://vercel.com) y crear cuenta (el plan gratis
   alcanza de sobra)
2. `Add New` > `Project` > importar el repo `aulatechsc/admisiones`
3. En la configuración del proyecto:
   - **Root Directory**: `web` ← importante
   - Framework Preset: `Other`
   - Los demás campos, vacíos
4. `Deploy`

En un minuto te da una URL tipo `https://admisiones-xxxx.vercel.app`.

> Si no querés conectar el repo, también podés arrastrar la carpeta `web/` a
> vercel.com/new. Pero conectando el repo, cada cambio que subas se publica
> solo.

## 5. Agregar la URL al Client ID

Volver al punto 1.4 y agregar la URL real de Vercel en **Orígenes autorizados
de JavaScript**. Sin esto el botón de Google no carga y la pantalla de login
queda vacía.

Los cambios en Google Cloud tardan unos minutos en tomar efecto.

## 6. Probar

1. Abrir la URL de Vercel **en el celular**
2. Entrar con tu cuenta del colegio
3. Verificar que arriba diga tu nombre, no `admision@`
4. Abrir una admisión, cambiar un estado, y confirmar que en el recorrido
   figure **tu** nombre

El punto 4 es el que confirma que la identidad viaja bien. Si el evento
quedara firmado por `admision@`, avisame.

---

## Dominio propio (opcional)

En Vercel: `Settings` > `Domains` > agregar `admisiones.sancarlos.edu.ar`.
Vercel te da un registro CNAME para cargar en el DNS del colegio.

Después hay que agregar ese dominio también a los orígenes autorizados del
Client ID.

---

## Los dos modos conviven

El mismo `index.html` funciona de las dos formas y detecta solo dónde está
corriendo:

| Dónde | Cómo identifica al usuario |
|---|---|
| Servido por Apps Script | Sesión de Google (`google.script.run`) |
| Servido por Vercel | ID token verificado en `doPost` |

Así que la URL de Apps Script te sigue funcionando como respaldo. Si algún día
Vercel falla, entrás por ahí sin tocar nada.

## Si algo falla

| Síntoma | Causa |
|---|---|
| El login no muestra el botón de Google | Falta la URL de Vercel en los orígenes autorizados (punto 5), o falta `CLIENT_ID` |
| `Falta completar URL_API y CLIENT_ID` | No se completaron los valores en `index.html` (punto 2) |
| `No se pudo verificar la identidad` | El `OAUTH_CLIENT_ID` de `Codigo.gs` no coincide con el del sitio |
| Error de CORS en la consola | La web app no se volvió a desplegar con acceso "Cualquier usuario" (punto 3) |
| Entra pero no muestra nada | La cuenta no está en la solapa `Usuarios`, o está con `activo` en FALSE |
| Los eventos figuran a nombre de `admision@` | Estás con una versión vieja del código: hace falta el bundle que fija el usuario verificado |
