import { Link } from 'react-router-dom';
import { isCardiacScenario } from '../lib/cardiacScenario.js';

export default function CardiacScenarioLink({ scenario, language }) {
  if (!isCardiacScenario(scenario)) return null;
  return <Link className="cardiac-scenario-link" to="/gemelo-3d" state={{ cardiacScenario: scenario }}>
    {language === 'en' ? 'View simulation in 3D' : 'Ver simulación en 3D'}
  </Link>;
}
