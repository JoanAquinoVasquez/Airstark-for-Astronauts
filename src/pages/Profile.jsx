import { useState } from 'react';
import { AstronautAvatar, PageHeading } from '../components/ui.jsx';
import { getSavedRecords } from '../lib/health.js';
import { astronautInitials, getAstronautProfile, saveAstronautProfile } from '../lib/profile.js';
import { copy, useLanguage } from '../i18n.jsx';

export default function Profile() {
  const { language } = useLanguage();
  const t = copy[language].profile;
  const [profile, setProfile] = useState(getAstronautProfile);
  const [message, setMessage] = useState('');

  function submit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const updated = saveAstronautProfile({
      name: String(formData.get('name') || '').trim(),
      crewId: String(formData.get('crewId') || '').trim().toUpperCase(),
      mission: String(formData.get('mission') || '').trim(),
      role: String(formData.get('role') || '').trim(),
    });
    setProfile(updated);
    setMessage(t.saved);
  }

  const localRecords = getSavedRecords().filter((record) => !record.astronautId || record.astronautId === profile.crewId);
  const roleValue = profile.isDemo ? t.roleDefault : profile.role;

  return <>
    <PageHeading eyebrow={t.eyebrow} title={t.title} description={t.description} action={<span className="profile-mode-tag"><i />{profile.isDemo ? t.demo : t.local}</span>} />
    <section className="profile-layout">
      <article className="panel profile-edit-panel">
        <div className="panel-heading"><div><span className="section-kicker">{t.identity}</span><h2>{t.editTitle}</h2></div></div>
        <form className="profile-form" onSubmit={submit}>
          <label className="field"><span>{t.name} <em>*</em></span><input className="profile-text-input" name="name" type="text" maxLength="80" defaultValue={profile.name} placeholder={t.namePlaceholder} required /></label>
          <label className="field"><span>{t.crewId} <em>*</em></span><input className="profile-text-input" name="crewId" type="text" maxLength="24" defaultValue={profile.crewId} placeholder="A-01" required /></label>
          <label className="field"><span>{t.mission} <em>*</em></span><input className="profile-text-input" name="mission" type="text" maxLength="80" defaultValue={profile.mission} placeholder={t.missionPlaceholder} required /></label>
          <label className="field"><span>{t.role}</span><input className="profile-text-input" name="role" type="text" maxLength="80" defaultValue={roleValue} placeholder={t.rolePlaceholder} /></label>
          <div className="profile-form-footer"><small>{t.localNote}</small><button className="submit-button" type="submit">{t.save} <span>→</span></button></div>
          {message && <div className="form-message" role="status">{message}</div>}
        </form>
      </article>

      <aside className="panel profile-identity-card">
        <div className="profile-avatar-wrap"><div className="profile-avatar-glow" /><AstronautAvatar className="profile-astronaut-icon" label={t.avatarAlt} /><span className="profile-avatar-initials">{astronautInitials(profile.name)}</span></div>
        <span className="profile-card-kicker">{t.crewMember}</span>
        <h2>{profile.name}</h2>
        <div className="profile-id-pill">{profile.crewId}</div>
        <div className="profile-detail-list"><div><span>{t.mission}</span><strong>{profile.mission}</strong></div><div><span>{t.role}</span><strong>{roleValue || '—'}</strong></div><div><span>{t.records}</span><strong>{localRecords.length}</strong></div></div>
        <p className="profile-link-note">{t.linkNote}</p>
      </aside>
    </section>
  </>;
}
