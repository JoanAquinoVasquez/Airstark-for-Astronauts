import { Link } from 'react-router-dom';
import { hasReportHotspots, isCardiacScenario, selectCardiacReport } from '../lib/cardiacScenario.js';

export default function CardiacScenarioLink({ scenario, interpretability, reportId, language }) {
  const en = language === 'en';
  const hasFindings = hasReportHotspots(interpretability);
  if (!hasFindings && !isCardiacScenario(scenario)) return null;

  const state = hasFindings
    ? { cardiacReportId: reportId }
    : { cardiacScenario: scenario };
  const label = hasFindings
    ? (en ? 'View areas from the report in 3D' : 'Ver zonas del informe en 3D')
    : (en ? 'View simulation in 3D' : 'Ver simulación en 3D');

  return <Link className="cardiac-scenario-link" to="/gemelo-3d" state={state}
    onClick={hasFindings ? () => selectCardiacReport(reportId, interpretability) : undefined}>
    {label}
  </Link>;
}
