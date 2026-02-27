I will implement the functionality to modify the Endpoint ID for models in the management configuration page.

### Backend Changes

1. **Repository (`backend/app/repositories/model_repo.py`)**:

   * Add an `update` method to `ModelConfigRepo` to support modifying model fields (specifically `endpoint_id`).
2. **API (`backend/app/api/config.py`)**:

   * Add a new endpoint `PUT /api/admin/models/{id}` to handle model updates.

### Frontend Changes

1. **Service (`frontend/src/services/api.ts`)**:

   * Add `updateModel` function to call the new PUT API.
2. **Component (`frontend/src/pages/AdminConfig.tsx`)**:

   * Modify the `columns` definition in `ModelConfig` component.

   * Update the `Endpoint ID` column to support inline editing:

     * Default view: Display Endpoint ID with a small "Edit" icon.

     * Edit mode: Display an `Input` field with the current Endpoint ID and a small "Save" button.

     * Interaction: Clicking "Edit" switches to edit mode; clicking "Save" calls `updateModel`, updates the local state, and switches back to view mode.

### Verification Plan

1. Verify the backend API using `curl` or a test script.
2. Verify the frontend interaction by editing an Endpoint ID and ensuring it persists after page reload.

