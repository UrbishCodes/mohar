import { statusName, type EscrowAccount } from "./mohar";

export type Role = "Client" | "Freelancer" | "Arbiter" | "Viewer";

export interface NextMove {
  /** is it this wallet's move? drives the "Your move" chip + card border */
  move: boolean;
  /** the one-line "what happens next" copy */
  headline: string;
  /** card CTA label (navigates to the detail page) */
  cta?: string;
}

/**
 * Role + status → the single next move. One source of truth for the
 * dashboard cards and the detail action panel (design board v2:
 * "every screen answers 'what is my move?'").
 */
export function nextMove(
  escrow: EscrowAccount,
  role: Role,
  pastDeadline: boolean
): NextMove {
  const status = statusName(escrow.status);

  if (status === "Released")
    return { move: false, headline: "Paid in full." };
  if (status === "Refunded")
    return { move: false, headline: "Refunded to the client." };
  if (status === "Resolved")
    return { move: false, headline: "Settled by the arbiter." };

  if (status === "Disputed") {
    if (role === "Arbiter")
      return {
        move: true,
        headline: "A dispute is open. Decide where the funds go.",
        cta: "Review dispute",
      };
    return {
      move: false,
      headline: "Waiting on the arbiter to resolve the dispute.",
    };
  }

  if (role === "Arbiter")
    return {
      move: false,
      headline: "You are the arbiter. Nothing to do unless a dispute is raised.",
    };
  if (role === "Viewer")
    return {
      move: false,
      headline: "Connect the client, freelancer or arbiter wallet to take action.",
    };

  if (status === "Funded") {
    if (role === "Freelancer")
      return {
        move: true,
        headline: "Funds are locked. Accept the job to begin.",
        cta: "Accept job",
      };
    // client
    if (pastDeadline)
      return {
        move: true,
        headline: "The deadline passed with no accept. Reclaim your funds.",
        cta: "Reclaim funds",
      };
    return {
      move: false,
      headline: "Waiting on the freelancer to accept. You can refund until then.",
    };
  }

  if (status === "InProgress") {
    if (role === "Freelancer") {
      if (pastDeadline)
        return {
          move: true,
          headline:
            "The deadline passed and the client has not released. You can claim.",
          cta: "Claim funds",
        };
      return {
        move: true,
        headline: "Ship the work, then mark it delivered.",
        cta: "Mark as delivered",
      };
    }
    return {
      move: false,
      headline: "The freelancer accepted. Waiting on delivery.",
    };
  }

  // Delivered
  if (role === "Client")
    return {
      move: true,
      headline:
        "The freelancer marked this delivered. Check the work, then release payment.",
      cta: "Release payment",
    };
  if (pastDeadline)
    return {
      move: true,
      headline:
        "The client has not released and the deadline passed. You can claim.",
      cta: "Claim funds",
    };
  return { move: false, headline: "Waiting on the client to release." };
}

export function isTerminal(status: string): boolean {
  return status === "Released" || status === "Refunded" || status === "Resolved";
}
