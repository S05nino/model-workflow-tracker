/** Maps release country codes (from project.ts COUNTRIES) to TestSuite folder codes */
export const RELEASE_TO_TESTSUITE_COUNTRY: Record<string, string> = {
  AUT: "de-AT",
  BEL: "nl-BE",
  CZK: "cs-CZ",
  DEU: "de-DE",
  ESP: "es-ES",
  FRA: "fr-FR",
  GBR: "en-GB",
  IND: "en-IN",
  IRL: "en-IE",
  ITA: "it-IT",
  ITA2: "it-IT",
  MEX: "es-MX",
  POL: "pl-PL",
  POR: "pt-PT",
  USA: "en-US",
};

/** Maps release country names to TestSuite folder codes */
export const COUNTRY_NAME_TO_TESTSUITE: Record<string, string> = {
  Austria: "de-AT",
  Belgio: "nl-BE",
  "Rep. Ceca": "cs-CZ",
  Germania: "de-DE",
  Spagna: "es-ES",
  Francia: "fr-FR",
  "Regno Unito": "en-GB",
  India: "en-IN",
  Irlanda: "en-IE",
  Italia: "it-IT",
  "Italia 2": "it-IT",
  Messico: "es-MX",
  Polonia: "pl-PL",
  Portogallo: "pt-PT",
  USA: "en-US",
};

export interface TestSuitePrefillEvent {
  country: string;    // TestSuite country code (e.g. "it-IT")
  segment: string;    // e.g. "consumer"
  valueSign: "OUT" | "IN";
}

/** Dispatch an event to navigate to TestSuite with pre-filled fields */
export function navigateToTestSuite(prefill: TestSuitePrefillEvent) {
  window.dispatchEvent(new CustomEvent('navigate-to-testsuite', { detail: prefill }));
}
