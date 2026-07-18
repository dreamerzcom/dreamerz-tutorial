import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, X, BookOpen, Users, User, BarChart3, LogOut, Shield, Clock,
  Compass, GraduationCap, Building2, Heart, Sparkles,
  Instagram, Youtube, Linkedin,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { UserMenu } from './UserMenu';
import { LanguageToggle } from './LanguageToggle';
import { scrollToSection, trackCTA } from '../utils/landing';
import { SOCIAL_URLS, LANDING_EVENTS, SECTION_IDS } from '../config/landingConfig';

// Free-trial countdown chip. Hidden for exempt accounts (admin/creator/
// supervisor get `trialDaysRemaining === null`) and for logged-out users.
// Turns rose-red at ≤3 days, amber at ≤7, slate otherwise; once expired
// it links to /trial-expired so the user can see what to do next.
const TrialBadge = ({ trialDaysRemaining, className = '' }) => {
  if (trialDaysRemaining === null || trialDaysRemaining === undefined) return null;

  const expired = trialDaysRemaining <= 0;
  const tone = expired
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : trialDaysRemaining <= 3
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : trialDaysRemaining <= 7
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-slate-100 text-slate-600 border-slate-200';

  const label = expired
    ? 'Trial ended'
    : `${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'} left in trial`;

  return (
    <Link
      to={expired ? '/trial-expired' : '/learn'}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${tone} ${className}`}
      title={expired ? 'Free trial ended — tap for details' : '30-day free trial'}
      data-testid="nav-trial-badge"
    >
      <Clock className="w-3 h-3" />
      {label}
    </Link>
  );
};

// Marketing nav (spec §5.1). `href` is either a real route ("/learn") or an
// in-page anchor ("#career-paths") that scrolls on the landing page (and
// navigates to /home#anchor from any other route). Six primary links max.
const NAV_LINKS = [
  { label: 'Courses', href: '/learn', icon: BookOpen },
  { label: 'Career Path', href: `#${SECTION_IDS.careerPaths}`, icon: Compass },
  { label: 'Supervisor', href: '/supervisors', icon: Users },
  { label: 'Teach', href: `#${SECTION_IDS.creatorCta}`, icon: GraduationCap },
  { label: 'Colleges', href: `#${SECTION_IDS.businessAudience}`, icon: Building2 },
  { label: 'Impact', href: `#${SECTION_IDS.impact}`, icon: Heart },
];

// Small social cluster for the header (desktop only). Text-link/small-icon
// style per spec §5.3 — no large social cards.
const HEADER_SOCIALS = [
  { label: 'Instagram', href: SOCIAL_URLS.instagram, Icon: Instagram, event: LANDING_EVENTS.socialInstagram },
  { label: 'YouTube', href: SOCIAL_URLS.youtube, Icon: Youtube, event: LANDING_EVENTS.socialYoutube },
  { label: 'LinkedIn', href: SOCIAL_URLS.linkedin, Icon: Linkedin, event: LANDING_EVENTS.socialLinkedin },
].filter((s) => s.href);

const isAnchor = (href) => href.startsWith('#');

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, isCreator, isAdmin, trialDaysRemaining } = useAuth();

  const navLinks = [...NAV_LINKS];
  if (isCreator() || isAdmin()) {
    navLinks.push({ label: 'Admin', href: '/admin', icon: Shield });
  }

  const onLanding = location.pathname === '/home' || location.pathname === '/';

  // Anchor links scroll on the landing page, otherwise route to /home#anchor.
  const handleAnchor = (e, href) => {
    e.preventDefault();
    setIsOpen(false);
    const id = href.slice(1);
    if (onLanding) {
      scrollToSection(id);
      window.history.replaceState(null, '', href);
    } else {
      navigate(`/home${href}`);
    }
  };

  const isRouteActive = (href) =>
    !isAnchor(href) &&
    (location.pathname === href || location.pathname.startsWith(href + '/'));

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100" aria-label="Main navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/home" className="flex items-center gap-2" data-testid="nav-logo">
            <img src="/icons/logo.jpg" alt="DreamerZ" className="w-12 h-12 rounded-xl object-cover" />
            <span className="font-bold text-lg text-slate-900">
              DreamerZ
            </span>
          </Link>

          {/* Desktop Navigation — marketing links */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const active = isRouteActive(link.href);
              const cls = `relative px-3 py-2 rounded-full text-sm font-semibold transition-all duration-200
                ${active ? 'text-primary bg-primary/10' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`;
              return isAnchor(link.href) ? (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => handleAnchor(e, link.href)}
                  data-testid={`nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                  className={cls}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  to={link.href}
                  data-testid={`nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                  className={cls}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right cluster: social + language + trial + auth/CTA */}
          <div className="hidden md:flex items-center gap-2">
            {/* Social (desktop xl+ to keep the bar uncluttered) */}
            <div className="hidden xl:flex items-center gap-1 mr-1">
              {HEADER_SOCIALS.map(({ label, href, Icon, event }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`DreamerZ on ${label}`}
                  title={label}
                  onClick={() => trackCTA(event, { section: 'header', cta_label: label, destination: href })}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-100 transition-colors flex items-center justify-center"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>

            {isAuthenticated && <TrialBadge trialDaysRemaining={trialDaysRemaining} />}
            <LanguageToggle />

            {isAuthenticated ? (
              <UserMenu user={user} onLogout={logout} />
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  onClick={() => trackCTA(LANDING_EVENTS.startFreeTrial, { section: 'header', cta_label: 'Start Free', destination: '/register' })}
                  className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:opacity-95 inline-flex items-center gap-1.5"
                  data-testid="nav-start-free"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Start Free
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
            data-testid="nav-mobile-toggle"
            aria-expanded={isOpen}
            aria-label="Toggle navigation menu"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white border-b border-slate-100 overflow-hidden"
          >
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const active = isRouteActive(link.href);
                const cls = `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors
                  ${active ? 'bg-primary text-white' : 'text-slate-700 hover:bg-slate-100'}`;
                return isAnchor(link.href) ? (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={(e) => handleAnchor(e, link.href)}
                    data-testid={`nav-mobile-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                    className={cls}
                  >
                    <Icon className="w-5 h-5" />
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.label}
                    to={link.href}
                    onClick={() => setIsOpen(false)}
                    data-testid={`nav-mobile-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                    className={cls}
                  >
                    <Icon className="w-5 h-5" />
                    {link.label}
                  </Link>
                );
              })}

              {/* Kids Funzone — present on mobile, de-prioritised on desktop (spec §5.2) */}
              <Link
                to="/learn"
                onClick={() => {
                  trackCTA(LANDING_EVENTS.kidsFunzone, { section: 'mobile_menu', cta_label: 'Kids Funzone', destination: '/learn' });
                  setIsOpen(false);
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-700 hover:bg-slate-100 font-medium"
              >
                <Sparkles className="w-5 h-5 text-orange-500" />
                Kids Funzone
              </Link>

              {/* Language toggle (mobile) */}
              <div className="pt-3 border-t border-slate-100 mt-2 mb-2 px-2">
                <LanguageToggle />
              </div>

              {/* Trial badge (mobile) */}
              {isAuthenticated && trialDaysRemaining !== null && trialDaysRemaining !== undefined && (
                <div className="px-2 pt-3 border-t border-slate-100 mt-2">
                  <TrialBadge trialDaysRemaining={trialDaysRemaining} className="w-full justify-center" />
                </div>
              )}

              {/* Account section */}
              <div className="pt-3 border-t border-slate-100 mt-2 space-y-1">
                {isAuthenticated ? (
                  <>
                    <Link
                      to="/learn/myprogress"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-700 hover:bg-slate-100 font-medium"
                    >
                      <BarChart3 className="w-5 h-5 text-slate-400" />
                      My Progress
                    </Link>
                    <Link
                      to="/account"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-700 hover:bg-slate-100 font-medium"
                    >
                      <User className="w-5 h-5 text-slate-400" />
                      Account
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setIsOpen(false);
                      }}
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-rose-600 hover:bg-rose-50 font-medium"
                    >
                      <LogOut className="w-5 h-5" />
                      Logout
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Link to="/login" onClick={() => setIsOpen(false)}>
                      <button className="w-full border border-slate-200 text-slate-700 px-5 py-3 rounded-xl font-semibold hover:bg-slate-50">
                        Sign in
                      </button>
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => {
                        trackCTA(LANDING_EVENTS.startFreeTrial, { section: 'mobile_menu', cta_label: 'Start Free', destination: '/register' });
                        setIsOpen(false);
                      }}
                    >
                      <button className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-5 py-3 rounded-xl font-bold hover:opacity-95 inline-flex items-center justify-center gap-1.5">
                        <Sparkles className="w-4 h-4" />
                        Start Free
                      </button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
