/**
 * CreatorUpgradeCTA — two cards side by side (spec §14): a dark creator card
 * and a light learner-conversion card. Doubles as the "Teach" anchor target.
 */
import { LandingCta } from './LandingCta';
import { landingConfig, LANDING_EVENTS, SECTION_IDS } from '../../config/landingConfig';

const { creatorUpgrade } = landingConfig;

export const CreatorUpgradeCTA = () => (
  <section id={SECTION_IDS.creatorCta} className="bg-white py-16 scroll-mt-20" aria-label="Teach and upgrade">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Creator (dark) */}
        <div className="rounded-3xl bg-slate-900 text-white p-8 lg:p-10 flex flex-col">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 leading-tight">
            {creatorUpgrade.creator.title}
          </h2>
          <p className="text-slate-300 leading-relaxed mb-7 flex-1">{creatorUpgrade.creator.body}</p>
          <div>
            <LandingCta
              href={creatorUpgrade.creator.cta.href}
              label={creatorUpgrade.creator.cta.label}
              event={LANDING_EVENTS.creatorApply}
              section="creator_cta"
              audience="creator"
              className="rounded-full px-7 py-3 h-auto text-sm font-bold bg-white text-slate-900 hover:bg-slate-100"
            />
          </div>
        </div>

        {/* Learner (light) */}
        <div className="rounded-3xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 p-8 lg:p-10 flex flex-col">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3 leading-tight">
            {creatorUpgrade.learner.title}
          </h2>
          <p className="text-slate-600 leading-relaxed mb-7 flex-1">{creatorUpgrade.learner.body}</p>
          <div>
            <LandingCta
              href={creatorUpgrade.learner.cta.href}
              label={creatorUpgrade.learner.cta.label}
              event={LANDING_EVENTS.startFreeTrial}
              section="creator_cta"
              audience="student"
              className="rounded-full px-7 py-3 h-auto text-sm font-bold bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25 hover:opacity-95"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default CreatorUpgradeCTA;
