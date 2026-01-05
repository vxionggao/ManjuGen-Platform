# Frontend Cache Strategy Implementation

I will update the frontend to implement the requested caching strategy and ensure "Copy Task" functionality works correctly with the new backend requirements (Base64 only).

## 1. Enhance Cache Service (`frontend/src/services/cache.ts`)
Add a `getOrFetch(url, key)` method to the `AssetCache` object.
- **Logic**:
  1. Try to get `Blob` from IndexedDB using `key`.
  2. If found, return it.
  3. If not, `fetch(url)`.
  4. Store the result `Blob` in IndexedDB using `key`.
  5. Return the `Blob`.

## 2. Update Cache Hook (`frontend/src/hooks/useCachedAsset.ts`)
Refactor `useCachedAsset` to use the new `AssetCache.getOrFetch` method.
- This centralizes the logic and ensures the UI components (`CachedImage`, `CachedVideo`) use the same caching path as the "Copy Task" logic.

## 3. Update "Copy Task" in Art Studio (`frontend/src/pages/ArtStudio.tsx`)
Refactor `handleReuse` to:
- Iterate through `t.input_images`.
- For each image URL, call `AssetCache.getOrFetch(url, cacheKey)`.
  - Key format: `task_${t.id}_input_${index}` (matching `CachedImage` usage in the list).
- Convert the returned `Blob` to a Base64 string.
- Update the `images` state with the Base64 strings.
- **Why**: This fixes the current broken state where URLs were being passed to a backend that now only accepts Base64, and fulfills the requirement to load from local cache.

## 4. Update "Copy Task" in Motion Studio (`frontend/src/pages/MotionStudio.tsx`)
Refactor `handleReuse` to:
- Replace the direct `fetch(url)` with `AssetCache.getOrFetch(url, cacheKey)`.
  - Key format: `task_${t.id}_input_${index}`.
- Convert to Base64 and set state.
