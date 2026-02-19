import { useState, useCallback } from 'react';

interface LocalFolder {
  name: string;
  prefix: string;
}

interface LocalFile {
  name: string;
  key: string;
  size: number;
  lastModified: string;
}

interface ListResult {
  folders: LocalFolder[];
  files: LocalFile[];
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export function useLocalBrowser() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listPath = useCallback(async (relPath: string): Promise<ListResult> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/testsuite/list?path=${encodeURIComponent(relPath)}`);
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`List failed (${res.status}): ${errBody}`);
      }
      return await res.json();
    } catch (e: any) {
      setError(e.message);
      return { folders: [], files: [] };
    } finally {
      setLoading(false);
    }
  }, []);

  const listCountries = useCallback(() => listPath(''), [listPath]);

  const listSegments = useCallback(
    (country: string) => listPath(country),
    [listPath]
  );

  const listDates = useCallback(
    (country: string, segment: string) => listPath(`${country}/${segment}`),
    [listPath]
  );

  const listSubfolder = useCallback(
    (country: string, segment: string, date: string, subfolder: string) =>
      listPath(`${country}/${segment}/${date}/${subfolder}`),
    [listPath]
  );

  const listModelSubfolder = useCallback(
    (country: string, segment: string, date: string, modelType: string) =>
      listPath(`${country}/${segment}/${date}/model/${modelType}`),
    [listPath]
  );

  const saveConfig = useCallback(async (filename: string, config: Record<string, unknown>): Promise<{ ok: boolean; error?: string; path?: string }> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/testsuite/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, config }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        const errMsg = `Config save failed (${res.status}): ${errBody}`;
        setError(errMsg);
        return { ok: false, error: errMsg };
      }
      const data = await res.json();
      return { ok: true, path: data.path };
    } catch (e: any) {
      const errMsg = `Errore di rete: ${e.message}`;
      setError(errMsg);
      return { ok: false, error: errMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  const checkOutput = useCallback(async (relPath: string): Promise<LocalFile[]> => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/testsuite/output?path=${encodeURIComponent(relPath)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.files || [];
    } catch {
      return [];
    }
  }, []);

  const getDownloadUrl = useCallback((relPath: string): string => {
    return `${BACKEND_URL}/api/testsuite/download?path=${encodeURIComponent(relPath)}`;
  }, []);

  return {
    loading,
    error,
    listPath,
    listCountries,
    listSegments,
    listDates,
    listSubfolder,
    listModelSubfolder,
    saveConfig,
    checkOutput,
    getDownloadUrl,
  };
}
