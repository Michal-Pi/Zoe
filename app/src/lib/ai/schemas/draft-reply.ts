import { z } from "zod";

export const draftReplySchema = z.object({
  subject: z
    .string()
    .describe(
      "Email subject line. For replies, use 'Re: <original subject>'. For follow-ups, use 'Follow-up: <meeting title>'."
    ),
  body: z
    .string()
    .describe(
      "Email body text. Match the user's writing style. Be concise and actionable."
    ),
  tone: z
    .enum(["professional", "casual", "direct", "empathetic"])
    .describe(
      "Detected tone of the draft. professional = formal business. casual = friendly. direct = terse and to-the-point. empathetic = warm and understanding."
    ),
});

export type DraftReplyOutput = z.infer<typeof draftReplySchema>;

export const followUpDraftSchema = z.object({
  subject: z
    .string()
    .describe("Follow-up email subject, e.g., 'Follow-up: Roadmap Sync'"),
  body: z
    .string()
    .describe(
      "Follow-up email body with key points discussed, action items, and next steps."
    ),
  action_items: z
    .array(
      z.object({
        assignee: z.string().describe("Name or email of the person responsible"),
        action: z.string().describe("What they need to do"),
        deadline: z
          .string()
          .nullable()
          .describe("When it's due, if mentioned"),
      })
    )
    .describe("Action items extracted from the meeting context"),
});

export type FollowUpDraftOutput = z.infer<typeof followUpDraftSchema>;
