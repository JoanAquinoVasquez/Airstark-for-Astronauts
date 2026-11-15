export const PROFILE_STORAGE_KEY = 'airstark.astronautProfile.v1';
export const DEMO_USER_ID = '845cc4fa-fac4-413d-a0ce-5947e808546a';
export const DEMO_CREW_ID = 'A-9K21-YCXQ';

export const DEFAULT_PROFILE = Object.freeze({
  name: 'Cmdr. Marcus Vega',
  crewId: DEMO_CREW_ID,
  mission: 'ISS Expedición 71',
  role: 'Comandante de Expedición',
  userId: DEMO_USER_ID,
  user_id: DEMO_USER_ID,
  isDemo: true,
});

export function getAstronautProfile() {
  try {
    const stored = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || 'null');
    return stored
      ? { ...DEFAULT_PROFILE, ...stored, userId: DEMO_USER_ID, user_id: DEMO_USER_ID, crewId: DEMO_CREW_ID, isDemo: false }
      : { ...DEFAULT_PROFILE };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveAstronautProfile(profile) {
  const value = { ...profile, isDemo: false, updatedAt: new Date().toISOString() };
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('airstark-profile-updated', { detail: value }));
  return value;
}

export function astronautInitials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'MV';
}
