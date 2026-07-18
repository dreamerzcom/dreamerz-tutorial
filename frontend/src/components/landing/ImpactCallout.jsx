/**
 * ImpactCallout — DreamerZ for Impact / NGO callout (spec §12). Secondary,
 * lower half of the page. Careful "aim to partner" wording; no overclaimed
 * numbers. Green / mint styling.
 */
import { LandingCta } from './LandingCta';
import { landingConfig, LANDING_EVENTS, SECTION_IDS } from '../../config/landingConfig';

const { impact } = landingConfig;

export const ImpactCallout = () => (
  <section id={SECTION_IDS.impact} className="bg-white pb-12 scroll-mt-20" aria-label="DreamerZ for Impact">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-7 lg:p-9 grid lg:grid-cols-[1.4fr_0.6fr] gap-6 items-center">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-emerald-600 mb-2">
            {impact.label}
          </div>
          <h2 className="text-2xl font-bold text-emerald-900 mb-2">{impact.title}</h2>
          <p className="text-emerald-800/90 leading-relaxed mb-5 max-w-2xl">{impact.body}</p>
          <div className="flex flex-wrap gap-3">
            <LandingCta
              href={impact.primaryCta.href}
              label={impact.primaryCta.label}
              event={LANDING_EVENTS.ngoPartner}
              section="impact"
              audience="ngo"
              className="rounded-full px-6 py-3 h-auto text-sm font-bold bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100"
            />
            <LandingCta
              href={impact.secondaryCta.href}
              label={impact.secondaryCta.label}
              event={LANDING_EVENTS.sponsorSeats}
              section="impact"
              audience="ngo"
              className="rounded-full px-6 py-3 h-auto text-sm font-bold bg-white text-slate-900 border border-slate-200 hover:bg-slate-50"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {impact.pills.map((p) => (
            <span
              key={p}
              className="bg-white border border-emerald-200 text-emerald-900 rounded-full px-3 py-1.5 text-xs font-bold"
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default ImpactCallout;
