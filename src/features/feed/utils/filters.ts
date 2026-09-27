// Shared by the filter sheet's choice groups and the Home page's category strip.

/**
 * Single-choice toggle: picking a new option selects it; picking the current
 * one clears it, unless a value is required (e.g. sort).
 */
export function nextChoice<T>(current: T | undefined, picked: T, isRequired = false) {
  if (picked !== current) {
    return picked;
  }

  return isRequired ? current : undefined;
}
