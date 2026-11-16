import { memo } from 'react';
import { splitAssistantActionPlan } from '../lib/assistantActionPlan.js';
import './assistant-message-content.css';

function renderEmphasis(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    index % 2 ? <strong key={index}>{part.slice(2, -2)}</strong> : part
  );
}

export default memo(function AssistantMessageContent({ text, language }) {
  const plan = splitAssistantActionPlan(text);
  if (!plan) return renderEmphasis(text);

  const summary = plan.intro.match(/^(?:#{1,6}[ \t]+)?(?:\*\*(Resumen|Summary):?\*\*:?|(Resumen|Summary):?)\s+/i);
  const english = language === 'en';

  return (
    <div className="assistant-action-plan">
      {plan.intro && (
        <div className="assistant-plan-intro">
          {summary && <strong className="assistant-plan-summary-title">{summary[1] ?? summary[2]}</strong>}
          {renderEmphasis(summary ? plan.intro.slice(summary[0].length) : plan.intro)}
        </div>
      )}
      <div className="assistant-plan-frame">
        <table>
          <caption>{plan.heading}</caption>
          <thead>
            <tr>
              <th scope="col">{english ? 'Step' : 'Paso'}</th>
              <th scope="col">{english ? 'Action' : 'Acción'}</th>
            </tr>
          </thead>
          <tbody>
            {plan.steps.map((step, index) => (
              <tr key={index}>
                <th scope="row"><span>{index + 1}</span></th>
                <td>{renderEmphasis(step)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {plan.outro && <div className="assistant-plan-outro">{renderEmphasis(plan.outro)}</div>}
    </div>
  );
});
