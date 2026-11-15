// ─── BLE Heart Rate Telemetry & GATT Client ──────────────────────────────────
// Integrated from BPM-por-minuto for Samsung Galaxy Watch (SM-R860) & BLE sensors

export const STANDARD_GATT_UUIDS = {
  HEART_RATE_SERVICE: '0000180d-0000-1000-8000-00805f9b34fb',
  HEART_RATE_MEASUREMENT_CHAR: '00002a37-0000-1000-8000-00805f9b34fb',
  BODY_SENSOR_LOCATION_CHAR: '00002a38-0000-1000-8000-00805f9b34fb',
  HEART_RATE_CONTROL_POINT_CHAR: '00002a39-0000-1000-8000-00805f9b34fb',
  BATTERY_SERVICE: '0000180f-0000-1000-8000-00805f9b34fb',
  BATTERY_LEVEL_CHAR: '00002a19-0000-1000-8000-00805f9b34fb',
  DEVICE_INFO_SERVICE: '0000180a-0000-1000-8000-00805f9b34fb',
  MODEL_NUMBER_CHAR: '00002a24-0000-1000-8000-00805f9b34fb',
  MANUFACTURER_NAME_CHAR: '00002a29-0000-1000-8000-00805f9b34fb',
};

export function parseHeartRateMeasurement(dataView, timestampMs = Date.now()) {
  if (dataView.byteLength < 2) {
    throw new Error('Trama BLE 0x2A37 inválida: se requieren al menos 2 bytes.');
  }

  const rawBytes = [];
  for (let i = 0; i < dataView.byteLength; i++) {
    rawBytes.push(dataView.getUint8(i));
  }
  const rawHex = rawBytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

  const flags = dataView.getUint8(0);
  const isUint16 = (flags & 0x01) !== 0;
  const contactBits = (flags >> 1) & 0x03;

  let sensorContact = 'not-supported';
  if (contactBits === 2) {
    sensorContact = 'no-contact';
  } else if (contactBits === 3) {
    sensorContact = 'contact';
  }

  const hasEnergyExpended = (flags & 0x08) !== 0;
  const hasRrIntervals = (flags & 0x10) !== 0;

  let offset = 1;
  let bpm = 0;
  if (isUint16) {
    if (offset + 2 > dataView.byteLength) {
      throw new Error('Trama BLE 0x2A37 truncada al leer BPM UINT16.');
    }
    bpm = dataView.getUint16(offset, true);
    offset += 2;
  } else {
    bpm = dataView.getUint8(offset);
    offset += 1;
  }

  let energyExpendedKj = null;
  if (hasEnergyExpended && offset + 2 <= dataView.byteLength) {
    energyExpendedKj = dataView.getUint16(offset, true);
    offset += 2;
  }

  const rrIntervalsMs = [];
  if (hasRrIntervals) {
    while (offset + 2 <= dataView.byteLength) {
      const rawRr = dataView.getUint16(offset, true);
      const ms = Math.round(((rawRr * 1000) / 1024) * 10) / 10;
      rrIntervalsMs.push(ms);
      offset += 2;
    }
  }

  return {
    timestampMs,
    bpm,
    format: isUint16 ? 'uint16' : 'uint8',
    sensorContact,
    energyExpendedKj,
    rrIntervalsMs,
    flagsByte: flags,
    rawHex,
    rawBytes,
  };
}

export function computeHrvMetrics(rrIntervalsMs) {
  const valid = (rrIntervalsMs || []).filter((v) => Number.isFinite(v) && v >= 250 && v <= 2500);
  if (valid.length === 0) {
    return { rmssdMs: null, sdnnMs: null, pnn50Percent: null, meanRrMs: null, sampleCount: 0 };
  }

  const meanRrMs = valid.reduce((acc, v) => acc + v, 0) / valid.length;
  if (valid.length < 2) {
    return {
      rmssdMs: null,
      sdnnMs: null,
      pnn50Percent: null,
      meanRrMs: Math.round(meanRrMs * 10) / 10,
      sampleCount: valid.length,
    };
  }

  const variance = valid.reduce((acc, v) => acc + (v - meanRrMs) ** 2, 0) / (valid.length - 1);
  const sdnnMs = Math.sqrt(variance);

  let sumSqDiff = 0;
  let nn50Count = 0;
  const diffCount = valid.length - 1;

  for (let i = 1; i < valid.length; i++) {
    const diff = valid[i] - valid[i - 1];
    sumSqDiff += diff * diff;
    if (Math.abs(diff) > 50) {
      nn50Count += 1;
    }
  }

  const rmssdMs = Math.sqrt(sumSqDiff / diffCount);
  const pnn50Percent = (nn50Count / diffCount) * 100;

  return {
    rmssdMs: Math.round(rmssdMs * 10) / 10,
    sdnnMs: Math.round(sdnnMs * 10) / 10,
    pnn50Percent: Math.round(pnn50Percent * 10) / 10,
    meanRrMs: Math.round(meanRrMs * 10) / 10,
    sampleCount: valid.length,
  };
}

export function computeCardiacZone(bpm, maxHr = 190) {
  const safeMax = Math.max(100, maxHr);
  const pct = Math.round((bpm / safeMax) * 100);

  if (pct < 60) {
    return {
      index: 1,
      name: 'Zona 1 · Recuperación',
      shortName: 'Z1 Recup.',
      percentOfMax: pct,
      rangeLabel: `< ${Math.round(safeMax * 0.6)} BPM`,
      strokeHex: '#22D3EE',
    };
  }
  if (pct < 70) {
    return {
      index: 2,
      name: 'Zona 2 · Base Aeróbica',
      shortName: 'Z2 Base',
      percentOfMax: pct,
      rangeLabel: `${Math.round(safeMax * 0.6)}–${Math.round(safeMax * 0.7)} BPM`,
      strokeHex: '#34D399',
    };
  }
  if (pct < 80) {
    return {
      index: 3,
      name: 'Zona 3 · Tempo Aeróbico',
      shortName: 'Z3 Tempo',
      percentOfMax: pct,
      rangeLabel: `${Math.round(safeMax * 0.7)}–${Math.round(safeMax * 0.8)} BPM`,
      strokeHex: '#FBBF24',
    };
  }
  if (pct < 90) {
    return {
      index: 4,
      name: 'Zona 4 · Umbral Anaeróbico',
      shortName: 'Z4 Umbral',
      percentOfMax: pct,
      rangeLabel: `${Math.round(safeMax * 0.8)}–${Math.round(safeMax * 0.9)} BPM`,
      strokeHex: '#FB923C',
    };
  }
  return {
    index: 5,
    name: 'Zona 5 · Esfuerzo Máximo',
    shortName: 'Z5 Máx.',
    percentOfMax: pct,
    rangeLabel: `>= ${Math.round(safeMax * 0.9)} BPM`,
    strokeHex: '#FB7185',
  };
}

// ─── Web Bluetooth Connect Client ─────────────────────────────────────────────
export async function connectGalaxyWatchBle({ onPacket, onDisconnect, onStatusChange }) {
  if (typeof navigator === 'undefined' || !navigator.bluetooth) {
    throw new Error('Web Bluetooth no está soportado en este navegador. Utiliza Google Chrome o Edge en HTTPS o localhost.');
  }

  onStatusChange?.('scanning');

  let device;
  try {
    device = await navigator.bluetooth.requestDevice({
      filters: [
        { services: ['heart_rate'] },
        { services: [STANDARD_GATT_UUIDS.HEART_RATE_SERVICE] },
      ],
      optionalServices: [
        STANDARD_GATT_UUIDS.BATTERY_SERVICE,
        STANDARD_GATT_UUIDS.DEVICE_INFO_SERVICE,
      ],
    });
  } catch (err) {
    // Si el usuario cancela o prefiere buscar todos los dispositivos
    if (err.name === 'NotFoundError') {
      throw new Error('Escaneo de Bluetooth cancelado o no se seleccionó ningún dispositivo.');
    }
    // Fallback: acceptAllDevices
    device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        'heart_rate',
        STANDARD_GATT_UUIDS.HEART_RATE_SERVICE,
        STANDARD_GATT_UUIDS.BATTERY_SERVICE,
        STANDARD_GATT_UUIDS.DEVICE_INFO_SERVICE,
      ],
    });
  }

  onStatusChange?.('connecting');

  device.addEventListener('gattserverdisconnected', () => {
    onDisconnect?.();
    onStatusChange?.('disconnected');
  });

  const server = await device.gatt.connect();

  let hrService;
  try {
    hrService = await server.getPrimaryService('heart_rate');
  } catch {
    hrService = await server.getPrimaryService(STANDARD_GATT_UUIDS.HEART_RATE_SERVICE);
  }

  let hrChar;
  try {
    hrChar = await hrService.getCharacteristic('heart_rate_measurement');
  } catch {
    hrChar = await hrService.getCharacteristic(STANDARD_GATT_UUIDS.HEART_RATE_MEASUREMENT_CHAR);
  }

  await hrChar.startNotifications();

  hrChar.addEventListener('characteristicvaluechanged', (event) => {
    try {
      const dataView = event.target.value;
      if (dataView && dataView.byteLength >= 2) {
        const packet = parseHeartRateMeasurement(dataView, Date.now());
        onPacket?.(packet);
      }
    } catch (e) {
      console.warn('Error parseando trama BLE:', e);
    }
  });

  // Intentar leer nivel de batería opcional
  let batteryLevel = null;
  try {
    const battService = await server.getPrimaryService(STANDARD_GATT_UUIDS.BATTERY_SERVICE);
    const battChar = await battService.getCharacteristic(STANDARD_GATT_UUIDS.BATTERY_LEVEL_CHAR);
    const battVal = await battChar.readValue();
    batteryLevel = battVal.getUint8(0);
  } catch {
    // Batería no disponible o restringida
  }

  onStatusChange?.('connected');

  return {
    device,
    server,
    characteristic: hrChar,
    batteryLevel,
    deviceName: device.name || 'Samsung Galaxy Watch (SM-R860)',
    deviceId: device.id,
    disconnect: async () => {
      try {
        await hrChar.stopNotifications();
      } catch {}
      if (device.gatt?.connected) {
        device.gatt.disconnect();
      }
    },
  };
}
