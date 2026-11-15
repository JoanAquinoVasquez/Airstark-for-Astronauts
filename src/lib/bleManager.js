import { connectGalaxyWatchBle, computeHrvMetrics } from './bleHeartRate.js';
import { getAstronautProfile } from './profile.js';
import { getSavedRecords, saveRecords } from './health.js';
import { insertCloudRecords } from './supabase.js';

// ─── Singleton Global BLE Manager ─────────────────────────────────────────────
// Mantiene la conexión Bluetooth activa a nivel de aplicación aunque el usuario
// cambie de pantalla, pestaña o navegue entre rutas de la app.

let activeClient = null;
let currentStatus = 'disconnected'; // 'disconnected' | 'scanning' | 'connecting' | 'connected'
let latestPacket = null;
let lastSaveTime = 0;
let lastSavedTimeStr = null;
let lastError = null;

const packetListeners = new Set();
const statusListeners = new Set();

function notifyStatus(status) {
  currentStatus = status;
  for (const listener of statusListeners) {
    try { listener(status, activeClient); } catch (e) { console.warn(e); }
  }
}

function notifyPacket(packet) {
  latestPacket = packet;
  for (const listener of packetListeners) {
    try { listener(packet); } catch (e) { console.warn(e); }
  }
}

export async function persistBleRecord(packet, deviceName) {
  if (!packet || !packet.bpm || packet.bpm <= 0) return;
  try {
    const astronaut = getAstronautProfile();
    const hrv = computeHrvMetrics(packet.rrIntervalsMs || []);
    let stressScore = null;
    if (hrv.rmssdMs != null) {
      stressScore = Math.max(5, Math.min(95, Math.round(100 - (hrv.rmssdMs / 60) * 100)));
    } else {
      stressScore = packet.bpm < 75 ? 20 : packet.bpm < 95 ? 45 : packet.bpm < 120 ? 70 : 88;
    }
    const stressLevel = stressScore <= 33 ? 'Bajo' : stressScore <= 66 ? 'Moderado' : 'Alto';

    const newRecord = {
      date: new Date().toISOString(),
      heartRate: packet.bpm,
      stress: stressLevel,
      stressScore,
      rawHex: packet.rawHex || null,
      rrIntervals: packet.rrIntervalsMs?.join(',') || null,
      sensorContact: packet.sensorContact || null,
      source: 'watch',
      sourceFile: deviceName || 'Samsung Galaxy Watch',
      astronautId: astronaut.crewId,
    };

    const existing = getSavedRecords();
    saveRecords([newRecord, ...existing]);
    await insertCloudRecords([newRecord], astronaut.crewId);
    window.dispatchEvent(new Event('airstark-cloud-data-loaded'));
    lastSavedTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch (err) {
    console.warn('Error guardando telemetría BLE en BD:', err);
  }
}

export function getBleState() {
  return {
    status: currentStatus,
    client: activeClient,
    latestPacket,
    deviceName: activeClient?.deviceName || '',
    batteryLevel: activeClient?.batteryLevel ?? null,
    lastSavedTimeStr,
    error: lastError,
  };
}

export function subscribeBleStatus(callback) {
  statusListeners.add(callback);
  callback(currentStatus, activeClient);
  return () => statusListeners.delete(callback);
}

export function subscribeBlePacket(callback) {
  packetListeners.add(callback);
  if (latestPacket) callback(latestPacket);
  return () => packetListeners.delete(callback);
}

export async function connectBleGlobal() {
  lastError = null;
  notifyStatus('scanning');
  try {
    const client = await connectGalaxyWatchBle({
      onPacket: (packet) => {
        notifyPacket(packet);

        // Auto-guardado en BD cada 15 segundos continuo en segundo plano
        const now = Date.now();
        if (now - lastSaveTime >= 15000) {
          lastSaveTime = now;
          persistBleRecord(packet, client.deviceName);
        }
      },
      onDisconnect: () => {
        if (latestPacket && Date.now() - lastSaveTime >= 3000) {
          persistBleRecord(latestPacket, activeClient?.deviceName);
        }
        activeClient = null;
        notifyStatus('disconnected');
      },
      onStatusChange: (status) => {
        notifyStatus(status);
      },
    });

    activeClient = client;
    notifyStatus('connected');
    return client;
  } catch (err) {
    lastError = err.message || 'Error conectando al smartwatch por Bluetooth.';
    notifyStatus('disconnected');
    throw err;
  }
}

export async function disconnectBleGlobal() {
  if (activeClient) {
    if (latestPacket && Date.now() - lastSaveTime >= 3000) {
      await persistBleRecord(latestPacket, activeClient.deviceName);
    }
    await activeClient.disconnect();
    activeClient = null;
  }
  notifyStatus('disconnected');
}
