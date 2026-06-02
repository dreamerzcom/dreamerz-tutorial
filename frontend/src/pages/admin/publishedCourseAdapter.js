/**
 * Adapter to convert a published course (from GET /api/content/courses/{id})
 * into the learner-facing tool/sections shape expected by JourneyPlayer.
 *
 * Published course shape:
 *   course = { id, name, description, sections: [{ id, title, lessons: [...] }] }
 *
 * Learner shape:
 *   tool = { id, name, icon, color, xpReward }
 *   sections[*] = { id, title, sort_order, lessons: [{ id, title, level, minutes, content, quiz }] }
 */

export const publishedCourseToLearnerTool = (course) => {
  if (!course) return null;

  const tool = {
    id: course.id,
    name: course.name || 'Untitled Course',
    icon: course.icon || '📚',
    color: course.theme?.color || '#6366f1',
    xpReward: 0, // Preview — no XP
  };

  // Pass sections with nested lessons (hierarchical structure). Preserve
  // module-level media so JourneyPlayer can render the hero infographic
  // video at the top of the module.
  const sections = (course.sections || []).map((section) => ({
    id: section.id,
    db_id: section.db_id,
    title: section.title,
    description: section.description,
    sort_order: section.sort_order,
    lessons: section.lessons || [],
    media_assets: section.media_assets || [],
    hero_video: section.hero_video || null,
  }));

  // Stubbed progress hooks for admin preview
  const isModuleCompleted = () => false;
  const isModuleUnlocked = () => true;
  const getModuleProgress = () => null;
  const completeModule = () => {};

  return {
    tool,
    sections,
    isModuleCompleted,
    isModuleUnlocked,
    getModuleProgress,
    completeModule,
  };
};
