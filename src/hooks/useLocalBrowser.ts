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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const API_URL = import.meta.env.VITE_API_URL || '';
const isLocalMode = !!API_URL;

async function callS3Function(params: Record<string, string>): Promise<Response> {
  if (isLocalMode) {
    // Local Docker mode: use Express backend
    const action = params.action;
    if (action === 'list') {
      return fetch(`${API_URL}/testsuite/list?path=${encodeURIComponent(params.path || '')}`);
    }
    if (action === 'download') {
      return fetch(`${API_URL}/testsuite/download?path=${encodeURIComponent(params.path || '')}`);
    }
    if (action === 'download-content') {
      return fetch(`${API_URL}/testsuite/download?path=${encodeURIComponent(params.path || '')}`);
    }
    return fetch(`${API_URL}/testsuite/list?path=${encodeURIComponent(params.path || '')}`);
  }

  // Cloud mode: use Supabase edge function
  const qs = new URLSearchParams(params).toString();
  return fetch(`${SUPABASE_URL}/functions/v1/s3-testsuite?${qs}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
}

export function useLocalBrowser() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listPath = useCallback(async (relPath: string): Promise<ListResult> => {
    setLoading(true);
    setError(null);
    try {
      const res = await callS3Function({ action: 'list', path: relPath });
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

  const checkOutput = useCallback(async (relPath: string): Promise<LocalFile[]> => {
    try {
      const res = await callS3Function({ action: 'list', path: relPath });
      if (!res.ok) return [];
      const data = await res.json();
      return data.files || [];
    } catch {
      return [];
    }
  }, []);

  const getDownloadUrl = useCallback((relPath: string): string => {
    if (isLocalMode) {
      return `${API_URL}/testsuite/download?path=${encodeURIComponent(relPath)}`;
    }
    return `${SUPABASE_URL}/functions/v1/s3-testsuite?action=download&path=${encodeURIComponent(relPath)}`;
  }, []);

  const downloadFile = useCallback(async (relPath: string): Promise<Blob | null> => {
    try {
      const res = await callS3Function({ action: 'download-content', path: relPath });
      if (!res.ok) return null;
      return await res.blob();
    } catch {
      return null;
    }
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
    checkOutput,
    getDownloadUrl,
    downloadFile,
  };
}
