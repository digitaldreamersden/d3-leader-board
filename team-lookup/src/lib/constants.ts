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
    timeLabel: "0–10 min",
    title: "Define the Problem",
    goal: 'Establish the "Why" and "Who."',
    body: "Pick a use case/product, define the problem and users, and identify the agents and their responsibilities.",
    icon: Bot,
  },
  {
    step: 2,
    timeLabel: "10–30 min",
    title: "Design the System",
    goal: 'Map the "How."',
    body: 'Design the architecture: agents, LLMs, tools, data, memory, orchestration, and human-in-the-loop. Map the flow from user input to outcome.',
    icon: Workflow,
  },
  {
    step: 3,
    timeLabel: "30–45 min",
    title: "Present & Defend",
    goal: 'Prove the design.',
    body: 'Walk through one user journey, explain key design decisions and trade-offs, and highlight how your system handles failures and real-world constraints.',
    icon: Presentation,
  },
];

/**
 * Sprint page copy. Update per event.
 */
export const SPRINT_TITLE = "Agentic Systems: The 45-Minute System Design Sprint";
export const SPRINT_INTRO =
  "Pick a real problem. Think like a systems architect. Design an agentic system that could solve it.\n\nIn this group activity, choose a real-world use case or existing agentic product and design the system behind it. Focus on understanding the agents, tools, data, orchestration, and decisions that make the system work.";
