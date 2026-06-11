---
name: GlobeLens Intelligence
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#c6c6cd'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#909097'
  outline-variant: '#45464d'
  surface-tint: '#bec6e0'
  primary: '#bec6e0'
  on-primary: '#283044'
  primary-container: '#0f172a'
  on-primary-container: '#798098'
  inverse-primary: '#565e74'
  secondary: '#bcc7de'
  on-secondary: '#263143'
  secondary-container: '#3e495d'
  on-secondary-container: '#aeb9d0'
  tertiary: '#dec29a'
  on-tertiary: '#3e2d11'
  tertiary-container: '#231500'
  on-tertiary-container: '#957d5a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#fcdeb5'
  tertiary-fixed-dim: '#dec29a'
  on-tertiary-fixed: '#271901'
  on-tertiary-fixed-variant: '#574425'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  display-lg:
    fontFamily: Source Serif 4
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-xl:
    fontFamily: Source Serif 4
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
  headline-lg:
    fontFamily: Source Serif 4
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-lg-mobile:
    fontFamily: Source Serif 4
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-data:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-max-width: 1440px
  gutter: 24px
  margin-desktop: 40px
  margin-mobile: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system is built on the narrative of "The Informed Edge." It merges the established credibility of traditional newsrooms with the high-velocity precision of modern data science. The visual direction follows an **Authoritative Editorial** style—prioritizing clarity, density, and intellectual weight.

The aesthetic utilizes **Modern Corporate** structures with a **Glassmorphic** layer for AI-driven insights. It is designed to evoke a sense of calm under pressure, providing users with a high-fidelity environment where complex global events are synthesized into actionable intelligence. The target audience includes analysts, journalists, and policy-makers who require an interface that is both technologically advanced and classically readable.

## Colors

This design system utilizes a "Deep-Sea" dark mode strategy to reduce cognitive load during extended research sessions.

- **Primary & Secondary:** These define the "Iron" and "Slate" surfaces of the application. The primary navy (#0F172A) serves as the base canvas, while the slate (#1E293B) creates architectural separation for cards and sidebars.
- **Electric Accent:** The Electric Blue (#3B82F6) is reserved exclusively for interactive triggers, AI-generated insights, and primary calls to action.
- **Intelligence Semantics:** Color is used as a data-validation tool. **Emerald** indicates high-source reliability, **Amber** denotes emerging or unverified data, and **Rose** marks high-risk or low-trust signals.

## Typography

The typography system creates a "Digital Broadsheet" feel. 

1. **Editorial Headlines:** **Source Serif 4** is used for article titles and primary section headers. It provides the necessary gravitas and readability for long-form intelligence reports.
2. **Interface Navigation:** **Inter** is the workhorse for the UI. It provides high legibility at small sizes for menus, tooltips, and dashboard controls.
3. **Data & AI:** **Geist** is used for reliability scores, timestamps, and AI-generated metadata. Its monospaced characteristics signal "processed data" and "technical accuracy."

Scale usage: Always use `label-caps` for metadata tags (e.g., "LIVE UPDATES" or "SOURCE: REUTERS"). Use `display-lg` only for hero article headers on desktop.

## Layout & Spacing

The design system employs a **Dense Editorial Grid**. This allows for the simultaneous display of global feeds, deep-dive articles, and analytical sidebars without feeling cluttered.

- **Desktop (1200px+):** A 12-column fluid grid. The "Social Flux" sidebar occupies 3 columns on the right, while the primary intelligence feed spans 9 columns.
- **Tablet (768px - 1199px):** The sidebar collapses into a bottom-drawer or a high-level summary view.
- **Mobile (<768px):** A single-column stack. Margins reduce to 16px to maximize reading real estate.

Spacing follows a 4px baseline rhythm. Information-dense components (like data tables) should use `stack-sm`, while editorial content should use `stack-lg` to provide "breathing room."

## Elevation & Depth

Hierarchy in this design system is established through **Tonal Layering** and **Structural Outlines**.

1. **Base Surface:** Darkest navy (#0F172A). Used for the background.
2. **Content Containers:** Raised using the Slate color (#1E293B) with a high-contrast 1px border (#334155). This provides a "blueprint" or "dossier" feel.
3. **Intelligence Overlays:** AI insights and floating tooltips use **Glassmorphism**. They feature a background blur (12px) and a semi-transparent fill (Slate at 70% opacity) to signify they are "meta-layers" existing above the raw data.
4. **Shadows:** Avoid heavy, fuzzy shadows. Use a "Sharp Offset" (2px down, 0px blur) with 40% black for cards to maintain a precise, technical look.

## Shapes

The shape language is **Soft but Geometric**. 

A standard 0.25rem (4px) radius is applied to cards and input fields to maintain a professional, architectural tone. However, **Reliability Badges** and **AI Chips** use a fully rounded "Pill" shape to distinguish them as dynamic, interactive elements. Buttons follow the system standard (0.25rem) to feel sturdy and intentional.

## Components

- **Buttons:** Primary buttons are Solid Electric Blue with white text. Secondary buttons are "Ghost" style (Slate border, transparent background) to minimize visual noise in dense layouts.
- **Reliability Badges:** Small, pill-shaped indicators. They feature a 2px left-accent border in the semantic color (Emerald/Amber/Rose) and a subtle tinted background.
- **Cards:** Dossier-style cards with a 1px border (#334155). On hover, the border color shifts to Electric Blue to indicate interactivity.
- **Social Flux Sidebar:** A vertical feed of micro-updates. Elements here use `body-sm` and `mono-data` typography to maximize vertical density.
- **Input Fields:** Dark background (#0F172A), Slate border, and a subtle inner shadow. Focus states should trigger an Electric Blue outer glow.
- **Intelligence Tooltips:** Glassmorphic containers that appear when hovering over highlighted text or data points, providing AI-driven context.