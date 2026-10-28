// Design tokens: the look follows the Raiffeisen Smart Mobile App Store screenshots and raiffeisen.ro (both seen on 28.10.2026):
// warm grey background, white cards, brand yellow for the main action, teal links, outline icons.
// No Raiffeisen logo, illustration or font is used. The colours were defined in OKLCH for the web version;
// these are the same values in sRGB hex.

export const color = {
  yellow: "#fee600",
  yellowHover: "#f4db00",
  yellowSoft: "#fff4a3", // quiet yellow backgrounds
  yellowDeep: "#dabd02", // edges of yellow fills on light tracks
  ink: "#2b2d33",
  ink2: "#4f5159",
  ink3: "#6a6b70", // 4.6:1 on sand, 5.3:1 on white
  teal: "#017080", // links and header icons
  tealWash: "#e2f4f8",
  sand: "#f1ede6", // app background
  sand2: "#e9e4dc",
  surface: "#fffefb", // cards, header, tab bar
  line: "#e3ddd2",
  warn: "#8a5a01",
  warnWash: "#efe6da",
  danger: "#a8382a",
  dangerWash: "#ffe9e4",
  badge: "#c9302d",
  onInk: "#f4f1ed",
  backdrop: "#e4dfd7",
  heroAlert: "#e9d423", // 9% ink over yellow
  rowPressed: "#f8f5f0",
};

// Category colours: validated categorical palette (adjacent CVD ΔE ≥ 9.2, normal ≥ 27.6 on the card surface).
// Order is fixed per category, never by rank. Two slots sit under 3:1, so labels and amounts are always shown.
// bg and fg are the category tinted over the surface (16%) and over ink (60%).
export const categoryTones = {
  "cat-1": { dot: "#2a78d6", bg: "#dde9f7", fg: "#305a91" }, // Alimente
  "cat-2": { dot: "#eb6834", bg: "#ffe7dc", fg: "#9a533b" }, // Cafenele
  "cat-3": { dot: "#1baf7a", bg: "#e1f2e6", fg: "#32785d" }, // Livrări
  "cat-4": { dot: "#6250d6", bg: "#e3e3f8", fg: "#4a4591" }, // Restaurante
  "cat-5": { dot: "#e87ba4", bg: "#fee9ed", fg: "#985c74" }, // Taxi
  "cat-none": { dot: "#a8a59f", bg: "#f1efec", fg: "#737271" }, // Fără categorie
  "cat-fixed": { dot: color.ink, bg: color.sand, fg: color.ink },
  "cat-income": { dot: color.teal, bg: color.tealWash, fg: color.teal },
};

// Parts of the salary split (data: allocation[].tone).
export const allocationTones = { fixed: color.ink, aside: color.teal, spend: color.yellow };

// Hanken Grotesk stands in for the bank's own typeface; one font file per weight.
export const fontFamily = {
  400: "HankenGrotesk_400Regular",
  500: "HankenGrotesk_500Medium",
  600: "HankenGrotesk_600SemiBold",
  700: "HankenGrotesk_700Bold",
};

export const text = { tab: 11, cap: 12, sm: 14, md: 16, lg: 20, xl: 28, "2xl": 40 };

export const space = { "2xs": 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32 };

export const radius = { tile: 10, card: 16, frame: 28, pill: 999 };

export const shadowCard = { boxShadow: "0 1px 2px rgba(43, 45, 51, 0.05), 0 4px 14px rgba(43, 45, 51, 0.04)" };

// Letter spacing of uppercase labels (0.06em).
export const caps = (size = text.cap, em = 0.06) => ({ textTransform: "uppercase", letterSpacing: size * em });
