import React, { useEffect, useId, useRef, useState } from "react";

// Only one guide speaks at a time; unmounting another guide must not interrupt it.
let currentVoice = null;
function stopVoice() {
  const reader = currentVoice;
  currentVoice = null;
  if (reader) {
    window.speechSynthesis.cancel();
    reader.stop();
  }
}

// Original vector character: its parts stay separate so every animation remains crisp.
export function KnightCat({ mood = "welcome", className = "" }) {
  const id = useId().replaceAll(":", "");
  return (
    <svg
      className={`knight-cat mood-${mood} ${className}`}
      viewBox="0 0 260 280"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`${id}-steel`}
          x1="62"
          y1="100"
          x2="182"
          y2="246"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fff" />
          <stop offset=".42" stopColor="#a9c6dd" />
          <stop offset=".7" stopColor="#e7f6ff" />
          <stop offset="1" stopColor="#7298bd" />
        </linearGradient>
        <linearGradient
          id={`${id}-blade`}
          x1="210"
          y1="52"
          x2="233"
          y2="174"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#86c8ed" />
        </linearGradient>
      </defs>
      <ellipse cx="130" cy="262" rx="91" ry="9" fill="#442657" opacity=".13" />
      <g
        className="knight-body"
        stroke="#30223c"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path
          className="knight-cape"
          d="M79 127C51 146 55 193 28 243c31-6 46 9 66 1l66-8c-7-44 18-73-9-101Z"
          fill="#e73b96"
        />
        <path
          className="knight-cape"
          d="M63 164c7 29 1 48-13 69m38-81c-5 22-3 49-10 74"
          stroke="#a42477"
        />
        <path
          d="M161 223c41 14 48-21 33-32-15-11-21 12-10 15"
          stroke="#30223c"
          strokeWidth="20"
        />
        <path
          d="M91 207 82 248q12 13 32 2l8-40m23 0 6 40q23 11 35-2l-13-41"
          fill={`url(#${id}-steel)`}
        />
        <path
          d="M76 151q-11 35 5 72 44 20 91-1 16-40-3-72Z"
          fill={`url(#${id}-steel)`}
        />
        <path d="M96 160q31 15 55 0l2 45q-26 16-54 0Z" fill="#c5e4f5" />
        <path d="M116 174q10-15 20 0v16l-10 7-10-7Z" fill="#ffed83" />
        <path d="m122 182 4 4 5-7" stroke="#a46d15" strokeWidth="2" />
        <path
          d="M78 148q-25 5-16 36l22 4 8-23m71-14q25-4 33 22l-17 17-21-16"
          fill={`url(#${id}-steel)`}
        />
        <path d="M62 183q-3 28 14 24l9-15" fill="#fffaf7" />
        <path
          d="M71 147q8 12 18 14m73-11 17 12M85 221l20 8m48 0 21-9"
          stroke="#6483a3"
        />
        <path
          d="m66 91-3-54 45 25q22-9 45-1l41-24-1 57c15 17 10 45-5 56-22 19-89 22-114 1-18-15-21-40-8-60Z"
          fill="#fffaf7"
        />
        <path
          d="m66 90-3-53 45 25 10 36-34 31-20-22Zm82-29 5 36 35 29 10-29-4-60Z"
          fill="#302c3d"
          stroke="none"
        />
        <path
          d="m73 51 4 28 18-13Zm111 1-24 14 22 15Z"
          fill="#f386b7"
          stroke="none"
        />
        <path
          d="M72 87q51-42 116 0l-2 11q-60-24-113 1Z"
          fill={`url(#${id}-steel)`}
        />
        <path d="m111 68 11-32 19 33" fill="#aed4ea" />
        <path
          className="knight-plume"
          d="M124 40c-17-28 8-35 18-25 11 12 4 19 11 24-14 4-19-8-25-3"
          fill="#ff5db4"
        />
        <g className="knight-eyes" stroke="none">
          <ellipse cx="99" cy="112" rx="10" ry="12" fill="#72d99d" />
          <ellipse cx="160" cy="112" rx="10" ry="12" fill="#72d99d" />
          <ellipse cx="101" cy="113" rx="5" ry="9" fill="#242239" />
          <ellipse cx="158" cy="113" rx="5" ry="9" fill="#242239" />
          <circle cx="102" cy="108" r="3" fill="white" />
          <circle cx="159" cy="108" r="3" fill="white" />
        </g>
        <ellipse cx="83" cy="132" rx="12" ry="6" fill="#ffa6cf" stroke="none" />
        <ellipse
          cx="176"
          cy="132"
          rx="12"
          ry="6"
          fill="#ffa6cf"
          stroke="none"
        />
        <path d="m123 126 7 6 7-6Z" fill="#ed72a5" strokeWidth="2" />
        <path
          className="knight-smile"
          d="M130 133q-6 13-13 4m13-4q6 13 13 4"
          strokeWidth="2"
        />
        <path
          d="m74 124-19-3m20 12-20 4m128-13 19-3m-20 12 20 4"
          strokeWidth="2"
        />
        <g className="knight-sword">
          <path
            d="m205 173 11-100 13-20 8 24-15 99Z"
            fill={`url(#${id}-blade)`}
          />
          <path d="m229 69-17 99" stroke="#fff" strokeWidth="2" />
          <path d="m195 177 37 5" stroke="#30223c" strokeWidth="10" />
          <path d="m195 177 37 5" stroke="#ffdf73" strokeWidth="5" />
          <path d="m213 184-3 22" strokeWidth="9" />
          <path d="m213 184-3 22" stroke="#ab79e1" strokeWidth="5" />
          <circle cx="209" cy="210" r="5" fill="#ffdf73" />
          <path d="M186 177q15-10 22 0l-2 14q-11 9-18-3Z" fill="#fffaf7" />
          <path
            className="sword-glint"
            d="m232 95 3-9 3 9 9 3-9 3-3 9-3-9-9-3Z"
            fill="#fff8ac"
            stroke="none"
          />
        </g>
      </g>
      <g className="knight-celebration" fill="#ee489d">
        <path d="m26 55 4-12 4 12 12 4-12 4-4 12-4-12-12-4Z" />
        <path d="m225 29 3-9 3 9 9 3-9 3-3 9-3-9-9-3Z" />
        <path d="M29 112c-9-12-23-1 0 14 23-15 9-26 0-14Z" />
      </g>
    </svg>
  );
}

export function GuideSpeech({
  title = "Cavalerul Miau",
  message,
  detail,
  mood = "welcome",
  className = "",
  speak = true,
}) {
  const voiceOwner = useRef({});
  const [talking, setTalking] = useState(false);
  const [voiceNote, setVoiceNote] = useState("");
  const [hasVoice, setHasVoice] = useState(false);
  useEffect(() => {
    setHasVoice(
      "speechSynthesis" in window && "SpeechSynthesisUtterance" in window,
    );
  }, []);
  useEffect(() => {
    setTalking(false);
    setVoiceNote("");
    return () => {
      if (currentVoice?.owner === voiceOwner.current) stopVoice();
    };
  }, [message, detail]);
  function listen() {
    const synth = window.speechSynthesis;
    if (talking) {
      stopVoice();
      return;
    }
    stopVoice();
    const voice = synth.getVoices().find((v) => /^ro([_-]|$)/i.test(v.lang));
    if (!voice) {
      setVoiceNote(
        "Vocea română nu este instalată pe acest dispozitiv. Îți las povestea scrisă aici, miau!",
      );
      return;
    }
    setVoiceNote("");
    const line = new SpeechSynthesisUtterance(
      title + ". " + (message || "") + " " + (detail || ""),
    );
    line.lang = "ro-RO";
    line.voice = voice;
    line.rate = 0.95;
    const reader = { owner: voiceOwner.current, stop: () => setTalking(false) };
    currentVoice = reader;
    line.onstart = () => {
      if (currentVoice === reader) setTalking(true);
    };
    line.onend = () => {
      if (currentVoice === reader) {
        currentVoice = null;
        setTalking(false);
      }
    };
    line.onerror = (event) => {
      if (currentVoice !== reader) return;
      currentVoice = null;
      setTalking(false);
      if (!["canceled", "interrupted"].includes(event.error))
        setVoiceNote(
          "Nu pot porni vocea acum. Putem continua cu mesajele scrise.",
        );
    };
    try {
      synth.speak(line);
    } catch {
      line.onerror({ error: "unavailable" });
    }
  }
  return (
    <div className={`guide-speech ${className} ${talking ? "is-talking" : ""}`}>
      <div className="guide-avatar">
        <KnightCat mood={mood} />
        <span>Cavalerul Miau</span>
      </div>
      <div className={`guide-bubble guide-${mood}`}>
        <div className="guide-caption">
          <span>GHIDUL TĂU CU LĂBUȚE</span>
          {speak && hasVoice && (
            <button
              type="button"
              className="guide-voice"
              onClick={listen}
              aria-pressed={talking}
              aria-label={
                talking
                  ? "Oprește vocea cavalerului"
                  : "Ascultă mesajul cavalerului"
              }
            >
              {talking ? "■ Oprește" : "♫ Ascultă"}
            </button>
          )}
        </div>
        <div
          className="guide-dialogue"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <strong>{title}</strong>
          {message && <p>{message}</p>}
          {detail && <p className="guide-detail">{detail}</p>}
        </div>
        {voiceNote && (
          <small className="voice-note" role="status">
            {voiceNote}
          </small>
        )}
      </div>
    </div>
  );
}

export function AmbientBackground() {
  return (
    <div className="ambient-background" aria-hidden="true">
      <div className="aurora aurora-pink" />
      <div className="aurora aurora-blue" />
      <div className="aurora aurora-green" />
      <div className="aurora aurora-yellow" />
      <div className="ambient-grain" />
      {Array.from({ length: 16 }, (_, i) => (
        <span
          className="ambient-spark"
          key={i}
          style={{
            "--left": `${(i * 31 + 7) % 100}%`,
            "--top": `${(i * 17 + 11) % 100}%`,
            "--delay": `${-i * 1.8}s`,
            "--duration": `${12 + (i % 5) * 3}s`,
            "--spark-color": ["#df238d", "#155cbe", "#357624", "#7e36b8"][
              i % 4
            ],
          }}
        >
          {i % 3 === 0 ? "✧" : i % 3 === 1 ? "✦" : "♡"}
        </span>
      ))}
    </div>
  );
}
