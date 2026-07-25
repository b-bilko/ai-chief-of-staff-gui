import { describe, expect, it } from "vitest";

import {
  InvalidDateError,
  InvalidTimezoneError,
  addDays,
  assertIntlSupport,
  canonicalizeTimezone,
  ageInDays,
  dailyNotePath,
  daysAgo,
  daysBetween,
  isBeforeToday,
  isValidDate,
  isValidTimezone,
  today,
  todayWeekday,
  weekday,
} from "./dates";

// 03:00 on the 25th in Lisbon, but still 19:00 on the 24th in Los Angeles.
// Any function that reads the machine clock instead of the profile zone will
// disagree with one of these two assertions.
const LATE_NIGHT = new Date("2026-07-25T02:00:00Z");

describe("today", () => {
  it("returns the calendar date in the given zone, not the machine's", () => {
    expect(today("Europe/Lisbon", LATE_NIGHT)).toBe("2026-07-25");
    expect(today("America/Los_Angeles", LATE_NIGHT)).toBe("2026-07-24");
    expect(today("Asia/Tokyo", LATE_NIGHT)).toBe("2026-07-25");
  });

  it("a phone in a different zone still writes the profile's day", () => {
    // The scenario the vault instructions warn about: someone whose profile
    // says Lisbon runs an evening wrap while travelling in California. The wrap
    // belongs in Lisbon's file, and the device zone must not get a vote.
    const profileZone = "Europe/Lisbon";
    const deviceZone = "America/Los_Angeles";

    expect(today(profileZone, LATE_NIGHT)).not.toBe(today(deviceZone, LATE_NIGHT));
    expect(dailyNotePath(today(profileZone, LATE_NIGHT))).toBe("daily/2026-07-25.md");
  });

  it("rejects a zone that is not a real IANA name", () => {
    expect(() => today("Europe/Lisboa", LATE_NIGHT)).toThrow(InvalidTimezoneError);
    expect(() => today("", LATE_NIGHT)).toThrow(InvalidTimezoneError);
    // A fixed offset is not a zone: it has no DST rules, so dates written
    // through it drift by an hour twice a year and by a day around midnight.
    expect(() => today("+01:00", LATE_NIGHT)).toThrow(InvalidTimezoneError);
  });
});

describe("isValidTimezone", () => {
  it("accepts real zones and rejects typos", () => {
    expect(isValidTimezone("Europe/Lisbon")).toBe(true);
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("Europe/Lisbao")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
  });

  it("rejects fixed UTC offsets even though Intl accepts them", () => {
    expect(isValidTimezone("+01:00")).toBe(false);
    expect(isValidTimezone("-0800")).toBe(false);
  });
});

describe("canonicalizeTimezone", () => {
  it("passes canonical names through unchanged", () => {
    expect(canonicalizeTimezone("Europe/Lisbon")).toBe("Europe/Lisbon");
    expect(canonicalizeTimezone("UTC")).toBe("UTC");
  });

  it("normalises aliases to the canonical IANA name", () => {
    // Setup asks for a city when the user does not know the IANA name, then
    // writes the IANA name. Accepting "PST" and storing the canonical form is
    // more useful than refusing it.
    expect(canonicalizeTimezone("PST")).toBe("America/Los_Angeles");
    expect(canonicalizeTimezone("Japan")).toBe("Asia/Tokyo");
    expect(canonicalizeTimezone("EST5EDT")).toBe("America/New_York");
  });

  it("trims incidental whitespace", () => {
    expect(canonicalizeTimezone("  Europe/Lisbon  ")).toBe("Europe/Lisbon");
  });

  it("returns null for anything that is not a zone", () => {
    expect(canonicalizeTimezone("+01:00")).toBeNull();
    expect(canonicalizeTimezone("Europe/Lisbao")).toBeNull();
    expect(canonicalizeTimezone("")).toBeNull();
  });
});

describe("assertIntlSupport", () => {
  it("passes on a runtime with full ICU", () => {
    expect(() => assertIntlSupport()).not.toThrow();
  });
});

describe("weekday", () => {
  it("computes the weekday rather than inferring it from the string", () => {
    expect(weekday("2026-07-24", "Europe/Lisbon")).toBe("Friday");
    expect(weekday("2026-03-29", "Europe/Lisbon")).toBe("Sunday");
    expect(weekday("2026-01-01", "Europe/Lisbon")).toBe("Thursday");
  });

  it("is stable across zones for a given calendar date", () => {
    // The date is already civil, so the zone cannot shift which day it names.
    for (const zone of ["Pacific/Auckland", "UTC", "America/Los_Angeles"]) {
      expect(weekday("2026-07-24", zone)).toBe("Friday");
    }
  });

  it("todayWeekday follows the profile zone", () => {
    expect(todayWeekday("Europe/Lisbon", LATE_NIGHT)).toBe("Saturday");
    expect(todayWeekday("America/Los_Angeles", LATE_NIGHT)).toBe("Friday");
  });
});

describe("addDays", () => {
  it("shifts forwards and backwards across month and year boundaries", () => {
    expect(addDays("2026-07-24", 1)).toBe("2026-07-25");
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29"); // leap year
  });

  it("is unaffected by DST transitions", () => {
    // European DST springs forward on 2026-03-29. Instant-based arithmetic can
    // lose or gain an hour here and land on the wrong civil day; this must not.
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-03-30", -2)).toBe("2026-03-28");
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26"); // autumn fall-back
  });
});

describe("daysAgo", () => {
  it("computes the tracker's fourteen-day staleness cutoff", () => {
    expect(daysAgo(14, "Europe/Lisbon", LATE_NIGHT)).toBe("2026-07-11");
    expect(daysAgo(7, "Europe/Lisbon", LATE_NIGHT)).toBe("2026-07-18");
    expect(daysAgo(0, "Europe/Lisbon", LATE_NIGHT)).toBe("2026-07-25");
  });
});

describe("daysBetween and ageInDays", () => {
  it("counts whole days in both directions", () => {
    expect(daysBetween("2026-07-24", "2026-07-25")).toBe(1);
    expect(daysBetween("2026-07-25", "2026-07-24")).toBe(-1);
    expect(daysBetween("2026-07-24", "2026-07-24")).toBe(0);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2); // across DST
  });

  it("treats an item captured exactly fourteen days ago as stale", () => {
    // "Fourteen or more, not more than fourteen" — an item sitting at exactly
    // fourteen days is caught here rather than falling between two definitions.
    const captured = daysAgo(14, "Europe/Lisbon", LATE_NIGHT);
    expect(ageInDays(captured, "Europe/Lisbon", LATE_NIGHT)).toBe(14);
    expect(ageInDays(captured, "Europe/Lisbon", LATE_NIGHT) >= 14).toBe(true);
  });
});

describe("isBeforeToday", () => {
  it("drives the overdue check", () => {
    expect(isBeforeToday("2026-07-24", "Europe/Lisbon", LATE_NIGHT)).toBe(true);
    expect(isBeforeToday("2026-07-25", "Europe/Lisbon", LATE_NIGHT)).toBe(false);
    expect(isBeforeToday("2026-07-26", "Europe/Lisbon", LATE_NIGHT)).toBe(false);
  });

  it("an item due today is not overdue, even late at night", () => {
    expect(isBeforeToday("2026-07-25", "Europe/Lisbon", LATE_NIGHT)).toBe(false);
  });
});

describe("isValidDate", () => {
  it("rejects malformed and impossible dates", () => {
    expect(isValidDate("2026-07-24")).toBe(true);
    expect(isValidDate("2024-02-29")).toBe(true);
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-13-01")).toBe(false);
    expect(isValidDate("26-07-24")).toBe(false);
    expect(isValidDate("2026/07/24")).toBe(false);
    expect(isValidDate("")).toBe(false);
  });
});

describe("dailyNotePath", () => {
  it("builds the vault-relative path", () => {
    expect(dailyNotePath("2026-07-24")).toBe("daily/2026-07-24.md");
  });

  it("refuses to build a path from a bad date", () => {
    expect(() => dailyNotePath("2026-02-30")).toThrow(InvalidDateError);
  });
});
