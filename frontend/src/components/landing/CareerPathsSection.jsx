/**
 * CareerPathsSection — the three primary go-live learning paths (spec §8).
 * Dark section to visually differentiate the main learning paths. Exactly three
 * cards; Kids Funzone / future courses are deliberately excluded here.
 */
import { motion } from 'framer-motion';
import { LandingCta } from './LandingCta';
import { landingConfig, LANDING_EVENTS, SECTION_IDS } from '../../config/landingConfig';

const { careerPaths } = landingConfig;

export const CareerPathsSection = () => (
  <section
    id={SECTION_IDS.careerPaths}
    className="bg-slate-950 py-20 scroll-mt-20"
    aria-labelledby="career-paths-title"
  >
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto text-center mb-12">
        <h2 id="career-paths-title" className="text-3xl sm:text-4xl font-bold text-white mb-3">
          {careerPaths.title}
        </h2>
        <p className="text-slate-300 text-lg">{careerPaths.subtitle}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {careerPaths.cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-7 flex flex-col"
          >
            <div className="text-xs font-bold uppercase tracking-wide text-indigo-300 mb-3">
              {card.label}
            </div>
            <h3 className="text-xl font-bold text-white mb-3">{card.title}</h3>
            <p className="text-slate-300 leading-relaxed mb-6 flex-1">{card.body}</p>
            <LandingCta
              href={card.cta.href}
              label={card.cta.label}
              event={LANDING_EVENTS.exploreCareerPaths}
              section="career_paths"
              asButton={false}
              className="text-sm font-bold text-indigo-300 hover:text-indigo-200"
            />
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default CareerPathsSection;
