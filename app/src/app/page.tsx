import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

const pains = [
  {
    title: "Reactive communication",
    description:
      "Slack and email pull you into other people's priorities before you have a plan for your own day.",
  },
  {
    title: "Meeting overload",
    description:
      "Back-to-back calendars hide how little execution time you actually have and which meetings need prep.",
  },
  {
    title: "Open loops everywhere",
    description:
      "Important threads, follow-ups, and decisions sit across tools with no shared system to close them.",
  },
];

const personas = [
  {
    title: "Founders",
    description:
      "Stay ahead of investor, customer, and team threads without running the day from inbox anxiety.",
  },
  {
    title: "Product leaders",
    description:
      "Keep roadmap, stakeholder, and prep work visible before reactive chatter turns the day into admin.",
  },
  {
    title: "Marketing and consulting",
    description:
      "Handle client follow-ups, coordination work, and message volume from one operating layer instead of five tabs.",
  },
];

const features = [
  {
    title: "Command Center",
    description:
      "Signals from Slack, Gmail, and calendar are converted into ranked, executable activities with rationale and time estimates.",
    icon: <PriorityIcon />,
  },
  {
    title: "Impact Dashboard",
    description:
      "See your real execution time, open loops, and behavioral pattern before you overcommit the day.",
    icon: <PulseIcon />,
  },
  {
    title: "Calendar Intelligence",
    description:
      "Spot decision-heavy meetings, prep risk, back-to-back drag, and where to protect focused work.",
    icon: <CalendarIcon />,
  },
  {
    title: "Smart Drafts and Chat",
    description:
      "Draft replies, meeting briefs, and scheduling suggestions are generated from live context, then reviewed by you before action.",
    icon: <SparkIcon />,
  },
];

const workflow = [
  {
    step: "01",
    title: "Connect your signal layer",
    description:
      "Link Gmail, Google Calendar, and Slack once. Zoe starts ingesting the actual work already happening around you.",
  },
  {
    step: "02",
    title: "Zoe scores what matters",
    description:
      "Threads, meetings, and follow-ups are clustered and ranked against urgency, ownership, and your priorities.",
  },
  {
    step: "03",
    title: "Execute from one place",
    description:
      "Start the top task, prep the meeting, review the draft, or ask Zoe for the next step without bouncing between tabs.",
  },
];

const faqs = [
  {
    question: "Who is Zoe for?",
    answer:
      "Zoe is built for high-autonomy professionals such as founders, product managers, marketers, consultants, and team leads who run their work from Slack, Gmail, and Google Calendar.",
  },
  {
    question: "Does Zoe take actions without approval?",
    answer:
      "No. Drafts and proposed changes are prepared for review first. External actions like sending email or changing calendar events require explicit confirmation.",
  },
  {
    question: "What does setup look like?",
    answer:
      "The onboarding flow is centered on connecting Google and Slack, setting priorities, and getting to the dashboard quickly. The product docs target first value in minutes, not hours.",
  },
  {
    question: "How is Zoe priced?",
    answer:
      "The app is positioned as a $15/month personal professional tool with a 14-day free trial and a signup-led onboarding flow.",
  },
];

const integrations = ["Gmail", "Google Calendar", "Slack", "Priority scoring", "Smart drafts"];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="marketing-glow pointer-events-none absolute inset-x-0 top-0 h-[38rem] bg-[radial-gradient(circle_at_top_left,rgba(108,92,231,0.20),transparent_34%),radial-gradient(circle_at_top_right,rgba(255,107,107,0.14),transparent_26%),linear-gradient(to_bottom,rgba(245,243,255,0.9),rgba(255,255,255,0))]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-24 mx-auto h-px max-w-6xl bg-gradient-to-r from-transparent via-border to-transparent"
        />

        <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-[0_8px_24px_rgba(108,92,231,0.28)]">
                Z
              </div>
              <div>
                <div className="font-display text-lg font-semibold">Zoe</div>
                <div className="text-xs text-muted-foreground">
                  Your unified work brain
                </div>
              </div>
            </Link>

            <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
              <a href="#product" className="transition-colors hover:text-foreground">
                Product
              </a>
              <a href="#workflow" className="transition-colors hover:text-foreground">
                How it works
              </a>
              <a href="#pricing" className="transition-colors hover:text-foreground">
                Pricing
              </a>
              <a href="#faq" className="transition-colors hover:text-foreground">
                FAQ
              </a>
            </div>

            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm" className="shadow-[0_10px_30px_rgba(108,92,231,0.24)]">
                <Link href="/signup">Start free trial</Link>
              </Button>
            </div>
          </div>
        </nav>

        <main>
          <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20">
            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="marketing-reveal">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                  <span className="inline-flex h-2 w-2 rounded-full bg-score-low" />
                  14-day free trial
                  <span className="text-border">/</span>
                  No credit card required
                </div>

                <h1 className="mt-6 max-w-3xl font-display text-5xl font-semibold tracking-[-0.04em] text-foreground sm:text-6xl lg:text-7xl">
                  Stop running your day from notifications.
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
                  Zoe connects your Slack, Gmail, and Google Calendar, then turns
                  incoming noise into a ranked operating system for the day.
                  Built for founders, product leaders, marketers, consultants,
                  and team leads who need to know what matters before the day
                  gets hijacked.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 px-8 text-base shadow-[0_12px_34px_rgba(108,92,231,0.24)]"
                  >
                    <Link href="/signup">Start free trial</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="h-12 px-8 text-base">
                    <a href="#product">See the workflow</a>
                  </Button>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <StatCard label="Built to save" value="10-15h" meta="per week" />
                  <StatCard label="Pricing" value="$15" meta="per month after trial" />
                  <StatCard label="Action policy" value="Review first" meta="before send or change" />
                </div>

                <div className="mt-8 flex flex-wrap gap-2 text-sm text-muted-foreground">
                  {integrations.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-border bg-background/80 px-3 py-1"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="marketing-reveal marketing-stagger-1 relative">
                <div
                  aria-hidden="true"
                  className="marketing-glow absolute -left-10 top-6 h-40 w-40 rounded-full bg-primary/15 blur-3xl"
                />
                <div
                  aria-hidden="true"
                  className="marketing-glow absolute -right-8 bottom-0 h-40 w-40 rounded-full bg-score-high/10 blur-3xl"
                />
                <div className="relative rounded-[2rem] border border-border/70 bg-card/95 p-4 shadow-[0_30px_80px_rgba(45,43,58,0.12)] sm:p-6">
                  <div className="flex items-center justify-between border-b border-border/70 pb-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                        Zoe Command View
                      </p>
                      <h2 className="mt-2 font-display text-2xl font-semibold">
                        Good morning. Here&apos;s what today can actually hold.
                      </h2>
                    </div>
                    <div className="rounded-2xl border border-border bg-background px-3 py-2 text-right">
                      <div className="font-mono text-sm font-semibold text-primary">91</div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        live score
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <PreviewMetric value="2h 10m" label="Real execution time" tone="primary" />
                    <PreviewMetric value="11" label="Active Slack threads" tone="coral" />
                    <PreviewMetric value="4" label="Open loops over 48h" tone="teal" />
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-[1.5rem] border border-primary/20 bg-[linear-gradient(180deg,rgba(108,92,231,0.08),rgba(108,92,231,0.02))] p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
                            Top priority
                          </p>
                          <h3 className="mt-2 font-display text-2xl font-semibold">
                            Prepare for 3pm Roadmap Sync
                          </h3>
                        </div>
                        <span className="rounded-full bg-background px-3 py-1 font-mono text-xs font-medium text-primary">
                          25m
                        </span>
                      </div>

                      <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                        <li className="flex gap-3">
                          <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                          High decision density and you are the organizer.
                        </li>
                        <li className="flex gap-3">
                          <span className="mt-1 h-2 w-2 rounded-full bg-score-high" />
                          Two unresolved Slack threads are already linked to the meeting.
                        </li>
                        <li className="flex gap-3">
                          <span className="mt-1 h-2 w-2 rounded-full bg-score-low" />
                          Zoe can generate the brief, block prep time, or draft the follow-up.
                        </li>
                      </ul>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <ActionChip label="Start now" />
                        <ActionChip label="Generate brief" />
                        <ActionChip label="Ask Zoe" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[1.5rem] border border-border bg-background p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                          Today&apos;s Reality
                        </p>
                        <div className="mt-4 grid gap-3">
                          <MiniMetricRow
                            label="Meetings"
                            value="5h 20m"
                            note="Calendar pressure is already heavy"
                          />
                          <MiniMetricRow
                            label="Reactive activity"
                            value="64%"
                            note="Slack and email are driving the day"
                          />
                          <MiniMetricRow
                            label="Intervention"
                            value="Protect 60m"
                            note="Block deep work before 2pm"
                          />
                        </div>
                      </div>

                      <div className="rounded-[1.5rem] border border-border bg-background p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">Smart draft ready</p>
                          <span className="rounded-full bg-score-low/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-score-low">
                            review first
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">
                          Reply to Sarah&apos;s budget proposal with a concise,
                          decision-ready draft grounded in the thread.
                        </p>
                        <div className="mt-4 rounded-2xl bg-muted p-3 text-sm leading-6 text-foreground">
                          Happy to move this forward. I&apos;ve reviewed the proposal
                          and the budget works if we phase the rollout across two
                          milestones...
                        </div>
                      </div>

                      <div className="rounded-[1.5rem] border border-border bg-background p-4">
                        <p className="text-sm font-medium text-foreground">
                          Calendar intelligence
                        </p>
                        <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                          <PreviewRow
                            title="Roadmap Sync"
                            meta="3:00 PM · Organizer · High density"
                            flag="No prep scheduled"
                          />
                          <PreviewRow
                            title="Weekly standup"
                            meta="11:00 AM · Participant · Low density"
                            flag="Can likely be shortened"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="border-y border-border/60 bg-surface-tertiary/70">
            <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-3">
              <OutcomeCard
                title="For people with real autonomy"
                description="Founders, PMs, marketers, consultants, and team leads who already live in Slack, Gmail, and calendar."
              />
              <OutcomeCard
                title="A system that reacts to reality"
                description="Zoe reprioritizes when meetings move, threads escalate, and new work arrives."
              />
              <OutcomeCard
                title="One operating layer, not five tools"
                description="Dashboard, command center, calendar intelligence, chat, and smart drafts work from the same context."
              />
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="marketing-reveal marketing-stagger-1 grid gap-5 md:grid-cols-3">
              {personas.map((persona) => (
                <PersonaCard
                  key={persona.title}
                  title={persona.title}
                  description={persona.description}
                />
              ))}
            </div>
          </section>

          <section id="product" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <SectionHeading
              eyebrow="Why Zoe"
              title="Most productivity tools ask you to maintain a system. Zoe reads the one you already live in."
              description="Instead of asking you to keep another task list updated, Zoe works from your actual communications, meetings, and follow-ups."
            />

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {pains.map((pain) => (
                <ProblemCard
                  key={pain.title}
                  title={pain.title}
                  description={pain.description}
                />
              ))}
            </div>

            <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {features.map((feature) => (
                <FeatureCard
                  key={feature.title}
                  title={feature.title}
                  description={feature.description}
                  icon={feature.icon}
                />
              ))}
            </div>
          </section>

          <section className="border-y border-border/60 bg-[linear-gradient(180deg,rgba(245,243,255,0.65),rgba(255,255,255,0.95))]">
            <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
              <SectionHeading
                eyebrow="What changes"
                title="A cleaner operating rhythm for the entire day"
                description="Zoe is built to reduce context switching, surface the dominant task, and help you act with less friction."
              />

              <div className="mt-10 grid gap-5 lg:grid-cols-3">
                <ValueCard
                  title="See the day clearly"
                  description="Reality Brief shows real exec time, meeting load, and open loops before you promise yourself a fantasy workload."
                />
                <ValueCard
                  title="Protect focus time"
                  description="Calendar intelligence exposes prep risk, low-value meetings, and where deep work still fits."
                />
                <ValueCard
                  title="Close loops faster"
                  description="Smart drafts, meeting briefs, and contextual chat help you move from signal to action without rebuilding context."
                />
              </div>
            </div>
          </section>

          <section id="workflow" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <SectionHeading
              eyebrow="How it works"
              title="Connect once. Let Zoe keep score."
              description="The app is designed around a simple operating loop: ingest signals, prioritize work, then help you execute."
            />

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {workflow.map((item) => (
                <WorkflowCard
                  key={item.step}
                  step={item.step}
                  title={item.title}
                  description={item.description}
                />
              ))}
            </div>
          </section>

          <section id="pricing" className="border-t border-border/60 bg-surface-tertiary/50">
            <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
              <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary">
                    Pricing
                  </p>
                  <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
                    Simple personal pricing for people who need leverage, not overhead.
                  </h2>
                  <p className="mt-4 max-w-xl text-lg leading-8 text-muted-foreground">
                    One plan for people who want less tool overhead and more
                    operating clarity across inbox, Slack, and meetings.
                  </p>
                </div>

                <div className="rounded-[2rem] border border-primary/20 bg-card p-8 shadow-[0_28px_80px_rgba(45,43,58,0.12)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary">
                        Zoe Individual
                      </p>
                      <div className="mt-4 flex items-end gap-2">
                        <span className="font-display text-6xl font-semibold tracking-[-0.05em]">
                          $15
                        </span>
                        <span className="pb-2 text-base text-muted-foreground">
                          / month
                        </span>
                      </div>
                    </div>
                    <span className="rounded-full bg-score-low/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-score-low">
                      14-day trial
                    </span>
                  </div>

                  <p className="mt-4 text-sm text-muted-foreground">
                    Built for high-autonomy professionals who want one operating
                    layer across communication, meetings, and follow-through.
                  </p>

                  <div className="mt-8 grid gap-3">
                    <PricingLine text="Unified dashboard, command center, calendar view, and chat" />
                    <PricingLine text="Gmail, Google Calendar, and Slack connections" />
                    <PricingLine text="AI ranking, meeting prep, and smart drafts" />
                    <PricingLine text="Review-before-send flow for communication and actions" />
                    <PricingLine text="Onboarding designed to get to first value quickly" />
                  </div>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Button
                      asChild
                      size="lg"
                      className="h-12 flex-1 text-base shadow-[0_12px_34px_rgba(108,92,231,0.24)]"
                    >
                      <Link href="/signup">Start free trial</Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="h-12 flex-1 text-base">
                      <Link href="/login">Log in</Link>
                    </Button>
                  </div>

                  <p className="mt-4 text-xs text-muted-foreground">
                    No credit card required to start. Cancel anytime.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section id="faq" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <SectionHeading
              eyebrow="FAQ"
              title="The questions that matter before signup"
              description="This copy is aimed at removing friction for the right user instead of trying to convince everyone."
            />

            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {faqs.map((item) => (
                <FAQCard
                  key={item.question}
                  question={item.question}
                  answer={item.answer}
                />
              ))}
            </div>
          </section>

          <section className="border-t border-border/60 bg-[linear-gradient(180deg,rgba(108,92,231,0.08),rgba(255,255,255,0.98))]">
            <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary">
                Final CTA
              </p>
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl">
                Open the day with clarity, not inbox guilt.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
                Zoe is built to help you understand what deserves attention,
                what can wait, and what you should do next. If your work already
                lives in Slack, Gmail, and Google Calendar, this is the page to
                turn that workflow into signup.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-12 px-8 text-base shadow-[0_12px_34px_rgba(108,92,231,0.24)]"
                >
                  <Link href="/signup">Start free trial</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 px-8 text-base">
                  <a href="#product">Review the product</a>
                </Button>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-border/60 bg-background">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground">
                Z
              </div>
              <div>
                <div className="font-medium text-foreground">Zoe</div>
                <div>Your unified work brain.</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link href="/login" className="transition-colors hover:text-foreground">
                Log in
              </Link>
              <Link href="/signup" className="transition-colors hover:text-foreground">
                Sign up
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="marketing-reveal max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
        {title}
      </h2>
      <p className="mt-4 text-lg leading-8 text-muted-foreground">{description}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-border bg-card/90 p-4 shadow-sm">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] text-foreground">
        {value}
      </div>
      <div className="mt-1 text-sm text-muted-foreground">{meta}</div>
    </div>
  );
}

function MiniMetricRow({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/50 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-sm font-semibold text-foreground">{value}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function PreviewMetric({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "primary" | "coral" | "teal";
}) {
  const toneClass =
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : tone === "coral"
        ? "bg-score-high/10 text-score-high"
        : "bg-score-low/10 text-score-low";

  return (
    <div className="rounded-[1.2rem] border border-border bg-background p-4">
      <div
        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${toneClass}`}
      >
        Live
      </div>
      <div className="mt-3 font-display text-2xl font-semibold tracking-[-0.04em] text-foreground">
        {value}
      </div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function ActionChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground">
      {label}
    </span>
  );
}

function PreviewRow({
  title,
  meta,
  flag,
}: {
  title: string;
  meta: string;
  flag: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/50 p-3">
      <div className="font-medium text-foreground">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{meta}</div>
      <div className="mt-2 text-xs font-medium text-score-high">{flag}</div>
    </div>
  );
}

function OutcomeCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="marketing-reveal rounded-[1.4rem] border border-border bg-background/85 p-5 shadow-sm">
      <div className="font-display text-xl font-semibold text-foreground">{title}</div>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p>
    </div>
  );
}

function PersonaCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="marketing-reveal rounded-[1.5rem] border border-border bg-card p-6 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
        Ideal fit
      </div>
      <h3 className="mt-3 font-display text-2xl font-semibold tracking-[-0.03em] text-foreground">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p>
    </div>
  );
}

function ProblemCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="marketing-reveal rounded-[1.5rem] border border-border bg-card p-6 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-[0.22em] text-score-high">
        Problem
      </div>
      <h3 className="mt-3 font-display text-2xl font-semibold tracking-[-0.03em] text-foreground">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="marketing-reveal rounded-[1.6rem] border border-border bg-card p-6 shadow-sm transition-transform duration-200 hover:-translate-y-1 hover:shadow-md">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mt-5 font-display text-2xl font-semibold tracking-[-0.03em] text-foreground">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p>
    </div>
  );
}

function ValueCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="marketing-reveal rounded-[1.6rem] border border-border bg-card p-6 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
        Benefit
      </div>
      <h3 className="mt-4 font-display text-2xl font-semibold tracking-[-0.03em] text-foreground">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p>
    </div>
  );
}

function WorkflowCard({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="marketing-reveal rounded-[1.6rem] border border-border bg-card p-6 shadow-sm">
      <div className="font-mono text-sm font-semibold text-primary">{step}</div>
      <h3 className="mt-4 font-display text-2xl font-semibold tracking-[-0.03em] text-foreground">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p>
    </div>
  );
}

function PricingLine({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/80 bg-background p-3">
      <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CheckIcon className="h-3.5 w-3.5" />
      </span>
      <span className="text-sm leading-6 text-foreground">{text}</span>
    </div>
  );
}

function FAQCard({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  return (
    <div className="marketing-reveal rounded-[1.5rem] border border-border bg-card p-6 shadow-sm">
      <h3 className="font-display text-2xl font-semibold tracking-[-0.03em] text-foreground">
        {question}
      </h3>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{answer}</p>
    </div>
  );
}

function PriorityIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 5H16" />
      <path d="M4 10H11" />
      <path d="M4 15H9" />
      <circle cx="15" cy="10" r="3" />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2.5 10H6L8 6L11 14L13 10H17.5" />
      <path d="M2.5 4.5V15.5H17.5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2.75" y="3.75" width="14.5" height="13.5" rx="2" />
      <path d="M2.75 8H17.25" />
      <path d="M6.25 2.25V5.25" />
      <path d="M13.75 2.25V5.25" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 2.5L11.7 7.1L16.5 8.8L11.7 10.5L10 15.2L8.3 10.5L3.5 8.8L8.3 7.1L10 2.5Z" />
      <path d="M15 14L15.7 15.9L17.6 16.6L15.7 17.3L15 19.2L14.3 17.3L12.4 16.6L14.3 15.9L15 14Z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.75 8.25L6.5 11L12.25 5.25" />
    </svg>
  );
}
