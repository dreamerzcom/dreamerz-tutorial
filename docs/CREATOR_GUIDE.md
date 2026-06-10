# DreamerZ Platform — Course Creator Guide

> **Who this is for:** Users with the `creator` role (or `admin` role). Creators build, manage, and publish the course catalogue that learners see at `/learn`.

---

## Table of Contents

1. [Access & Permissions](#1-access--permissions)
2. [Getting to the Creator Dashboard](#2-getting-to-the-creator-dashboard)
3. [Course Management](#3-course-management)
4. [Module (Section) Management](#4-module-section-management)
5. [Lesson Management](#5-lesson-management)
6. [Quiz Builder](#6-quiz-builder)
7. [Media Management](#7-media-management)
8. [AI-Assisted Course Creation](#8-ai-assisted-course-creation)
9. [Content Localisation & Translation](#9-content-localisation--translation)
10. [Category Management](#10-category-management)
11. [Learner Preview](#11-learner-preview)
12. [Publishing Workflow](#12-publishing-workflow)
13. [Ownership & Access Control](#13-ownership--access-control)
14. [Course Analytics](#14-course-analytics)
15. [Cloning a Course](#15-cloning-a-course)
16. [Reordering with Drag & Drop](#16-reordering-with-drag--drop)
17. [Manual Grading Queue](#17-manual-grading-queue)
18. [Completion Certificates](#18-completion-certificates)
19. [Announcements](#19-announcements)
20. [Data Fields Reference](#20-data-fields-reference)

---

## 1. Access & Permissions

| Permission | Creator | Admin |
|---|---|---|
| Manage own courses | ✅ | ✅ |
| Manage any course | ✗ | ✅ |
| Access Admin panel (`/admin`) | ✅ (Course Manager tab only) | ✅ (all tabs) |
| AI course generation | ✅ (if `ai_generation_enabled` flag is on) | ✅ always |
| View Users tab | ✗ | ✅ |
| View Platform Stats tab | ✗ | ✅ |
| View **per-course** analytics (own courses) | ✅ | ✅ (any course) |
| Grade short-answer responses, issue certificates, post announcements | ✅ (own courses) | ✅ (any course) |
| Exempt from 30-day learner trial | ✅ | ✅ |

**Important:** The `ai_generation_enabled` flag is a separate toggle set by an admin in User Management. Creators without this flag can still build courses manually but cannot use AI generation.

---

## 2. Getting to the Creator Dashboard

1. Log in with a `creator` account.
2. Click **Admin** in the top navigation bar, or open the user menu and select **Content Management**.
3. You land at `/admin`. The **Course Manager** tab is pre-selected.

---

## 3. Course Management

### 3.1 Creating a Course

Two modes are available from the Course Manager:

| Mode | When to use |
|---|---|
| **Manual** | You already have content and want full structural control |
| **AI-Assisted** | You have a source document (PDF / DOCX / TXT) or want Claude to generate content from a brief |

A new course is always created in **Draft** status and is invisible to learners until you publish it.

### 3.2 Editing Course Metadata

From the course list, click the pencil icon or click into a course to open the editor. You can set:

| Field | Description |
|---|---|
| **Name** | Course title shown in the catalogue |
| **Tagline** | Short description (up to 500 chars) shown on the course card |
| **Description** | Full course description |
| **Category** | Assigned category (e.g. AI Learning, Conversational English) |
| **Difficulty** | `beginner` / `intermediate` / `advanced` |
| **Icon** | URL or uploaded image used as the course icon |
| **Theme colour** | Hex colour used for card accents |
| **Total XP** | XP awarded to learners on course completion |
| **Sort order** | Controls display order in the catalogue |
| **Available languages** | List of language codes the course supports |

### 3.3 Draft vs. Published Courses

- **Draft** — only visible to the creating user and admins. Learners cannot see it.
- **Published** — visible in the learner catalogue at `/learn`.

To edit a published course without affecting live learners, use **Create Draft** — this creates an editable copy. When the draft is ready, re-publish it to overwrite the live version.

### 3.4 Deleting a Course

Deletes the course and all its modules, lessons, quizzes, and media associations. This action is permanent and only available to the course owner or an admin.

---

## 4. Module (Section) Management

Courses are structured as: **Course → Modules → Lessons**

### Creating a Module

Inside the course editor, click **Add Section**. Each module has:

| Field | Description |
|---|---|
| **Title** | Module name shown to learners |
| **Description** | Optional module description |
| **Sort order** | Controls order within the course |
| **Status** | `draft` or `published` |
| **Is active** | Toggle to hide without deleting |

### Reordering Modules

Drag a module by its ⋮⋮ handle in the Builder tab to reorder it (see
[§16](#16-reordering-with-drag--drop)). The `sort_order` field is updated
automatically; lower numbers appear first.

### Deleting a Module

Deleting a module cascades and removes all lessons inside it.

---

## 5. Lesson Management

### Creating a Lesson

Inside a module, click **Add Lesson**. Lesson metadata fields:

| Field | Description |
|---|---|
| **Title** | Lesson name |
| **Description** | Short lesson description |
| **Level** | `beginner` / `intermediate` / `advanced` |
| **Estimated minutes** | Displayed duration estimate |
| **XP reward** | XP granted to learners on completion |
| **Week / Day** | Optional scheduling grouping fields |
| **Is weekly test** | Mark lesson as an assessment lesson |
| **Sort order** | Order within the module |
| **Status** | `draft` or `published` |

### Editing Lesson Content

Each lesson can have rich structured content:

| Field | Description |
|---|---|
| **Explanation** | Main lesson body (supports Markdown) |
| **Example** | Worked example text |
| **Activity** | Practice task for the learner |
| **Bengali tip** | Language-specific tip (optional) |
| **Micro grammar** | Grammar note (optional) |
| **Speaking task** | Conversation / speaking prompt |
| **Vocabulary** | JSON dictionary of terms and definitions |
| **Dialogue** | JSON-structured conversation exercise |
| **Language** | Language code this content belongs to (e.g. `en`, `bn`) |

Lessons support **multi-language content**: you can create separate content records for each language under the same lesson. The learner's preferred language is used to select the right content at runtime.

---

## 6. Quiz Builder

Each lesson can have one quiz attached. Open the **Quiz** tab inside a lesson to build it.

### Quiz Settings

| Field | Description |
|---|---|
| **Title** | Quiz title |
| **Passing score** | Minimum percentage to pass (0–100) |
| **Max attempts** | How many times a learner can retake |
| **Shuffle questions** | Randomise question order for each attempt |
| **Shuffle options** | Randomise answer choices for each question |

### Question Types

| Type | Description |
|---|---|
| `mcq` | Multiple choice — one correct answer |
| `multi-select` | Multiple correct answers can be selected |
| `true-false` | True or False question |
| `short-answer` | Open text response |

### Question Fields

| Field | Description |
|---|---|
| **Question text** | The question prompt |
| **Options** | Array of answer choices |
| **Correct answer** | Index, boolean, or string depending on type |
| **Hint** | Explanatory hint shown on incorrect answer |
| **Feedback** | JSON feedback (can include image references) |
| **Sort order** | Question sequence |

---

## 7. Media Management

Media assets (images, videos, documents, audio) can be attached to lessons or used as quiz question images.

### Uploading Media

Three upload methods are available:

| Method | When to use |
|---|---|
| **Direct upload** (`POST /media/upload`) | Upload files directly from your device |
| **Signed URL upload** (`POST /media/sign-upload`) | Large files — get a Cloudinary signed URL and upload directly to CDN |
| **YouTube link** (`POST /media/youtube`) | Create a video asset from a YouTube URL |

### Supported Asset Types

- `image` — PNG, JPG, WebP, GIF
- `video` — MP4, MOV (processed to adaptive streaming)
- `document` — PDF, DOCX
- `audio` — MP3, WAV

### Media Asset Fields

| Field | Description |
|---|---|
| **Alt text** | Accessibility description for images |
| **Duration** | Auto-detected for video/audio |
| **Poster URL** | Thumbnail image for videos |
| **Sort order** | Order when multiple assets are attached to a lesson |
| **Is highlight** | Marks asset as the hero/featured media |
| **Tags** | e.g. `["quiz-question"]` |

### Attaching Media to Lessons

After uploading, use **Attach** to link an existing asset to a specific lesson. One asset can be attached to multiple lessons.

### Deleting Media

Deletes the asset from Cloudinary and removes all attachment records.

---

## 8. AI-Assisted Course Creation

> **Requires:** `ai_generation_enabled = true` on your account (set by admin).

The AI workflow uses Claude to generate full course content from a source document or topic brief.

### Step-by-Step Workflow

#### Step 1 — Parse a Source Document (optional)

Upload a PDF, DOCX, or TXT file. The system extracts plain text you can use as the AI's input material.

#### Step 2 — Generate a Blueprint

Provide:
- Source text (from step 1 or written manually)
- Desired number of modules
- Desired number of lessons per module
- Writing tone (e.g. friendly, formal, conversational)
- Optional hints or focus areas

Claude generates a full course **blueprint**: a structured JSON outline of modules, lessons, and quiz questions. A draft course record is created in the database at this point.

#### Step 3 — Review and Edit the Blueprint

Before generating content, you can manually edit the blueprint — rename modules, reorder lessons, change quiz questions — without committing to full content generation.

#### Step 4 — Generate Lesson Content

Two options:

| Option | Description |
|---|---|
| **Generate one lesson** | Generate explanation, example, and activity for a single lesson. Optionally enable a "critique" pass where the AI reviews and improves its own output. Custom instructions can be applied per lesson. |
| **Bulk generate all** | Generate all remaining ungenerated lessons in parallel. Optional critique pass applies to every lesson. |

#### Step 5 — Publish the Draft

Once satisfied, **Publish Draft** materialises the blueprint into the full module/lesson/quiz/content database structure and makes the course available for further editing and eventual publication.

### Managing Draft Courses

| Action | Description |
|---|---|
| List drafts | View all your in-progress AI drafts |
| View draft | Inspect blueprint and generation status |
| Edit blueprint | Modify structure before generating content |
| Delete draft | Permanently discard a draft (does not affect published courses) |

---

## 9. Content Localisation & Translation

Courses can support multiple languages. For each lesson you can maintain separate `LessonContent` records per language code.

### Translating a Course

Trigger a full course translation via `POST /courses/{course_id}/translate`. Provide the target language code. The system translates all lesson content (explanation, example, activity, vocabulary, dialogue).

### Checking Translation Status

`GET /courses/{course_id}/translation-status` returns which lessons have content for each language and which are still pending.

### Manual Language Content

Use `PUT /lessons/{lesson_id}/content/{language}` to manually create or update lesson content for a specific language code without using AI translation.

---

## 10. Category Management

Categories group courses in the learner catalogue (e.g. "AI Learning", "Conversational English").

| Action | Description |
|---|---|
| Create category | Add a new category with a name and slug |
| List categories | View all existing categories |
| Delete category | Remove a category (only possible if no courses are assigned to it) |

**Note:** Category display metadata (icon, gradient, description shown in the learner catalogue) is currently defined in frontend code (`CATEGORY_META` in `LearnHub.jsx`). The category slug in the database must match the key in that object for full metadata to appear.

---

## 11. Learner Preview

Before publishing, click **Preview as Learner** on any course. This calls `GET /courses/{course_id}/learner-preview` and renders the course exactly as a learner would see it, including module structure, lesson content, and quizzes — without changing the draft status.

---

## 12. Publishing Workflow

```
Create Course (draft)
        │
        ▼
  Build Modules & Lessons
        │
        ▼
  Add Quizzes & Media
        │
        ▼
  Preview as Learner
        │
        ▼
  Publish → Visible at /learn
        │
        ▼
  (Need to edit a live course?)
        │
        ▼
  Create Draft Version → edit safely → Re-publish
```

**Key rules:**
- Draft courses are invisible to learners.
- Published courses appear immediately in the `/learn` catalogue.
- Creating a draft of a published course lets you edit without disrupting live learners.
- Re-publishing a draft overwrites the live version.

---

## 13. Ownership & Access Control

- **Creators can only modify courses they created.** The `created_by` field (set automatically on creation) is checked on every update and delete.
- **Admins bypass ownership checks** and can modify any course.
- **Draft courses** are only visible to their owner or admins — other creators cannot see your drafts.
- **AI generation drafts** are scoped the same way: only the creating user or an admin can read, edit, or delete them. Ownership violations return a `404` (not `403`) to avoid leaking draft existence.

---

## 14. Course Analytics

Every course now has an **Analytics** tab in the course editor (top of the
course detail view). It is read-only and reflects live learner activity drawn
from enrolment and assessment records — nothing you do here changes content.

| Section | What it shows |
|---|---|
| **KPI cards** | Total enrolments, completion rate, average progress, total learning time, weekly active learners, average quiz score |
| **Lesson completion (drop-off)** | Per-lesson completion rate — quickly spot where learners stall |
| **Enrolments (last 30 days)** | Daily new-enrolment trend line |
| **Quiz performance** | Total attempts, pass rate, count awaiting manual grading, and the **hardest questions** (lowest correct-answer rate, min. 3 answers) |

Endpoint: `GET /admin/courses/{course_id}/analytics`. Visible to the course
owner and admins.

---

## 15. Cloning a Course

The **Clone** button (course header) deep-copies an entire course — modules,
lessons, every language's content, quizzes/questions, and media attachments —
into a **brand-new independent draft** owned by you.

- Differs from **Create Draft**: a clone is *not* linked to a published parent
  and re-publishing it never overwrites another course. Use it to spin up a new
  course from an existing template, or to experiment safely.
- The new course is named `"<original> (Copy)"` and starts in **Draft** status.
- Media assets reference the same Cloudinary files (no re-upload).

Endpoint: `POST /admin/courses/{course_id}/clone`.

---

## 16. Reordering with Drag & Drop

In the **Builder** tab, modules and lessons can be reordered by dragging
(grab the ⋮⋮ handle). On a draft course you can:

- Drag a **module** up or down to change its position.
- Drag a **lesson** within its module, or onto another module to **move it**.

Order is saved automatically. (Published courses are read-only — create a draft
version first.) The manual `sort_order` fields still exist and stay in sync.

Endpoints: `PUT /admin/courses/{course_id}/sections/reorder`,
`PUT /admin/courses/{course_id}/lessons/reorder`.

---

## 17. Manual Grading Queue

Short-answer quiz responses can't be auto-graded. The **Grading** tab lists
every attempt with a short-answer response awaiting a human grade:

1. Read the learner's answer next to the question prompt.
2. Enter a **score** (out of the question's max) and optional per-answer feedback.
3. Add an optional overall feedback note and click **Submit grade**.

Submitting recomputes the attempt's total/percentage, marks it
**teacher-graded**, and sets pass/fail from the quiz's passing score. The graded
attempt then drops off the queue. The Analytics tab's *awaiting grading* count
reflects this queue.

Endpoints: `GET /admin/courses/{course_id}/grading-queue`,
`POST /admin/attempts/{attempt_id}/grade`.

---

## 18. Completion Certificates

Open the **Certificate** tab to enable automatic completion certificates:

- Toggle **Issue a certificate automatically when a learner completes this course**.
- Optionally set a **certificate title** (defaults to “Certificate of Completion — <course>”).

When an enrolled learner finishes every published lesson, a certificate is
issued automatically with a unique **serial**. The tab lists all issued
certificates and lets you **revoke / restore** any of them. Certificates
snapshot the learner name and course name at issue time, so they remain valid
even if the course is later edited.

| Surface | Endpoint |
|---|---|
| Configure | `PUT /admin/courses/{course_id}/certificate` |
| List issued | `GET /admin/courses/{course_id}/certificates` |
| Revoke / restore | `POST /admin/certificates/{serial}/revoke` |
| Learner's own certificates | `GET /certificates/me` |
| Public verification | `GET /certificates/verify/{serial}` (no auth) |

---

## 19. Announcements

The **Announcements** tab lets you post notices to learners enrolled in a
course. Each announcement has a title and body, and can be:

- **Pinned** to the top of the feed.
- Saved as a **draft** (unpublished) or published immediately; drafts are only
  visible to you and admins.

Published announcements appear in the learner's course feed (pinned first, then
newest first). Edit, pin/unpin, publish/unpublish, or delete at any time.

| Surface | Endpoint |
|---|---|
| List (incl. drafts) | `GET /admin/courses/{course_id}/announcements` |
| Create | `POST /admin/courses/{course_id}/announcements` |
| Edit | `PUT /admin/announcements/{announcement_id}` |
| Delete | `DELETE /admin/announcements/{announcement_id}` |
| Learner feed (published only) | `GET /courses/{course_id}/announcements` |

---

## 20. Data Fields Reference

### Course

| Field | Type | Notes |
|---|---|---|
| `name` | string | Required |
| `description` | string | Full description |
| `slug` | string | URL-safe identifier, auto-generated |
| `tagline` | string (≤500) | Card subtitle |
| `icon` | string | Image URL |
| `theme_color` | string | Hex colour |
| `difficulty` | enum | `beginner` / `intermediate` / `advanced` |
| `total_xp` | integer | Completion reward |
| `sort_order` | integer | Catalogue ordering |
| `status` | enum | `draft` / `published` |
| `available_languages` | JSON array | e.g. `["en", "bn"]` |
| `tags` | JSON array | e.g. `["ai-generated"]` |
| `certificate_enabled` | boolean | Auto-issue completion certificates |
| `certificate_title` | string | Optional certificate title |
| `created_by` | string | Auto-set to creator username |

### Module

| Field | Type | Notes |
|---|---|---|
| `title` | string | Required |
| `description` | string | Optional |
| `sort_order` | integer | Order within course |
| `is_active` | boolean | Hide without deleting |
| `status` | enum | `draft` / `published` |

### Lesson

| Field | Type | Notes |
|---|---|---|
| `title` | string | Required |
| `description` | string | Short description |
| `level` | enum | `beginner` / `intermediate` / `advanced` |
| `estimated_minutes` | integer | Duration estimate |
| `xp_reward` | integer | Learner XP on completion |
| `week` | integer | Optional scheduling |
| `day` | integer | Optional scheduling |
| `is_weekly_test` | boolean | Assessment lesson flag |
| `sort_order` | integer | Order within module |
| `status` | enum | `draft` / `published` |

### LessonContent (per language)

| Field | Type | Notes |
|---|---|---|
| `explanation` | text | Main body (Markdown) |
| `example` | text | Worked example |
| `activity` | text | Practice task |
| `bengali_tip` | text | Language-specific tip |
| `micro_grammar` | text | Grammar note |
| `speaking_task` | text | Speaking prompt |
| `vocab` | JSON | Term → definition dictionary |
| `dialogue` | JSON | Structured conversation |
| `language` | string | e.g. `en`, `bn` |
| `status` | enum | `draft` / `published` |

### Quiz

| Field | Type | Notes |
|---|---|---|
| `title` | string | Quiz name |
| `passing_score` | integer | 0–100 |
| `max_attempts` | integer | Retake limit |
| `shuffle_questions` | boolean | Randomise order |
| `shuffle_options` | boolean | Randomise choices |

### QuizQuestion

| Field | Type | Notes |
|---|---|---|
| `question_text` | string | The question |
| `question_type` | enum | `mcq` / `multi-select` / `true-false` / `short-answer` |
| `options` | JSON array | Answer choices |
| `correct_answer` | mixed | Index / bool / string |
| `hint` | string | Shown on wrong answer |
| `feedback` | JSON | Rich feedback (may include images) |
| `sort_order` | integer | Question sequence |

### MediaAsset

| Field | Type | Notes |
|---|---|---|
| `asset_type` | enum | `image` / `video` / `document` / `audio` |
| `cloudinary_url` | string | CDN URL |
| `original_filename` | string | Uploaded filename |
| `alt_text` | string | Accessibility text |
| `duration_seconds` | float | Video/audio length |
| `width` / `height` | integer | Image/video dimensions |
| `poster_url` | string | Video thumbnail |
| `streaming_url` | string | Adaptive streaming URL |
| `upload_status` | enum | `uploading` / `processing` / `ready` / `failed` |
| `sort_order` | integer | Order in lesson |
| `is_highlight` | boolean | Hero media flag |
| `tags` | JSON array | e.g. `["quiz-question"]` |

### Certificate

| Field | Type | Notes |
|---|---|---|
| `serial` | string | Unique, shareable verification token |
| `student_user_id` | integer | Recipient |
| `course_id` | integer | Course completed |
| `student_name_snapshot` | string | Recipient name at issue time |
| `course_name_snapshot` | string | Course name at issue time |
| `title` | string | Certificate title |
| `completion_percent` | numeric | Completion at issue time |
| `average_score` | numeric | Average quiz score (nullable) |
| `revoked` | boolean | Revoked flag |
| `issued_at` | datetime | Issue timestamp |

### Announcement

| Field | Type | Notes |
|---|---|---|
| `course_id` | integer | Owning course |
| `title` | string | Required |
| `body` | text | Required |
| `is_published` | boolean | Drafts hidden from learners |
| `pinned` | boolean | Pin to top of feed |
| `created_by` | string | Author username |
