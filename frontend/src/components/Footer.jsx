import { Link } from 'react-router-dom';
import {
  Shield,
  Heart,
  Mail,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
} from 'lucide-react';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { DiscordIcon } from './icons/DiscordIcon';
import { SOCIAL_URLS, DISCORD_INVITE_URL } from '../config/landingConfig';

const SUPPORT_EMAIL = 'dreamerz.support@gmail.com';

// Public social handles. URLs live in src/config/landingConfig.js (SOCIAL_URLS)
// and are mirrored in backend/services/knowledge_base.py so Swapna can answer
// "where can I follow you?" — if you add/remove or change a URL, update the
// knowledge base too (there's no shared config layer between the React app and
// the Python backend for marketing URLs). Entries with an empty href (e.g.
// WhatsApp until a URL is set) are filtered out below.
const SOCIAL_LINKS = [
  { label: 'Instagram', href: SOCIAL_URLS.instagram, Icon: Instagram },
  { label: 'Facebook', href: SOCIAL_URLS.facebook, Icon: Facebook },
  { label: 'LinkedIn', href: SOCIAL_URLS.linkedin, Icon: Linkedin },
  { label: 'YouTube', href: SOCIAL_URLS.youtube, Icon: Youtube },
  { label: 'WhatsApp', href: SOCIAL_URLS.whatsapp, Icon: WhatsAppIcon },
].filter((s) => s.href);

// Legal/trust links (spec §16.2). Dedicated /privacy, /terms and /child-safety
// pages are a P1 follow-up; until they exist these point at the supervisor
// safety hub so nothing 404s. Contact is a real mailto.
const LEGAL_LINKS = [
  { label: 'Privacy', to: '/supervisors' },
  { label: 'Terms', to: '/supervisors' },
  { label: 'Child Safety', to: '/supervisors' },
];

export const Footer = () => {
  return (
    <footer className="bg-slate-900 text-slate-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-6 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/home" className="flex items-center gap-2 mb-4">
              <img src="/icons/logo.jpg" alt="DreamerZ" className="w-9 h-9 rounded-xl object-cover" />
              <span className="font-bold text-lg text-white">
                DreamerZ
              </span>
            </Link>
            <p className="text-sm leading-relaxed max-w-md">
              DreamerZ — AI career learning for students and young adults.
              Build AI-ready skills through practical courses, projects and creator-led learning.
            </p>

            {/* Social handles — opens each in a new tab. rel includes
                noopener+noreferrer so the destination tab can't access
                window.opener (security) or read our Referer (privacy). */}
            <div className="mt-5 flex items-center gap-2.5 flex-wrap">
              {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`DreamerZ on ${label}`}
                  title={label}
                  data-testid={`footer-social-${label.toLowerCase()}`}
                  className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-primary text-slate-300 hover:text-white transition-colors flex items-center justify-center"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-white mb-4">Learn</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/learn" className="hover:text-white transition-colors">
                  Explore Courses
                </Link>
              </li>
              <li>
                <Link to="/home#career-paths" className="hover:text-white transition-colors">
                  Career Paths
                </Link>
              </li>
              <li>
                <Link to="/home#business-audience" className="hover:text-white transition-colors">
                  For Colleges
                </Link>
              </li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h3 className="font-semibold text-white mb-4">Community</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href={DISCORD_INVITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="footer-discord"
                  className="hover:text-white transition-colors flex items-center gap-2"
                >
                  <DiscordIcon className="w-4 h-4 text-[#7289da]" />
                  Join our Discord
                </a>
              </li>
              <li>
                <Link to="/home#community" className="hover:text-white transition-colors">
                  Stay connected
                </Link>
              </li>
              <li>
                <Link to="/home#impact" className="hover:text-white transition-colors flex items-center gap-2">
                  <Heart className="w-4 h-4 text-emerald-400" />
                  DreamerZ for Impact
                </Link>
              </li>
            </ul>
          </div>

          {/* Safety */}
          <div>
            <h3 className="font-semibold text-white mb-4">Safety</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/supervisors"
                  className="hover:text-white transition-colors flex items-center gap-2"
                  data-testid="footer-supervisors-link"
                >
                  <Shield className="w-4 h-4 text-primary" />
                  For Supervisor
                </Link>
              </li>
              <li>
                <span className="text-slate-500 text-xs">
                  Safe learning environment
                </span>
              </li>
              <li>
                <span className="text-slate-500 text-xs">
                  No personal data collected
                </span>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-white mb-4">Contact</h3>
            <ul className="space-y-2 text-sm">
              <li>
                {/* mailto: opens the user's default mail client with To: +
                    Subject: pre-filled. whitespace-nowrap + text-xs so the
                    full address renders on one line at every breakpoint. */}
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=DreamerZ%20support%20request`}
                  className="hover:text-white transition-colors flex items-center gap-2 whitespace-nowrap text-xs"
                  data-testid="footer-support-email"
                >
                  <Mail className="w-4 h-4 text-primary flex-shrink-0" />
                  {SUPPORT_EMAIL}
                </a>
              </li>
              <li>
                <span className="text-slate-500 text-xs">
                  We reply within 24 hours
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} DreamerZ. Made with{' '}
            <Heart className="w-3 h-3 inline text-rose-500" /> to dream, learn and LIVE Next Gen Education Process
          </p>

          <div className="flex items-center gap-4 text-sm flex-wrap justify-center">
            {LEGAL_LINKS.map(({ label, to }) => (
              <Link
                key={label}
                to={to}
                className="text-slate-500 hover:text-white transition-colors"
              >
                {label}
              </Link>
            ))}
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=DreamerZ%20support%20request`}
              className="text-slate-500 hover:text-white transition-colors"
            >
              Contact
            </a>
            <Link
              to="/supervisors"
              className="text-primary hover:text-primary/80 transition-colors font-medium flex items-center gap-1"
            >
              <Shield className="w-4 h-4" />
              Safety &amp; Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
