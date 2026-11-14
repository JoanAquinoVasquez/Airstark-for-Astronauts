# AIRSTARK · aplicación web

Prototipo de salud para la hackatón NASA Space Apps, construido con React y Vite. Cada módulo tiene su propia ruta y ventana de navegación: `/`, `/monitor`, `/gemelo-3d`, `/datos`, `/registro`, `/historial` y `/asistente`.

## Desarrollo

```bash
npm install
npm run dev
```

Para compilar para Vercel: `npm run build`.

## Incluye

- Panel adaptable a móvil con valores de demostración claramente identificados.
- Importación local de archivos CSV con columnas de frecuencia cardíaca, IMC y estrés. Se reconocen encabezados como `heart_rate`, `heart_rate_bpm`, `frecuencia_cardiaca`, `bpm`, `timestamp_iso`, `bmi`, `imc`, `stress` y `nivel_estres`. Las filas con `0 bpm` se omiten porque representan lecturas no válidas en el CSV de muestra del reloj.
- Formulario para frecuencia cardíaca, presión arterial, glucosa, peso, estatura, tipo de diabetes, estrés y nota opcional.
- Cálculo del IMC a partir del peso y estatura ingresados.
- Historial en `localStorage` del navegador y exportación de los registros introducidos como CSV.
- Navegación en ventanas separadas: resumen, monitor en vivo, gemelo digital 3D, datos del reloj, registro, historial y Copilot.
- Interfaz bilingüe EN/ES, con inglés como idioma inicial y preferencia guardada en el navegador.
- Dictado por voz en los campos del check-in y en Copilot; las respuestas del agente se pueden escuchar con síntesis de voz.
- Panel de actividad y notificaciones como punto de integración para alertas del agente.

Los datos del formulario y los CSV se guardan solo en el navegador de este dispositivo; la demo no transmite ni sincroniza información con un servidor. El historial de demostración es fijo y no es un registro clínico.

## Supabase (preparación)

`supabase/schema.sql` crea tablas para registros de salud y notificaciones con Row Level Security ligado al usuario autenticado. El proyecto todavía no sincroniza datos con Supabase: se requiere crear el proyecto, habilitar autenticación y configurar el cliente web con la URL y la clave `anon` pública. Nunca exponer una clave `service_role` en el navegador.

El reconocimiento de voz usa las APIs disponibles en el navegador. Algunos navegadores requieren conexión de red para transcribir; para uso real durante una misión se necesitaría un motor de voz que funcione sin conexión.

## Interfaz del agente por webhook

El panel **AIRSTARK Copilot** usa el webhook definido en `src/lib/health.js`; la interfaz no muestra controles de configuración al astronauta. Envía la pregunta y un contexto de salud acotado mediante `POST`:

```json
{
  "action": "sendMessage",
  "sessionId": "airstark-session-id",
  "chatInput": "¿Qué indicadores puedo consultar?\\n\\nContexto de salud AIRSTARK (JSON): ...",
  "astronautData": {
    "latest": { "heartRateBpm": 72, "bmi": 22.4, "stressLevel": "Bajo", "isMock": true },
    "recentRecords": [],
    "containsMockData": true
  }
}
```

El contrato usa los campos de un chat n8n: `action`, `sessionId` y `chatInput`. El texto `chatInput` incluye la pregunta y el contexto JSON para que el agente lo reciba como parte de su mensaje; `astronautData` también se envía como campo estructurado adicional. `astronautData.latest` contiene la medición más reciente y `recentRecords` hasta siete registros. Cada registro incluye frecuencia cardíaca, IMC, estrés, presión, glucosa, peso, estatura, diabetes, fecha y origen; los datos de demostración incluyen `isMock: true`. La respuesta puede ser texto plano o JSON con un campo `answer`, `response`, `output`, `message`, `reply` o `text`. El endpoint debe aceptar solicitudes `POST` desde el dominio de Vercel y habilitar CORS para `Content-Type`.

## Flujo para el siguiente módulo

Los puntos de montaje de módulos son `#airstark-live-monitor-root` (telemetría Bluetooth) y `#airstark-digital-twin-root` (visor volumétrico 3D). Sus pantallas están separadas; por ahora no simulan conexión ni datos en vivo.

El registro de salud queda como objeto JSON con fecha, frecuencia cardíaca, presión, glucosa, peso, estatura, IMC, nivel de estrés, diabetes, nota y origen. Ese objeto puede enviarse luego al endpoint del backend/modelo de IA; la persistencia de demostración puede reemplazarse por Supabase o por una API propia.
