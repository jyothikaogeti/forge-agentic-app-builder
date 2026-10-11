import React from "react";

export const GrayTitle = ({ children }: { children: React.ReactNode }) => (
  <span className="text-white/90">{children}</span>
);

export const BlueTitle = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <span
    className={`bg-linear-to-br from-blue-300 via-blue-400 to-blue-600 bg-clip-text text-transparent font-serif ${className}`}
  >
    {children}
  </span>
);

export const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-blue-400 text-xs font-semibold inline-flex items-center gap-2 uppercase tracking-[0.14em] mb-4">
    <span className="w-4 h-px bg-blue-400" />
    {children}
    <span className="w-4 h-px bg-blue-400" />
  </p>
);

export const SectionHeading = ({
  grayText,
  blueText,
}: {
  grayText: string;
  blueText: string;
}) => (
  <h2 className="text-[clamp(2rem,4vw,3rem)] font-serif tracking-tight leading-[1.1]">
    <GrayTitle>{grayText}</GrayTitle>
    <br />
    <BlueTitle>{blueText}</BlueTitle>
  </h2>
);
