# Frontend Architecture & Decisions

## 1. Routing Structure
The application uses a unified routing structure to prevent duplication and ensure consistency.
```text
/
├── /login
├── /register
│
├── /dashboard
├── /lands
├── /lands/new
├── /lands/:id
├── /lands/compare
│
├── /methodology
├── /team
├── /about
├── /profile
├── /logs
```

## 2. Main Layout Structure
ONE shared app layout is used across the authenticated application.
```jsx
<AppLayout>
    <Sidebar />   // Contains: Dashboard, Lands, Add Land, Compare, Methodology, Team, Profile
    <Topbar />
    <MainContent />
</AppLayout>
```

## 3. Map Strategy
- **Stack:** Leaflet + OpenStreetMap + Leaflet Draw
- **Reason:** Free, stable, lightweight, perfect for React.
- **Rule:** Do NOT switch to Google Maps to avoid rewrites.

## 4. Image Handling Strategy
Backend returns URLs (`visual_url`, `ndvi_url`).
- **Frontend Responsibilities:** Display images, cache lightly, switch timeline.
- **Frontend MUST NOT:** Process imagery, compute NDVI, manipulate raster.

## 5. Timeline UX
- **UX Mechanism:** Slider + Date selector.
- **Example:** `[ Jan ] ——— [ Feb ] ——— [ Mar ]`
- **Behavior:** Changing the timeline updates the image, graphs, and metrics simultaneously.

## 6. State Management
- **React Query:** For server state (API fetching, caching, loading states).
- **Zustand:** For UI state (selectedLand, mapLayer, timeline, UI toggles).

## 7. Design System
- **Frameworks:** Tailwind CSS + shadcn/ui.
- **Goal:** Fast, clean, modern, professional UI without building custom components from scratch.

## 8. Backend API Alignment
Frontend development relies on these stable endpoints:
- `GET /lands`
- `GET /lands/{id}`
- `GET /lands/{id}/images`
- `GET /lands/{id}/timeline`
- `GET /lands/{id}/analysis`
- `POST /lands`

## 9. Core Architecture
- **Stack:** React / Vite (Frontend) + FastAPI (Backend)
- This is the final alignment. No fundamental architecture changes.
