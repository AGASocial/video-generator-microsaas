# Feature Research

**Domain:** AI Video Generation SaaS (pay-as-you-go, single-user, Sora-backed)
**Researched:** 2026-04-21
**Confidence:** HIGH — project is post-Phase 0, features are observable from codebase and PROJECT.md

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any paid AI generation tool. Missing these = product feels broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Video generation from text prompt | Core product action | LOW (API call) | Built ✓ — 3 models, 3 durations |
| Credit balance visible at all times | Users won't pay if they can't see what they have | LOW | Built ✓ — dashboard header |
| Generation status feedback (pending/processing/done/failed) | Async generation takes 30-120s; users abandon if they can't track progress | MEDIUM | Built ✓ — via Supabase realtime + webhook |
| Credit refund on failed generation | Users won't trust the platform without it | MEDIUM | Built ✓ — refund on failure path |
| Video playback in-browser | Downloading to preview is friction | LOW | Built ✓ — proxied via `/api/video/[videoId]/content` |
| Video history / library | Users return to past work; need to find it | LOW | Built ✓ — dashboard |
| Transaction history | Users need to audit credit spend | LOW | Built ✓ — dashboard |
| Secure payment flow | No one enters card info on an untrusted UI | MEDIUM | Built ✓ — Stripe Embedded Checkout |
| Account creation + login | Obvious | LOW | Built ✓ — Supabase email/password |
| Password reset / account recovery | Mandatory for any paid product | LOW | Needs verification — Supabase handles it but confirm email templates are in Spanish |
| Mobile-responsive UI | High % of SaaS initial visits are mobile | MEDIUM | Built ✓ — responsive design stated |
| Video download | Users want to use their videos outside the platform | LOW | NOT confirmed built — needs explicit download button |

### Differentiators (Competitive Advantage)

Features that set this product apart from Sora's own interface or generic wrappers.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Prompt templates system | Lowers friction for non-technical users who don't know how to write good prompts | LOW | Built ✓ — prompt prefix + template system |
| Configurable prompt prefix | Allows operator to inject style/quality guidance without user friction | LOW | Built ✓ — admin-controlled |
| Spanish-first UX | Competitors (Runway, Kling, Pika) are English-only; underserved market | LOW | Built ✓ — /es default locale |
| Pay-per-use (no subscription) | Lower commitment barrier; good for occasional users and agencies doing one-off projects | LOW | Built ✓ — credit packs |
| Embedded checkout (no redirect) | Lower abandonment vs redirect-based checkout | LOW | Built ✓ — Stripe Embedded |
| 3 model tiers (sora-2, sora-2-pro, sora-2-pro-HD) | Users can choose quality/cost tradeoff | LOW | Built ✓ — model selection at generation time |
| Reference image support | Text-to-video + image-to-video in one product | MEDIUM | Built ✓ — optional reference images |
| Credit pack pricing tiers | Bulk discount incentivizes higher spend per session | LOW | Needs confirmation — is there actual tiered pricing? |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem like good ideas but should be resisted.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Subscription billing | Predictable revenue for operator | Requires usage metering, dunning, proration, pause/resume — all infrastructure that doesn't exist; credit packs already solve the revenue problem more simply | Add a "bulk credit pack" at a discount to simulate subscription value without the complexity |
| Public video gallery / social feed | Builds community, showcases product | Videos are private by user decision; GDPR/content moderation overhead; turns product into a platform which is a different business | Add optional "share link" per video (private link, no gallery) in v1.x |
| Real-time generation progress bar | Users want precise progress | OpenAI webhook only delivers completion events, not progress; building a fake progress bar creates wrong expectations; polling Sora API for progress isn't supported | Show "generating..." spinner with estimated time range (e.g., "usually 30-90 seconds") |
| Video editing (trim, captions, filters) | Users want to polish videos | Completely different product category; would require FFmpeg or third-party video editing SDK; massive scope expansion | Recommend external tools (CapCut, Descript) in the completion UI |
| Team/org accounts | Agencies want shared billing | Multi-tenancy requires RLS redesign, invitation flows, role management — not worth it at this stage | Single account per user; agencies can purchase separate accounts |
| OAuth social login (Google, GitHub) | Convenience | Requires Supabase RLS policy audit; social login users often have weaker intent; email/password creates deliberate sign-up friction that filters serious users | Keep email/password; add Google OAuth only if signup conversion data shows friction is a real problem |
| API access for developers | Power users want to automate | Turns product into a platform; requires API key management, rate limiting, docs — different go-to-market | Not worth building until product has proven demand; Sora's own API already exists for developers |
| Custom branding / white-label | Agencies want to resell | Multi-tenancy lite — same complexity, just scoped to UI customization; licensing headaches | Out of scope; separate product offering if there's demand |

---

## Feature Dependencies

```
[User Account]
    └──requires──> [Auth (Supabase email/password)]

[Video Generation]
    └──requires──> [User Account]
    └──requires──> [Credit Balance > 0]
                       └──requires──> [Credit Purchase]
                                          └──requires──> [Stripe Checkout]
                                                             └──requires──> [Stripe Webhook → Credit Allocation]

[Video Playback]
    └──requires──> [Video Generation Complete]
    └──requires──> [Video Storage (Supabase)]
    └──requires──> [Video Proxy Route (/api/video/[id]/content)]

[Video Download]
    └──requires──> [Video Storage (Supabase)]
    └──requires──> [Video Proxy Route] (or direct signed URL)

[Transaction History]
    └──requires──> [Credit Purchase]
    └──requires──> [Video Generation] (debits appear here)

[Prompt Templates]
    └──enhances──> [Video Generation] (reduces prompt friction)

[Reference Image Upload]
    └──enhances──> [Video Generation] (image-to-video mode)

[Generation Status]
    └──requires──> [OpenAI Webhook → Supabase status update]
    └──enhances──> [Video History] (shows pending/processing state)
```

### Dependency Notes

- **Credit Purchase requires Stripe Webhook:** Credits must not be allocated optimistically at checkout — only after webhook confirms payment. Current implementation is webhook-based, which is correct.
- **Video Playback requires Proxy Route:** Supabase Storage URLs expire; the `/api/video/[videoId]/content` proxy is what makes video URLs permanent and auth-gated. Do not serve direct Supabase URLs.
- **Generation Status requires OpenAI Webhook stability:** The current hot issue. Until webhook verification is stable, the entire completion flow is unreliable. This blocks v1 stability.
- **Prompt Templates enhance (not require) Video Generation:** Templates are a UX improvement; generation works without them. Good for post-stability iteration.

---

## MVP Definition

Phase 0 is code-complete. MVP is not "what to build" — it's "what must be stable before this product can be trusted."

### Launch With (v1) — Stabilization Phase

These are already built but need end-to-end production validation before calling it launch-ready.

- [ ] **OpenAI webhook signature verification** — stable, no fallback hacks; webhook must reject invalid signatures reliably
- [ ] **Credit allocation idempotency** — Stripe webhook replays must not double-credit; OpenAI webhook replays must not double-complete
- [ ] **Video proxy route** — confirmed working in production; signed URL fallback if needed
- [ ] **Credit refund on failure** — confirmed working end-to-end; failed generation returns credits atomically
- [ ] **Password reset flow (Spanish locale)** — confirm Supabase email templates are in Spanish; this is the only recovery path for users
- [ ] **Video download** — basic download button on video card; users will ask immediately after first generation

### Add After Validation (v1.x) — Growth Features

Add once the core is provably stable in production.

- [ ] **Generation cost preview** — show credit cost before user clicks generate (model + duration → credits); reduces surprise and support requests
- [ ] **Prompt history** — show last N prompts used; users iterate on prompts frequently
- [ ] **Video title / rename** — users generate many videos; naming helps them organize
- [ ] **Share link (private, expiring)** — single video share link; no gallery, no social feed; satisfies sharing need without platform complexity
- [ ] **Credit low-balance warning** — notify (in-UI) when balance drops below X credits; reduces generation failures from empty balance
- [ ] **Google OAuth** — only if signup conversion data shows friction is real; requires RLS audit first

### Future Consideration (v2+) — Expansion

Defer until product-market fit is confirmed.

- [ ] **Bulk credit packs with discount** — simulate subscription value at higher price points; only worth building if users are hitting pack limits
- [ ] **Admin dashboard** — credit usage analytics, revenue metrics, model usage breakdown; needed once scale warrants it
- [ ] **Webhook retry visibility** — show in dashboard if a video generation is stuck; gives users recourse without support ticket
- [ ] **Multiple reference images** — Sora API evolution may support this; track API changelog
- [ ] **Video variations** — regenerate from same prompt; useful for iteration but requires clear credit cost communication
- [ ] **n8n automation integration** — the `N8N_WEBHOOK_URL` env var exists; document how to use it for power users

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Webhook signature verification (stable) | HIGH | MEDIUM | P1 |
| Credit allocation idempotency | HIGH | MEDIUM | P1 |
| Video download button | HIGH | LOW | P1 |
| Password reset (Spanish locale) | HIGH | LOW | P1 |
| Generation cost preview (before submit) | MEDIUM | LOW | P2 |
| Credit low-balance warning | MEDIUM | LOW | P2 |
| Prompt history | MEDIUM | LOW | P2 |
| Video title / rename | LOW | LOW | P2 |
| Private share link | MEDIUM | MEDIUM | P2 |
| Google OAuth | LOW | HIGH | P3 |
| Admin analytics dashboard | MEDIUM | HIGH | P3 |
| Bulk/discounted credit packs | MEDIUM | LOW | P3 |
| Webhook retry visibility | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must be stable/built before calling this product launched
- P2: Should add in first month post-launch based on user feedback
- P3: Future milestone; don't build until demand is proven

---

## Competitor Feature Analysis

| Feature | Runway ML | Kling AI | Pika Labs | Our Approach |
|---------|-----------|----------|-----------|--------------|
| Model | Gen-3 Alpha | Kling 1.x | Pika 2.x | Sora-2, Sora-2-pro, Sora-2-pro-HD |
| Pricing | Subscription ($15/mo+) | Credits + subscription | Credits + subscription | Credits only (no subscription) |
| Spanish UI | No | No | No | Yes (primary locale) |
| Prompt templates | No | No | No | Yes (differentiator) |
| Reference images | Yes | Yes | Yes | Yes |
| Video history | Yes | Yes | Yes | Yes |
| Download | Yes | Yes | Yes | Needs explicit confirmation |
| Public gallery | Yes | Yes | Yes | Intentionally absent |
| Team accounts | Yes (paid) | No | Limited | Intentionally absent |
| API access | Yes (paid) | Partial | No | Intentionally absent |
| Mobile responsive | Partial | Yes | Yes | Yes |

**Takeaway:** The competitive gap is (1) Spanish-first UX, (2) pay-as-you-go with no subscription lock-in, and (3) prompt template system. These are the features to protect. Everything else is table stakes.

---

## Sources

- PROJECT.md (primary source — validated requirements, active issues, out-of-scope decisions)
- Competitor product observations: Runway ML, Kling AI, Pika Labs (training data, MEDIUM confidence — verify feature parity at time of launch)
- OpenAI Sora API capabilities: informed by project context (sora-2, sora-2-pro, sora-2-pro-HD model names, webhook completion pattern)

---
*Feature research for: AI Video Generation SaaS (Sora / pay-as-you-go)*
*Researched: 2026-04-21*
