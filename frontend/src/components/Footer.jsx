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

const SUPPORT_EMAIL = 'dreamerz.support@gmail.com';

// Public social handles. Mirrored in backend/services/knowledge_base.py so
// Swapna can answer "where can I follow you?" — if you add/remove or change
// a URL here, update the knowledge base too (there's no shared config layer
// between the React app and the Python backend for marketing URLs).
const SOCIAL_LINKS = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/dreamerz8314',
    Icon: Instagram,
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/share/18gki1kfVd/',
    Icon: Facebook,
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/dreamer-z-185669413',
    Icon: Linkedin,
  },
  {
    label: 'YouTube',
    href: 'https://youtube.com/@dreamerz-m1y',
    Icon: Youtube,
  },
];

export const Footer = () => {
  return (
    <footer className="bg-slate-900 text-slate-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-5 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/home" className="flex items-center gap-2 mb-4">
              <img src="/icons/logo.jpg" alt="DreamerZ" className="w-9 h-9 rounded-xl object-cover" />
              <span className="font-bold text-lg text-white">
                DreamerZ
              </span>
            </Link>
            <p className="text-sm leading-relaxed max-w-md">
              Teaching learners to use AI, responsibly & ethically.
              Learn Prompt Engineering, understand AI tools, and build future-ready skills.
            </p>

            {/* Social handles — opens each in a new tab. rel includes
                noopener+noreferrer so the destination tab can't access
                window.opener (security) or read our Referer (privacy). */}
            <div className="mt-5 flex items-center gap-2.5">
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
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=DreamerZ%20support%20request`}
                  className="hover:text-white transition-colors flex items-center gap-2 break-all"
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
            <Heart className="w-3 h-3 inline text-rose-500" /> for AI & Conversational-English learners.
          </p>
          
          <div className="flex items-center gap-4 text-sm">
            <Link
              to="/supervisors"
              className="text-primary hover:text-primary/80 transition-colors font-medium flex items-center gap-1"
            >
              <Shield className="w-4 h-4" />
              Safety & Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
