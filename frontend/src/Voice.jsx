import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { api } from "./api";
const defaults = { mode: "recordings", pitch: 1.2, rate: 0.95, aiReady: false };
const Context = createContext({ config: defaults, setConfig: () => {} });
export function VoiceProvider({ children }) {
  const [config, setConfig] = useState(defaults);
  useEffect(() => {
    let active = true;
    const load = () =>
      api("/voice/config")
        .then((c) => active && setConfig(c))
        .catch(() => {});
    load();
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, []);
  return (
    <Context.Provider value={{ config, setConfig }}>
      {children}
    </Context.Provider>
  );
}
export const useVoice = () => useContext(Context);
let current = null;
function stopVoice() {
  const previous = current;
  current = null;
  previous?.cancel();
}

export function useGuideVoice({ title, message, detail, t }) {
  const { config } = useVoice(),
    owner = useRef({}),
    audioRef = useRef(null),
    readerRef = useRef(null),
    active = useRef(true);
  const [talking, setTalking] = useState(false),
    [loading, setLoading] = useState(false),
    [note, setNote] = useState(""),
    [showControls, setShowControls] = useState(false),
    [kind, setKind] = useState("");
  const supported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (current?.owner === owner.current) stopVoice();
    };
  }, []);
  useEffect(() => {
    setTalking(false);
    setLoading(false);
    setNote("");
    setShowControls(false);
    setKind("");
    return () => {
      if (current?.owner === owner.current) stopVoice();
    };
  }, [title, message, detail, config.mode, config.rate, config.pitch]);
  async function listen() {
    if (talking || loading) {
      stopVoice();
      return;
    }
    stopVoice();
    setNote("");
    setKind("");
    setShowControls(false);
    const controller = new AbortController();
    const reader = {
      owner: owner.current,
      audio: null,
      source: "",
      fellBack: false,
      cancel() {
        controller.abort();
        if (reader.audio) {
          reader.audio.pause();
          reader.audio.removeAttribute("src");
          reader.audio.load();
        }
        if (reader.source === "browser") window.speechSynthesis?.cancel();
        if (active.current) {
          setTalking(false);
          setLoading(false);
          setShowControls(false);
        }
      },
    };
    readerRef.current = reader;
    current = reader;
    const owns = () =>
      active.current && current === reader && !controller.signal.aborted;
    function browser(reason = "") {
      if (!owns() || reader.fellBack) return;
      reader.fellBack = true;
      if (reader.audio) {
        reader.audio.pause();
        reader.audio.removeAttribute("src");
        reader.audio.load();
        reader.audio = null;
      }
      setLoading(false);
      setKind("browser");
      setShowControls(false);
      const voice = supported
        ? window.speechSynthesis
            .getVoices()
            .find((v) => /^ro([_-]|$)/i.test(v.lang))
        : null;
      if (!voice) {
        current = null;
        setNote(
          reason ||
            t(
              "guide.vocea-romana-nu-este-instalata-pe-acest-dispozitiv-iti-las-povest",
            ),
        );
        return;
      }
      reader.source = "browser";
      const line = new SpeechSynthesisUtterance(
        [title, message, detail].filter(Boolean).join(". "),
      );
      line.lang = "ro-RO";
      line.voice = voice;
      line.rate = config.rate;
      line.pitch = config.pitch;
      if (reason) setNote(reason + " " + t("voice.browserFallback"));
      line.onstart = () => owns() && setTalking(true);
      line.onend = () => {
        if (owns()) {
          current = null;
          setTalking(false);
        }
      };
      line.onerror = (e) => {
        if (!owns()) return;
        current = null;
        setTalking(false);
        if (!["canceled", "interrupted"].includes(e.error))
          setNote(
            t(
              "guide.nu-pot-porni-vocea-acum-putem-continua-cu-mesajele-scrise",
            ),
          );
      };
      try {
        window.speechSynthesis.speak(line);
      } catch {
        line.onerror({ error: "unavailable" });
      }
    }
    reader.browser = browser;
    if (config.mode === "browser") {
      browser();
      return;
    }
    setLoading(true);
    try {
      const result = await api("/voice/resolve", {
        method: "POST",
        body: { title, message: message || "", detail: detail || "" },
        signal: controller.signal,
      });
      if (!owns()) return;
      if (!result.url) {
        browser();
        return;
      }
      const audio = audioRef.current;
      reader.audio = audio;
      reader.source = "audio";
      setKind(result.kind);
      audio.src = result.url;
      try {
        await audio.play();
        if (owns()) setLoading(false);
      } catch (e) {
        if (!owns()) return;
        setLoading(false);
        if (e.name === "NotAllowedError") {
          setShowControls(true);
          setNote(t("voice.manualPlay"));
        } else browser(t("voice.playFailed"));
      }
    } catch (e) {
      if (owns()) browser(e.message);
    }
  }
  function onPlay() {
    const r = readerRef.current;
    if (!r || !active.current) return;
    if (current !== r) {
      stopVoice();
      current = r;
    }
    setLoading(false);
    setTalking(true);
  }
  function onEnd() {
    if (current === readerRef.current) current = null;
    setLoading(false);
    setTalking(false);
  }
  function onError() {
    const r = readerRef.current;
    if (current === r && r?.source === "audio")
      r.browser(t("voice.playFailed"));
  }
  return {
    talking,
    loading,
    note,
    kind,
    showControls,
    audioRef,
    enabled: config.mode !== "browser" || supported,
    listen,
    onPlay,
    onEnd,
    onError,
    onPause: () =>
      active.current && audioRef.current?.paused && setTalking(false),
  };
}
