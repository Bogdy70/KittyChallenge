import { useMessages } from "./Messages";
import React from "react";
export function Icon({ name, size = 20, ...props }) {
  const paths = {
    arrow: (
      <>
        <path d="M5 12h14m-6-6 6 6-6 6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    heart: (
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
    ),
    star: <path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" />,
    spark: (
      <>
        <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
      </>
    ),
    home: (
      <>
        <path d="m3 10 9-7 9 7v10H3Z" />
        <path d="M9 20v-7h6v7" />
      </>
    ),
    matrix: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M10 4v16M4 10h16" />
      </>
    ),
    puzzle: (
      <path d="M4 4h5a3 3 0 1 1 6 0h5v5a3 3 0 1 0 0 6v5h-5a3 3 0 1 1-6 0H4v-5a3 3 0 1 0 0-6Z" />
    ),
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="3" fill="currentColor" />
        <circle cx="15" cy="17" r="3" fill="currentColor" />
      </>
    ),
    logout: (
      <>
        <path d="M10 4H4v16h6m4-12 4 4-4 4m-4-4h10" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    bulb: (
      <>
        <path d="M9 18h6m-6 3h6M8 15a7 7 0 1 1 8 0l-1 3H9Z" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6" />
      </>
    ),
    trophy: (
      <>
        <path d="M7 3h10v6a5 5 0 0 1-10 0Zm5 11v7m-4 0h8M7 5H3v3c0 3 4 3 4 3m10-6h4v3c0 3-4 3-4 3" />
      </>
    ),
    camera: (
      <>
        <path d="M3 6h5l2-3h4l2 3h5v15H3Z" />
        <circle cx="12" cy="13" r="4" />
      </>
    ),
    paw: (
      <>
        <ellipse
          cx="12"
          cy="16"
          rx="6"
          ry="4"
          fill="currentColor"
          stroke="none"
        />
        <ellipse cx="5" cy="10" rx="2" ry="3" />
        <ellipse cx="10" cy="6" rx="2" ry="3" />
        <ellipse cx="16" cy="6" rx="2" ry="3" />
        <ellipse cx="20" cy="11" rx="2" ry="3" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    trash: (
      <>
        <path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15m-6 4v7" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10v1" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name] || paths.spark}
    </svg>
  );
}
export function Cat({
  color = "#c6f581",
  className = "",
  party = false,
  sleepy = false,
  ...props
}) {
  return (
    <svg
      className={`cat-art ${className}`}
      viewBox="0 0 260 240"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <ellipse cx="130" cy="221" rx="78" ry="11" fill="#312148" opacity=".10" />
      <path
        className="cat-tail"
        d="M184 185c70 16 64-69 36-54-17 9 10 30-27 28"
        stroke="#30223c"
        strokeWidth="27"
        strokeLinecap="round"
      />
      <path
        className="cat-tail"
        d="M184 185c70 16 64-69 36-54-17 9 10 30-27 28"
        stroke={color}
        strokeWidth="21"
        strokeLinecap="round"
      />
      <path
        d="M82 145c-13 21-19 46-12 65 4 10 30 10 36 0 13 8 38 8 50 0 9 10 36 10 39-2 6-22-6-51-19-65"
        fill={color}
        stroke="#30223c"
        strokeWidth="3.5"
      />
      <ellipse cx="131" cy="182" rx="27" ry="27" fill="#fff8ee" />
      <path
        d="m55 87-4-58 57 26c16-5 31-5 47 0l52-27-2 62c19 19 19 53 3 68-26 29-122 29-151-1-17-17-19-45-2-69Z"
        fill={color}
        stroke="#30223c"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="m62 46 6 39 26-22Z M193 47l-29 17 29 20Z" fill="#ff83bb" />
      <path
        d="m114 57 5 15m10-17 2 17m11-15-3 15"
        stroke="#30223c"
        strokeWidth="4"
        strokeLinecap="round"
        opacity=".35"
      />
      {sleepy ? (
        <path
          d="m83 108 12 6 12-6m49 0 12 6 12-6"
          stroke="#30223c"
          strokeWidth="4"
          strokeLinecap="round"
        />
      ) : (
        <g className="cat-eyes">
          <ellipse cx="97" cy="111" rx="6" ry="9" fill="#30223c" />
          <ellipse cx="168" cy="111" rx="6" ry="9" fill="#30223c" />
          <circle cx="99" cy="108" r="2" fill="white" />
          <circle cx="170" cy="108" r="2" fill="white" />
        </g>
      )}
      <ellipse cx="75" cy="129" rx="13" ry="7" fill="#ff83bb" opacity=".75" />
      <ellipse cx="188" cy="129" rx="13" ry="7" fill="#ff83bb" opacity=".75" />
      <path
        d="m125 122 7 7 7-7Z"
        fill="#ff579b"
        stroke="#30223c"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M132 129c0 13-15 13-16 4m16-4c0 13 15 13 16 4M60 117l-24-4m25 16-26 4m168-16 23-4m-24 16 25 4"
        stroke="#30223c"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {party && (
        <g className="party-hat">
          <path
            d="m97 56 26-54 38 49Z"
            fill="#ad8dff"
            stroke="#30223c"
            strokeWidth="3"
          />
          <path d="m111 29 30 5m-37 12 49-1" stroke="#f7f07b" strokeWidth="9" />
          <circle cx="123" cy="6" r="7" fill="#ff559f" />
          <path
            d="m95 55 68-6"
            stroke="#30223c"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      )}
      <path
        d="m111 166 20 8-19 10Zm42 0-21 8 20 10Z"
        fill="#ff559f"
        stroke="#30223c"
        strokeWidth="2"
      />
      <circle
        cx="132"
        cy="174"
        r="5"
        fill="#f7f07b"
        stroke="#30223c"
        strokeWidth="2"
      />
    </svg>
  );
}
export function PartyArt() {
  const { t } = useMessages();
  return (
    <div className="party-art">
      <div className="orbit-ring" />
      <div className="age-art">
        20<span>{t("home.de-ani-de-magie")}</span>
      </div>
      <Cat party className="hero-cat" />
      <span className="sticker sticker-yellow">
        <Icon name="star" />
        {" " + t("home.editie-limitata")}
      </span>
      <span className="sticker sticker-white">
        {t("home.100-adorabila") + " "}
        <Icon name="heart" />
      </span>
      <span className="art-spark one">✦</span>
      <span className="art-spark two">✳</span>
      <span className="art-spark three">✧</span>
      <div className="tiny-heart">♥</div>
    </div>
  );
}
export function Confetti({ burst }) {
  return burst ? (
    <div className="confetti" aria-hidden="true" key={burst}>
      {Array.from(
        {
          length: 42,
        },
        (_, i) => (
          <i
            key={i}
            style={{
              "--x": `${(i * 37) % 100}vw`,
              "--delay": `${(i % 7) * 0.07}s`,
              "--rot": `${i * 31}deg`,
              "--color": [
                "#fa4c9a",
                "#ae8cff",
                "#b9ed7a",
                "#5ebcfb",
                "#ffe273",
              ][i % 5],
            }}
          />
        ),
      )}
    </div>
  ) : null;
}
export function Progress({ value, max, label }) {
  return (
    <div className="progress-wrap">
      <div className="progress-caption">
        <span>{label}</span>
        <strong>
          {value} / {max}
        </strong>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max || 1}
      >
        <span
          style={{
            width: `${max ? (value / max) * 100 : 0}%`,
          }}
        />
      </div>
    </div>
  );
}
export function ErrorBox({ children }) {
  return children ? (
    <div className="error-box" role="alert">
      <Icon name="info" />
      <span>{children}</span>
    </div>
  ) : null;
}
export function Loading() {
  const { t } = useMessages();
  return (
    <div className="loading" role="status">
      <Cat sleepy />
      <span>{t("general.se-pregatesc-pisicutele")}</span>
    </div>
  );
}
