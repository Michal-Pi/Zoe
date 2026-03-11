import { generateObject } from "ai";
import { models } from "@/lib/ai/providers";
import { meetingClassificationSchema } from "@/lib/ai/schemas/meeting";
import { buildMeetingClassificationPrompt } from "@/lib/ai/prompts/classify-meetings";
import { createServiceRoleClient } from "@/lib/supabase/server";

function clampPrepMinutes(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(60, Math.round(value)));
}

// Classify unclassified calendar events for a user
export async function classifyMeetings(userId: string): Promise<{
  classified: number;
  errors: number;
}> {
  const supabase = await createServiceRoleClient();

  // Fetch user timezone for accurate "today" calculation
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .single();

  // Use user's timezone or UTC as fallback for "today" calculation
  const tz = profile?.timezone ?? "UTC";
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
  const todayStart = new Date(`${todayStr}T00:00:00`);

  const { data: events, error } = await supabase
    .from("calendar_events")
    .select(
      "id, title, description, start_at, end_at, is_organizer, attendee_count, is_recurring, location"
    )
    .eq("user_id", userId)
    .is("decision_density", null)
    .gte("start_at", todayStart.toISOString())
    .order("start_at")
    .limit(20);

  if (error || !events?.length) return { classified: 0, errors: 0 };

  // Get user email for context
  const { data: emailProfile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single();

  const userEmail = emailProfile?.email ?? "user";

  try {
    const prompt = buildMeetingClassificationPrompt(
      events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        startAt: e.start_at,
        endAt: e.end_at,
        isOrganizer: e.is_organizer,
        attendeeCount: e.attendee_count,
        isRecurring: e.is_recurring,
        location: e.location,
      })),
      userEmail
    );

    const { object } = await generateObject({
      model: models.fast,
      schema: meetingClassificationSchema,
      prompt,
    });

    let classified = 0;
    let errors = 0;

    // Check for back-to-back meetings
    const sortedEvents = [...events].sort(
      (a, b) =>
        new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );

    const backToBackIds = new Set<string>();
    for (let i = 1; i < sortedEvents.length; i++) {
      const prevEnd = new Date(sortedEvents[i - 1].end_at).getTime();
      const currStart = new Date(sortedEvents[i].start_at).getTime();
      if (currStart - prevEnd < 5 * 60 * 1000) {
        backToBackIds.add(sortedEvents[i - 1].id);
        backToBackIds.add(sortedEvents[i].id);
      }
    }

    for (const classification of object.classifications) {
      const prepMinutes = clampPrepMinutes(
        classification.prep_time_needed_minutes
      );
      const risks = [...classification.efficiency_risks];
      if (
        backToBackIds.has(classification.event_id) &&
        !risks.includes("back_to_back")
      ) {
        risks.push("back_to_back");
      }

      // Check if there's a prep block before high-density meetings
      let hasPrepBlock = false;
      if (prepMinutes > 0) {
        const event = events.find((e) => e.id === classification.event_id);
        if (event) {
          const eventStart = new Date(event.start_at);
          const prepWindow = new Date(
            eventStart.getTime() -
              prepMinutes * 60 * 1000
          );

          const { count } = await supabase
            .from("calendar_events")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("start_at", prepWindow.toISOString())
            .lt("end_at", eventStart.toISOString());

          hasPrepBlock = (count ?? 0) === 0; // No conflicts = prep block exists
        }
      }

      const { error: updateError } = await supabase
        .from("calendar_events")
        .update({
          decision_density: classification.decision_density,
          ownership_load: classification.ownership_load,
          efficiency_risks: risks,
          prep_time_needed_minutes: prepMinutes,
          has_prep_block: hasPrepBlock,
        })
        .eq("id", classification.event_id)
        .eq("user_id", userId);

      if (updateError) {
        errors++;
      } else {
        classified++;
      }
    }

    return { classified, errors };
  } catch (err) {
    console.error("Meeting classification error:", err);
    return { classified: 0, errors: events.length };
  }
}
