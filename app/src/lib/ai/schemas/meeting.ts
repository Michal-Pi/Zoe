import { z } from "zod";

export const meetingClassificationSchema = z.object({
  classifications: z.array(
    z.object({
      event_id: z.string(),
      decision_density: z
        .enum(["high", "medium", "low"])
        .describe(
          "high = strategic decisions expected, budget/roadmap/hiring. medium = operational decisions, status updates with action items. low = informational, social, standup."
        ),
      ownership_load: z
        .enum(["organizer", "presenter", "contributor", "passive"])
        .describe(
          "organizer = user created it and drives the agenda. presenter = user is presenting or demoing. contributor = user expected to provide input. passive = user is optional or observing."
        ),
      efficiency_risks: z
        .array(z.string())
        .describe(
          "List of risks. E.g., 'no_agenda', 'back_to_back', 'recurring_stale', 'too_many_attendees', 'no_prep_time'."
        ),
      prep_time_needed_minutes: z
        .number()
        .int()
        .min(0)
        .max(60)
        .describe(
          "Minutes of prep needed before this meeting. 0 for casual/standup, 15-30 for decisions, 30-60 for presentations."
        ),
    })
  ),
});

export type MeetingClassification = z.infer<typeof meetingClassificationSchema>;
