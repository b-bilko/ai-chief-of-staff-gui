/**
 * Every date and weekday written into the vault comes from here.
 *
 * The vault's operating instructions are emphatic about this: dates are derived
 * from the IANA timezone in `config/profile.md`, never from the machine clock.
 * A phone in a different zone than its owner's profile will otherwise write the
 * evening wrap into yesterday's file, correctly formatted, with nothing in the
 * output saying so. `dates.guard.test.ts` fails the build if date formatting
 * appears anywhere outside this module.
 *
 * All functions work on civil (calendar) dates rather than instants, so day
 * arithmetic is unaffected by DST transitions: subtracting 14 days from a date
 * always lands on the same wall-clock day of the month, which is what the
 * tracker's staleness rule means by "fourteen or more days ago".
 */

/** A calendar date in the profile's timezone, `YYYY-MM-DD`. */
export type VaultDate = string;

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export class InvalidTimezoneError extends Error {
  constructor(readonly timezone: string) {
    super(
      `"${timezone}" is not a valid IANA timezone. The vault needs a real zone ` +
        `(for example "Europe/Lisbon") in config/profile.md before any date can be written.`,
    );
    this.name = "InvalidTimezoneError";
  }
}

export class InvalidDateError extends Error {
  constructor(readonly value: string) {
    super(`"${value}" is not a YYYY-MM-DD date.`);
    this.name = "InvalidDateError";
  }
}

/** `+01:00` and friends: accepted by Intl, but not a zone. */
const FIXED_OFFSET = /^[+-]\d{2}:?\d{2}$/;

/**
 * Resolve a user-supplied zone to its canonical IANA name, or `null`.
 *
 * Intl accepts more than IANA region/city names and quietly canonicalises the
 * rest: `PST` becomes `America/Los_Angeles`, `Japan` becomes `Asia/Tokyo`. That
 * is useful at setup — the profile should record the canonical name, which is
 * what "ask for a city if they do not know the IANA name, then write the IANA
 * name" asks for — so aliases are accepted and normalised rather than refused.
 *
 * Fixed UTC offsets are the exception and are rejected outright. `+01:00` looks
 * like a timezone and behaves like one until DST, at which point every date
 * silently shifts by an hour and, around midnight, by a whole day. That is the
 * exact failure this module exists to prevent, so it cannot be stored.
 */
export function canonicalizeTimezone(timezone: string): string | null {
  if (!timezone || FIXED_OFFSET.test(timezone.trim())) return null;

  let resolved: string;
  try {
    resolved = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone.trim(),
    }).resolvedOptions().timeZone;
  } catch {
    // Intl throws RangeError for unknown zones; anything else is also a reject.
    return null;
  }

  if (FIXED_OFFSET.test(resolved)) return null;
  if (resolved === "UTC") return "UTC";

  // Prefer an exact match against the runtime's canonical zone list. Hermes
  // ships a reduced Intl on some platforms, so fall back to the shape of a
  // region/city identifier when the list is unavailable.
  const supported =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : null;
  if (supported) return supported.includes(resolved) ? resolved : null;
  return resolved.includes("/") ? resolved : null;
}

/**
 * True if the string names a real IANA zone, directly or via an alias.
 *
 * Used at setup to reject a typo before it is written into the profile, where
 * it would poison every subsequent date.
 */
export function isValidTimezone(timezone: string): boolean {
  return canonicalizeTimezone(timezone) !== null;
}

function assertTimezone(timezone: string): void {
  if (!isValidTimezone(timezone)) throw new InvalidTimezoneError(timezone);
}

/**
 * Fail loudly at startup if the runtime cannot do timezone-aware formatting.
 *
 * React Native's Hermes engine has shipped reduced Intl builds on Android,
 * where an unsupported `timeZone` is ignored rather than throwing. Silently
 * falling back to the device zone is the worst possible outcome here — every
 * date would look right and be wrong — so check once, up front, that a known
 * offset actually takes effect.
 */
export function assertIntlSupport(): void {
  const probe = new Date("2026-07-25T02:00:00Z");
  const inLisbon = today("Europe/Lisbon", probe);
  const inLosAngeles = today("America/Los_Angeles", probe);
  if (inLisbon !== "2026-07-25" || inLosAngeles !== "2026-07-24") {
    throw new Error(
      "This runtime cannot format dates in an arbitrary timezone " +
        `(got ${inLisbon} / ${inLosAngeles}, expected 2026-07-25 / 2026-07-24). ` +
        "Every date written to the vault would be wrong. Build with full ICU support.",
    );
  }
}

/** Split a `YYYY-MM-DD` string into numeric parts. */
function parseYmd(date: VaultDate): { year: number; month: number; day: number } {
  const match = YMD.exec(date);
  if (!match) throw new InvalidDateError(date);
  const [, year, month, day] = match;
  return { year: Number(year), month: Number(month), day: Number(day) };
}

function formatYmd(year: number, month: number, day: number): VaultDate {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;
}

/**
 * The calendar date it currently is in `timezone`.
 *
 * This is the equivalent of the vault's `TZ=<zone> date +%Y-%m-%d`, and it is
 * the only correct way to answer "which daily note does this belong in".
 */
export function today(timezone: string, now: Date = new Date()): VaultDate {
  assertTimezone(timezone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((p) => p.type === type);
    if (!part) throw new Error(`Intl did not return a "${type}" part for ${timezone}`);
    return part.value;
  };

  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * The English weekday name for a calendar date.
 *
 * Equivalent to `TZ=<zone> date +%A`. Never infer this by reasoning about an ISO
 * string — that is exactly the mistake the vault instructions call out.
 *
 * The date is interpreted as noon UTC so that the zone offset can never push it
 * onto an adjacent day.
 */
export function weekday(date: VaultDate, timezone: string): string {
  assertTimezone(timezone);
  const { year, month, day } = parseYmd(date);
  const instant = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
  }).format(instant);
}

/** Today's weekday in the profile timezone. */
export function todayWeekday(timezone: string, now: Date = new Date()): string {
  return weekday(today(timezone, now), timezone);
}

/**
 * Shift a calendar date by whole days. Negative goes backwards.
 *
 * Civil-date arithmetic, so a DST transition in the window cannot move the
 * result by a day the way instant-based arithmetic can.
 */
export function addDays(date: VaultDate, days: number): VaultDate {
  const { year, month, day } = parseYmd(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return formatYmd(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
}

/** The date `days` before today in the profile timezone. */
export function daysAgo(days: number, timezone: string, now: Date = new Date()): VaultDate {
  return addDays(today(timezone, now), -days);
}

/** Whole days from `from` to `to`; negative if `to` is earlier. */
export function daysBetween(from: VaultDate, to: VaultDate): number {
  const a = parseYmd(from);
  const b = parseYmd(to);
  const msPerDay = 86_400_000;
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / msPerDay,
  );
}

/**
 * How many days old something captured on `date` is, as of today.
 *
 * The tracker's staleness rule is "fourteen or more days", drawn at the same
 * number by both the wrap and the weekly recap, so an item sitting at exactly
 * fourteen days is caught rather than falling between two definitions.
 */
export function ageInDays(date: VaultDate, timezone: string, now: Date = new Date()): number {
  return daysBetween(date, today(timezone, now));
}

/** True if `date` is strictly before today in the profile timezone. */
export function isBeforeToday(date: VaultDate, timezone: string, now: Date = new Date()): boolean {
  return daysBetween(date, today(timezone, now)) > 0;
}

/** True if the string is a well-formed and real calendar date. */
export function isValidDate(value: string): boolean {
  const match = YMD.exec(value);
  if (!match) return false;
  const { year, month, day } = parseYmd(value);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  // Round-trip through Date to reject 2026-02-30 and friends.
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/** The filename a daily note for this date lives at, relative to the vault root. */
export function dailyNotePath(date: VaultDate): string {
  if (!isValidDate(date)) throw new InvalidDateError(date);
  return `daily/${date}.md`;
}
