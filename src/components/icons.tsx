import type { SVGProps } from "react";

/** Enkle linjeikoner (24×24, strek), samme stil som ikonene på creativeart.no. */
const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

export const IkonSok = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </svg>
);
export const IkonChat = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.8A8 8 0 1 1 21 12Z" />
    <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" strokeWidth={2.5} />
  </svg>
);
export const IkonLukk = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IkonSend = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 12 20 4l-4 16-4-6-8-2Z" />
    <path d="m12 14 8-10" />
  </svg>
);
export const IkonPil = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const IkonChevron = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const IkonBok = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
    <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5" />
  </svg>
);
export const IkonSjekk = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const IkonPerson = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);
export const IkonSteg = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 6h10M4 12h16M4 18h7" />
    <circle cx="18" cy="6" r="2" />
    <circle cx="14" cy="18" r="2" />
  </svg>
);

export const IkonPrinter = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M7 9V3h10v6" />
    <rect x="3" y="9" width="18" height="8" rx="1.5" />
    <path d="M7 14h10v7H7z" />
    <path d="M17.5 12h.01" strokeWidth={2.5} />
  </svg>
);
const IkonPalett = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.9 1.4-1.9-.4-1.2.4-2.1 1.6-2.1H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10Z" />
    <path d="M7.5 11h.01M10 7h.01M14.5 7h.01M17 11h.01" strokeWidth={2.5} />
  </svg>
);
const IkonDrape = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z" />
  </svg>
);
const IkonNokkel = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8Z" />
  </svg>
);
const IkonSaks = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" />
  </svg>
);
const IkonBil = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" />
    <circle cx="7" cy="17.5" r="1.8" />
    <circle cx="17" cy="17.5" r="1.8" />
  </svg>
);

export const kategoriIkoner = {
  printer: IkonPrinter,
  palette: IkonPalett,
  drop: IkonDrape,
  wrench: IkonNokkel,
  scissors: IkonSaks,
  truck: IkonBil,
} as const;

export function KategoriIkon({ navn, ...p }: { navn: string } & SVGProps<SVGSVGElement>) {
  const Ikon = kategoriIkoner[navn as keyof typeof kategoriIkoner] ?? IkonBok;
  return <Ikon {...p} />;
}
