import type { PlayerGender } from "@life-abroad/shared";
import { playerPortraitPresentation } from "../../gameplay/portraits";

export function PlayerPortrait({
  gender,
  label,
  className,
}: {
  gender?: PlayerGender | undefined;
  label?: string;
  className: string;
}) {
  const presentation = playerPortraitPresentation(gender);
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`shrink-0 bg-[var(--color-portrait)] bg-no-repeat ${className}`}
      style={{
        backgroundImage: `url(${presentation.portrait})`,
        backgroundPosition: presentation.portraitPosition ?? "center",
        backgroundSize: presentation.portraitGrid
          ? `${presentation.portraitGrid.columns * 100}% 100%`
          : "cover",
      }}
    />
  );
}
