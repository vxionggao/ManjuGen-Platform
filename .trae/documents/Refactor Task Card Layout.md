I will redesign the task card layout in `ArtStudio.tsx` to match your requirements and the reference image more closely.

**Design Changes:**

1. **Layout Structure**: Switch to a vertical layout where the "Result" (generated image) takes up the majority of the space (similar to the reference), and the "Prompt/Input" section is smaller and placed above or beside it in a compact way.
2. **Header Information**: Move "Creation Time" (生成时间) and "Duration" (耗时) to the very top line of the card.
3. **Content Ratio**:

   * **Result Area**: Increase size significantly (e.g., large central preview).

   * **Input Area**: Reduce visual weight. Display the prompt and reference images in a more compact row or small section, rather than a large block.
4. **Visual Hierarchy**: Emphasize the result.

**Implementation Plan:**

1. Modify the `Card` content structure in `ArtStudio.tsx`.
2. Move the timestamp/duration row to the top.
3. Adjust the flex layout:

   * Top Row: Status Icon/Tag + Time + Duration.

   * Middle Row: Compact Prompt + Reference Image thumbnail (small).

   * Main Area: Large Result Image (or placeholder if generating).
4. Apply styles to ensure the result image is the focal point.

