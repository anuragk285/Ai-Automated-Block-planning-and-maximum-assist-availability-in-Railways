/**
 * Shared 24-hour time formatting utility for Indian Railways system.
 * Converts numeric hours, minute offsets, or string timestamps into standardized 'HH:MM' (24hr).
 */
export function formatTime24(timeValue: string | number | null | undefined): string {
  if (timeValue === null || timeValue === undefined) {
    return '00:00';
  }

  // Case 1: Numeric decimal hours (e.g. 14.5 -> "14:30")
  if (typeof timeValue === 'number') {
    let totalMinutes = 0;
    if (timeValue <= 24.0) {
      totalMinutes = Math.round(timeValue * 60);
    } else {
      // Minutes from midnight (e.g. 870 -> 14:30)
      totalMinutes = Math.round(timeValue);
    }

    const hours = Math.floor((totalMinutes / 60) % 24);
    const minutes = Math.floor(totalMinutes % 60);
    const formattedHours = hours < 10 ? `0${hours}` : `${hours}`;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${formattedHours}:${formattedMinutes}`;
  }

  // Case 2: String inputs
  const strVal = String(timeValue).trim();

  // If already "HH:MM" format
  if (/^\d{1,2}:\d{2}$/.test(strVal)) {
    const [hStr, mStr] = strVal.split(':');
    const h = parseInt(hStr, 10);
    const formattedH = h < 10 ? `0${h}` : `${h}`;
    return `${formattedH}:${mStr}`;
  }

  // If ISO Datetime string
  if (strVal.includes('T')) {
    try {
      const date = new Date(strVal);
      const h = date.getHours();
      const m = date.getMinutes();
      const formattedH = h < 10 ? `0${h}` : `${h}`;
      const formattedM = m < 10 ? `0${m}` : `${m}`;
      return `${formattedH}:${formattedM}`;
    } catch {
      // fallback
    }
  }

  // If numeric string
  const numParsed = parseFloat(strVal);
  if (!isNaN(numParsed)) {
    return formatTime24(numParsed);
  }

  return '00:00';
}
