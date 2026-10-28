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
  upload: (
    <>
      <path d="M12 15V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17" />
      <path d="M8 3v4M16 3v4" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 17.5h2" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  file: (
    <>
      <path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" />
      <path d="M14 3.5V8h4.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  bell: (
    <>
      <path d="M6 16.5v-5a6 6 0 1 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  bank: (
    <>
      <path d="M3 9.5 12 4l9 5.5" />
      <path d="M5.5 10.5v7M10 10.5v7M14 10.5v7M18.5 10.5v7" />
      <path d="M3.5 20h17" />
    </>
  ),
  shield: <path d="M12 3.5 19 6v5.5c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6z" />,
  chevron: <path d="m9.5 6 6 6-6 6" />,
  logout: (
    <>
      <path d="M14.5 4.5H18a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-3.5" />
      <path d="m9.5 16.5-4.5-4.5 4.5-4.5" />
      <path d="M5 12h10" />
    </>
  ),
  pencil: (
    <>
      <path d="M4.5 19.5 5 16 15.5 5.5a2.1 2.1 0 0 1 3 3L8 19z" />
      <path d="m13.5 7.5 3 3" />
    </>
  ),
  repeat: (
    <>
      <path d="M4.5 11.5a7 7 0 0 1 12-4.5l2 2" />
      <path d="M18.5 4.5V9H14" />
      <path d="M19.5 12.5a7 7 0 0 1-12 4.5l-2-2" />
      <path d="M5.5 19.5V15H10" />
    </>
  ),
  split: (
    <>
      <path d="M12 20.5V13" />
      <path d="M12 13 6.5 7.5" />
      <path d="m12 13 5.5-5.5" />
      <path d="M6 11.5V7h4.5" />
      <path d="M18 11.5V7h-4.5" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8.5h6M9 12h6" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.5v-8a1 1 0 0 1 1-1h8l8 8-9 9z" />
      <circle cx="8.5" cy="8.5" r="1.3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  back: <path d="m14.5 6-6 6 6 6" />,
  send: <path d="M4.5 11.6 19.5 4.5l-5.6 15-2.6-5.6z" />,
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  external: (
    <>
      <path d="M14 4.5h5.5V10" />
      <path d="M19.5 4.5 11 13" />
      <path d="M18 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.5C10.5 5.3 8.3 4.5 4.5 4.5v13c3.8 0 6 .8 7.5 2 1.5-1.2 3.7-2 7.5-2v-13c-3.8 0-6 .8-7.5 2z" />
      <path d="M12 6.5v13" />
    </>
  ),
  bus: (
    <>
      <rect x="5" y="3.5" width="14" height="14" rx="2.5" />
      <path d="M5 11h14" />
      <path d="M8.5 14.5h.01" />
      <path d="M15.5 14.5h.01" />
      <path d="M7.5 17.5V20" />
      <path d="M16.5 17.5V20" />
    </>
  ),
  leaf: (
    <>
      <path d="M5.5 18.5C4.5 12 8.5 6 18.5 5c1 9.5-5 14.5-13 13.5z" />
      <path d="M5.5 18.5c2.5-3.5 5.5-6.2 9-8" />
    </>
  ),
  drop: (
    <>
      <path d="M12 3.8c-2.9 3.6-6 7.2-6 10.4a6 6 0 0 0 12 0c0-3.2-3.1-6.8-6-10.4z" />
      <path d="M9.3 14.6a2.8 2.8 0 0 0 2.5 2.7" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6" />
    </>
  ),
  tractor: (
    <>
      <circle cx="7.5" cy="16" r="4" />
      <circle cx="18" cy="17.5" r="2.5" />
      <path d="M4.5 12.5v-7h6.5l1.5 6.5h6.5a1 1 0 0 1 1 1v2.5" />
      <path d="M11.5 16h4" />
    </>
  ),
  flame: <path d="M12 3.5c.5 3 4.5 5 4.5 9.5a4.5 4.5 0 0 1-9 0c0-2 .8-3.4 2-4.6.2 1.6 1 2.6 2 3-.4-2.6.1-5.3.5-7.9z" />,
  snow: (
    <>
      <path d="M12 3.5v17M4.6 7.75l14.8 8.5M4.6 16.25l14.8-8.5" />
      <path d="m9.5 4.8 2.5 2 2.5-2M9.5 19.2l2.5-2 2.5 2" />
    </>
  ),
  factory: (
    <>
      <path d="M3.5 20.5v-10l5 3v-3l5 3v-8h4l.9 15z" />
      <path d="M2.5 20.5h19" />
      <path d="M7 17h1.5M11 17h1.5" />
    </>
  ),
  tree: (
    <>
      <path d="M12 3.5 6.5 10.5h3l-4 5.5h13l-4-5.5h3z" />
      <path d="M12 16v4.5" />
    </>
  ),
  fish: (
    <>
      <path d="M5 12c2.2-3.3 5.4-5 8.8-5 3.2 0 5.2 1.8 6.7 5-1.5 3.2-3.5 5-6.7 5C10.4 17 7.2 15.3 5 12z" />
      <path d="M5 12 2.5 9.5M5 12l-2.5 2.5" />
      <path d="M16 11h.01" />
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
