import { Bot, Workflow, Presentation, type LucideIcon } from "lucide-react";

/**
 * Event-specific constants for the team-lookup app. Update these per event.
 */

export interface MilestoneItem {
  readonly step: number;
  readonly timeLabel: string;
  readonly title: string;
  readonly goal: string;
  readonly body: string;
  readonly icon: LucideIcon;
}

/**
 * Milestones displayed on the /milestones page.
 * Update this array per event with the activity steps.
 */
export const MILESTONES: readonly MilestoneItem[] = [
  {
    step: 1,
    timeLabel: "0–15 min",
    title: "Define the Persona",
    goal: 'Establish the "Who" and "What."',
    body: "Clearly define your agent\u2019s role, its specific objective, and the tools it needs (like web search or a calculator). By minute 15, you should have your environment set up and your base prompt or configuration initialized.",
    icon: Bot,
  },
  {
    step: 2,
    timeLabel: "15–45 min",
    title: "Architect the Flow",
    goal: "Connect the logic.",
    body: 'This is the core building phase. Use your framework of choice to wire the agent\u2019s reasoning paths. The milestone is hit when your agent can successfully take an input, process it through its logic "brain," and move toward a solution without manual intervention.',
    icon: Workflow,
  },
  {
    step: 3,
    timeLabel: "45–60 min",
    title: "The Live Demo",
    goal: 'Ship the "Vibe."',
    body: 'The final sprint is for refining the output and catching edge cases. To complete the challenge, your agent must successfully execute a "live mission"—producing a final, structured result that proves it can handle the task it was built for.',
    icon: Presentation,
  },
];

/**
 * Sprint page copy. Update per event.
 */
export const SPRINT_TITLE = "Vibe & Build: The 60-Minute Agent Sprint";
export const SPRINT_INTRO =
  'One hour. No overthinking. Just pure flow. This challenge invites you to lean into "vibe coding"—using natural language and AI-assisted tools to manifest a functional AI agent from scratch. Whether you\'re a seasoned dev or a curious builder, it\'s time to see how fast you can turn a prompt into a product.';
