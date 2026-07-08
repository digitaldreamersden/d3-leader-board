/**
 * Event-specific constants. Update these per event.
 */
export const EVENT_TITLE = "Digital Dreamers Den (D3) Meetup #8 Activity";

/**
 * Milestone configuration type.
 */
export interface MilestoneConfig {
  id: number;
  title: string;
  subtitle: string;
}

// export const INITIAL_MILESTONES: MilestoneConfig[] = [
//   { id: 1, title: "Step 1", subtitle: "Do the first thing" },
//   { id: 2, title: "Step 2", subtitle: "Do the second thing" },
// ];


/**
 * Default milestones for the activity. Update this array per event.
 * Leave empty if you want to add milestones manually from the UI.
 */
export const INITIAL_MILESTONES: MilestoneConfig[] = [];
