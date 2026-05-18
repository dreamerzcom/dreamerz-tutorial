/**
 * MediaUploader — direct-to-Cloudinary uploader with progress.
 *
 * Flow:
 *   1) POST /api/admin/media/sign-upload  → backend returns a signed payload
 *   2) Browser POSTs the file directly to Cloudinary using the signature
 *      (with real upload progress via XHR; no traffic through our backend)
 *   3) POST /api/admin/media/register    → backend records a MediaAsset row
 *
 * The render server never sees the bytes, which keeps memory and the 30s
 * request timeout out of the picture even for 200 MB videos.
 */

import { useRef, useState } from 'react';
import { Upload, X, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatErrorDetail } from '../lib/utils';

const API_BASE = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');

const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);
const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

// 'auto' lets Cloudinary detect image vs. video from the file. Force one
// of 'image' / 'video' / 'raw' if you want stricter validation (the backend
// signs with the matching allowed_formats list). Cloudinary requires PDFs
// and office files to go through the raw upload endpoint.
const detectResourceType = (file) => {
  if (!file) return 'auto';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  const ext = (file.name || '').split('.').pop()?.toLowerCase();
  if (DOCUMENT_MIME_TYPES.has(file.type) || DOCUMENT_EXTENSIONS.has(ext)) return 'raw';
  return 'auto';
};

const fetchSignedTicket = async ({ token, resourceType, lessonSlug, tags }) => {
  const res = await fetch(`${API_BASE}/api/admin/media/sign-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      resource_type: resourceType,
      lesson_slug: lessonSlug || undefined,
      tags: tags && tags.length ? tags : undefined,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail = formatErrorDetail(data.detail);
    // Status-specific hints so the user / dev knows what to fix without
    // digging into network tab. 503 is the common one — backend is up but
    // CLOUDINARY_URL isn't set (or the backend was started before .env was
    // updated, in which case restart).
    if (res.status === 401) {
      throw new Error('Your admin session expired. Please sign in again, then retry.');
    }
    if (res.status === 403) {
      throw new Error('You need creator/admin role to upload media.');
    }
    if (res.status === 503) {
      throw new Error(
        detail
          || 'Cloudinary is not configured on the backend. Set CLOUDINARY_URL in backend/.env (or Render env vars) and restart.'
      );
    }
    throw new Error(detail || `Sign-upload failed (${res.status}). Check backend logs.`);
  }
  return res.json();
};

const uploadToCloudinary = (file, ticket, onProgress) => new Promise((resolve, reject) => {
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', ticket.api_key);
  form.append('timestamp', ticket.timestamp);
  form.append('signature', ticket.signature);
  form.append('public_id', ticket.public_id);
  form.append('folder', ticket.folder);
  if (ticket.tags) form.append('tags', ticket.tags);
  if (ticket.allowed_formats) form.append('allowed_formats', ticket.allowed_formats);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', ticket.upload_url);
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
  };
  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      try { resolve(JSON.parse(xhr.responseText)); }
      catch { reject(new Error('Cloudinary returned a malformed response')); }
    } else {
      // Surface Cloudinary's own error message verbatim — these are
      // usually descriptive (e.g. "Invalid Signature", "Resource not
      // allowed by allowed_formats", "File size too large").
      let msg = `Cloudinary upload failed (HTTP ${xhr.status})`;
      try {
        const body = JSON.parse(xhr.responseText);
        if (body?.error?.message) {
          msg = `Cloudinary: ${body.error.message}`;
        }
      } catch { /* response wasn't JSON */ }
      // Log the raw response so the browser console has the full picture.
      // eslint-disable-next-line no-console
      console.error('[MediaUploader] Cloudinary response', xhr.status, xhr.responseText);
      reject(new Error(msg));
    }
  };
  xhr.onerror = () => reject(new Error('Network error reaching Cloudinary. Check your internet connection.'));
  xhr.send(form);
});

const registerAsset = async ({ token, cloudResult, file, lessonSlug, tags, altText }) => {
  const res = await fetch(`${API_BASE}/api/admin/media/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      public_id: cloudResult.public_id,
      secure_url: cloudResult.secure_url,
      resource_type: cloudResult.resource_type,
      format: cloudResult.format,
      bytes: cloudResult.bytes,
      width: cloudResult.width,
      height: cloudResult.height,
      duration: cloudResult.duration,
      original_filename: file.name,
      lesson_slug: lessonSlug || undefined,
      tags: tags && tags.length ? tags : undefined,
      alt_text: altText || undefined,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail = formatErrorDetail(data.detail);
    // The file is already uploaded to Cloudinary at this point — the DB
    // row just couldn't be written. Tell the user so they don't think
    // nothing happened (and so the orphan in Cloudinary is visible).
    throw new Error(
      `${detail || 'Could not record the upload in the database'} `
      + `(the file did land on Cloudinary as ${cloudResult.public_id}; an admin can clean it up).`
    );
  }
  return res.json();
};

export const MediaUploader = ({
  token,
  lessonSlug,
  tags = [],
  resourceType,           // 'image' | 'video' | 'raw' | 'auto' (default: auto-detect from MIME)
  altText,
  accept,                 // file picker accept attribute (e.g. 'image/*,video/*')
  multiple = false,
  onUploaded,             // (asset) => void — fired once per successful upload
  className = '',
  buttonLabel = 'Upload media',
  disabled,
}) => {
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle');  // idle | uploading | done | error
  const [error, setError] = useState('');

  const reset = () => { setProgress(0); setStatus('idle'); setError(''); };

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setError('');

    for (const file of Array.from(files)) {
      setStatus('uploading');
      setProgress(0);
      try {
        const detected = resourceType || detectResourceType(file);
        const ticket = await fetchSignedTicket({ token, resourceType: detected, lessonSlug, tags });

        // Server-side ceiling, surfaced before bytes leave the browser
        if (ticket.max_bytes && file.size > ticket.max_bytes) {
          throw new Error(
            `File is ${(file.size / 1024 / 1024).toFixed(1)} MB; limit is ${(ticket.max_bytes / 1024 / 1024).toFixed(0)} MB`
          );
        }

        const cloudResult = await uploadToCloudinary(file, ticket, setProgress);
        const asset = await registerAsset({ token, cloudResult, file, lessonSlug, tags, altText });

        setStatus('done');
        onUploaded?.(asset);
      } catch (e) {
        setStatus('error');
        setError(e.message || 'Upload failed');
        // Mirror to the browser console so the dev tools have the full
        // stack/context — the in-UI red box only shows the short message.
        // eslint-disable-next-line no-console
        console.error('[MediaUploader] Upload failed for', file?.name, e);
        // Stop processing further files on failure; user re-picks if they want
        break;
      }
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          // Snapshot the FileList into a plain array BEFORE clearing the
          // input value. Per the HTML spec, setting `.value = ''` on a
          // file input also empties the live `.files` FileList — so the
          // previous order (capture reference, clear, hand off) handed
          // `handleFiles` an empty list and the whole upload silently
          // no-op'd. Symptoms: no spinner, no error, no console line,
          // no asset appears. Materialising via Array.from up front
          // makes the reference independent of the input element.
          const files = Array.from(e.target.files || []);
          e.target.value = '';
          if (files.length === 0) return; // picker closed without selecting
          handleFiles(files);
        }}
        disabled={disabled || status === 'uploading'}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || status === 'uploading'}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors w-fit"
      >
        {status === 'uploading' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Upload className="w-4 h-4" />
        )}
        {status === 'uploading' ? `Uploading ${progress}%` : buttonLabel}
      </button>

      {status === 'uploading' && (
        <div className="w-full max-w-sm">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {status === 'done' && (
        <div className="inline-flex items-center gap-1.5 text-emerald-600 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          Uploaded
          <button type="button" onClick={reset} className="ml-2 text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {status === 'error' && error && (
        <div className="inline-flex items-start gap-1.5 text-rose-600 text-sm bg-rose-50 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={reset} className="text-rose-400 hover:text-rose-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default MediaUploader;
