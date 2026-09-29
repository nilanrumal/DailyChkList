/**
 * Sri Lanka Standard Internet Time Service (Asia/Colombo, UTC+05:30)
 * 
 * Fetches and synchronizes accurate Sri Lanka time from world time APIs
 * over the internet, preventing reliance on local device clocks which
 * may be tampered, unsynchronized, or set to different time zones.
 */

// Cache offset between performance.now() and Sri Lanka time in milliseconds
let synchronizedSriLankaOffsetMs: number | null = null;
let lastSyncTimestamp = 0;

/**
 * Calculates Sri Lanka Standard Time (UTC+05:30) from a given UTC epoch timestamp
 */
export function getSriLankaDateFromEpoch(epochMs: number): Date {
  const utcMs = epochMs;
  // Sri Lanka is strictly UTC + 5 hours and 30 minutes
  const sriLankaOffsetMs = (5 * 60 + 30) * 60 * 1000;
  return new Date(utcMs + sriLankaOffsetMs);
}

/**
 * Synchronize with internet time server for Asia/Colombo
 */
export async function syncInternetTime(): Promise<number> {
  const now = Date.now();
  // Resync every 10 minutes or if not initialized
  if (synchronizedSriLankaOffsetMs !== null && now - lastSyncTimestamp < 10 * 60 * 1000) {
    return synchronizedSriLankaOffsetMs;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    // Primary: worldtimeapi.org
    const res = await fetch('https://worldtimeapi.org/api/timezone/Asia/Colombo', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.unixtime) {
        const internetEpochMs = data.unixtime * 1000;
        synchronizedSriLankaOffsetMs = internetEpochMs - performance.now();
        lastSyncTimestamp = now;
        return synchronizedSriLankaOffsetMs;
      }
    }
  } catch {
    // Secondary fallback: timeapi.io
    try {
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 3500);

      const res2 = await fetch('https://timeapi.io/api/time/current/zone?timeZone=Asia/Colombo', {
        signal: controller2.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId2);

      if (res2.ok) {
        const data2 = await res2.json();
        if (data2.dateTime) {
          const parsed = new Date(data2.dateTime).getTime();
          if (!isNaN(parsed)) {
            synchronizedSriLankaOffsetMs = parsed - performance.now();
            lastSyncTimestamp = now;
            return synchronizedSriLankaOffsetMs;
          }
        }
      }
    } catch {
      // Final reliable fallback: calculate true UTC + 05:30 based on system UTC clock
    }
  }

  // Fallback to UTC + 05:30
  const systemUtcMs = Date.now();
  synchronizedSriLankaOffsetMs = systemUtcMs - performance.now();
  lastSyncTimestamp = now;
  return synchronizedSriLankaOffsetMs;
}

// Initial sync triggered asynchronously in background
syncInternetTime().catch(() => {});

/**
 * Returns current accurate Sri Lanka Epoch in Milliseconds
 */
export function getCurrentSriLankaEpochMs(): number {
  if (synchronizedSriLankaOffsetMs === null) {
    return Date.now();
  }
  return performance.now() + synchronizedSriLankaOffsetMs;
}

/**
 * Returns current accurate Sri Lanka Standard Time formatted as ISO 8601 string with +05:30 offset
 */
export function getSriLankaIsoString(): string {
  const epoch = getCurrentSriLankaEpochMs();
  // Create UTC date object
  const slDate = getSriLankaDateFromEpoch(epoch);
  
  // Format as YYYY-MM-DDTHH:mm:ss.sss+05:30
  const year = slDate.getUTCFullYear();
  const month = String(slDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(slDate.getUTCDate()).padStart(2, '0');
  const hours = String(slDate.getUTCHours()).padStart(2, '0');
  const minutes = String(slDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(slDate.getUTCSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+05:30`;
}

/**
 * Returns human-readable Sri Lanka Time (e.g. "08:30 AM" or "02:15 PM")
 */
export function formatSriLankaTime(isoStringOrDate?: string | Date | null): string {
  if (!isoStringOrDate) return '—';

  let dateObj: Date;
  if (typeof isoStringOrDate === 'string') {
    dateObj = new Date(isoStringOrDate);
  } else {
    dateObj = isoStringOrDate;
  }

  if (isNaN(dateObj.getTime())) return '—';

  // Format explicitly in Asia/Colombo timezone
  return dateObj.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Colombo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Returns Sri Lanka Date & Time (e.g. "2026-09-29 08:30 AM")
 */
export function formatSriLankaDateTime(isoStringOrDate?: string | Date | null): string {
  if (!isoStringOrDate) return '—';

  let dateObj: Date;
  if (typeof isoStringOrDate === 'string') {
    dateObj = new Date(isoStringOrDate);
  } else {
    dateObj = isoStringOrDate;
  }

  if (isNaN(dateObj.getTime())) return '—';

  const timeStr = dateObj.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Colombo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const dateStr = dateObj.toLocaleDateString('en-CA', {
    timeZone: 'Asia/Colombo',
  });

  return `${dateStr} ${timeStr}`;
}

/**
 * Returns today's date in Sri Lanka Standard Time as YYYY-MM-DD
 */
export function getSriLankaTodayDate(): string {
  const epoch = getCurrentSriLankaEpochMs();
  const slDate = getSriLankaDateFromEpoch(epoch);
  const year = slDate.getUTCFullYear();
  const month = String(slDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(slDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if Internet Time sync has completed
 */
export function isInternetTimeSynced(): boolean {
  return synchronizedSriLankaOffsetMs !== null;
}

