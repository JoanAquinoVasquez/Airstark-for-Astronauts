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
