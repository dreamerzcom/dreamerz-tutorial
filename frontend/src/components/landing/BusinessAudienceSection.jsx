/**
 * BusinessAudienceSection — the four core business audiences (spec §10):
 * Students, Supervisors, Creators, Colleges & Schools. 4 cols desktop →
 * 2 cols tablet → stacked mobile. Kids Funzone is deliberately excluded.
 */
import { motion } from 'framer-motion';
import { LandingCta } from './LandingCta';
import { landingConfig, LANDING_EVENTS, SECTION_IDS } from '../../config/landingConfig';

const { businessAudience } = landingConfig;

// map each card to its analytics event + audience tag
const META = {
  Students: { event: LANDING_EVENTS.startFreeTrial, audience: 'student' },
  Supervisors: { event: LANDING_EVENTS.supervisorDashboard, audience: 'supervisor' },
  Creators: { event: LANDING_EVENTS.creatorApply, audience: 'creator' },
  'Colleges & Schools': { event: LANDING_EVENTS.collegeDemo, audience: 'institution' },
};

export const BusinessAudienceSection = () => (
  <section
    id={SECTION_IDS.businessAudience}
    className="bg-white py-20 scroll-mt-20"
    aria-labelledby="business-title"
  >
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto text-center mb-12">
        <h2 id="business-title" className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
          {businessAudience.title}
        </h2>
        <p className="text-slate-600 text-lg">{businessAudience.subtitle}</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {businessAudience.cards.map((card, i) => {
          const meta = META[card.label] || { event: LANDING_EVENTS.startFreeTrial };
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col shadow-[0_12px_28px_rgba(15,23,42,0.045)]"
            >
              <div className="text-xs font-bold uppercase tracking-wide text-indigo-600 mb-3">
                {card.label}
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{card.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-5 flex-1">{card.body}</p>
              <LandingCta
                href={card.cta.href}
                label={card.cta.label}
                event={meta.event}
                section="business_audience"
                audience={meta.audience}
                asButton={false}
                className="text-sm font-bold text-indigo-600 hover:text-indigo-700"
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  </section>
);

export default BusinessAudienceSection;
