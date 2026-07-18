/**
 * KidsFunzoneCallout — warm, compact secondary callout (spec §11). Not a main
 * pillar; no age group mentioned. Warm orange/cream styling.
 */
import { LandingCta } from './LandingCta';
import { landingConfig, LANDING_EVENTS } from '../../config/landingConfig';

const { kidsFunzone } = landingConfig;

export const KidsFunzoneCallout = () => (
  <section className="bg-white pb-8" aria-label="Kids Funzone">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-7 lg:p-9 grid lg:grid-cols-[1.4fr_0.6fr] gap-6 items-center">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-orange-600 mb-2">
            {kidsFunzone.label}
          </div>
          <h2 className="text-2xl font-bold text-orange-900 mb-2">{kidsFunzone.title}</h2>
          <p className="text-orange-800/90 leading-relaxed mb-5 max-w-2xl">{kidsFunzone.body}</p>
          <div className="flex flex-wrap gap-3">
            <LandingCta
              href={kidsFunzone.primaryCta.href}
              label={kidsFunzone.primaryCta.label}
              event={LANDING_EVENTS.kidsFunzone}
              section="kids_funzone"
              className="rounded-full px-6 py-3 h-auto text-sm font-bold bg-orange-50 text-orange-900 border border-orange-200 hover:bg-orange-100"
            />
            <LandingCta
              href={kidsFunzone.secondaryCta.href}
              label={kidsFunzone.secondaryCta.label}
              event={LANDING_EVENTS.kidsFunzone}
              section="kids_funzone"
              className="rounded-full px-6 py-3 h-auto text-sm font-bold bg-white text-slate-900 border border-slate-200 hover:bg-slate-50"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {kidsFunzone.pills.map((p) => (
            <span
              key={p}
              className="bg-white border border-orange-200 text-orange-900 rounded-full px-3 py-1.5 text-xs font-bold"
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default KidsFunzoneCallout;
