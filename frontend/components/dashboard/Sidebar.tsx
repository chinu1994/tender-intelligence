import type { ReactNode } from "react";

/* ----------------------------- Icons ----------------------------- */
// Same outline style everywhere (18px, 1.8 stroke, currentColor).

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const HomeIcon = () => (
  <svg {...iconProps}>
    <path d="M3 10.5L12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9.5" />
  </svg>
);

const UsersIcon = () => (
  <svg {...iconProps}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6" />
    <path d="M16 4.6a3.5 3.5 0 010 6.8" />
    <path d="M18 14.3c2.2.7 3.5 2.7 3.5 5.7" />
  </svg>
);

const FolderIcon = () => (
  <svg {...iconProps}>
    <path d="M3 7a2 2 0 012-2h4l2 2.5h8a2 2 0 012 2V17a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
  </svg>
);

const FileIcon = () => (
  <svg {...iconProps}>
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
    <path d="M14 3v5h5" />
  </svg>
);

const DatabaseIcon = () => (
  <svg {...iconProps}>
    <ellipse cx="12" cy="5.5" rx="8" ry="3" />
    <path d="M4 5.5v6.5c0 1.7 3.6 3 8 3s8-1.3 8-3V5.5" />
    <path d="M4 12v6.5c0 1.7 3.6 3 8 3s8-1.3 8-3V12" />
  </svg>
);

const CheckSquareIcon = () => (
  <svg {...iconProps}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
    <path d="M8 12.5l2.8 2.8L16.5 9.5" />
  </svg>
);

const PencilIcon = () => (
  <svg {...iconProps}>
    <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1z" />
    <path d="M14.5 6.5l3 3" />
  </svg>
);

const ProposalIcon = () => (
  <svg {...iconProps}>
    <path d="M6 3h9l4 4v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" />
    <path d="M14 3v5h5" />
    <path d="M8.5 13h7M8.5 17h5" />
  </svg>
);

const CasesIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
    <path d="M3 13h18" />
  </svg>
);

/* ------------------------------ Nav ------------------------------ */

type NavItem = {
  label: string;
  icon: ReactNode;
  href?: string; // no href = "Soon" placeholder
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: <HomeIcon />, href: "/dashboard" },
  { label: "Cases", icon: <CasesIcon />, href: "/dashboard/cases" },
  { label: "Users", icon: <UsersIcon />, href: "/dashboard/users" },
  {
    label: "Opportunities",
    icon: <FolderIcon />,
    href: "/dashboard/opportunities",
  },
  { label: "Documents", icon: <FileIcon />, href: "/dashboard/documents" },
  {
    label: "Knowledge Base",
    icon: <DatabaseIcon />,
    href: "/dashboard/knowledge-base",
  },
  {
    label: "Requirements",
    icon: <CheckSquareIcon />,
    href: "/dashboard/requirements",
  },
  { label: "Review", icon: <PencilIcon />, href: "/dashboard/review" },
  { label: "Proposal", icon: <ProposalIcon />, href: "/dashboard/proposal" },
];

type SidebarProps = {
  active: string; // label of the active item, e.g. "Documents"
  user?: { email: string; role: string } | null;
  onSignOut?: () => void;
};

export default function Sidebar({ active, user, onSignOut }: SidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-white/10 bg-[#0a0f1c]/90 backdrop-blur-xl lg:flex lg:flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-bold text-white shadow-lg shadow-blue-500/30">
          T
        </div>

        <div>
          <div className="text-lg font-bold leading-none tracking-tight">
            Tender<span className="text-blue-400">IQ</span>
          </div>

          <p className="mt-1.5 text-[11px] leading-none text-slate-500">
            Intelligent tender workspace
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav
        aria-label="Main navigation"
        className="flex-1 space-y-1.5 overflow-y-auto px-4 py-6"
      >
        {NAV_ITEMS.map((item) => {
          if (!item.href) {
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-500"
              >
                {item.icon}
                {item.label}
                <span className="ml-auto text-[10px] uppercase tracking-wider">
                  Soon
                </span>
              </div>
            );
          }

          const isActive = item.label === active;

          return (
            <a
              key={item.label}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={
                isActive
                  ? "relative flex items-center gap-3 rounded-xl bg-blue-500/10 px-4 py-3 text-sm font-medium text-blue-300"
                  : "relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
              }
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-blue-400" />
              )}
              {item.icon}
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* User + sign out */}
      <div className="border-t border-white/10 p-4">
        {user && (
          <div className="rounded-xl bg-white/[0.04] p-4">
            <p className="truncate text-sm font-medium">{user.email}</p>
            <p className="mt-1 text-xs capitalize text-slate-500">
              {user.role}
            </p>
          </div>
        )}

        <button
          onClick={onSignOut}
          className="mt-3 w-full rounded-xl px-4 py-2.5 text-left text-sm text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}