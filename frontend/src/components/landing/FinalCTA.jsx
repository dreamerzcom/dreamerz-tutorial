/**
 * FinalCTA — final conversion band (spec §15). Blue/violet gradient, three CTAs.
 */
import { LandingCta } from './LandingCta';
import { landingConfig, LANDING_EVENTS } from '../../config/landingConfig';

const { finalCta } = landingConfig;

// pair each CTA with its analytics event, in order
const EVENTS = [
  LANDING_EVENTS.startFreeTrial,
  LANDING_EVENTS.exploreCareerPaths,
  LANDING_EVENTS.schoolCollegeDemo,
];

export const FinalCTA = () => (
  <section className="bg-gradient-to-br from-indigo-600 to-violet-600 py-20 text-center" aria-labelledby="final-cta-title">
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 id="final-cta-title" className="text-3xl sm:text-4xl font-bold text-white mb-3">
        {finalCta.title}
      </h2>
      <p className="text-lg text-indigo-100 mb-8">{finalCta.subtitle}</p>
      <div className="flex flex-wrap gap-3 justify-center">
        {finalCta.ctas.map((cta, i) => (
          <LandingCta
            key={cta.label}
            href={cta.href}
            label={cta.label}
            event={EVENTS[i]}
            section="final_cta"
            className={
              i === 0
                ? 'rounded-full px-7 py-3 h-auto text-sm font-bold bg-white text-indigo-700 hover:bg-indigo-50'
                : 'rounded-full px-7 py-3 h-auto text-sm font-bold bg-white/10 text-white border border-white/30 hover:bg-white/20'
            }
          />
        ))}
      </div>
    </div>
  </section>
);

export default FinalCTA;
