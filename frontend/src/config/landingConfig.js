/**
 * landingConfig.js
 * -----------------------------------------------------------------------------
 * Single source of truth for all DreamerZ landing-page marketing copy, CTA
 * destinations, social links and analytics event names. Keeping copy here means
 * the section components stay presentational and content edits never touch JSX.
 *
 * Built from dreamerz_landing_page_build_spec_comprehensive.md (v1.0).
 */

/* ── Social + community URLs ───────────────────────────────────────────────
 * The first four mirror backend/services/knowledge_base.py so the Swapna
 * assistant can answer "where can I follow you?". If you change a URL here,
 * update knowledge_base.py too — there is no shared config layer between the
 * React app and the Python backend for marketing URLs.
 *
 * Discord is the DreamerZ community hub (a "join" link, not just a follow).
 * WhatsApp is wired but has no public URL yet — set WHATSAPP_URL to enable it;
 * entries with an empty href are skipped at render time.
 */
export const SOCIAL_URLS = {
  instagram: 'https://www.instagram.com/dreamerz_education_official?igsh=ZzBpdTAxeDA5cndm',
  facebook: 'https://www.facebook.com/share/1B5EWRcpHu/',
  linkedin: 'https://www.linkedin.com/in/dreamer-z-185669413',
  youtube: 'https://youtube.com/@dreamerz-education-official?si=qH7YyBmexXptibDt',
  whatsapp: '', // TODO: add WhatsApp community/contact link when available
};

export const DISCORD_INVITE_URL = 'https://discord.gg/a9d3WVK4g';

/* ── Analytics event names (spec §20) ──────────────────────────────────── */
export const LANDING_EVENTS = {
  startFreeTrial: 'landing_start_free_trial_click',
  exploreCareerPaths: 'landing_explore_career_paths_click',
  teachOnDreamerz: 'landing_teach_on_dreamerz_click',
  kidsFunzone: 'landing_kids_funzone_click',
  supervisorDashboard: 'landing_supervisor_dashboard_click',
  schoolCollegeDemo: 'landing_school_college_demo_click',
  creatorApply: 'landing_creator_apply_click',
  collegeDemo: 'landing_college_demo_click',
  ngoPartner: 'landing_ngo_partner_click',
  sponsorSeats: 'landing_sponsor_seats_click',
  socialInstagram: 'landing_social_instagram_click',
  socialYoutube: 'landing_social_youtube_click',
  socialLinkedin: 'landing_social_linkedin_click',
  socialWhatsapp: 'landing_social_whatsapp_click',
  communityDiscord: 'landing_community_discord_click',
};

/* ── Section anchors (used by the header anchor-scroll links) ───────────── */
export const SECTION_IDS = {
  careerPaths: 'career-paths',
  supervisor: 'supervisor',
  businessAudience: 'business-audience',
  impact: 'impact',
  community: 'community',
  creatorCta: 'creator-cta',
};

export const landingConfig = {
  hero: {
    eyebrow: 'CAREER-FOCUSED AI LEARNING',
    headline: 'Build AI-ready career skills.',
    subheadline:
      "DreamerZ helps students and young adults learn AI tools, communication, coding, and startup skills through practical courses, projects, and creator-led learning.",
    primaryCta: { label: 'Start Free Trial', href: '/register' },
    secondaryCta: { label: 'Explore Career Paths', href: `#${SECTION_IDS.careerPaths}` },
    creatorCta: { label: 'Teach on DreamerZ', href: `#${SECTION_IDS.creatorCta}` },
    kidsFunzoneLink: 'Also explore Kids Funzone for playful early learning →',
    trustLine:
      'For students, creators, supervisors, schools, colleges and training partners preparing for the AI-first job market.',
    cards: [
      { badge: 'Career Path', title: 'AI Career Starter', body: 'Use AI tools safely for study, productivity, presentations and projects.' },
      { badge: 'Portfolio', title: 'AI Builder Path', body: 'Build apps, automations and AI agents with modern AI coding tools.' },
      { badge: 'Job Ready', title: 'Career Communication', body: 'Improve emails, interviews, meetings and professional English.' },
    ],
  },

  outcomes: [
    { title: 'AI Confidence', subtitle: 'Use tools effectively' },
    { title: 'Communication', subtitle: 'Write and speak better' },
    { title: 'Projects', subtitle: 'Build portfolio proof' },
    { title: 'Career Readiness', subtitle: 'Prepare for jobs/startups' },
  ],

  careerPaths: {
    title: 'Focused career learning paths',
    subtitle: 'Three clean offers for go-live. Each path connects learning to practical career outcomes.',
    cards: [
      {
        label: 'For AI beginners',
        title: 'AI Career Starter',
        body: 'Learn ChatGPT, Claude, Gemini, prompt quality, AI safety, productivity and presentation workflows.',
        cta: { label: 'Start AI Career Starter →', href: '/learn' },
      },
      {
        label: 'For tech students',
        title: 'AI Builder Path',
        body: 'Use AI coding tools to build apps, automations, agents, and GitHub-ready portfolio projects.',
        cta: { label: 'Explore AI Builder →', href: '/learn' },
      },
      {
        label: 'For job readiness',
        title: 'Career Communication',
        body: 'Improve official emails, meeting updates, interviews, client English and workplace communication.',
        cta: { label: 'Improve Communication →', href: '/learn' },
      },
    ],
  },

  supervisor: {
    title: 'Manage learners with clarity.',
    body: 'DreamerZ gives supervisors, school teachers, college teachers and mentors a simple dashboard to manage student profiles, assign learning paths, monitor progress and identify who needs support.',
    primaryCta: { label: 'View Supervisor Dashboard', href: '/supervisors/dashboard' },
    secondaryCta: { label: 'Book School/College Demo', href: `#${SECTION_IDS.businessAudience}` },
    pills: ['Student profiles', 'Course assignment', 'Progress tracking', 'Quiz scores', 'Batch view', 'Reports'],
    dashboardRows: [
      { title: 'AI Career Starter', meta: '42 students assigned • 68% average completion', score: '68%' },
      { title: 'Career Communication', meta: '18 project submissions • 7 need review', score: 'Review' },
      { title: 'Learners needing support', meta: 'Quiz score below threshold or inactive for 7 days', score: '5' },
    ],
  },

  businessAudience: {
    title: 'Designed for business outcomes',
    subtitle: 'DreamerZ supports students, supervisors, creators and institutions with measurable learning outcomes.',
    cards: [
      { label: 'Students', title: 'Learn skills that pay back', body: 'Build confidence for internships, interviews, freelancing, college projects and startup ideas.', cta: { label: 'Start learning →', href: '/register' } },
      { label: 'Supervisors', title: 'Manage student progress', body: 'Assign courses, review quiz scores, track projects and support learners through dashboards.', cta: { label: 'View dashboard →', href: '/supervisors/dashboard' } },
      { label: 'Creators', title: 'Turn expertise into courses', body: 'Publish career-focused content, grow your learner audience, and monetize through cohorts or workshops.', cta: { label: 'Apply to teach →', href: `#${SECTION_IDS.creatorCta}` } },
      { label: 'Colleges & Schools', title: 'Bring AI readiness to campus', body: 'Run practical AI and career-skill programs with structured learning outcomes.', cta: { label: 'Book demo →', href: '/supervisors' } },
    ],
  },

  kidsFunzone: {
    label: 'Also available',
    title: 'Kids Funzone',
    body: 'A playful early-learning option with rhymes, phonics, numbers, stories, puzzles and creative activities for parents, teachers and preschool partners.',
    primaryCta: { label: 'Explore Kids Funzone', href: '/learn' },
    secondaryCta: { label: 'Preschool Demo Pack', href: `#${SECTION_IDS.businessAudience}` },
    pills: ['Rhymes', 'Phonics', 'Numbers', 'Stories', 'Puzzles', 'Creativity'],
  },

  impact: {
    label: 'DreamerZ for Impact',
    title: 'Learning access through NGO partnerships',
    body: 'We aim to partner with NGOs and community organisations to make AI, English and digital skills accessible to underserved learners through sponsored seats, workshops and volunteer creator sessions.',
    primaryCta: { label: 'Partner as NGO', href: 'mailto:dreamerz.support@gmail.com?subject=DreamerZ%20for%20Impact%20%E2%80%94%20NGO%20partnership' },
    secondaryCta: { label: 'Sponsor Learner Seats', href: 'mailto:dreamerz.support@gmail.com?subject=DreamerZ%20for%20Impact%20%E2%80%94%20Sponsor%20seats' },
    pills: ['NGO programs', 'Sponsored seats', 'Community workshops', 'Volunteer creators', 'Digital confidence'],
  },

  community: {
    title: 'Stay connected with DreamerZ',
    body: 'Follow short AI tips, student project ideas, creator updates, Kids Funzone activities and impact stories.',
    discord: {
      title: 'Join the DreamerZ Community',
      body: 'Ask questions, share projects, find study partners and get help from creators and mentors on our Discord.',
      cta: { label: 'Join on Discord', href: DISCORD_INVITE_URL },
    },
  },

  creatorUpgrade: {
    creator: {
      title: 'Teach career skills. Build your education business.',
      body: 'DreamerZ gives educators, professionals, and creators a platform to turn expertise into practical courses for AI-curious students and young adults.',
      cta: { label: 'Apply as Creator', href: 'mailto:dreamerz.support@gmail.com?subject=DreamerZ%20Creator%20application' },
    },
    learner: {
      title: 'Start free. Upgrade when ready.',
      body: 'Begin with a free trial, then move learners into focused career paths, project-based courses, certificates, workshops and college programs.',
      cta: { label: 'Start Free Trial', href: '/register' },
    },
  },

  finalCta: {
    title: 'Make DreamerZ the AI career launchpad.',
    subtitle: 'Simple offer. Clear outcomes. Supervisor, creator, college and impact paths for scale.',
    ctas: [
      { label: 'Start Free Trial', href: '/register' },
      { label: 'Explore Career Paths', href: `#${SECTION_IDS.careerPaths}` },
      { label: 'Book Demo', href: `#${SECTION_IDS.businessAudience}` },
    ],
  },
};

export default landingConfig;
