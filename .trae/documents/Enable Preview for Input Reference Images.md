I will implement the image preview functionality for input reference images in both `ArtStudio.tsx` and `MotionStudio.tsx`.

1.  **`frontend/src/pages/ArtStudio.tsx`**:
    *   Modify the input image rendering logic to wrap each image in a clickable container.
    *   Add an `onClick` handler to set the `preview` state (visible: true, url: image_url, type: 'image').
    *   Ensure the `PreviewModal` component is correctly placed to handle these preview requests.

2.  **`frontend/src/pages/MotionStudio.tsx`**:
    *   Modify the "First Frame" and "Last Frame" image slots.
    *   Add `onClick` handlers to the image elements to trigger the `preview` state.
    *   Pass the correct `task` (if available, or null) and `url` to the preview state.

This will allow users to click on any uploaded reference image to view it in the large preview modal, similar to how generated results are viewed.
