# UI/UX Style Guide — AgriData Egypt

> **This is the single source of truth for all frontend styling decisions.**
> Every page, component, and animation MUST follow these rules exactly.
> Inconsistency is a bug.

---

## 1. Brand Identity

| Property        | Value                                            |
|-----------------|--------------------------------------------------|
| **App Name**    | AgriData Egypt                                   |
| **Tagline**     | Smart Agriculture Data Platform                  |
| **Personality** | Professional, intelligent, alive, premium        |
| **Visual Mood** | Dark sidebar + light content, data-rich, organic  |

---

## 2. Color System

### 2.1 Primary Palette (Green — Brand)

| Token              | Hex       | Usage                                     |
|---------------------|-----------|-------------------------------------------|
| `--green-50`       | `#f0fdf4` | Lightest tint, success backgrounds        |
| `--green-100`      | `#dcfce7` | Hover tints, badges                       |
| `--green-200`      | `#bbf7d0` | Borders, dividers on success              |
| `--green-300`      | `#86efac` | Secondary decorative                      |
| `--green-400`      | `#4ade80` | Active states, accent highlights          |
| `--green-500`      | `#22c55e` | **Primary brand color** — CTAs, links     |
| `--green-600`      | `#16a34a` | Primary buttons, active nav               |
| `--green-700`      | `#15803d` | Button hover, strong emphasis             |
| `--green-800`      | `#166534` | Logo text, header text on dark            |
| `--green-900`      | `#14532d` | Sidebar background base                   |
| `--green-950`      | `#052e16` | Darkest — sidebar deep background         |

### 2.2 Neutrals (Gray)

| Token              | Hex       | Usage                                     |
|---------------------|-----------|-------------------------------------------|
| `--gray-50`        | `#f9fafb` | Page background (content area)            |
| `--gray-100`       | `#f3f4f6` | Card hover bg, input hover                |
| `--gray-200`       | `#e5e7eb` | Borders, dividers                         |
| `--gray-300`       | `#d1d5db` | Disabled borders                          |
| `--gray-400`       | `#9ca3af` | Placeholder text, icons (muted)           |
| `--gray-500`       | `#6b7280` | **Secondary text** — descriptions, labels |
| `--gray-600`       | `#4b5563` | Stronger secondary text                   |
| `--gray-700`       | `#374151` | Input labels, card titles                 |
| `--gray-800`       | `#1f2937` | Heading text, strong emphasis             |
| `--gray-900`       | `#111827` | **Primary text** — headings, body         |
| `--gray-950`       | `#030712` | Darkest neutral                           |

### 2.3 Semantic Colors

| Purpose      | Token          | Hex       | Light BG            | Border               |
|--------------|----------------|-----------|----------------------|----------------------|
| **Error**    | `--error`      | `#ef4444` | `--error-light` `#fef2f2` | `--error-border` `#fecaca` |
| **Warning**  | `--warning`    | `#f59e0b` | `--warning-light` `#fffbeb` | `--warning-border` `#fde68a` |
| **Success**  | `--success`    | `#22c55e` | `--success-light` `#f0fdf4` | `--success-border` `#bbf7d0` |
| **Info**     | `--info`       | `#3b82f6` | `--info-light` `#eff6ff` | `--info-border` `#bfdbfe` |

### 2.4 Surface Colors

| Token                | Value                | Usage                          |
|-----------------------|----------------------|--------------------------------|
| `--bg-primary`       | `#ffffff`            | Cards, panels, modals          |
| `--bg-secondary`     | `var(--gray-50)`     | Page background                |
| `--bg-sidebar`       | `var(--green-950)`   | Sidebar background             |
| `--text-primary`     | `var(--gray-900)`    | Body text, headings            |
| `--text-secondary`   | `var(--gray-500)`    | Descriptions, meta             |
| `--text-inverse`     | `#ffffff`            | Text on dark backgrounds       |
| `--border-color`     | `var(--gray-200)`    | All borders and dividers       |

### 2.5 Color Rules

- **NEVER** use raw hex values in components. ALWAYS use CSS variables.
- **NEVER** use generic red/blue/green. Use the semantic tokens above.
- **NEVER** mix color scales — green for brand, gray for neutral, semantic for status.

---

## 3. Typography

### 3.1 Font Stack

```css
--font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
```

**Inter is loaded via Google Fonts in `index.html` with weights: 300, 400, 500, 600, 700.**

### 3.2 Type Scale

| Name        | Size   | Weight | Line-Height | Letter-Spacing | Usage                        |
|-------------|--------|--------|-------------|----------------|------------------------------|
| `display`   | 36px   | 700    | 1.15        | -1.0px         | Page titles (Dashboard, etc) |
| `heading-1` | 28px   | 700    | 1.2         | -0.75px        | Section headings             |
| `heading-2` | 22px   | 600    | 1.3         | -0.5px         | Card group titles            |
| `heading-3` | 18px   | 600    | 1.4         | -0.3px         | Card titles                  |
| `body`      | 15px   | 400    | 1.6         | 0              | Default body text            |
| `body-sm`   | 14px   | 400    | 1.5         | 0              | Table cells, descriptions    |
| `caption`   | 13px   | 500    | 1.4         | 0.2px          | Labels, metadata             |
| `overline`  | 12px   | 600    | 1.3         | 0.8px          | Section labels (uppercase)   |
| `stat`      | 32px   | 700    | 1.1         | -0.5px         | Dashboard big numbers        |

### 3.3 Typography Rules

- **ONE `<h1>` per page** — the page title only.
- Heading hierarchy: h1 > h2 > h3. Never skip levels.
- Body text is **always 15px**, never 16px in components.
- All stat/metric numbers use `font-variant-numeric: tabular-nums`.

---

## 4. Spacing System

Based on a **4px grid**. Use ONLY these values:

| Token         | Value  | Usage                              |
|---------------|--------|------------------------------------|
| `--space-xs`  | 4px    | Icon gaps, tight padding           |
| `--space-sm`  | 8px    | Between related elements           |
| `--space-md`  | 16px   | Default padding, component gaps    |
| `--space-lg`  | 24px   | Section gaps, card padding         |
| `--space-xl`  | 32px   | Page section gaps                  |
| `--space-2xl` | 48px   | Major section separations          |
| `--space-3xl` | 64px   | Hero sections, large spacing       |

### Spacing Rules

- **NEVER use arbitrary pixel values** like 13px, 17px, 22px for margins/padding.
- **ALWAYS** use the spacing tokens above.
- Card padding is ALWAYS `--space-lg` (24px).
- Gap between cards in a grid is ALWAYS `--space-lg` (24px).
- Page content padding is ALWAYS `--space-xl` (32px).

---

## 5. Border Radius

| Token            | Value    | Usage                            |
|------------------|----------|----------------------------------|
| `--radius-sm`    | 6px      | Small buttons, tags, badges      |
| `--radius-md`    | 10px     | Inputs, dropdowns, small cards   |
| `--radius-lg`    | 16px     | Cards, panels, modals            |
| `--radius-xl`    | 24px     | Large decorative containers      |
| `--radius-full`  | 9999px   | Avatars, pills, circular badges  |

**Rule:** Cards = `--radius-lg`. Inputs = `--radius-md`. Badges = `--radius-full`.

---

## 6. Shadows

| Token           | Value                                                                 | Usage               |
|-----------------|-----------------------------------------------------------------------|----------------------|
| `--shadow-sm`   | `0 1px 2px rgba(0,0,0,0.05)`                                         | Subtle lift          |
| `--shadow-md`   | `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)`    | Default card shadow  |
| `--shadow-lg`   | `0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)`  | Elevated cards/hover |
| `--shadow-xl`   | `0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)` | Modals, dropdowns    |
| `--shadow-glow` | `0 0 30px rgba(34,197,94,0.15)`                                      | Brand accent glow    |

**Rule:** Cards at rest = `--shadow-sm`. Cards on hover = `--shadow-lg`. Modals = `--shadow-xl`.

---

## 7. Animation & Transition System

### 7.1 Transition Durations

| Token               | Value    | Usage                                    |
|----------------------|----------|------------------------------------------|
| `--transition-fast`  | 150ms    | Hover colors, opacity, icon changes      |
| `--transition-base`  | 250ms    | Card hover lift, menu open/close         |
| `--transition-slow`  | 400ms    | Page transitions, modals, drawers        |

### 7.2 Easing

ALL transitions use `ease` easing unless specified otherwise.
- **Enter animations:** `cubic-bezier(0.4, 0, 0.2, 1)` (ease-out)
- **Exit animations:** `cubic-bezier(0.4, 0, 1, 1)` (ease-in)

### 7.3 Standard Animations

| Name            | Keyframe           | Duration | Usage                          |
|------------------|--------------------|----------|--------------------------------|
| `fadeIn`        | opacity 0 to 1     | 300ms    | Page content appear            |
| `slideUp`       | translateY(12px) to 0 | 300ms | Cards staggered entry          |
| `slideDown`     | translateY(-8px) to 0 | 300ms | Alerts, notifications          |
| `scaleIn`       | scale(0.95) to 1   | 200ms    | Modals, dropdowns              |
| `spin`          | rotate 0 to 360deg | 700ms    | Loading spinners               |
| `pulse`         | opacity 1 to 0.5 to 1 | 2s    | Skeleton loaders               |
| `float`         | translateY +/-15px | 20s      | Decorative background elements |
| `shimmer`       | translateX(-100% to 100%) | 1.5s | Skeleton loading bars       |

### 7.4 Hover Micro-Interactions

| Element              | Hover Effect                                           |
|----------------------|--------------------------------------------------------|
| **Cards**           | `transform: translateY(-2px)` + `box-shadow: --shadow-lg` |
| **Buttons (primary)**| `transform: translateY(-1px)` + brighter gradient       |
| **Sidebar nav items**| `background: rgba(255,255,255,0.08)` + slight left border |
| **Icon buttons**    | `background: var(--gray-100)` + `color` change          |
| **Table rows**      | `background: var(--gray-50)`                             |
| **Links**           | `color` darkens one shade                                |

### 7.5 Animation Rules

- **NEVER** use animations longer than 400ms for UI interactions (hover, click).
- **NEVER** animate `width`, `height`, or `top/left` — use `transform` and `opacity`.
- **ALWAYS** include `will-change` for animated elements in lists.
- **ALL cards** must use the same hover effect: `translateY(-2px) + shadow-lg`.
- Stagger delay for card lists: each card gets `animation-delay: calc(index * 60ms)`.

---

## 8. Component Styles

### 8.1 Cards

```
Background:     #fff (var(--bg-primary))
Border:         1px solid var(--border-color)
Border-radius:  var(--radius-lg) — 16px
Padding:        var(--space-lg) — 24px
Shadow rest:    var(--shadow-sm)
Shadow hover:   var(--shadow-lg)
Hover lift:     translateY(-2px)
Transition:     var(--transition-base)
```

### 8.2 Stat Cards (Dashboard)

```
Same as Card +
Colored left border:  3px solid [semantic color]
Icon container:       48x48px, rounded-md, 10% opacity bg of the semantic color
Stat value:           32px, font-weight 700, tabular-nums
Stat label:           13px, uppercase, letter-spacing 0.8px, gray-500
```

### 8.3 Buttons

| Variant       | Background                        | Text     | Border  |
|---------------|----------------------------------|----------|---------|
| `primary`     | gradient green-600 to green-700  | white    | none    |
| `secondary`   | white                            | gray-700 | gray-200|
| `ghost`       | transparent                      | gray-600 | none    |
| `danger`      | error                            | white    | none    |
| `disabled`    | any + `opacity: 0.65`            | —        | —       |

All buttons: height 44px, border-radius `--radius-md`, font-weight 600, font-size 14px.

### 8.4 Badges / Status Pills

```
Padding:        4px 12px
Border-radius:  var(--radius-full)
Font-size:      12px
Font-weight:    600
Letter-spacing: 0.3px
```

| Status      | Background            | Text Color          |
|-------------|----------------------|---------------------|
| Healthy     | `var(--green-100)`   | `var(--green-700)`  |
| Warning     | `var(--warning-light)` | `var(--amber-500)` |
| Critical    | `var(--error-light)` | `var(--error)`      |
| Info        | `var(--info-light)`  | `var(--info)`       |
| Neutral     | `var(--gray-100)`    | `var(--gray-600)`   |

### 8.5 Inputs

```
Height:         48px
Padding:        0 14px (or 42px left if icon present)
Border:         1.5px solid var(--border-color)
Border-radius:  var(--radius-md)
Font-size:      15px
Focus:          border-color green-500 + box-shadow 0 0 0 3px rgba(34,197,94,0.1)
```

---

## 9. Layout Specifications

### 9.1 App Shell

```
+----------+-------------------------------------+
|          |  Topbar (56px height)               |
| Sidebar  +-------------------------------------+
| (260px)  |                                     |
|          |  Content Area                       |
|          |  padding: 32px                      |
|          |  max-width: 1400px                  |
|          |  background: var(--gray-50)         |
|          |                                     |
+----------+-------------------------------------+
```

### 9.2 Sidebar Spec

```
Width:          260px
Background:     var(--green-950)
Text color:     rgba(255,255,255,0.7)
Active text:    #ffffff
Active bg:      rgba(255,255,255,0.1)
Active left border: 3px solid var(--green-400)
Section labels: 11px uppercase, letter-spacing 1.2px, rgba(255,255,255,0.35)
Nav item height: 44px
Nav item padding: 0 20px
Nav icon size:  20px
Gap between items: 2px
```

### 9.3 Topbar Spec

```
Height:         56px
Background:     #fff
Border-bottom:  1px solid var(--border-color)
Shadow:         var(--shadow-sm)
Padding:        0 32px
Content:        Page title (left) + User menu (right)
```

---

## 10. Responsive Breakpoints

| Name      | Width      | Behavior                                    |
|-----------|-----------|----------------------------------------------|
| `mobile`  | <= 640px  | Single column, sidebar hidden, compact cards |
| `tablet`  | <= 1024px | Sidebar collapsed to icons, 2-col grid       |
| `desktop` | > 1024px  | Full sidebar, 3-4 col grid                   |

---

## 11. Strict DO / DON'T Rules

### DO

- Use CSS variables for ALL colors, spacing, radii, shadows
- Use `transition` on hover/focus states with the token durations
- Use `transform` for hover lift effects
- Use consistent card structure: icon then title then description then footer
- Use skeleton loaders during fetch
- Use `font-variant-numeric: tabular-nums` for numbers
- Put all page-specific styles in their own `.css` file, imported in the page
- Name CSS classes with BEM: `block__element--modifier`

### DON'T

- Use inline styles (except truly dynamic values like positioning)
- Use Tailwind utility classes
- Use `!important`
- Use fixed pixel values for colors — always use variables
- Mix rounded corners (all cards same radius)
- Use different hover effects on different cards
- Create new color shades — use only the defined palette
- Animate layout properties (`width`, `height`, `margin`)

---

## 12. File Organization

```
src/
  index.css              -- Global tokens + reset + base styles
  styles/
    animations.css       -- All @keyframes and animation utilities
    components.css       -- Reusable component classes (cards, buttons, badges)
    layout.css           -- Sidebar, topbar, app shell styles
  pages/
    AuthPages.css        -- Login + Register specific styles
    Dashboard.css        -- Dashboard specific styles
    Lands.css            -- Lands explorer + details styles
    ...
```

---

## 13. Loading and Empty States

### Skeleton Loader
```
Background:     var(--gray-200)
Animation:      pulse 2s ease-in-out infinite
Border-radius:  var(--radius-md)
```

### Empty State
```
Centered container
Icon:           64x64px, gray-300
Heading:        18px, gray-700
Description:    14px, gray-500
CTA Button:     Primary button
```

### Error State
```
Same as empty but:
Icon color:     var(--error)
Border:         1px solid var(--error-border)
Background:     var(--error-light)
Retry button:   Secondary button variant
```

---

**Every developer and AI agent MUST read this document before writing ANY frontend code.**
If a component does not match this guide, it is a bug and must be fixed.
