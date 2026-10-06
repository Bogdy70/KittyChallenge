import React from "react";
import { Icon } from "./Art";
import { useMessages } from "./Messages";

function CatArrow({ direction }) {
  return (
    <svg
      viewBox="0 0 44 38"
      fill="none"
      aria-hidden="true"
      className="focus-cat-arrow"
    >
      <path
        d="M8 17 7 3l12 7h6l12-7-1 14c8 15-1 19-14 19S0 32 8 17Z"
        fill="currentColor"
        stroke="#493355"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="m10 8 6 4m18-4-6 4"
        stroke="#ed6cac"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="16" cy="21" r="1.8" fill="#493355" />
      <circle cx="28" cy="21" r="1.8" fill="#493355" />
      <path
        d="m20 25 2 2 2-2m-13-1-7-2m7 6-7 1m29-5 7-2m-7 6 7 1"
        stroke="#493355"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        className={"cat-chevron cat-chevron-" + direction}
        d="m19 30 3 3 3-3"
        stroke="#493355"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PuzzleFocusTabs({
  drawer,
  onToggle,
  onExit,
  idPrefix,
}) {
  const { t } = useMessages();
  return (
    <nav className="focus-tabs" aria-label={t("puzzle.focus.enter")}>
      {[
        ["tools", "down"],
        ["pieces", "left"],
        ["guide", "up"],
      ].map(([kind, direction]) => (
        <button
          key={kind}
          data-focus-tab={kind}
          className={"focus-tab focus-tab-" + kind}
          aria-label={t("puzzle.focus." + kind)}
          title={t("puzzle.focus." + kind)}
          aria-expanded={drawer === kind}
          aria-controls={idPrefix + "-" + kind}
          onClick={() => onToggle(kind)}
        >
          <CatArrow direction={direction} />
          <span>{t("puzzle.focus." + kind)}</span>
        </button>
      ))}
      <button
        className="focus-exit"
        aria-label={t("puzzle.fullscreen.exit")}
        title={t("puzzle.fullscreen.exit")}
        onClick={onExit}
      >
        <Icon name="close" size={19} />
      </button>
    </nav>
  );
}
