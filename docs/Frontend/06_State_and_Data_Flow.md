# State Management & Data Flow

This document details the boundary between Server State (React Query) and Client State (Zustand).

## 1. Server State: React Query

React Query is used exclusively for fetching, caching, and updating asynchronous data from the backend.

### Query Keys Schema
Consistent query keys are crucial for cache invalidation.
- `['lands']`: Fetch all lands for the user.
- `['lands', id]`: Fetch details for a specific land.
- `['lands', id, 'images']`: Fetch image timeline for a land.
- `['lands', id, 'analysis']`: Fetch analytics data for a land.

### Common Hooks
Agents should create custom hooks in `hooks/` encapsulating React Query calls.
- `useLands()` -> `useQuery({ queryKey: ['lands'], queryFn: fetchLands })`
- `useLandDetails(id)`
- `useCreateLand()` -> `useMutation({ mutationFn: createLand, onSuccess: () => queryClient.invalidateQueries(['lands']) })`

## 2. Client State: Zustand

Zustand is used for global UI state that needs to be accessed across deeply nested components without prop drilling, particularly where URL state is insufficient.

### Recommended Stores

#### `useMapStore`
Manages the state of the geospatial interactions.
```typescript
interface MapStore {
  selectedLayer: 'true_color' | 'ndvi' | 'map';
  setLayer: (layer: 'true_color' | 'ndvi' | 'map') => void;
  drawMode: boolean;
  setDrawMode: (active: boolean) => void;
  currentPolygon: GeoJSON | null;
  setCurrentPolygon: (polygon: GeoJSON | null) => void;
}
```

#### `useTimelineStore`
Manages the synchronized timeline state across maps and charts.
```typescript
interface TimelineStore {
  currentDateIndex: number;
  setDateIndex: (index: number) => void;
  isPlaying: boolean; // For animating the timeline automatically
  togglePlay: () => void;
}
```

## 3. Data Flow Pattern
1. **Fetch:** `<LandDetailsPage>` uses `useLandDetails(id)` to fetch server data.
2. **Propagate:** The fetched data is passed down to components (`<SatelliteViewer>`, `<NDVIChart>`).
3. **Interact:** The user interacts with the `<TimelineSlider>`, updating `useTimelineStore`.
4. **React:** The `<SatelliteViewer>` and `<NDVIChart>` read `currentDateIndex` from `useTimelineStore` and filter their displayed data accordingly. No refetching is required.
