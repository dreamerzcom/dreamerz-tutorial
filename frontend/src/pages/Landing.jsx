/**
 * Landing — DreamerZ career-first marketing page.
 * Composed from config-driven sections (src/components/landing/*) per the
 * landing build spec. Section order follows spec §3 page hierarchy. The global
 * <Navbar> and <Footer> are rendered by App.js, so they are intentionally not
 * rendered here.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SEO } from '../components/SEO';
import { scrollToSection } from '../utils/landing';
import { HeroSection } from '../components/landing/HeroSection';
import { OutcomeStrip } from '../components/landing/OutcomeStrip';
import { CareerPathsSection } from '../components/landing/CareerPathsSection';
import { SupervisorDashboardSection } from '../components/landing/SupervisorDashboardSection';
import { BusinessAudienceSection } from '../components/landing/BusinessAudienceSection';
import { KidsFunzoneCallout } from '../components/landing/KidsFunzoneCallout';
import { ImpactCallout } from '../components/landing/ImpactCallout';
import { CommunityStrip } from '../components/landing/CommunityStrip';
import { CreatorUpgradeCTA } from '../components/landing/CreatorUpgradeCTA';
import { FinalCTA } from '../components/landing/FinalCTA';

export const Landing = () => {
  const location = useLocation();

  // When the page is opened with a hash (e.g. /home#impact from another route),
  // smooth-scroll to that section once it has mounted.
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1);
      // small delay so the target section is in the DOM before we scroll
      const t = setTimeout(() => scrollToSection(id), 60);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [location.hash]);

  return (
    <>
      <SEO
        title="DreamerZ | AI Career Skills for Students and Young Adults"
        description="DreamerZ helps students and young adults build AI-ready career skills through practical courses, projects, communication training and creator-led learning."
        url="https://www.dreamer-z.com/"
      />

      <main className="min-h-screen bg-white">
        <HeroSection />
        <OutcomeStrip />
        <CareerPathsSection />
        <SupervisorDashboardSection />
        <BusinessAudienceSection />
        <KidsFunzoneCallout />
        <ImpactCallout />
        <CommunityStrip />
        <CreatorUpgradeCTA />
        <FinalCTA />
      </main>
    </>
  );
};

export default Landing;
