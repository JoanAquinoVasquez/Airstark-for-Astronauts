export const PROFILE_STORAGE_KEY = 'airstark.astronautProfile.v1';
export const DEFAULT_PROFILE = Object.freeze({
  name: 'Alex Crew',
  crewId: 'A-01',
  mission: 'Artemis III',
  role: 'Flight crew member',
  isDemo: true,
});

export function getAstronautProfile() {
  try {
    const stored = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || 'null');
    return stored ? { ...DEFAULT_PROFILE, ...stored, isDemo: false } : { ...DEFAULT_PROFILE };
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
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'AC';
}
