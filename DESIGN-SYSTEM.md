# Zoe — Design System Specification

## Design Philosophy

**Professional with a fun element.** Think Mailchimp meets Linear.

Mailchimp nails this balance: the product is serious (email marketing for businesses) but the personality is warm, witty, and human. Freddie the chimp winks at you. Copy is conversational. Illustrations are playful. But the UI itself is clean, spacious, and scannable.

Zoe follows the same pattern:

- **The chrome (UI structure) is professional:** clean typography, generous whitespace, clear hierarchy, no visual noise
- **The personality (content, illustrations, micro-interactions) is warm and fun:** Zoe "speaks" with confidence and gentle humor, progress feels rewarding, empty states are delightful
- **The data (dashboards, scores, lists) is crisp and scannable:** no decoration for decoration's sake

## Brand Identity

### Name & Voice

**Zoe** — short, human, easy to remember. Pronounced "ZO-ee."

**Voice attributes:**

- Confident but not bossy ("You have 2h of real time today" not "WARNING: You are overbooked")
- Direct and specific ("Prepare for Roadmap Sync — 25m" not "You might want to get ready for your meeting")
- Gently humorous when appropriate ("Zero open loops. That never happens." or "You survived Thursday.")
- Never condescending, never corporate

### Color System

**Foundation: Warm neutrals + one bold accent**

```css
/* Primary — Zoe's signature color. Energetic but professional. */
--color-primary: #6c5ce7; /* Electric violet — stands out without screaming */
--color-primary-light: #a29bfe;
--color-primary-dark: #4a3db5;
--color-primary-subtle: #f0eeff;

/* Secondary — Warm complement for CTAs and highlights */
--color-secondary: #ff6b6b; /* Coral — friendly, warm, attention-grabbing */
--color-secondary-light: #ffa8a8;
--color-secondary-subtle: #fff0f0;

/* Accent — For success states and positive signals */
--color-accent: #00b894; /* Teal green — calm, positive */
--color-accent-light: #55efc4;
--color-accent-subtle: #eafff8;

/* Scoring colors — used for activity scores and urgency */
--color-score-high: #ff6b6b; /* Coral — urgent */
--color-score-medium: #fdcb6e; /* Amber — important */
--color-score-low: #00b894; /* Teal — can wait */

/* Neutrals — warm undertone, not cold gray */
--color-surface: #ffffff;
--color-surface-secondary: #fafafa;
--color-surface-tertiary: #f5f3ff; /* Hint of violet */
--color-border: #e8e4f0;
--color-border-light: #f0edf5;
--color-text-primary: #2d2b3a; /* Dark violet-gray, not pure black */
--color-text-secondary: #6b6880;
--color-text-tertiary: #a09dae;
--color-text-inverse: #ffffff;

/* Dark mode (future — design tokens support it from day one) */
--color-dark-surface: #1a1825;
--color-dark-surface-secondary: #242236;
--color-dark-border: #3a3750;
--color-dark-text-primary: #f0edf5;
--color-dark-text-secondary: #a09dae;
```

**Why these colors:**

- Violet is distinctive in a market of blue productivity tools (Notion, Linear, Slack)
- Coral adds warmth and friendliness (Mailchimp energy)
- Teal provides positive/success contrast
- Warm neutrals prevent the "sterile SaaS" feel

### Typography

```css
/* Primary — for body text and UI */
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;

/* Display — for headings and large text (adds personality) */
--font-display: 'Satoshi', 'Inter', system-ui, sans-serif;

/* Mono — for scores, stats, and code-like elements */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* Scale */
--text-xs: 0.75rem; /* 12px — captions, labels */
--text-sm: 0.875rem; /* 14px — secondary text */
--text-base: 1rem; /* 16px — body */
--text-lg: 1.125rem; /* 18px — large body */
--text-xl: 1.25rem; /* 20px — section headers */
--text-2xl: 1.5rem; /* 24px — page headers */
--text-3xl: 1.875rem; /* 30px — hero text */
--text-4xl: 2.25rem; /* 36px — display */

/* Weight */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;

/* Line height */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
```

### Spacing

```css
/* 4px base grid */
--space-1: 0.25rem; /* 4px */
--space-2: 0.5rem; /* 8px */
--space-3: 0.75rem; /* 12px */
--space-4: 1rem; /* 16px */
--space-5: 1.25rem; /* 20px */
--space-6: 1.5rem; /* 24px */
--space-8: 2rem; /* 32px */
--space-10: 2.5rem; /* 40px */
--space-12: 3rem; /* 48px */
--space-16: 4rem; /* 64px */
```

### Border Radius

```css
--radius-sm: 6px; /* Buttons, inputs */
--radius-md: 8px; /* Cards, panels */
--radius-lg: 12px; /* Modals, large containers */
--radius-xl: 16px; /* Feature cards */
--radius-full: 9999px; /* Pills, avatars */
```

### Shadows

```css
/* Soft, warm shadows — not harsh drop shadows */
--shadow-sm: 0 1px 2px rgba(45, 43, 58, 0.05);
--shadow-md: 0 4px 12px rgba(45, 43, 58, 0.08);
--shadow-lg: 0 8px 24px rgba(45, 43, 58, 0.12);
--shadow-xl: 0 16px 48px rgba(45, 43, 58, 0.16);

/* Colored shadow for primary elements (Mailchimp-style pop) */
--shadow-primary: 0 4px 14px rgba(108, 92, 231, 0.25);
```

## Component Patterns

### shadcn/ui Setup

Initialize with: `npx shadcn@latest init`

**Theme configuration:**

- Style: Default (we'll customize via CSS variables)
- Base color: Violet (custom palette above)
- CSS variables: Yes
- Tailwind prefix: None

### Component Inventory (MVP)

**Tier 1 — Install on day one:**

- Button (primary, secondary, ghost, destructive variants)
- Card (for activity cards, meeting cards, metric cards)
- Input, Textarea, Select
- Dialog (for confirmations)
- Sheet (for mobile nav, detail panels)
- Avatar (for participants, senders)
- Badge (for horizon tags: NOW, SOON, STRATEGIC)
- Tooltip
- Separator
- Skeleton (loading states)

**Tier 2 — Install when needed:**

- Command (for Zoe Chat input)
- Dropdown Menu (for activity actions)
- Popover (for date pickers, quick actions)
- Tabs (for dashboard sections)
- Toast (via Sonner — for "Priorities updated" notifications)
- ScrollArea (for chat messages, activity list)
- Progress (for scores, metrics)

### Custom Components

#### Score Badge

```
┌──────────┐
│  91      │  ← Score number in mono font
│  HIGH    │  ← Urgency label
└──────────┘
```

Color-coded: coral (>80), amber (50-80), teal (<50). Compact pill shape.

#### Activity Card (Dominant)

```
┌─────────────────────────────────────────────┐
│  ┌──┐                                        │
│  │91│  Prepare for 3pm Roadmap Sync          │
│  └──┘  25m  ·  NOW  ·  Before 3pm meeting    │
│                                               │
│  • High decision density                      │
│  • You are the organizer                      │
│  • 2 unresolved Slack threads                 │
│                                               │
│  [Start Now]  [Block Time]  [Generate Brief]  │
└─────────────────────────────────────────────┘
```

Elevated card with primary shadow. Score badge left-aligned. Action buttons right-aligned.

#### Activity Card (List Item)

```
┌─────────────────────────────────────────────┐
│  82  Resolve Growth Slack threads    20m NOW │
└─────────────────────────────────────────────┘
```

Compact row. Score, title, estimate, horizon tag. Hover reveals actions.

#### Meeting Card

```
┌─────────────────────────────────────────────┐
│  3:00 PM  Roadmap Sync                       │
│  60m  ·  Organizer  ·  High decision density │
│  ⚠ No prep scheduled                         │
└─────────────────────────────────────────────┘
```

Risk flags in coral. Prep status as subtle indicator.

#### Metric Card (Dashboard)

```
┌──────────────────┐
│  2h 10m          │  ← Large number in display font
│  Real exec time  │  ← Label in secondary text
│  ▼ 30m vs avg    │  ← Trend indicator
└──────────────────┘
```

Clean, number-first design. Trend arrows color-coded (green = better, coral = worse).

### Layout

**App Shell:**

```
┌──────┬──────────────────────────────────┐
│      │  Zoe · Impact Dashboard      ☀  │
│  Z   │─────────────────────────────────│
│      │                                  │
│  📊  │  [Main Content Area]            │
│  ⚡  │                                  │
│  📅  │                                  │
│  💬  │                                  │
│      │                                  │
│  ⚙   │                                  │
└──────┴──────────────────────────────────┘
```

- **Left sidebar:** Collapsed icon nav (56px). Expands on hover (240px). Icons + labels.
- **Top bar:** Page title, breadcrumbs, settings/profile.
- **Main content:** Max-width 1200px, centered, generous padding.

Navigation items:

1. Dashboard (home/default)
2. Command Center
3. Calendar
4. Chat

### Micro-interactions & Fun Elements

**Where personality lives (Mailchimp-inspired):**

1. **Empty states:** Illustrated (not just text). E.g., Command Center with zero tasks shows a relaxed character with "Nothing urgent. Enjoy it while it lasts."

2. **Score animations:** When scores change, numbers animate (count up/down). Subtle but satisfying.

3. **Task completion:** Check animation with a subtle confetti particle burst (tiny, not distracting). Running total: "14 tasks completed this week."

4. **Priority updates:** Gentle slide-in notification: "Priorities shifted. Here's what changed." Not a jarring alert.

5. **Zoe's personality in chat:** First message of the day has a greeting. "Morning. You have 3 meetings and a tight afternoon. Let's make it count." — not robotic, not overly casual.

6. **Weekly summary:** End-of-week card with progress visualization. "You closed 23 loops this week. That's 8 more than last week."

7. **Streak/momentum indicators:** Subtle glow effect on the dashboard when user has been consistently completing high-priority activities.

### Accessibility Requirements

- All interactive elements keyboard accessible
- Focus rings visible (2px solid primary, 2px offset)
- Color contrast: 4.5:1 minimum for body text, 3:1 for large text
- Score colors always paired with text labels (not color-only)
- Screen reader announcements for priority updates
- Reduced motion support (`prefers-reduced-motion` media query)

### Responsive Breakpoints

```css
--breakpoint-sm: 640px; /* Mobile landscape */
--breakpoint-md: 768px; /* Tablet */
--breakpoint-lg: 1024px; /* Desktop */
--breakpoint-xl: 1280px; /* Large desktop */
```

**Mobile-first approach:**

- Sidebar collapses to bottom tab bar on mobile
- Activity cards stack vertically
- Chat goes full-screen on mobile
- Dashboard metrics wrap to 2-column grid

### Tailwind Configuration

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          light: 'var(--color-primary-light)',
          dark: 'var(--color-primary-dark)',
          subtle: 'var(--color-primary-subtle)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          light: 'var(--color-secondary-light)',
          subtle: 'var(--color-secondary-subtle)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          light: 'var(--color-accent-light)',
          subtle: 'var(--color-accent-subtle)',
        },
        surface: {
          DEFAULT: 'var(--color-surface)',
          secondary: 'var(--color-surface-secondary)',
          tertiary: 'var(--color-surface-tertiary)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        primary: 'var(--shadow-primary)',
      },
    },
  },
}
```

### Constitution Rules for AI Agents

```markdown
## Design System Rules

- All UI components use shadcn/ui from components/ui/
- Import as: import { Button } from '@/components/ui/button' (NOT from 'shadcn')
- Use semantic color tokens (text-primary, bg-surface) — NEVER use Tailwind color classes directly (no bg-blue-500)
- New components must follow composition pattern: forwardRef + className merge via cn()
- Check components/ui/ before creating any new component
- Scores always displayed in font-mono
- Activity cards use the Card component, not custom divs
- All interactive elements must have visible focus rings
- Reduced motion: wrap animations in prefers-reduced-motion check
```
