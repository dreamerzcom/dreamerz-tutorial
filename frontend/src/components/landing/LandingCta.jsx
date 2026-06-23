/**
 * LandingCta — one CTA primitive for the whole landing page.
 * Resolves the config href into the right element and behaviour:
 *   - "#section"  → in-page smooth scroll (or navigate to /home#section first)
 *   - "/route"    → react-router <Link>
 *   - http/mailto → external <a> (new tab for http)
 * Always fires the matching analytics event (spec §20) on click.
 *
 * Pass `asButton` (default true) for a styled shadcn Button, or false for a
 * plain inline link (used by the card "→" links).
 *
 * Auth-aware redirect:
 *   The landing config hard-codes "/register" for Start-Free-Trial CTAs
 *   (correct for visitors). For an ALREADY logged-in user, /register and
 *   /login are nonsensical destinations — they'd bounce off auth gates and
 *   land on the login form. We intercept those two routes and send the
 *   authed user to /learn (the natural product surface) instead. The
 *   analytics event still fires with the ORIGINAL `destination` so we can
 *   see how many logged-in users click trial CTAs.
 */
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../ui/button';
import { resolveHref, scrollToSection, trackCTA } from '../../utils/landing';
import { useAuth } from '../../hooks/useAuth';

// Routes where a logged-in user has no business going. Maps the
// nominal destination → where we actually send them.
const AUTH_REDIRECTS = {
  '/register': '/learn',
  '/login': '/learn',
};

export const LandingCta = ({
  href,
  label,
  event,
  section,
  audience,
  asButton = true,
  className = '',
  buttonProps = {},
  children,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const target = resolveHref(href);
  const content = children || label;

  // Rewrite the destination for logged-in users so they don't bounce
  // back to login/register. The original `href` is preserved in the
  // analytics payload (line ~fire) so destination tracking is honest.
  if (
    target.type === 'route' &&
    isAuthenticated &&
    Object.prototype.hasOwnProperty.call(AUTH_REDIRECTS, target.to)
  ) {
    target.to = AUTH_REDIRECTS[target.to];
  }

  const fire = () =>
    trackCTA(event, { section, cta_label: label, audience, destination: href });

  const onAnchorClick = (e) => {
    e.preventDefault();
    fire();
    const onLanding = location.pathname === '/home' || location.pathname === '/';
    if (onLanding) {
      scrollToSection(target.id);
      // keep the hash in the URL for shareability without a jump
      window.history.replaceState(null, '', `#${target.id}`);
    } else {
      navigate(`/home#${target.id}`);
    }
  };

  // ── In-page anchor ──
  if (target.type === 'anchor') {
    if (asButton) {
      return (
        <Button asChild className={className} {...buttonProps}>
          <a href={`#${target.id}`} onClick={onAnchorClick}>{content}</a>
        </Button>
      );
    }
    return (
      <a href={`#${target.id}`} onClick={onAnchorClick} className={className}>
        {content}
      </a>
    );
  }

  // ── External / mailto ──
  if (target.type === 'external') {
    const isHttp = /^https?:/.test(target.href);
    const extra = isHttp ? { target: '_blank', rel: 'noopener noreferrer' } : {};
    if (asButton) {
      return (
        <Button asChild className={className} {...buttonProps}>
          <a href={target.href} onClick={fire} {...extra}>{content}</a>
        </Button>
      );
    }
    return (
      <a href={target.href} onClick={fire} className={className} {...extra}>
        {content}
      </a>
    );
  }

  // ── Internal route ──
  if (asButton) {
    return (
      <Button asChild className={className} {...buttonProps}>
        <Link to={target.to} onClick={fire}>{content}</Link>
      </Button>
    );
  }
  return (
    <Link to={target.to} onClick={fire} className={className}>
      {content}
    </Link>
  );
};

export default LandingCta;
