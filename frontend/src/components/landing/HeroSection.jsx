/**
 * HeroSection — career-first hero (spec §6). One <h1> only. Left column = copy
 * + three CTAs + Kids Funzone secondary link + trust line. Right column = a
 * clean 3-card visual stack (not a dashboard).
 */
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { LandingCta } from './LandingCta';
import { landingConfig, LANDING_EVENTS } from '../../config/landingConfig';

const { hero } = landingConfig;

export const HeroSection = () => (
  <section className="relative overflow-hidden bg-white pt-28 pb-16 lg:pt-32 lg:pb-20">
    <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-violet-50 pointer-events-none" />
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Copy */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full mb-5 text-xs font-bold tracking-wide border border-indigo-100">
            <Sparkles className="w-3.5 h-3.5" />
            {hero.eyebrow}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.04] tracking-tight mb-5">
            {hero.headline}
          </h1>

          <p className="text-lg text-slate-600 leading-relaxed max-w-xl mb-8">
            {hero.subheadline}
          </p>

          <div className="flex flex-wrap gap-3">
            <LandingCta
              href={hero.primaryCta.href}
              label={hero.primaryCta.label}
              event={LANDING_EVENTS.startFreeTrial}
              section="hero"
              audience="student"
              className="rounded-full px-7 py-3 h-auto text-sm font-bold bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25 hover:opacity-95"
            />
            <LandingCta
              href={hero.secondaryCta.href}
              label={hero.secondaryCta.label}
              event={LANDING_EVENTS.exploreCareerPaths}
              section="hero"
              className="rounded-full px-7 py-3 h-auto text-sm font-bold bg-white text-slate-900 border border-slate-200 hover:bg-slate-50"
            />
            <LandingCta
              href={hero.creatorCta.href}
              label={hero.creatorCta.label}
              event={LANDING_EVENTS.teachOnDreamerz}
              section="hero"
              audience="creator"
              className="rounded-full px-7 py-3 h-auto text-sm font-bold bg-slate-900 text-white hover:bg-slate-800"
            />
          </div>

          <LandingCta
            href={landingConfig.kidsFunzone.primaryCta.href}
            label={hero.kidsFunzoneLink}
            event={LANDING_EVENTS.kidsFunzone}
            section="hero"
            asButton={false}
            className="inline-block mt-6 text-sm font-bold text-orange-700 hover:text-orange-800"
          />

          <p className="mt-5 text-sm text-slate-500 max-w-lg">{hero.trustLine}</p>
        </motion.div>

        {/* Visual card stack */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-violet-50/70 p-5 sm:p-7"
        >
          <div className="space-y-4">
            {hero.cards.map((card) => (
              <div
                key={card.title}
                className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.10)]"
              >
                <span className="inline-block bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-1 text-xs font-bold mb-2">
                  {card.badge}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mb-1">{card.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

export default HeroSection;
