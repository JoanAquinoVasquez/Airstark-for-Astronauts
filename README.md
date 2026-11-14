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
- Perfil editable del astronauta con ID de tripulación y misión; ese ID se agrega a check-ins, CSV importados y al contexto del agente.
- Importación local de archivos CSV con columnas de frecuencia cardíaca, IMC y estrés. Se reconocen encabezados como `heart_rate`, `heart_rate_bpm`, `frecuencia_cardiaca`, `bpm`, `timestamp_iso`, `bmi`, `imc`, `stress` y `nivel_estres`. Las filas con `0 bpm` se omiten porque representan lecturas no válidas en el CSV de muestra del reloj.
- Formulario para frecuencia cardíaca, presión arterial, glucosa, peso, estatura, tipo de diabetes, estrés y nota opcional.
- Cálculo del IMC a partir del peso y estatura ingresados.
- Historial en `localStorage` del navegador y exportación de los registros introducidos como CSV.
- Navegación en ventanas separadas: resumen, monitor en vivo, gemelo digital 3D, datos del reloj, registro, historial y Copilot.
- Interfaz bilingüe EN/ES, con inglés como idioma inicial y preferencia guardada en el navegador.
- Dictado por voz en los campos del check-in y en Copilot; las respuestas del agente se pueden escuchar con síntesis de voz.
- Panel de actividad y notificaciones como punto de integración para alertas del agente.

El perfil, los datos del formulario y los CSV se guardan solo en el navegador de este dispositivo; la demo no transmite ni sincroniza información con un servidor. El historial de demostración es fijo y no es un registro clínico.

## Supabase

`supabase/schema.sql` crea perfiles, registros de salud y notificaciones con Row Level Security ligado al usuario autenticado. Para habilitar la sincronización:

1. Ejecuta `supabase/schema.sql` en el SQL Editor del proyecto Supabase.
2. Habilita Email/Password en Authentication.
3. Copia `.env.example` a `.env.local` y completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` con la URL del proyecto y la clave pública `publishable`.
4. En Supabase, habilita **Anonymous Sign-Ins** en Authentication settings.
5. Reinicia Vite. La demo abre directamente, crea una sesión anónima y pide el perfil de tripulación en la pantalla inicial. Esa sesión se conserva en ese navegador; al borrar sus datos, la demo crea otro usuario anónimo.

Se usa la clave pública `publishable` con las políticas RLS del esquema. Nunca expongas una clave `secret` o `service_role` en el navegador. Sin configuración de Supabase, la aplicación conserva el modo local de demostración.

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
