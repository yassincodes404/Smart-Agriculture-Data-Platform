# Mobile Compatibility & React Native Export Guide

The web UI is being prepared for easy extraction/porting to a React Native mobile app (Expo recommended).

## Current Status

- Auth layer improved (access + refresh tokens)
- `api.js` is now storage-agnostic via `configureTokenStorage()`
- Core data fetching and business logic are separated from presentation
- Some responsive styles exist

## Recommended Architecture for RN Export

```
project/
├── shared/                 # Pure JS/TS - works on web + RN
│   ├── api.js              # (already mostly portable)
│   ├── auth/
│   ├── hooks/
│   ├── types/
│   └── utils/
├── web/                    # Vite + React (current)
│   └── src/
│       └── (uses shared + web-specific UI)
└── mobile/                 # New Expo / RN app
    └── src/
        └── (re-uses shared + RN components)
```

## How to Share Code

### 1. Token Storage (Critical for mobile)

```js
// In your RN app entry
import * as SecureStore from 'expo-secure-store';
import { configureTokenStorage } from '../shared/api';

configureTokenStorage({
  getToken: () => SecureStore.getItemAsync('agri_token'),
  setToken: (t) => SecureStore.setItemAsync('agri_token', t),
  getRefreshToken: () => SecureStore.getItemAsync('agri_refresh_token'),
  setRefreshToken: (t) => SecureStore.setItemAsync('agri_refresh_token', t),
  clearTokens: () => {
    SecureStore.deleteItemAsync('agri_token');
    SecureStore.deleteItemAsync('agri_refresh_token');
  },
});
```

**Note**: `configureTokenStorage` currently expects sync functions. For full async, you may wrap the `request` function or use a small wrapper.

### 2. Components to Abstract

| Web Component       | RN Equivalent                     | Strategy |
|---------------------|-----------------------------------|----------|
| Recharts charts     | `react-native-chart-kit` or Victory | Abstract `<PlatformChart>` |
| Leaflet maps        | `@react-native-maps` + `react-native-maps` | Abstract `<PlatformMap>` |
| react-router-dom    | `@react-navigation/native`       | Use route config object |
| CSS / styled        | StyleSheet + NativeWind / Tamagui | Use design tokens + CSS vars |

### 3. Responsive Web (PWA-like)

Run the web app on mobile browsers first:

- Added basic responsive rules in `styles/layout.css`
- Use `flex`, media queries, and touch-friendly sizes (min 44px targets)

### 4. Auth Flow (Already Good)

The improved Auth v2 (refresh tokens) works the same on mobile.

### Next Steps for Full RN App

1. Create new Expo app: `npx create-expo-app@latest mobile`
2. Copy/adapt `shared/` folder
3. Re-implement screens using React Native primitives
4. Replace map + chart implementations
5. Use same API_BASE (or configure per env)
6. Handle navigation + deep links

### Libraries that work cross-platform

- `zustand` or `jotai` for state
- `axios` or native `fetch`
- `react-query` / `swr` (community RN support)
- `zod` for validation

---

**Current recommendation**: Keep improving the web app's responsiveness and extract more logic into `shared/`. The current structure already makes porting feasible.

For production mobile, consider using **Expo + Tamagui** or **NativeWind** for the best DX when sharing styles.
