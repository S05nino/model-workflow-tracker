// Unified exports - automatically use local API when VITE_API_URL is set
import { useProjects as useProjectsStorage } from './useProjects';
import { useReleases as useReleasesStorage } from './useReleases';
import { useCountries as useCountriesStorage } from './useCountries';
import { useProjectsLocal } from './useProjectsLocal';
import { useReleasesLocal } from './useReleasesLocal';
import { useCountriesLocal } from './useCountriesLocal';

const isLocalMode = !!import.meta.env.VITE_API_URL;

// Export the appropriate hooks based on environment
export const useProjectsAdapter = isLocalMode ? useProjectsLocal : useProjectsStorage;
export const useReleasesAdapter = isLocalMode ? useReleasesLocal : useReleasesStorage;
export const useCountriesAdapter = isLocalMode ? useCountriesLocal : useCountriesStorage;

// Also export individual hooks for direct use
export { useProjectsStorage, useReleasesStorage, useCountriesStorage };
export { useProjectsLocal, useReleasesLocal, useCountriesLocal };
