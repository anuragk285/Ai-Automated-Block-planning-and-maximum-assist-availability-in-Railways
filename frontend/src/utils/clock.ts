import { useState, useEffect } from 'react';

/** Returns a live Date object that updates every second. */
export function useClock(): Date {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return now;
}

/** Format a Date as  DD MMM YYYY */
export function formatDateLong(d: Date): string {
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Format a Date as HH:MM:SS (24-hr IST) */
export function formatTimeIST(d: Date): string {
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
}

/** Format a Date as HH:MM (24-hr IST) — no seconds */
export function formatTimeISTShort(d: Date): string {
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
}

/** Return current hour (0-23) in IST – used to decide if a window is "now" on the Gantt */
export function getCurrentHourIST(): number {
  const d = new Date();
  const istStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
  return parseInt(istStr.split(':')[0], 10);
}
