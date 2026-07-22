import type { SVGProps } from "react";
import type { TournamentTabValue } from "@/lib/tournament-public-view";

// Custom line icons for the tournament tabs. Single consistent stroke style
// (24x24 viewBox, currentColor, round caps) so they read as one set and inherit
// the active/inactive text color from the nav.
type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

// Структура — bracket / tree of stages.
function StructureIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4" width="6" height="4" rx="1.2" />
      <rect x="3" y="16" width="6" height="4" rx="1.2" />
      <rect x="15" y="10" width="6" height="4" rx="1.2" />
      <path d="M9 6h3v6h3M9 18h3v-6" />
    </svg>
  );
}

// Расписание — calendar.
function ScheduleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="5" width="17" height="15" rx="2.2" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
      <path d="M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2" />
    </svg>
  );
}

// Мои матчи — gamepad / controller.
function MyMatchesIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 8.5h10a4.5 4.5 0 0 1 4.4 5.4l-.5 2.6A2.6 2.6 0 0 1 16.6 17l-1.3-1.5a2 2 0 0 0-1.5-.7h-3.6a2 2 0 0 0-1.5.7L7.4 17a2.6 2.6 0 0 1-4.8-.5l-.5-2.6A4.5 4.5 0 0 1 6.5 8.5" />
      <path d="M6 11.5v2M5 12.5h2" />
      <circle cx="15.5" cy="11.5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="13" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Состав — shield with a check (confirmed roster).
function RosterIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.2 5 5.6v5.2c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V5.6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

// Участники — group of people.
function ParticipantsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 14.5a5.5 5.5 0 0 1 3 4.5" />
    </svg>
  );
}

// Правила — scroll / document with lines.
function RulesIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 3.5h9l4 4v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
      <path d="M14.5 3.5V8h4.5" />
      <path d="M8 12h8M8 15.5h8M8 8.5h3" />
    </svg>
  );
}

export const tournamentTabIcons: Record<TournamentTabValue, (props: IconProps) => JSX.Element> = {
  structure: StructureIcon,
  matches: ScheduleIcon,
  "my-matches": MyMatchesIcon,
  roster: RosterIcon,
  participants: ParticipantsIcon,
  rules: RulesIcon,
};
