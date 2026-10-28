// Outline icons on a 24px grid, drawn for this prototype (stroke: currentColor).

const PATHS = {
  home: <path d="M3.5 10.5 12 3.5l8.5 7V20a.5.5 0 0 1-.5.5h-5v-6H9v6H4a.5.5 0 0 1-.5-.5z" />,
  transfer: (
    <>
      <path d="M4 8h14" />
      <path d="m14 4 4 4-4 4" />
      <path d="M20 16H6" />
      <path d="m10 12-4 4 4 4" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h3" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.2 8.8-1.9 4.5-4.5 1.9 1.9-4.5z" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  pie: (
    <>
      <path d="M11 4.1A8 8 0 1 0 19.9 13H11z" />
      <path d="M14 3.5V10h6.5A6.5 6.5 0 0 0 14 3.5z" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.6" />
    </>
  ),
  chat: <path d="M4 5.5h16v11H9.5L5 20v-3.5H4z" />,
  cup: (
    <>
      <path d="M5 9h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" />
      <path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M8.5 3.5v2M12 3.5v2" />
    </>
  ),
  gift: (
    <>
      <rect x="4" y="9.5" width="16" height="10.5" rx="1.5" />
      <path d="M3 7h18v2.5H3z" />
      <path d="M12 7v13" />
      <path d="M12 7C10.5 4.5 7.5 4.5 7.5 6S10 7 12 7zm0 0c1.5-2.5 4.5-2.5 4.5-1S14 7 12 7z" />
    </>
  ),
  utensils: (
    <>
      <path d="M7 3v8" />
      <path d="M4.5 3v4.5a2.5 2.5 0 0 0 5 0V3" />
      <path d="M7 11v10" />
      <path d="M17 21V3c-2 1.5-3 4-3 7h3" />
    </>
  ),
  shirt: <path d="M8.5 4 4 6.5l1.8 4H8V20h8v-9.5h2.2l1.8-4L15.5 4a3.5 3.5 0 0 1-7 0z" />,
  bag: (
    <>
      <path d="M5.5 8.5h13l-1 11.5h-11z" />
      <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2.2l2.3 10.5h9.8l2-7.5H6.2" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
    </>
  ),
  car: (
    <>
      <path d="M4 16.5v-4l2.2-5h11.6l2.2 5v4z" />
      <path d="M4 12.5h16" />
      <circle cx="7.5" cy="16.5" r="1.5" />
      <circle cx="16.5" cy="16.5" r="1.5" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.7 9.3a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1.1.9-1.1 1.7v.3" />
      <path d="M12 16.6h.01" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1z" />
      <path d="M4 7.5 15 4.5v3" />
      <path d="M16 13.5h.01" />
    </>
  ),
  send: <path d="M4.5 11.6 19.5 4.5l-5.6 15-2.6-5.6z" />,
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
};

export function Icon({ name, className }) {
  return (
    <svg className={className ? `icon ${className}` : "icon"} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
