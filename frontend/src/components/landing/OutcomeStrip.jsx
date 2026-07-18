/**
 * OutcomeStrip — four outcome items (spec §7). Compact; 4 columns on desktop,
 * 2x2 on mobile. Outcome language, not feature language.
 */
import { landingConfig } from '../../config/landingConfig';

export const OutcomeStrip = () => (
  <section className="bg-white border-y border-slate-100" aria-label="Learner outcomes">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {landingConfig.outcomes.map((o) => (
          <div key={o.title} className="text-center">
            <div className="text-base font-bold text-slate-900">{o.title}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">{o.subtitle}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default OutcomeStrip;
