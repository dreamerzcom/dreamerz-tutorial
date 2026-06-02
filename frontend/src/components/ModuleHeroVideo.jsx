import { Play } from 'lucide-react';

/**
 * Renders the hero infographic video for a module/lesson — handles both
 * Cloudinary direct uploads (mp4/webm/HLS) and YouTube/Vimeo embeds.
 *
 * Props:
 *  - videoUrl:      primary playback URL (HLS .m3u8, .mp4, YouTube/Vimeo)
 *  - posterUrl:     thumbnail/snapshot URL (Cloudinary derives this at
 *                   upload time; for YouTube it's optional)
 *  - title:         small label rendered above the player
 *  - durationSec:   optional, shown next to the title
 *  - subtitle:      optional second-line label (e.g. "Module introduction")
 *
 * Copy-protection: download is disabled, right-click is blocked. This is
 * deterrence, not DRM — anyone with the URL can still curl it.
 */
const YOUTUBE_HOSTS = ['youtube.com', 'youtu.be', 'www.youtube.com'];
const VIMEO_HOSTS = ['vimeo.com', 'player.vimeo.com'];

const detectKind = (url) => {
  if (!url) return null;
  try {
    const parsed = new URL(url.includes('//') ? url : `https://${url}`);
    if (YOUTUBE_HOSTS.some((h) => parsed.hostname.includes(h))) return 'youtube';
    if (VIMEO_HOSTS.some((h) => parsed.hostname.includes(h))) return 'vimeo';
    // Cloudinary, raw mp4, direct hosting, HLS — render as native <video>.
    return 'native';
  } catch {
    return null;
  }
};

const toYoutubeEmbed = (url) =>
  url.includes('/embed/')
    ? url
    : url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/');

const toVimeoEmbed = (url) => {
  if (url.includes('player.vimeo.com')) return url;
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? `https://player.vimeo.com/video/${m[1]}` : url;
};

const formatDuration = (sec) => {
  if (!sec) return null;
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const ModuleHeroVideo = ({
  videoUrl,
  posterUrl,
  title = 'Module video',
  durationSec,
  subtitle = 'Watch before you start',
}) => {
  if (!videoUrl) return null;

  const kind = detectKind(videoUrl);
  if (!kind) return null;

  const durationLabel = formatDuration(durationSec);

  const blockEvent = (e) => {
    e.preventDefault();
    return false;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
        <Play className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-slate-900 text-sm truncate">{title}</h3>
        {durationLabel ? (
          <span className="text-xs text-slate-400 font-mono">{durationLabel}</span>
        ) : null}
        <span className="ml-auto text-xs text-slate-400 hidden sm:inline">{subtitle}</span>
      </div>

      {kind === 'native' ? (
        <div className="relative w-full bg-black" style={{ aspectRatio: '16 / 9' }}>
          <video
            className="absolute inset-0 w-full h-full"
            src={videoUrl}
            poster={posterUrl || undefined}
            controls
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            playsInline
            preload="metadata"
            onContextMenu={blockEvent}
          />
        </div>
      ) : (
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            className="absolute inset-0 w-full h-full"
            src={kind === 'youtube' ? toYoutubeEmbed(videoUrl) : toVimeoEmbed(videoUrl)}
            title={title}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            frameBorder="0"
          />
        </div>
      )}
    </div>
  );
};

export default ModuleHeroVideo;
