export const assetChannel = new BroadcastChannel('asset_updates');

export const notifyAssetUpdate = () => {
    // Notify other tabs
    assetChannel.postMessage({ type: 'update' });
    // Notify current tab
    window.dispatchEvent(new Event('asset_update'));
}
