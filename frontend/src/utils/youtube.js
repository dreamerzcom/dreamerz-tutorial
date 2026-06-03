/**
 * Normalize any YouTube URL form to one that's safe to use as an
 * <iframe src>. YouTube refuses cross-origin embedding on /watch and
 * /shorts pages via X-Frame-Options; only the /embed/<id> form works.
 *
 * Handles:
 *   - https://www.youtube.com/watch?v=ID
 *   - https://youtu.be/ID
 *   - https://www.youtube.com/shorts/ID   ← the mobile-share default,
 *     which was silently breaking when admins pasted a Shorts link
 *     into the lesson media uploader.
 *   - https://www.youtube.com/embed/ID    ← already correct, pass through.
 *
 * Returns the input unchanged for anything that isn't a recognisable
 * YouTube URL — callers can then handle the fallback (e.g. anchor link).
 */
export const toYoutubeEmbed = (url) => {
  if (!url || typeof url !== 'string') return url;
  if (url.includes('/embed/')) return url;

  if (url.includes('watch?v=')) {
    const id = url.split('watch?v=')[1].split('&')[0];
    return `https://www.youtube.com/embed/${id}`;
  }
  if (url.includes('youtu.be/')) {
    const id = url.split('youtu.be/')[1].split('?')[0].split('/')[0];
    return `https://www.youtube.com/embed/${id}`;
  }
  if (url.includes('/shorts/')) {
    const id = url.split('/shorts/')[1].split('?')[0].split('#')[0].split('/')[0];
    return `https://www.youtube.com/embed/${id}`;
  }
  return url;
};

/** True for any URL we recognise as YouTube — used to pick the iframe
 *  render path over the native <video> path. */
export const isYoutubeUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return url.includes('youtube.com') || url.includes('youtu.be');
};
