// Privacy coarsening for third-party AI prompts.
// Raw vitals are health data and must not leave our infrastructure — any
// value included in an external LLM prompt goes through these qualitative
// bands first. Numeric computation stays inside the edge functions.

export function hrZone(hr: number | null | undefined): string {
  if (hr === null || hr === undefined) return "unknown";
  if (hr < 60)  return "very low";
  if (hr < 75)  return "resting";
  if (hr < 95)  return "light activity";
  if (hr < 115) return "moderate";
  if (hr < 140) return "vigorous";
  return "peak";
}

export function band(value: number | null | undefined): string {
  if (value === undefined || value === null) return "unknown";
  if (value < 25) return "low";
  if (value < 50) return "moderate";
  if (value < 75) return "elevated";
  return "high";
}

export interface EegBands {
  eegAlpha?: number;
  eegBeta?: number;
  eegTheta?: number;
  eegGamma?: number;
  eegDelta?: number;
}

export function dominantEegBand(s: EegBands): string {
  const bands: Array<[string, number]> = [
    ["alpha (relaxed focus)", s.eegAlpha ?? 0],
    ["beta (active thinking)", s.eegBeta ?? 0],
    ["theta (meditative/drowsy)", s.eegTheta ?? 0],
    ["gamma (intense cognition)", s.eegGamma ?? 0],
    ["delta (deep rest)", s.eegDelta ?? 0],
  ];
  bands.sort((a, b) => b[1] - a[1]);
  return bands[0][1] > 0 ? bands[0][0] : "unknown";
}
