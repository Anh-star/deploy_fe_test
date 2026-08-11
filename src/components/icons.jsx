const baseSvgStyle = {
  display: "block",
};

export function SearchIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2" />
      <path d="M20 20L16.65 16.65" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
export function BellIcon({ size = 18, color = "currentColor", strokeWidth = 1.8 }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.8V5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 9.8C17 7.05 14.75 4.8 12 4.8C9.25 4.8 7 7.05 7 9.8V13.2L5.5 16H18.5L17 13.2V9.8Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 18.2C10.45 19.25 11.2 20 12 20C12.8 20 13.55 19.25 14 18.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function UploadIcon({ size = 14, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 16V6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M8.5 9.5L12 6L15.5 9.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 18H19" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 12, color = "currentColor" }) {
  return <span style={{ color, fontSize: size, lineHeight: 1 }}>›</span>;
}

export function EyeIcon({ size = 14, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 12C3.8 8.9 7.3 7 12 7C16.7 7 20.2 8.9 22 12C20.2 15.1 16.7 17 12 17C7.3 17 3.8 15.1 2 12Z" stroke={color} strokeWidth="2" />
      <circle cx="12" cy="12" r="3" fill={color} />
    </svg>
  );
}

export function BookmarkIcon({ size = 14, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 4H17V20L12 16.5L7 20V4Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function StarIcon({ size = 14, color = "currentColor" }) {
  return <span style={{ color, fontSize: size, lineHeight: 1 }}>★</span>;
}

export function ChevronLeftIcon({ size = 12, color = "currentColor" }) {
  return <span style={{ color, fontSize: size, lineHeight: 1 }}>‹</span>;
}

export function ShieldIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3L19 6V11C19 15.4 16.2 19.4 12 21C7.8 19.4 5 15.4 5 11V6L12 3Z" stroke={color} strokeWidth="2" />
      <path d="M9 11L11 13L15 9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GiftIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="9" width="16" height="11" stroke={color} strokeWidth="2" />
      <path d="M12 9V20" stroke={color} strokeWidth="2" />
      <path d="M4 13H20" stroke={color} strokeWidth="2" />
      <path d="M12 9H9.5C8.4 9 7.5 8.1 7.5 7C7.5 5.9 8.4 5 9.5 5C11.2 5 12 7 12 9Z" stroke={color} strokeWidth="2" />
      <path d="M12 9H14.5C15.6 9 16.5 8.1 16.5 7C16.5 5.9 15.6 5 14.5 5C12.8 5 12 7 12 9Z" stroke={color} strokeWidth="2" />
    </svg>
  );
}

export function GlobeIcon({ size = 14, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      <path d="M3 12H21" stroke={color} strokeWidth="2" />
      <path d="M12 3C14.5 5.4 16 8.6 16 12C16 15.4 14.5 18.6 12 21" stroke={color} strokeWidth="2" />
      <path d="M12 3C9.5 5.4 8 8.6 8 12C8 15.4 9.5 18.6 12 21" stroke={color} strokeWidth="2" />
    </svg>
  );
}

export function LanguageIcon({ size = 14, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7H14" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M9 5V7" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M6 11C8 10 10 8 11 6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M8 9C9 10.5 10.5 12 12 13" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M16 8L20 19" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M14 14H22" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function DocumentIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3H14L19 8V21H7V3Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 3V8H19" stroke={color} strokeWidth="2" />
    </svg>
  );
}

export function UsersIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="3" stroke={color} strokeWidth="2" />
      <circle cx="17" cy="10" r="2" stroke={color} strokeWidth="2" />
      <path d="M4 19C4 16.8 6.2 15 9 15C11.8 15 14 16.8 14 19" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M15 18C15.2 16.7 16.4 15.8 18 15.7" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function DownloadIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4V14" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M8 10L12 14L16 10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19H19" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function TrophyIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 4H16V8C16 10.2 14.2 12 12 12C9.8 12 8 10.2 8 8V4Z" stroke={color} strokeWidth="2" />
      <path d="M9 21H15" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M12 12V21" stroke={color} strokeWidth="2" />
      <path d="M16 6H19C19 8.2 17.7 10 16 10" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M8 6H5C5 8.2 6.3 10 8 10" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}



export function LinkIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FacebookIcon({ size = 16, color = "currentColor" }) {
  return <span style={{ color, fontSize: size, fontWeight: 700, lineHeight: 1 }}>f</span>;
}

export function YoutubeIcon({ size = 16, color = "currentColor" }) {
  return <span style={{ color, fontSize: size, lineHeight: 1 }}>▶</span>;
}

export function LinkedinIcon({ size = 16, color = "currentColor" }) {
  return <span style={{ color, fontSize: size, fontWeight: 700, lineHeight: 1 }}>in</span>;
}

export function AlertIcon({ size = 16 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-triangle-alert-icon lucide-triangle-alert"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
  );
}

export function MessageIcon({ size = 16 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-circle-more-icon lucide-message-circle-more"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/></svg>
  );
}

export function PlusIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  );
}

export function HeartIcon({ size = 16 }) {
  return <span style={{ fontSize: size }}>❤️</span>;
}

export function ShareIcon({ size = 16 }) {
  return <span style={{ fontSize: size }}>🔗</span>;
}

export function ListIcon({ size = 16 }) {
  return <span style={{ fontSize: size }}>📋</span>;
}

export function ClockIcon({ size = 16 }) {
  return (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-clock-icon lucide-clock"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
  );
}

export function MaximizeIcon({ size = 16 }) {
  return <span style={{ fontSize: size }}>⛶</span>;
}

export function MinusIcon({ size = 16 }) {
  return <span style={{ fontSize: size }}>➖</span>;
}

export function UserCircleIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export function QuizIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke={color} strokeWidth="1.5" />
      <path d="M9.09 9C9.3251 8.4315 9.72922 7.95014 10.246 7.62087C10.7628 7.29159 11.365 7.13209 11.968 7.16518C12.571 7.19827 13.143 7.42217 13.604 7.80517C14.065 8.18817 14.39 8.71003 14.53 9.29001C14.66 9.87001 14.59 10.47 14.33 11C14 11.75 13 12.25 12.5 13M12 17H12.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HistoryIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 8V12L15 15" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      <path d="M12 3C7.03 3 3 7.03 3 12C3 12.69 3.08 13.35 3.22 14" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function FilterIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
    </svg>
  );
}

export function LayoutIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="3" y1="9" x2="21" y2="9"></line>
      <line x1="9" y1="21" x2="9" y2="9"></line>
    </svg>
  );
}

export function MonitorIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
      <line x1="8" y1="21" x2="16" y2="21"></line>
      <line x1="12" y1="17" x2="12" y2="21"></line>
    </svg>
  );
}

export function NetworkIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="6" rx="1"></rect>
      <rect x="3" y="15" width="6" height="6" rx="1"></rect>
      <rect x="15" y="15" width="6" height="6" rx="1"></rect>
      <line x1="12" y1="9" x2="12" y2="12"></line>
      <line x1="6" y1="12" x2="18" y2="12"></line>
      <line x1="6" y1="12" x2="6" y2="15"></line>
      <line x1="18" y1="12" x2="18" y2="15"></line>
    </svg>
  );
}

export function DatabaseIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
    </svg>
  );
}

export function CheckCircleIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  );
}

export function XCircleIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="15" y1="9" x2="9" y2="15"></line>
      <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>
  );
}

export function LogoutIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 17L21 12L16 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12H9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UpvoteIcon({ size = 16, color = "currentColor", filled = false }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M12 5L6 11M12 5L18 11" />
    </svg>
  );
}

export function DownvoteIcon({ size = 16, color = "currentColor", filled = false }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M12 19l-6-6M12 19l6-6" />
    </svg>
  );
}

export function CommentBubbleIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

export function BookmarkRibbonIcon({ size = 16, color = "currentColor", filled = false }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function ImageIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

export function PencilIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

export function LockIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function ChartIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

export function BellOffIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
      <path d="M18 8a6 6 0 0 0-9.33-5" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function PinIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14l-1.5-6H6.5L5 17z" />
      <path d="M9 11V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v7" />
    </svg>
  );
}

export function TrashIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export function FlagIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

export function MoreHorizontalIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}

export function UnlockIcon({ size = 14, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}

export function DismissIcon({ size = 14, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

export function LockCircleIcon({ size = 22, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function FlameIcon({ size = 13, color = "currentColor" }) {
  return (
    <svg style={baseSvgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2c0 4-4 6-4 10 0 3.3 2.7 6 6 6s6-2.7 6-6c0-3.5-3-5.5-3-8 0 0-2 2-2 4 0-1.7-1-4-3-6z" />
    </svg>
  );
}