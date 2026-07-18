/**
 * CommunityStrip — slim "stay connected" strip (spec §13) PLUS a dedicated
 * DreamerZ Community space on Discord. Social handles render as small real
 * icons only (no large social cards). The Discord block is visually separated
 * so it reads as a community hub to join, not just another follow link.
 *
 * Social entries with an empty href (e.g. WhatsApp until a URL is set in
 * landingConfig) are skipped automatically.
 */
import { Instagram, Facebook, Linkedin, Youtube } from 'lucide-react';
import { WhatsAppIcon } from '../icons/WhatsAppIcon';
import { DiscordIcon } from '../icons/DiscordIcon';
import { trackCTA } from '../../utils/landing';
import { landingConfig, SOCIAL_URLS, LANDING_EVENTS, SECTION_IDS } from '../../config/landingConfig';

const { community } = landingConfig;

const SOCIALS = [
  { label: 'Instagram', href: SOCIAL_URLS.instagram, Icon: Instagram, event: LANDING_EVENTS.socialInstagram },
  { label: 'YouTube', href: SOCIAL_URLS.youtube, Icon: Youtube, event: LANDING_EVENTS.socialYoutube },
  { label: 'LinkedIn', href: SOCIAL_URLS.linkedin, Icon: Linkedin, event: LANDING_EVENTS.socialLinkedin },
  { label: 'Facebook', href: SOCIAL_URLS.facebook, Icon: Facebook, event: LANDING_EVENTS.socialInstagram },
  { label: 'WhatsApp', href: SOCIAL_URLS.whatsapp, Icon: WhatsAppIcon, event: LANDING_EVENTS.socialWhatsapp },
].filter((s) => s.href);

export const CommunityStrip = () => (
  <section
    id={SECTION_IDS.community}
    className="bg-slate-50 border-y border-slate-100 py-10 scroll-mt-20"
    aria-labelledby="community-title"
  >
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
        {/* Follow us */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="max-w-md">
            <h2 id="community-title" className="text-xl font-bold text-slate-900 mb-1">
              {community.title}
            </h2>
            <p className="text-sm text-slate-500">{community.body}</p>
          </div>
          <div className="flex items-center gap-2.5">
            {SOCIALS.map(({ label, href, Icon, event }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`DreamerZ on ${label}`}
                title={label}
                onClick={() => trackCTA(event, { section: 'community', cta_label: label, destination: href })}
                className="w-9 h-9 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-white hover:bg-indigo-600 hover:border-indigo-600 transition-colors flex items-center justify-center"
              >
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>

        {/* DreamerZ Community on Discord */}
        <div className="lg:max-w-sm rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-5">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#5865F2] text-white flex items-center justify-center">
              <DiscordIcon className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900">{community.discord.title}</h3>
              <p className="text-sm text-slate-500 mt-0.5 mb-3">{community.discord.body}</p>
              <a
                href={community.discord.cta.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackCTA(LANDING_EVENTS.communityDiscord, {
                    section: 'community',
                    cta_label: community.discord.cta.label,
                    destination: community.discord.cta.href,
                  })
                }
                className="inline-flex items-center gap-2 rounded-full bg-[#5865F2] hover:bg-[#4752c4] text-white px-5 py-2.5 text-sm font-bold transition-colors"
              >
                <DiscordIcon className="w-4 h-4" />
                {community.discord.cta.label}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default CommunityStrip;
