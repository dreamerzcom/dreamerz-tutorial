/**
 * SupervisorDashboardSection — managed-learning story for supervisors/teachers
 * (spec §9). Two columns: copy + feature pills + CTAs on the left, a compact
 * 3-row mini dashboard preview on the right (no charts, no full product UI).
 */
import { motion } from 'framer-motion';
import { LandingCta } from './LandingCta';
import { landingConfig, LANDING_EVENTS, SECTION_IDS } from '../../config/landingConfig';

const { supervisor } = landingConfig;

export const SupervisorDashboardSection = () => (
  <section
    id={SECTION_IDS.supervisor}
    className="bg-slate-50 border-y border-slate-100 py-20 scroll-mt-20"
    aria-labelledby="supervisor-title"
  >
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        {/* Copy */}
        <div>
          <h2 id="supervisor-title" className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            {supervisor.title}
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed mb-6">{supervisor.body}</p>

          <div className="flex flex-wrap gap-3 mb-6">
            <LandingCta
              href={supervisor.primaryCta.href}
              label={supervisor.primaryCta.label}
              event={LANDING_EVENTS.supervisorDashboard}
              section="supervisor"
              audience="supervisor"
              className="rounded-full px-6 py-3 h-auto text-sm font-bold bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25 hover:opacity-95"
            />
            <LandingCta
              href={supervisor.secondaryCta.href}
              label={supervisor.secondaryCta.label}
              event={LANDING_EVENTS.schoolCollegeDemo}
              section="supervisor"
              className="rounded-full px-6 py-3 h-auto text-sm font-bold bg-white text-slate-900 border border-slate-200 hover:bg-slate-50"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {supervisor.pills.map((p) => (
              <span
                key={p}
                className="bg-white border border-slate-200 rounded-full px-3 py-1.5 text-xs font-bold text-slate-700"
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        {/* Mini dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white border border-slate-200 rounded-3xl p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]"
          aria-label="Supervisor dashboard preview"
        >
          {supervisor.dashboardRows.map((row, i) => (
            <div
              key={row.title}
              className={`flex items-center justify-between gap-4 py-4 ${
                i < supervisor.dashboardRows.length - 1 ? 'border-b border-slate-100' : ''
              }`}
            >
              <div>
                <div className="font-bold text-slate-900 text-sm">{row.title}</div>
                <div className="text-xs text-slate-500 mt-1">{row.meta}</div>
              </div>
              <div className="flex-shrink-0 font-bold text-indigo-600 bg-indigo-50 rounded-full px-3 py-1.5 text-xs">
                {row.score}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  </section>
);

export default SupervisorDashboardSection;
