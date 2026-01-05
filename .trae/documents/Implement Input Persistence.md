I will implement state persistence for the ArtStudio page to save the user's input (prompt, uploaded images, selected size) to `localStorage` (which is easier and more appropriate than cookies for this amount of data) and restore it on page load.

1.  **Modify `frontend/src/pages/ArtStudio.tsx`**:
    *   Add `useEffect` hooks to save `prompt`, `images`, `size`, and `modelId` to `localStorage` whenever they change.
    *   Modify the initial state values (`useState`) to read from `localStorage` if available.
    *   **Note**: Saving Base64 images to localStorage might hit quota limits (typically 5MB). I will add a check or limit, or perhaps only save the prompt and settings, as images are large.
    *   *Refinement*: Given the user explicitly asked to "automatically read previous input, including re-uploading images", I will try to save images too, but with a warning or compression if possible. Or I can suggest that saving large images in local storage isn't ideal, but I'll implement it for now as requested, maybe limiting to the last session.
    *   Actually, a better UX for images is keeping them in the state if the user navigates away and back (which React Router does *not* do by default unless we lift state up or use a persistent store). Since the user wants persistence across *sessions* (implied by "cookie"), `localStorage` is the way.
    *   I will key the storage by `art_studio_state`.

**Plan Details**:
1.  Update `ArtStudio.tsx`:
    *   `useState` initialization: `localStorage.getItem('art_studio_prompt') || ''`
    *   `useEffect` to `setItem`.
    *   For images, I'll try to save them. If it fails (quota exceeded), I'll catch the error and maybe clear the image storage.

**Let's start with Prompt, Size, and ModelID first, and try Images.**