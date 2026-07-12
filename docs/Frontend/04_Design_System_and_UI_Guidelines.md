# Design System and UI Guidelines

## 1. Aesthetic Philosophy
The system is a **Geospatial Agricultural Intelligence Platform**, meaning the design must feel like a premium, professional intelligence tool. 
- **Dynamic & Alive:** Interfaces should feel responsive, utilizing hover effects and micro-animations to encourage interaction.
- **Premium Feel:** Avoid generic default colors. Use a harmonious, carefully curated color palette tailored for an intelligence dashboard.
- **Dark Mode Support:** The platform should leverage sleek dark mode and glassmorphism where appropriate to highlight visual data (like satellite imagery).

## 2. Frameworks & Libraries
- **CSS Framework:** Tailwind CSS
- **Component Library:** shadcn/ui
- **Icons:** Lucide React (standard with shadcn)
- **Typography:** Modern sans-serif (e.g., Inter, Roboto, or Outfit)

## 3. UI/UX Global Behaviors

### Loading States
Every interaction that fetches data must have a distinct loading state.
- **Maps:** "Loading imagery..." overlay with a spinner.
- **Analytics:** Skeleton loaders mimicking the shape of the charts.
- **Analysis:** "Analyzing land..." for pipeline execution.

### Error & Empty States
- **Empty Lands:** A prominent "No lands yet" placeholder with a clear Call to Action (CTA) button to "Add your first land".
- **Error States:** "Failed to load imagery" with a "Retry" button. Ensure error states are localized to the component, not crashing the entire page.

### Tooltips & Explanations
Given the scientific nature of the platform (NDVI, soil metrics), use tooltips extensively to explain acronyms and metrics to the user.

## 4. Component Rules
- **DO NOT build from scratch:** Always pull from `shadcn/ui` first (buttons, dropdowns, dialogs, cards, sliders, sheets, tabs).
- **Tailwind Utility First:** Apply layout and typography styling directly via Tailwind utility classes.
- **Consistent Spacing:** Use a fixed spacing scale (e.g., `gap-4`, `p-6`, `mb-8`) across all pages.
