"use client";

import type { ReactNode } from "react";

declare global {
  interface Window {
    RenateOnline?: { open: (valg?: { flyt?: string }) => void; close: () => void; toggle: () => void };
  }
}

/** Knapp som åpner chat-widgeten (lastet av embed.js), eventuelt rett inn i en feilsøkingsflyt. */
export function ApneChat({
  flyt,
  className,
  children,
}: {
  flyt?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (window.RenateOnline) window.RenateOnline.open(flyt ? { flyt } : undefined);
        else window.open(`/widget${flyt ? `?flyt=${flyt}` : ""}`, "_blank", "noopener");
      }}
    >
      {children}
    </button>
  );
}
