import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Accept only http(s) URLs (or protocol-relative). Blocks javascript:,
// data:, vbscript:, file:, etc. — any of which would let an AI-emitted
// or admin-authored markdown image/link execute scripts or exfiltrate.
const isSafeUrl = (url) => {
  if (typeof url !== 'string' || !url.trim()) return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('//')) return true;          // protocol-relative
  if (trimmed.startsWith('#') || trimmed.startsWith('/')) return true;
  if (trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) return true;
  try {
    const parsed = new URL(trimmed, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Renders markdown content with themed typography.
 *
 * Variants:
 *  - 'light' (default): dark text on light background — for the "Learn" section
 *  - 'dark':            light text on dark background — for the "Example" block
 *  - 'emerald':         dark text on emerald-tinted background — for "Activity" block
 */
const VARIANT_STYLES = {
  light: {
    text: 'text-slate-700',
    heading: 'text-slate-900',
    link: 'text-primary hover:text-primary/80',
    code: 'bg-slate-100 text-slate-800',
    codeBlock: 'bg-slate-900 text-slate-100',
    blockquote: 'border-slate-300 text-slate-600 bg-slate-50',
    hr: 'border-slate-200',
    tableHeader: 'bg-slate-100 text-slate-900',
    tableCell: 'border-slate-200',
  },
  dark: {
    text: 'text-slate-200',
    heading: 'text-white',
    link: 'text-amber-300 hover:text-amber-200',
    code: 'bg-slate-700 text-amber-200',
    codeBlock: 'bg-black/40 text-slate-100',
    blockquote: 'border-amber-400 text-slate-300 bg-white/5',
    hr: 'border-white/10',
    tableHeader: 'bg-white/10 text-white',
    tableCell: 'border-white/10',
  },
  emerald: {
    text: 'text-slate-700',
    heading: 'text-emerald-900',
    link: 'text-emerald-700 hover:text-emerald-800',
    code: 'bg-white text-emerald-800 border border-emerald-200',
    codeBlock: 'bg-emerald-900 text-emerald-50',
    blockquote: 'border-emerald-400 text-emerald-800 bg-white/60',
    hr: 'border-emerald-200',
    tableHeader: 'bg-emerald-100 text-emerald-900',
    tableCell: 'border-emerald-200',
  },
};

export const MarkdownContent = ({ children, variant = 'light', className = '' }) => {
  const s = VARIANT_STYLES[variant] || VARIANT_STYLES.light;
  const content = typeof children === 'string' ? children : String(children ?? '');

  if (!content.trim()) {
    return <div className={`${s.text} text-sm italic opacity-60`}>No content available.</div>;
  }

  // Block casual copy paths at the component level. CSS in index.css
  // disables text selection; these handlers stop the OS-level events
  // that survive selection (right-click menu, drag-to-desktop, copy
  // shortcut if a selection somehow exists).
  const blockEvent = (e) => {
    e.preventDefault();
    return false;
  };

  return (
    <div
      className={`markdown-body no-copy leading-relaxed text-[15px] ${s.text} ${className}`}
      onCopy={blockEvent}
      onCut={blockEvent}
      onContextMenu={blockEvent}
      onDragStart={blockEvent}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node: _node, ...p }) => <h1 className={`text-2xl font-bold mt-6 mb-3 ${s.heading}`} {...p} />,
          h2: ({ node: _node, ...p }) => <h2 className={`text-xl font-bold mt-6 mb-3 ${s.heading}`} {...p} />,
          h3: ({ node: _node, ...p }) => <h3 className={`text-lg font-semibold mt-5 mb-2 ${s.heading}`} {...p} />,
          h4: ({ node: _node, ...p }) => <h4 className={`text-base font-semibold mt-4 mb-2 ${s.heading}`} {...p} />,
          p: ({ node: _node, ...p }) => <p className="my-3" {...p} />,
          a: ({ node: _node, href, ...p }) => {
            // Drop href if it uses a dangerous scheme (javascript:, data:,
            // vbscript:, file:). The link still renders as text so the
            // user sees something, but it's no longer a vector.
            const safeHref = isSafeUrl(href) ? href : undefined;
            return (
              <a
                href={safeHref}
                className={`underline ${s.link}`}
                target="_blank"
                rel="noopener noreferrer"
                {...p}
              />
            );
          },
          strong: ({ node: _node, ...p }) => <strong className={`font-semibold ${s.heading}`} {...p} />,
          em: ({ node: _node, ...p }) => <em className="italic" {...p} />,
          ul: ({ node: _node, ...p }) => <ul className="list-disc pl-6 my-3 space-y-1.5" {...p} />,
          ol: ({ node: _node, ...p }) => <ol className="list-decimal pl-6 my-3 space-y-1.5" {...p} />,
          li: ({ node: _node, ...p }) => <li className="leading-relaxed" {...p} />,
          blockquote: ({ node: _node, ...p }) => (
            <blockquote className={`border-l-4 ${s.blockquote} pl-4 py-2 my-4 rounded-r-lg italic`} {...p} />
          ),
          hr: ({ node: _node, ...p }) => <hr className={`my-6 border-t ${s.hr}`} {...p} />,
          code: ({ node: _node, inline, className: cn, children: kids, ...p }) => {
            if (inline) {
              return (
                <code className={`px-1.5 py-0.5 rounded text-[0.9em] font-mono ${s.code}`} {...p}>
                  {kids}
                </code>
              );
            }
            return (
              <code className={`block font-mono text-sm ${cn || ''}`} {...p}>
                {kids}
              </code>
            );
          },
          pre: ({ node: _node, ...p }) => (
            <pre className={`rounded-xl p-4 my-4 overflow-x-auto text-sm ${s.codeBlock}`} {...p} />
          ),
          table: ({ node: _node, ...p }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full text-sm border-collapse" {...p} />
            </div>
          ),
          thead: ({ node: _node, ...p }) => <thead className={s.tableHeader} {...p} />,
          th: ({ node: _node, ...p }) => (
            <th className={`border ${s.tableCell} px-3 py-2 text-left font-semibold`} {...p} />
          ),
          td: ({ node: _node, ...p }) => (
            <td className={`border ${s.tableCell} px-3 py-2 align-top`} {...p} />
          ),
          img: ({ node: _node, src, alt, ...p }) => {
            // Refuse non-http(s) image sources — blocks javascript:
            // and data: URI XSS via AI-generated or admin-authored
            // markdown like ![x](javascript:alert(1)) or
            // ![x](data:text/html,<script>...</script>).
            if (!isSafeUrl(src)) return null;
            return (
              <img
                src={src}
                alt={alt || ''}
                className="rounded-lg my-4 max-w-full"
                loading="lazy"
                {...p}
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownContent;
