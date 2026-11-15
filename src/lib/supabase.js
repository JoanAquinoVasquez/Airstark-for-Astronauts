import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && publishableKey ? createClient(url, publishableKey) : null;
export const isSupabaseConfigured = Boolean(supabase);
export const NOTIFICATIONS_STORAGE_KEY = 'airstark.missionNotifications.v1';

export async function loadCloudData() {
  if (!supabase) return;
  const [{ data: records, error: recordsError }, { data: profile, error: profileError }, { data: notifications, error: notificationsError }] = await Promise.all([
    supabase.from('health_records').select('*').order('recorded_at', { ascending: false }),
    supabase.from('astronaut_profiles').select('*').maybeSingle(),
    supabase.from('mission_notifications').select('id,created_at,severity,title,message,read_at').order('created_at', { ascending: false }).limit(20),
  ]);
  if (recordsError) throw recordsError;
  if (profileError) throw profileError;
  if (notificationsError) throw notificationsError;
  const localRecords = (records || []).map((record) => ({
    id: record.id, astronautId: record.astronaut_id, date: record.recorded_at,
    heartRate: record.heart_rate_bpm == null ? null : Number(record.heart_rate_bpm),
    pressure: record.blood_pressure_mmhg, glucose: record.glucose_mg_dl == null ? null : Number(record.glucose_mg_dl),
    weight: record.weight_kg == null ? null : Number(record.weight_kg), heightCm: record.height_cm == null ? null : Number(record.height_cm),
    bmi: record.bmi == null ? null : Number(record.bmi), stress: record.stress_level, diabetes: record.diabetes_type,
    notes: record.notes, source: record.source,
  }));
  return { records: localRecords, notifications: notifications || [], profile: profile && { name: profile.full_name, crewId: profile.crew_id, mission: profile.mission, role: profile.crew_role || '', isDemo: false } };
}

export async function insertCloudRecords(records, crewId) {
  if (!supabase || !records?.length) return;
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) return;
  const { data: profile, error: profileError } = await supabase.from('astronaut_profiles').select('crew_id').eq('crew_id', crewId).maybeSingle();
  if (profileError) throw profileError;
  const rows = records.map((record) => ({
    astronaut_id: profile?.crew_id || null, recorded_at: record.date, heart_rate_bpm: record.heartRate || null,
    blood_pressure_mmhg: record.pressure || null, glucose_mg_dl: record.glucose || null,
    weight_kg: record.weight || null, height_cm: record.heightCm || null, bmi: record.bmi || null,
    stress_level: record.stress || null, diabetes_type: record.diabetes || null, notes: record.notes || null,
    source: ['manual', 'csv', 'watch', 'demo'].includes(record.source) ? record.source : 'manual',
  }));
  const { error } = await supabase.from('health_records').insert(rows);
  if (error) throw error;
}

export async function saveCloudProfile(profile) {
  if (!supabase) return profile;
  const { data: sessionData, error: userError } = await supabase.auth.getSession();
  if (userError) throw userError;
  if (!sessionData.session) return profile;

  const currentUserId = sessionData.session.user.id;
  let targetCrewId = profile.crewId;

  const { error } = await supabase.from('astronaut_profiles').upsert({
    user_id: currentUserId,
    full_name: profile.name,
    crew_id: targetCrewId,
    mission: profile.mission,
    crew_role: profile.role,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  // Si hay conflicto de clave única con crew_id (pertenece a otra sesión/usuario anónimo en la BD)
  if (error && (error.code === '23505' || error.message?.includes('astronaut_profiles_crew_id_key') || error.message?.includes('duplicate key'))) {
    const uniqueSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    targetCrewId = `${profile.crewId.slice(0, 16)}-${uniqueSuffix}`;

    const retry = await supabase.from('astronaut_profiles').upsert({
      user_id: currentUserId,
      full_name: profile.name,
      crew_id: targetCrewId,
      mission: profile.mission,
      crew_role: profile.role,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (retry.error) throw retry.error;

    // Actualizar el perfil local con el nuevo crewId único para evitar desincronizaciones
    const updatedProfile = { ...profile, crewId: targetCrewId };
    try {
      localStorage.setItem('airstark.astronautProfile.v1', JSON.stringify(updatedProfile));
      window.dispatchEvent(new CustomEvent('airstark-profile-updated', { detail: updatedProfile }));
    } catch {
      // ignore storage errors
    }
    return updatedProfile;
  }

  if (error) throw error;
  return profile;
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
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) return null;

  const { data: profile } = await supabase
    .from('astronaut_profiles')
    .select('crew_id')
    .eq('crew_id', crewId)
    .maybeSingle();

  let sys = null, dia = null;
  if (evalData.bloodPressure) {
    const parts = String(evalData.bloodPressure).split('/');
    if (parts.length === 2) {
      sys = Number(parts[0].trim()) || null;
      dia = Number(parts[1].trim()) || null;
    }
  }

  const row = {
    astronaut_id: profile?.crew_id || null,
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

  const { data, error } = await supabase.from('cardiovascular_evaluations').insert([row]).select();
  if (error) {
    console.warn('Error insertando en cardiovascular_evaluations:', error);
    throw error;
  }
  return data;
}
