import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://esoeoflrxfhgplpfvopm.supabase.co';
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_f3QHPinURAjJzuK069h6Zg_4TXu5kzK';

export const supabase = url && publishableKey ? createClient(url, publishableKey) : null;
export const isSupabaseConfigured = Boolean(supabase);
export const NOTIFICATIONS_STORAGE_KEY = 'airstark.missionNotifications.v1';
export const DEMO_USER_ID = '845cc4fa-fac4-413d-a0ce-5947e808546a';
export const DEMO_CREW_ID = 'A-9K21-YCXQ';

export async function loadCloudData() {
  if (!supabase) return;
  const [
    { data: records, error: recordsError },
    { data: profile, error: profileError },
    { data: notifications, error: notificationsError },
    { data: cardioEvals, error: cardioError },
  ] = await Promise.all([
    supabase.from('health_records').select('*').order('recorded_at', { ascending: false }),
    supabase.from('astronaut_profiles').select('*').or(`user_id.eq.${DEMO_USER_ID},crew_id.eq.${DEMO_CREW_ID}`).maybeSingle(),
    supabase.from('mission_notifications').select('id,created_at,severity,title,message,read_at').order('created_at', { ascending: false }).limit(20),
    supabase.from('cardiovascular_evaluations').select('*').order('evaluated_at', { ascending: false }).limit(50),
  ]);

  if (recordsError) console.warn('Supabase health_records query notice:', recordsError.message);
  if (profileError) console.warn('Supabase astronaut_profiles query notice:', profileError.message);
  if (notificationsError) console.warn('Supabase notifications query notice:', notificationsError.message);
  if (cardioError) console.warn('Supabase cardio_evaluations query notice:', cardioError.message);

  let rawHealth = records;
  if (!rawHealth || !rawHealth.length) {
    try {
      const fallback = await supabase.from('health_records').select('*').limit(100);
      if (fallback.data?.length) rawHealth = fallback.data;
    } catch {}
  }

  const localRecords = (rawHealth || []).map((record) => {
    const rawBpm = record.heart_rate_bpm ?? record.heart_rate ?? record.heartRate ?? record.bpm;
    const rawGlucose = record.glucose_mg_dl ?? record.glucose;
    const rawWeight = record.weight_kg ?? record.weight;
    const rawHeight = record.height_cm ?? record.height;
    const rawPressure = record.blood_pressure_mmhg ?? record.blood_pressure ?? record.pressure ?? (record.systolic_bp && record.diastolic_bp ? `${record.systolic_bp}/${record.diastolic_bp}` : null);

    return {
      id: record.id,
      astronautId: record.astronaut_id || DEMO_CREW_ID,
      date: record.recorded_at || record.created_at || record.date || record.timestamp || new Date().toISOString(),
      heartRate: rawBpm == null ? null : Number(rawBpm),
      pressure: rawPressure,
      glucose: rawGlucose == null ? null : Number(rawGlucose),
      weight: rawWeight == null ? null : Number(rawWeight),
      heightCm: rawHeight == null ? null : Number(rawHeight),
      bmi: record.bmi == null ? null : Number(record.bmi),
      stress: record.stress_level ?? record.stress ?? 'Bajo',
      diabetes: record.diabetes_type ?? record.diabetes ?? null,
      notes: record.notes,
      source: record.source || 'supabase',
    };
  });

  // Si existen evaluaciones cardiovasculares, guardarlas también localmente
  if (cardioEvals?.length) {
    try {
      localStorage.setItem(CARDIO_STORAGE_KEY, JSON.stringify(cardioEvals));
      window.dispatchEvent(new CustomEvent('airstark-cardio-updated', { detail: cardioEvals }));
    } catch {}

    // Si la tabla health_records estaba vacía pero hay evaluaciones cardiovasculares, integrarlas al historial
    if (!localRecords.length) {
      for (const ev of cardioEvals) {
        localRecords.push({
          id: ev.id,
          astronautId: ev.astronaut_id || DEMO_CREW_ID,
          date: ev.evaluated_at || new Date().toISOString(),
          heartRate: ev.heart_rate_bpm == null ? null : Number(ev.heart_rate_bpm),
          pressure: ev.blood_pressure_mmhg || (ev.systolic_bp && ev.diastolic_bp ? `${ev.systolic_bp}/${ev.diastolic_bp}` : null),
          glucose: ev.glucose_mg_dl == null ? null : Number(ev.glucose_mg_dl),
          weight: ev.weight_kg == null ? null : Number(ev.weight_kg),
          heightCm: ev.height_cm == null ? null : Number(ev.height_cm),
          bmi: ev.bmi == null ? null : Number(ev.bmi),
          stress: ev.stress_level || 'Bajo',
          diabetes: ev.diabetes ? 'Sí' : 'No',
          notes: ev.notes,
          source: 'manual',
        });
      }
    }
  }

  return {
    records: localRecords,
    notifications: notifications || [],
    profile: {
      name: profile?.full_name || 'Cmdr. Marcus Vega',
      crewId: profile?.crew_id || DEMO_CREW_ID,
      mission: profile?.mission || 'ISS Expedición 71',
      role: profile?.crew_role || 'Comandante de Expedición',
      userId: DEMO_USER_ID,
      user_id: DEMO_USER_ID,
      isDemo: false,
    },
  };
}

export async function insertCloudRecords(records, crewId) {
  if (!supabase || !records?.length) return;
  const targetCrewId = crewId || DEMO_CREW_ID;
  const rows = records.map((record) => ({
    astronaut_id: targetCrewId,
    recorded_at: record.date,
    heart_rate_bpm: record.heartRate || null,
    blood_pressure_mmhg: record.pressure || null,
    glucose_mg_dl: record.glucose || null,
    weight_kg: record.weight || null,
    height_cm: record.heightCm || null,
    bmi: record.bmi || null,
    stress_level: record.stress || null,
    diabetes_type: record.diabetes || null,
    notes: record.notes || null,
    source: ['manual', 'csv', 'watch', 'demo'].includes(record.source) ? record.source : 'manual',
  }));
  const { error } = await supabase.from('health_records').insert(rows);
  if (error) {
    console.warn('Could not insert health_records in Supabase:', error);
  }
}

export async function saveCloudProfile(profile) {
  const savedProfile = {
    ...profile,
    name: profile.name || 'Cmdr. Marcus Vega',
    crewId: DEMO_CREW_ID,
    mission: profile.mission || 'ISS Expedición 71',
    role: profile.role || 'Comandante de Expedición',
    userId: DEMO_USER_ID,
    user_id: DEMO_USER_ID,
  };

  try {
    localStorage.setItem('airstark.astronautProfile.v1', JSON.stringify(savedProfile));
    window.dispatchEvent(new CustomEvent('airstark-profile-updated', { detail: savedProfile }));
  } catch {}

  if (supabase) {
    try {
      await supabase.from('astronaut_profiles').upsert({
        user_id: DEMO_USER_ID,
        full_name: savedProfile.name,
        crew_id: DEMO_CREW_ID,
        mission: savedProfile.mission,
        crew_role: savedProfile.role,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    } catch (err) {
      console.warn('Could not upsert demo profile in Supabase:', err);
    }
  }

  return savedProfile;
}

export async function getCurrentUserId() {
  return DEMO_USER_ID;
}

export const CARDIO_STORAGE_KEY = 'airstark.cardioEvaluations.v1';

export function getSavedCardioEvaluations() {
  try {
    return JSON.parse(localStorage.getItem(CARDIO_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveCardioEvaluation(evalData) {
  const existing = getSavedCardioEvaluations();
  const next = [evalData, ...existing];
  try {
    localStorage.setItem(CARDIO_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('airstark-cardio-updated', { detail: next }));
  } catch (err) {
    console.warn('Error saving local cardio evaluation:', err);
  }
  return next;
}

export async function insertCardiovascularEvaluation(evalData, crewId) {
  if (!supabase) return null;
  const targetCrewId = crewId || DEMO_CREW_ID;

  let sys = null, dia = null;
  if (evalData.bloodPressure) {
    const parts = String(evalData.bloodPressure).split('/');
    if (parts.length === 2) {
      sys = Number(parts[0].trim()) || null;
      dia = Number(parts[1].trim()) || null;
    }
  }

  const row = {
    user_id: DEMO_USER_ID,
    astronaut_id: targetCrewId,
    evaluated_at: evalData.date || new Date().toISOString(),
    sex: evalData.sex || null,
    age: evalData.age != null && evalData.age !== '' ? Number(evalData.age) : null,
    weight_kg: evalData.weight != null && evalData.weight !== '' ? Number(evalData.weight) : null,
    height_cm: evalData.heightCm != null && evalData.heightCm !== '' ? Number(evalData.heightCm) : null,
    bmi: evalData.bmi != null && evalData.bmi !== '' ? Number(evalData.bmi) : null,
    heart_rate_bpm: evalData.heartRate != null && evalData.heartRate !== '' ? Number(evalData.heartRate) : null,
    blood_pressure_mmhg: evalData.bloodPressure || null,
    systolic_bp: sys,
    diastolic_bp: dia,
    glucose_mg_dl: evalData.glucose != null && evalData.glucose !== '' ? Number(evalData.glucose) : null,
    tot_chol_mg_dl: evalData.totChol != null && evalData.totChol !== '' ? Number(evalData.totChol) : null,
    hdl_c_mg_dl: evalData.hdlc != null && evalData.hdlc !== '' ? Number(evalData.hdlc) : null,
    ldl_c_mg_dl: evalData.ldlc != null && evalData.ldlc !== '' ? Number(evalData.ldlc) : null,
    cur_smoke: evalData.curSmoke === true || evalData.curSmoke === 'si',
    cigs_per_day: evalData.cigsPerDay != null && evalData.cigsPerDay !== '' ? Number(evalData.cigsPerDay) : 0,
    diabetes: evalData.diabetes === true || evalData.diabetes === 'si' || evalData.diabetes === 'tipo1' || evalData.diabetes === 'tipo2',
    bp_meds: evalData.bpMeds === true || evalData.bpMeds === 'si',
    prev_chd: evalData.prevChd === true || evalData.prevChd === 'si',
    prev_ap: evalData.prevAp === true || evalData.prevAp === 'si',
    prev_mi: evalData.prevMi === true || evalData.prevMi === 'si',
    prev_strk: evalData.prevStrk === true || evalData.prevStrk === 'si',
    prev_hyp: evalData.prevHyp === true || evalData.prevHyp === 'si',
    angina: evalData.angina === true || evalData.angina === 'si',
    any_chd: evalData.anyChd === true || evalData.anyChd === 'si',
    stroke: evalData.stroke === true || evalData.stroke === 'si',
    cvd: evalData.cvd === true || evalData.cvd === 'si',
    hyperten: evalData.hyperten === true || evalData.hyperten === 'si',
    stress_level: evalData.stress || null,
    notes: evalData.notes || null,
  };

  try {
    const { data, error } = await supabase.from('cardiovascular_evaluations').insert([row]).select();
    if (error) {
      console.warn('Error insertando en cardiovascular_evaluations:', error);
    }
    return data;
  } catch (err) {
    console.warn('Exception insertando en cardiovascular_evaluations:', err);
    return null;
  }
}
