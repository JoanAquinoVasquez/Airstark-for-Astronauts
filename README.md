# AIRSTARK · prototipo web

Prototipo de monitoreo para la hackatón NASA Space Apps. La interfaz funciona como sitio estático, sin instalación ni servicios externos: abre `index.html` en un navegador moderno.

## Incluye

- Panel adaptable a móvil con valores de demostración claramente identificados.
- Importación local de archivos CSV con columnas de frecuencia cardíaca, IMC y estrés. Se reconocen encabezados como `heart_rate`, `heart_rate_bpm`, `frecuencia_cardiaca`, `bmi`, `imc`, `stress` y `nivel_estres`.
- Formulario para frecuencia cardíaca, presión arterial, glucosa, peso, estatura, tipo de diabetes, estrés y nota opcional.
- Cálculo del IMC a partir del peso y estatura ingresados.
- Historial en `localStorage` del navegador y exportación de los registros introducidos como CSV.

Los datos del formulario y los CSV se guardan solo en el navegador de este dispositivo; la demo no transmite ni sincroniza información con un servidor. El historial de demostración es fijo y no es un registro clínico.

## Interfaz del agente por webhook

El panel **AIRSTARK Copilot** permite configurar una URL de webhook y conversar con un agente. La interfaz envía únicamente la pregunta como JSON mediante `POST`:

```json
{"question":"¿Qué indicadores puedo consultar?"}
```

La respuesta puede ser texto plano o JSON con un campo `answer`, `response`, `output`, `message`, `reply` o `text`. La interfaz no añade datos de salud ni historial a la solicitud. El endpoint debe aceptar solicitudes `POST` desde el dominio de Vercel y habilitar CORS para `Content-Type`.

## Flujo para el siguiente módulo

El registro queda como objeto JSON con fecha, frecuencia cardíaca, presión, glucosa, peso, estatura, IMC, nivel de estrés, diabetes, nota y origen. Ese objeto puede enviarse luego al endpoint del backend/modelo de IA; la persistencia de demostración puede reemplazarse por Supabase o por una API propia.
