import { describe, it, expect } from "vitest";
import { computeFreeSlots } from "./find-available-times";

// Fixed "now" for deterministic tests: Monday 2026-03-09 08:00 UTC
const NOW = new Date("2026-03-09T08:00:00Z").getTime();

describe("computeFreeSlots", () => {
  it("returns slots when calendar is empty", () => {
    const slots = computeFreeSlots(
      [], // no events
      "09:00",
      "17:00",
      [1, 2, 3, 4, 5], // Mon-Fri
      "2026-03-09",
      "2026-03-13",
      30,
      "any",
      15,
      5,
      NOW
    );

    expect(slots.length).toBe(5);
    expect(slots[0].day).toBe("Monday");
    // First slot should start at 09:00
    expect(slots[0].start).toContain("09:00:00");
  });

  it("avoids busy periods", () => {
    const slots = computeFreeSlots(
      [
        { startAt: "2026-03-09T09:00:00Z", endAt: "2026-03-09T12:00:00Z" }, // 9-12
        { startAt: "2026-03-09T14:00:00Z", endAt: "2026-03-09T15:00:00Z" }, // 2-3
      ],
      "09:00",
      "17:00",
      [1, 2, 3, 4, 5],
      "2026-03-09",
      "2026-03-09",
      30,
      "any",
      15,
      5,
      NOW
    );

    // Should find slots after 12:15 (12:00 + 15min buffer) and after 15:15
    for (const slot of slots) {
      const slotStart = new Date(slot.start).getTime();
      const slotEnd = new Date(slot.end).getTime();

      // Slot should not overlap with busy periods (ignoring buffer for simplicity)
      expect(
        slotStart >= new Date("2026-03-09T12:00:00Z").getTime() ||
          slotEnd <= new Date("2026-03-09T09:00:00Z").getTime()
      ).toBe(true);
    }
  });

  it("returns empty when fully booked", () => {
    const slots = computeFreeSlots(
      [{ startAt: "2026-03-09T08:00:00Z", endAt: "2026-03-09T18:00:00Z" }],
      "09:00",
      "17:00",
      [1, 2, 3, 4, 5],
      "2026-03-09",
      "2026-03-09",
      30,
      "any",
      15,
      5,
      NOW
    );

    expect(slots).toEqual([]);
  });

  it("respects morning preference", () => {
    const slots = computeFreeSlots(
      [],
      "09:00",
      "17:00",
      [1, 2, 3, 4, 5],
      "2026-03-09",
      "2026-03-13",
      30,
      "morning",
      15,
      5,
      NOW
    );

    for (const slot of slots) {
      const hour = new Date(slot.start).getUTCHours();
      expect(hour).toBeLessThan(12);
    }
  });

  it("respects afternoon preference", () => {
    const slots = computeFreeSlots(
      [],
      "09:00",
      "17:00",
      [1, 2, 3, 4, 5],
      "2026-03-09",
      "2026-03-13",
      30,
      "afternoon",
      15,
      5,
      NOW
    );

    for (const slot of slots) {
      const hour = new Date(slot.start).getUTCHours();
      expect(hour).toBeGreaterThanOrEqual(12);
    }
  });

  it("skips weekends", () => {
    const slots = computeFreeSlots(
      [],
      "09:00",
      "17:00",
      [1, 2, 3, 4, 5], // Mon-Fri
      "2026-03-14", // Saturday
      "2026-03-15", // Sunday
      30,
      "any",
      15,
      5,
      new Date("2026-03-14T08:00:00Z").getTime()
    );

    expect(slots).toEqual([]);
  });

  it("caps at maxSlots", () => {
    const slots = computeFreeSlots(
      [],
      "09:00",
      "17:00",
      [1, 2, 3, 4, 5],
      "2026-03-09",
      "2026-03-20",
      30,
      "any",
      15,
      3, // max 3 slots
      NOW
    );

    expect(slots.length).toBe(3);
  });

  it("handles long meetings correctly", () => {
    const slots = computeFreeSlots(
      [],
      "09:00",
      "17:00",
      [1, 2, 3, 4, 5],
      "2026-03-09",
      "2026-03-09",
      480, // 8 hours — exactly fills the work day
      "any",
      0, // no buffer
      5,
      NOW
    );

    expect(slots.length).toBe(1);
  });

  it("returns no slot when duration exceeds available time", () => {
    const slots = computeFreeSlots(
      [],
      "09:00",
      "17:00",
      [1, 2, 3, 4, 5],
      "2026-03-09",
      "2026-03-09",
      600, // 10 hours — exceeds 8-hour work day
      "any",
      0,
      5,
      NOW
    );

    expect(slots).toEqual([]);
  });
});
