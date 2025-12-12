import { useState, useEffect } from 'react';
import { CountryConfig, COUNTRIES as DEFAULT_COUNTRIES } from '@/types/project';

const STORAGE_KEY = 'ml-workflow-countries';

export function useCountries() {
  const [countries, setCountries] = useState<CountryConfig[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setCountries(JSON.parse(stored));
    } else {
      setCountries(DEFAULT_COUNTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_COUNTRIES));
    }
  }, []);

  const saveCountries = (newCountries: CountryConfig[]) => {
    setCountries(newCountries);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCountries));
  };

  const addCountry = (country: CountryConfig) => {
    const exists = countries.some(c => c.code === country.code);
    if (exists) return;
    saveCountries([...countries, country]);
  };

  const removeCountry = (countryCode: string) => {
    saveCountries(countries.filter(c => c.code !== countryCode));
  };

  const updateCountry = (countryCode: string, updates: Partial<CountryConfig>) => {
    const updated = countries.map(c => 
      c.code === countryCode ? { ...c, ...updates } : c
    );
    saveCountries(updated);
  };

  return {
    countries,
    addCountry,
    removeCountry,
    updateCountry,
  };
}
