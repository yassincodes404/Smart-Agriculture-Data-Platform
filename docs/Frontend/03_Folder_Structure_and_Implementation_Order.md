# Folder Structure and Implementation Order

## 1. Folder Structure
The frontend application uses a feature-based folder structure to ensure scalability.

```text
src/
├── app/                  # App initialization, main providers
├── assets/               # Static assets (images, fonts, global styles)
├── components/           # Shared global components
│   ├── alerts/
│   ├── cards/
│   ├── charts/
│   ├── forms/
│   ├── layout/
│   ├── map/
│   ├── satellite/
│   └── ui/               # shadcn/ui components
├── features/             # Feature-specific modules (IMPORTANT)
│   ├── analytics/
│   ├── dashboard/
│   ├── lands/
│   └── map/
├── hooks/                # Global custom hooks
├── pages/                # Route components (Page assemblies)
│   ├── about/
│   ├── compare/
│   ├── dashboard/
│   ├── lands/
│   ├── logs/
│   ├── methodology/
│   ├── profile/
│   └── team/
├── routes/               # Routing configuration
├── services/             # External integrations
│   ├── analytics/
│   ├── api/              # Axios instances
│   ├── auth/
│   └── lands/
├── store/                # Zustand stores
├── types/                # TypeScript definitions (if applicable) / JSDoc typedefs
└── utils/                # Helper functions, formatting
```

## 2. Implementation Order

### Phase 1: Foundation
- Layout structure (AppLayout, Topbar, Sidebar).
- Routing setup (React Router).
- Dashboard skeleton.

### Phase 2: Map & Input
- Map UI integration (Leaflet).
- Land creation flow (Polygon draw + form).

### Phase 3: Core Intelligence
- Land Details page.
- Satellite viewer implementation.
- Charts and data visualization.

### Phase 4: Supporting Pages
- Comparison page.
- Methodology.
- Team, About, Profile.
- Logs.

## 3. Component Grouping Reference
- **Map:** MapContainer, PolygonDrawer, MapLayers, TimelineSlider, LandOverlay
- **Satellite:** SatelliteViewer, NDVIViewer, ImageComparison
- **Analytics:** NDVIChart, ClimateChart, SoilCard, InsightCard
