import { useState, useEffect } from 'react';
import { CountryConfig, COUNTRIES as DEFAULT_COUNTRIES } from '@/types/project';

const API_URL = import.meta.env.VITE_API_URL || '';
const STORAGE_KEY = 'ml-workflow-countries';
const isLocalMode = !!API_URL;

export function useCountriesLocal() {
  const [countries, setCountries] = useState<CountryConfig[]>([]);

  useEffect(() => {
    if (isLocalMode) {
      // In Docker mode, fetch from API
      fetchCountries();
      const interval = setInterval(fetchCountries, 5000);
      return () => clearInterval(interval);
    } else {
      // In web mode, use localStorage
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setCountries(JSON.parse(stored));
      } else {
        setCountries(DEFAULT_COUNTRIES);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_COUNTRIES));
      }
    }
  }, []);

  const fetchCountries = async () => {
    try {
      const response = await fetch(`${API_URL}/app_config`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      const countriesConfig = data.find((c: { key: string }) => c.key === 'countries');
      if (countriesConfig) {
        setCountries(JSON.parse(countriesConfig.value));
      } else {
        // Initialize countries in API
        await fetch(`${API_URL}/app_config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: 'countries',
            value: JSON.stringify(DEFAULT_COUNTRIES),
          }),
        });
        setCountries(DEFAULT_COUNTRIES);
      }
    } catch (error) {
      console.error('Error fetching countries:', error);
      setCountries(DEFAULT_COUNTRIES);
    }
  };

  const saveCountries = async (newCountries: CountryConfig[]) => {
    setCountries(newCountries);
    
    if (isLocalMode) {
      try {
        // First try to get existing config
        const response = await fetch(`${API_URL}/app_config`);
        const data = await response.json();
        const existing = data.find((c: { key: string; id?: string }) => c.key === 'countries');
        
        if (existing?.id) {
          await fetch(`${API_URL}/app_config/${existing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: JSON.stringify(newCountries) }),
          });
        } else {
          await fetch(`${API_URL}/app_config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key: 'countries',
              value: JSON.stringify(newCountries),
            }),
          });
        }
      } catch (error) {
        console.error('Error saving countries:', error);
      }
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newCountries));
    }
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
