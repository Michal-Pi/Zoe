interface DraftReplyInput {
  senderName: string | null;
  senderEmail: string;
  subject: string;
  snippet: string | null;
  body: string | null;
  threadContext: string | null;
}

export function buildDraftReplyPrompt(
  input: DraftReplyInput,
  userPriorities: string[],
  writingStyle: string | null
): string {
  const styleSection = writingStyle
    ? `The user's preferred writing style: ${writingStyle}`
    : "Default style: professional, concise, and direct. No excessive formality.";

  const prioritiesSection =
    userPriorities.length > 0
      ? `The user's strategic priorities:\n${userPriorities.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
      : "";

  const threadSection = input.threadContext
    ? `Previous messages in this thread:\n${input.threadContext}\n\n---`
    : "";

  const bodySection = input.body
    ? `Full email body:\n${input.body}`
    : `Email snippet:\n${input.snippet ?? "(no content)"}`;

  return `You are Zoe, writing an email reply on behalf of a busy professional.

${styleSection}
${prioritiesSection}

${threadSection}

Email to reply to:
From: ${input.senderName ?? "Unknown"} <${input.senderEmail}>
Subject: ${input.subject}
${bodySection}

Write a reply that:
- Matches the user's preferred tone and style
- Addresses the key points raised in the email
- Is actionable and specific, not vague
- Is concise — aim for 3-5 sentences unless the topic demands more
- Omit the greeting line if the thread is clearly informal or rapid back-and-forth
- Sign off appropriately for the detected tone
- Do NOT include the subject line in the body text

Output the subject (use "Re: <original subject>"), the body, and the detected tone.`;
}
