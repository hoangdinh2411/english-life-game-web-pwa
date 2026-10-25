import type { PlayerInfoCardProps } from "../types/ui/gameplay";
import { useEffect, useState } from "react";
import { PlayerPortrait } from "../features/appearance/PlayerPortrait";
import { GAME_TIME_RATE } from "@life-abroad/shared";
import { formatWorldTime } from "../features/world-clock/world-clock";

export function PlayerInfoCard({
  gender,
  playerName,
  cityName,
  coins,
  visible = true,

  onOpenProfile,
}: PlayerInfoCardProps) {
  return (
    <aside
      hidden={!visible}
      className="player-card w-[min(260px,_100%)] max-lg:w-[min(260px,_calc(50vw_-_8px),_100%)] min-w-0 [&[hidden]]:hidden"
    >
      <button
        type="button"
        className="pointer-events-auto flex min-h-11 w-full min-w-0 items-center gap-1.5 rounded-[12px] bg-dialogue border-2 border-border p-1 text-left text-ink shadow-[0_2px_6px_#0004] lg:hidden"
        aria-label={`Open ${playerName}'s profile`}
        onClick={onOpenProfile}
      >
        <PlayerPortrait
          gender={gender}
          className="size-6 rounded-full"
        />
      </button>
      <button
        type="button"
        className="pointer-events-auto hidden lg:flex flex-wrap min-h-14 w-full min-w-0 items-center gap-2 rounded-[14px] bg-[rgba(255,_248,_233,_0.97)] [border:2px_solid_#8b806c] p-2 text-left text-ink shadow-[0_2px_6px_#0004] hover:bg-[#fffaf0]"
        aria-label={`Open ${playerName}'s profile`}
        onClick={() => onOpenProfile()}
      >
        <PlayerPortrait
          gender={gender}
          className="size-10 rounded-full [border:1px_solid_#8b806c]"
        />
        <span className="flex min-w-[6em] flex-1 flex-col gap-0.5">
          <strong className="truncate text-[14px] leading-tight">
            {playerName}
          </strong>
          <span className="text-[12px] leading-tight text-[#52644f]">
            {cityName} · ${coins}
          </span>
        </span>
      </button>
    </aside>
  );
}
