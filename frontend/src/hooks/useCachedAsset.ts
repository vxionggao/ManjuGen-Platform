import { useState, useEffect } from 'react';
import { AssetCache } from '../services/cache';

export function useCachedAsset(url: string, key: string) {
  const [src, setSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    const load = async () => {
      if (!url) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const blob = await AssetCache.getOrFetch(url, key);
        
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
        }
      } catch (e) {
        console.error(`[Cache] Error loading ${key}:`, e);
        if (active) {
          setError(e);
          // Fallback to original URL if fetch/cache fails
          setSrc(url); 
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
      if (objectUrl) {
        // Small delay to allow ongoing renders to finish before revoking
        setTimeout(() => URL.revokeObjectURL(objectUrl!), 100);
      }
    };
  }, [url, key]);

  return { src, loading, error };
}
