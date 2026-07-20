# Requirements: Video Generator Microsaas

**Defined:** 2026-04-21
**Core Value:** Users can generate a Sora video and receive it in their history without the platform getting in the way — credits deduct correctly, generation completes reliably, and the video is stored and playable.

## v1 Requirements

Requirements for launch-readiness. Phase 0 is code-complete; v1 is about stabilization and filling the one confirmed gap (video download).

### Authentication

- [x] **AUTH-01**: User can sign up with email and password
- [x] **AUTH-02**: User profile is created automatically after signup (via DB trigger)
- [ ] **AUTH-03**: User can reset password via email link with email content in Spanish
- [x] **AUTH-04**: User session persists across browser refresh
- [x] **AUTH-05**: Unauthenticated users are redirected to login when accessing protected routes

### Credits

- [x] **CRED-01**: User can view current credit balance on dashboard at all times
- [x] **CRED-02**: Credits are deducted from user balance when a video generation is submitted
- [x] **CRED-03**: Credits are refunded to user balance when a video generation fails
- [ ] **CRED-04**: Stripe webhook credit allocation is idempotent — replaying the same webhook event does not double-credit the user
- [ ] **CRED-05**: Credit deduction and refund operations are atomic — partial states (deducted but not recorded, or vice versa) cannot occur
- [x] **CRED-06**: User cannot submit a video generation request if credit balance is insufficient

### Payments

- [x] **PAY-01**: User can purchase a credit pack via Stripe Embedded Checkout without leaving the page
- [x] **PAY-02**: Credits are allocated only after Stripe webhook confirms payment — not optimistically at checkout
- [ ] **PAY-03**: Stripe webhook handler rejects duplicate payment events (idempotency key check)
- [x] **PAY-04**: User can view transaction history showing all credit purchases and deductions

### Video Generation

- [x] **GEN-01**: User can submit a video generation request with a text prompt
- [x] **GEN-02**: User can optionally attach a reference image to a generation request (image-to-video)
- [x] **GEN-03**: User can select from 3 model tiers: sora-2, sora-2-pro, sora-2-pro-HD
- [x] **GEN-04**: User can select from 3 duration options at generation time
- [x] **GEN-05**: User can select from prompt templates to pre-fill the prompt field
- [x] **GEN-06**: Operator-configured prompt prefix is prepended to user prompt before sending to Sora API

### Generation Status

- [x] **STAT-01**: Generation status transitions through pending → processing → completed / failed states
- [x] **STAT-02**: User can see real-time status updates for in-progress generations without refreshing
- [ ] **STAT-03**: OpenAI webhook signature is verified using HMAC before processing any completion event — requests with invalid signatures are rejected with 401
- [ ] **STAT-04**: OpenAI webhook handler is idempotent — replaying the same completion event does not update the video record twice or credit the user twice
- [ ] **STAT-05**: OpenAI webhook handler rejects events with timestamps older than 5 minutes (replay attack prevention)
- [x] **STAT-06**: Generation status shows an estimated time range (e.g., "usually 30–90 seconds") while in processing state

### Video Library

- [x] **VID-01**: User can view a history of all their generated videos on the dashboard
- [x] **VID-02**: User can play back a completed video in-browser via the proxied video route
- [ ] **VID-03**: User can download a completed video to their device via a download button on the video card
- [ ] **VID-04**: Video proxy route (`/api/video/[videoId]/content`) is confirmed working in production and serves the correct video file with appropriate content-type headers
- [x] **VID-05**: Videos are only accessible to the authenticated user who generated them (auth-gated proxy)

### Infrastructure & Security

- [ ] **INFRA-01**: Production environment variables are fully configured (Supabase, Stripe live keys, OpenAI keys, webhook secrets)
- [ ] **INFRA-02**: Supabase RLS policies are verified in production — users cannot read or write other users' data
- [ ] **INFRA-03**: OpenAI webhook route uses raw body parsing (not Next.js default JSON parsing) to preserve HMAC integrity
- [x] **INFRA-04**: Application supports `/es` and `/en` locale-prefixed routing with Spanish as default
- [x] **INFRA-05**: Application renders correctly on mobile viewports (responsive design)
- [x] **INFRA-06**: Application supports dark and light themes

### Error Handling & Logging

- [ ] **ERR-01**: OpenAI API errors (rate limit, model unavailable, content policy rejection) are caught and surfaced to the user with a human-readable message in Spanish/English
- [ ] **ERR-02**: Stripe Checkout errors are caught and surfaced to the user without exposing internal details
- [ ] **ERR-03**: Server-side errors in webhook handlers are logged with sufficient context (video ID, event type, error message) for debugging
- [ ] **ERR-04**: Failed video generation triggers credit refund before returning error to user — no case where generation fails and credits are not returned

## v2 Requirements

Deferred to post-launch. Add once v1 is stable in production.

### Generation UX

- **GENUX-01**: User sees the credit cost of a generation request before submitting (model + duration → credit count displayed)
- **GENUX-02**: User sees a warning when credit balance drops below a configurable threshold (e.g., 10 credits remaining)
- **GENUX-03**: User can view their last N prompts used and re-select one to populate the prompt field
- **GENUX-04**: User can rename a video in their history (assign a custom title)

### Sharing

- **SHARE-01**: User can generate a private, expiring share link for a single video
- **SHARE-02**: Share link recipient can view and play the video without an account
- **SHARE-03**: Share links expire after a configurable duration (e.g., 7 days)

### Reliability Visibility

- **REL-01**: User can see in their video history if a generation is stuck (processing for longer than expected) with an option to contact support
- **REL-02**: Admin can view a list of all webhook delivery failures and retry them manually

### Admin

- **ADMIN-01**: Admin can view aggregated credit usage by model tier
- **ADMIN-02**: Admin can view total revenue and credit pack purchase counts
- **ADMIN-03**: Admin can view per-user generation counts and credit balances

## Out of Scope

| Feature | Reason |
|---------|--------|
| Subscription billing | Requires usage metering, dunning, proration, pause/resume infrastructure; credit packs solve the revenue problem more simply |
| Team / org accounts | Multi-tenancy requires RLS redesign, invitation flows, role management — not worth the complexity at this stage |
| Public video gallery or social feed | Videos are private by user decision; adds GDPR/content moderation overhead; turns product into a platform |
| Video editing (trim, captions, filters) | Different product category; requires FFmpeg or third-party SDK; massive scope expansion |
| Custom domain video embedding / CDN | Videos are served via Supabase proxy; CDN/embed infrastructure is a future concern |
| OAuth social login (Google, GitHub) | Requires Supabase RLS policy audit; email/password creates intentional sign-up friction; add only if conversion data proves friction is a real problem |
| Developer API access | Turns product into a platform; requires API key management, rate limiting, docs; Sora's own API already exists for developers |
| Custom branding / white-label | Multi-tenancy lite with licensing headaches; separate product offering if there's ever demand |
| Real-time progress bar during generation | OpenAI webhook only delivers completion events, not progress; fake progress bar creates wrong expectations |
| Multiple reference images | Sora API does not currently support this; re-evaluate when API evolves |
| Video variations / regenerate | Requires clear credit cost communication and UI — defer until core is stable |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 0 | Complete |
| AUTH-02 | Phase 0 | Complete |
| AUTH-03 | Phase 3 | Pending |
| AUTH-04 | Phase 0 | Complete |
| AUTH-05 | Phase 0 | Complete |
| CRED-01 | Phase 0 | Complete |
| CRED-02 | Phase 0 | Complete |
| CRED-03 | Phase 0 | Complete |
| CRED-04 | Phase 2 | Pending |
| CRED-05 | Phase 2 | Pending |
| CRED-06 | Phase 0 | Complete |
| PAY-01 | Phase 0 | Complete |
| PAY-02 | Phase 0 | Complete |
| PAY-03 | Phase 2 | Pending |
| PAY-04 | Phase 0 | Complete |
| GEN-01 | Phase 0 | Complete |
| GEN-02 | Phase 0 | Complete |
| GEN-03 | Phase 0 | Complete |
| GEN-04 | Phase 0 | Complete |
| GEN-05 | Phase 0 | Complete |
| GEN-06 | Phase 0 | Complete |
| STAT-01 | Phase 0 | Complete |
| STAT-02 | Phase 0 | Complete |
| STAT-03 | Phase 1 | Pending |
| STAT-04 | Phase 1 | Pending |
| STAT-05 | Phase 1 | Pending |
| STAT-06 | Phase 0 | Complete |
| VID-01 | Phase 0 | Complete |
| VID-02 | Phase 0 | Complete |
| VID-03 | Phase 3 | Pending |
| VID-04 | Phase 3 | Pending |
| VID-05 | Phase 0 | Complete |
| INFRA-01 | Phase 3 | Pending |
| INFRA-02 | Phase 3 | Pending |
| INFRA-03 | Phase 0 | Complete |
| INFRA-04 | Phase 0 | Complete |
| INFRA-05 | Phase 0 | Complete |
| INFRA-06 | Phase 0 | Complete |
| ERR-01 | Phase 1 | Pending |
| ERR-02 | Phase 3 | Pending |
| ERR-03 | Phase 1 | Pending |
| ERR-04 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 43 total
- Mapped to phases: 43
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-21*
*Last updated: 2026-04-21 after Phase 0 completion*
