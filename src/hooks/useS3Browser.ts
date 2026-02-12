import { useState, useCallback } from 'react';

interface S3Folder {
  name: string;
  prefix: string;
}

interface S3File {
  name: string;
  key: string;
  size: number;
  lastModified: string;
}

interface S3ListResult {
  folders: S3Folder[];
  files: S3File[];
}

const ROOT_PREFIX = 'TEST_SUITE/';

export function useS3Browser() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listPrefix = useCallback(async (prefix: string): Promise<S3ListResult> => {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/s3-browser`;
      const url = `${baseUrl}?action=list&prefix=${encodeURIComponent(prefix)}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`S3 list failed: ${errBody}`);
      }
      const result: S3ListResult = await res.json();
      return result;
    } catch (e: any) {
      setError(e.message);
      return { folders: [], files: [] };
    } finally {
      setLoading(false);
    }
  }, []);

  const listCountries = useCallback(() => listPrefix(ROOT_PREFIX), [listPrefix]);

  const listSegments = useCallback(
    (country: string) => listPrefix(`${ROOT_PREFIX}${country}/`),
    [listPrefix]
  );

  const listDates = useCallback(
    (country: string, segment: string) => listPrefix(`${ROOT_PREFIX}${country}/${segment}/`),
    [listPrefix]
  );

  const listSubfolder = useCallback(
    (country: string, segment: string, date: string, subfolder: string) =>
      listPrefix(`${ROOT_PREFIX}${country}/${segment}/${date}/${subfolder}/`),
    [listPrefix]
  );

  const listModelSubfolder = useCallback(
    (country: string, segment: string, date: string, modelType: string) =>
      listPrefix(`${ROOT_PREFIX}${country}/${segment}/${date}/model/${modelType}/`),
    [listPrefix]
  );

  const getPresignedUrl = useCallback(async (key: string): Promise<string | null> => {
    try {
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/s3-browser`;
      const url = `${baseUrl}?action=presign&key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.url;
    } catch {
      return null;
    }
  }, []);

  const putConfig = useCallback(async (key: string, config: Record<string, unknown>): Promise<boolean> => {
    try {
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/s3-browser`;
      const url = `${baseUrl}?action=put&key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  return {
    loading,
    error,
    listPrefix,
    listCountries,
    listSegments,
    listDates,
    listSubfolder,
    listModelSubfolder,
    getPresignedUrl,
    putConfig,
  };
}
