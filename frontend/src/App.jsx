import { useMessages, MessageProvider } from "./Messages";
import React, { useEffect, useState, useCallback } from "react";
import { api, useHash } from "./api";
import {
  Cat,
  Icon,
  PartyArt,
  Confetti,
  Progress,
  ErrorBox,
  Loading,
} from "./Art";
import MathChallenge from "./MathChallenge";
import PuzzleChallenge from "./PuzzleChallenge";
import Admin from "./Admin";
import { KnightCat, GuideSpeech, AmbientBackground } from "./Guide";
function Login({ onLogin }) {
  const { t } = useMessages();
  const [form, setForm] = useState({
      username: "",
      password: "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [show, setShow] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(
        await api("/login", {
          method: "POST",
          body: form,
        }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <div className="login-top">
        <Brand />
        <span className="tag">
          <Icon name="heart" size={15} />
          {" " + t("login.facut-cu-drag")}
        </span>
      </div>
      <div className="login-layout">
        <section className="login-story">
          <div className="eyebrow">
            <span className="live-dot" />
            {" " + t("login.o-petrecere-doar-pentru-tine")}
          </div>
          <h1>
            {t("login.mai-mult")}
            <br />
            {t("login.decat-un") + " "}
            <span className="hand-underline">{t("login.cadou")}</span>
          </h1>
          <p>
            {t("login.un-pic-de-joaca-un-strop-de-magie")}
            <br />
            {t("login.si-o-multime-de-motive-sa-zambesti")}
          </p>
          <PartyArt />
          <div className="story-footer">
            <span>{t("login.pisicute-incluse")}</span>
            <span>{t("login.zambete-garantate")}</span>
          </div>
        </section>
        <section className="login-card">
          <span className="login-cat-badge">
            <KnightCat />
          </span>
          <div className="eyebrow">{t("login.bine-ai-venit-in-club")}</div>
          <h2>
            {t("login.hei-sarbatorito")}
            <span className="pink">!</span>
          </h2>
          <p>
            {t("login.surpriza-ta-incepe-cu-un-mic-miau")}
            <br />
            {t("login.intra-in-cont-si-descopera-ce-ti-am-pregatit")}
          </p>
          <form onSubmit={submit}>
            <label>
              {t("login.nume-de-utilizator")}
              <input
                autoComplete="username"
                required
                placeholder={t("login.numele-tau-de-utilizator")}
                value={form.username}
                onChange={(e) =>
                  setForm({
                    ...form,
                    username: e.target.value,
                  })
                }
              />
            </label>
            <label>
              {t("login.parola")}
              <div className="password-field">
                <input
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder={t("login.secretul-nostru")}
                  value={form.password}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      password: e.target.value,
                    })
                  }
                />
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={
                    show ? t("login.ascunde-parola") : t("login.arata-parola")
                  }
                  aria-pressed={show}
                >
                  <Icon name="eye" />
                </button>
              </div>
            </label>
            <ErrorBox>{error}</ErrorBox>
            <button className="button rainbow wide" disabled={busy}>
              {busy
                ? t("login.deschidem-cadoul")
                : t("login.sa-inceapa-surpriza")}
              <Icon name="arrow" />
            </button>
          </form>
          <div className="login-note">
            <Icon name="lock" size={15} />
            {" " + t("login.o-invitatie-speciala-doar-pentru-voi-doi")}
          </div>
        </section>
      </div>
      <footer className="login-bottom">
        {t("login.la-multi-ani") + " "}
        <span>{t("login.20-de-ani-nenumarate-aventuri")}</span> ♥
      </footer>
    </main>
  );
}
function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <Cat />
      </div>
      <span>
        kitty
        <span className="brand-party">
          party<span className="pink">✦</span>
        </span>
      </span>
    </div>
  );
}
function Dashboard({ settings, overview, navigate }) {
  const { t } = useMessages();
  const math = overview?.math,
    puzzle = overview?.puzzle;
  const locked = !overview?.puzzleUnlocked;
  const done =
    !!math &&
    math.solved === math.exercises.length &&
    puzzle?.placed.length === puzzle?.count;
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="live-dot" />
            {" " + t("home.ziua-ta-regulile-pisicutelor")}
          </div>
          <h1>
            {t("home.la-multi")}
            <br />
            <span className="pink hand-underline">{t("home.ani")}</span>{" "}
            <span className="little-star">✳</span>
          </h1>
          <p>
            <strong>{settings.recipient},</strong> {settings.message}
          </p>
          <div className="hero-chips">
            <span>
              <Icon name="heart" size={16} />
              {" " + t("home.facute-cu-drag")}
            </span>
            <span>
              <Icon name="spark" size={16} />
              {" " + t("home.zero-graba-multa-joaca")}
            </span>
          </div>
        </div>
        <PartyArt />
      </section>
      <div className="ticker" aria-hidden="true">
        <div>
          {Array.from(
            {
              length: 6,
            },
            (_, i) => (
              <span key={i}>
                {t("home.miau-multi-ani") + " "}
                <span>✦</span>
                {" " + t("home.astazi-e-despre-tine") + " "}
                <span>✦</span>
              </span>
            ),
          )}
        </div>
      </div>
      <GuideSpeech
        className="welcome-guide"
        title={t("home.welcome.title", {
          recipient: settings.recipient,
        })}
        message={t(
          "home.eu-sunt-cavalerul-miau-paznicul-cadoului-tau-am-o-sabie-mica-si-m",
        )}
        detail={t(
          "home.la-matrici-iti-soptesc-indicii-la-puzzle-cautam-impreuna-locul-fi",
        )}
      />
      <section className="challenges">
        <div className="section-title">
          <div>
            <div className="eyebrow">{t("home.micile-tale-aventuri")}</div>
            <h2>{t("home.doua-provocari-o-zi-speciala")}</h2>
          </div>
          <span className="tag white">
            <Icon name="paw" size={16} />
            {" " + t("home.in-ritmul-tau")}
          </span>
        </div>
        <div className="challenge-grid">
          <article className="challenge-card math-card">
            <div className="card-top">
              <span className="number-label">{t("home.01-pentru-minte")}</span>
              <span className="pill">
                {math?.exercises.length || 5}
                {" " + t("home.exercitii")}
              </span>
            </div>
            <div className="challenge-illustration matrix-mini">
              <div className="mini-ear left" />
              <div className="mini-ear right" />
              <div className="mini-matrix">
                <span>2</span>
                <span>−1</span>
                <span>0</span>
                <span>3</span>
              </div>
              <span className="floating-symbol">✦</span>
              <span className="matrix-formula">{t("home.a-b")}</span>
            </div>
            <h3>{t("home.matrici-mustati")}</h3>
            <p>
              {t(
                "home.numere-mici-satisfactii-mari-rezolva-descopera-si-lasa-pisicutele",
              )}
            </p>
            <Progress
              value={math?.solved || 0}
              max={math?.exercises.length || 5}
              label={t("home.exercitii-rezolvate")}
            />
            <button
              className="button dark wide"
              onClick={() => navigate("math")}
            >
              {math?.solved
                ? t("home.continua-aventura")
                : t("home.hai-la-joaca")}
              <Icon name="arrow" />
            </button>
          </article>
          <article
            className={`challenge-card puzzle-card ${locked ? "challenge-locked" : ""}`}
          >
            <div className="card-top">
              <span className="number-label">{t("home.02-pentru-suflet")}</span>
              <span className="pill">
                {puzzle?.count || settings.puzzle.count || 10}
                {" " + t("home.piese")}
              </span>
            </div>
            <div className="challenge-illustration puzzle-mini">
              <div className="polaroid">
                {locked ? (
                  <div className="locked-photo">
                    <Icon name="lock" size={42} />
                    <span>{t("puzzle.locked.label")}</span>
                  </div>
                ) : (
                  <img
                    src={puzzle?.url || "/demo-photo.svg"}
                    alt={t("home.previzualizare-puzzle")}
                  />
                )}
                <span>{t("home.o-amintire-piesa-cu-piesa")}</span>
              </div>
              <div className="puzzle-sticker">
                <Icon name="puzzle" size={43} />
              </div>
            </div>
            <h3>{t("home.piese-de-fericire")}</h3>
            <p>
              {locked
                ? t("puzzle.locked.message")
                : t(
                    "home.o-imagine-speciala-ascunsa-in-bucatele-pune-le-la-loc-si-descoper",
                  )}
            </p>
            <Progress
              value={puzzle?.placed.length || 0}
              max={puzzle?.count || settings.puzzle.count || 10}
              label={t("home.piese-la-locul-lor")}
            />
            <button
              className="button dark wide"
              onClick={() => navigate(locked ? "math" : "puzzle")}
            >
              {locked
                ? t("puzzle.locked.action")
                : puzzle?.placed.length
                  ? t("home.continua-povestea")
                  : t("home.descopera-puzzle-ul")}
              <Icon name="arrow" />
            </button>
          </article>
        </div>
      </section>
      <GuideSpeech
        className="journey-note"
        mood={done ? "celebrate" : "encourage"}
        title={
          done
            ? t("home.toate-labutele-sus-ai-reusit")
            : t("home.pactul-nostru-de-cavaler")
        }
        message={
          done
            ? t(
                "home.ambele-misiuni-sunt-gata-imi-ridic-sabia-pentru-tine-la-multi-ani",
              )
            : t(
                "home.promit-sa-tin-cu-tine-si-cand-raspunsul-nu-iese-din-prima-tu-prom",
              )
        }
        detail={
          done
            ? t("home.tu-esti-cea-mai-frumoasa-surpriza-miau")
            : t(
                "home.indiciile-sunt-pentru-ajutor-pauzele-pentru-incarcat-superputeril",
              )
        }
      />
    </>
  );
}
function AppContent() {
  const { t, setMessages, ready } = useMessages();
  const [user, setUser] = useState(null),
    [checking, setChecking] = useState(true),
    [settings, setSettings] = useState(null),
    [overview, setOverview] = useState(null),
    [page, setPage] = useState(useHash),
    [error, setError] = useState(""),
    [burst, setBurst] = useState(0),
    [toast, setToast] = useState("");
  const refresh = useCallback(async () => {
    try {
      const [s, math, journey] = await Promise.all([
        api("/settings"),
        api("/math"),
        api("/journey"),
      ]);
      const puzzle = journey.puzzleUnlocked ? await api("/puzzle") : null;
      setSettings(s);
      setMessages(s.messages || {});
      setOverview({
        math,
        puzzle,
        puzzleUnlocked: journey.puzzleUnlocked,
      });
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [setMessages]);
  useEffect(() => {
    let active = true;
    api("/me")
      .then((u) => active && setUser(u))
      .catch((e) => {
        if (active && e.status !== 401) setError(e.message);
      })
      .finally(() => active && setChecking(false));
    const expired = () => {
      setUser(null);
      setSettings(null);
      setOverview(null);
      setToast(t("general.sesiunea-a-expirat-intra-din-nou-in-cont"));
    };
    const hash = () => setPage(useHash());
    window.addEventListener("kitty:expired", expired);
    window.addEventListener("hashchange", hash);
    return () => {
      active = false;
      window.removeEventListener("kitty:expired", expired);
      window.removeEventListener("hashchange", hash);
    };
  }, []);
  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    if (burst) {
      const timer = setTimeout(() => setBurst(0), 3500);
      return () => clearTimeout(timer);
    }
  }, [burst]);
  function navigate(next) {
    setPage(next);
    window.location.hash = next;
    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
  }
  function celebrate(message) {
    setBurst(Date.now());
    setToast(message);
    refresh();
  }
  async function logout() {
    try {
      await api("/logout", {
        method: "POST",
      });
      setUser(null);
      setOverview(null);
      setSettings(null);
      navigate("home");
    } catch (e) {
      setToast(e.message);
    }
  }
  if (checking || !ready) return <Loading />;
  if (!user)
    return (
      <>
        <Login
          onLogin={(u) => {
            setUser(u);
            navigate("home");
          }}
        />
        <div className="toast-area" role="status">
          {toast || error ? (
            <div className="toast">{toast || error}</div>
          ) : null}
        </div>
      </>
    );
  const nav = [
    ["home", "home", t("general.acasa")],
    ["math", "matrix", t("general.matrici")],
    ["puzzle", "puzzle", t("general.puzzle")],
    ...(user.role === "admin"
      ? [["admin", "settings", t("general.atelier")]]
      : []),
  ];
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
          document.getElementById("main-content")?.scrollIntoView();
        }}
      >
        {t("general.sari-la-continut")}
      </a>
      <header className="app-header">
        <button
          className="brand-button"
          onClick={() => navigate("home")}
          aria-label={t("general.kitty-party-acasa")}
        >
          <Brand />
        </button>
        <nav aria-label={t("general.navigare-principala")}>
          {nav.map(([key, icon, label]) => (
            <button
              key={key}
              className={page === key ? "nav-item active" : "nav-item"}
              onClick={() => navigate(key)}
              aria-current={page === key ? "page" : undefined}
            >
              <Icon
                name={
                  key === "puzzle" && overview && !overview.puzzleUnlocked
                    ? "lock"
                    : icon
                }
              />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="user-menu">
          <span className="avatar">
            {user.role === "admin" ? (
              <Icon name="star" />
            ) : (
              <Icon name="heart" />
            )}
          </span>
          <span className="user-name">
            {user.displayName}
            <small>
              {user.role === "admin"
                ? t("general.organizator")
                : t("general.invitata-de-onoare")}
            </small>
          </span>
          <button
            className="icon-button"
            onClick={logout}
            aria-label={t("general.iesi-din-cont")}
            title={t("general.iesi-din-cont")}
          >
            <Icon name="logout" />
          </button>
        </div>
      </header>
      <main className="app-main" id="main-content" tabIndex={-1}>
        <ErrorBox>{error}</ErrorBox>
        {!settings ? (
          <>
            <Loading />
            {error && (
              <button className="button" onClick={refresh}>
                {t("general.incearca-din-nou")}
              </button>
            )}
          </>
        ) : page === "math" ? (
          <MathChallenge
            celebrate={celebrate}
            onProgress={refresh}
            onPuzzle={() => navigate("puzzle")}
          />
        ) : page === "puzzle" ? (
          overview?.puzzleUnlocked ? (
            <PuzzleChallenge celebrate={celebrate} onProgress={refresh} />
          ) : (
            <section className="panel puzzle-locked-panel">
              <GuideSpeech
                mood="thinking"
                title={t("puzzle.locked.title")}
                message={t("puzzle.locked.message")}
              />
              <Progress
                value={overview?.math?.solved || 0}
                max={overview?.math?.exercises.length || 5}
                label={t("home.exercitii-rezolvate")}
              />
              <button
                className="button rainbow"
                onClick={() => navigate("math")}
              >
                <Icon name="matrix" />
                {t("puzzle.locked.action")}
              </button>
            </section>
          )
        ) : page === "admin" && user.role === "admin" ? (
          <Admin
            settings={settings}
            onSaved={(s) => {
              setSettings(s);
              setMessages(s.messages || {});
              refresh();
            }}
            notify={setToast}
          />
        ) : (
          <Dashboard
            settings={settings}
            overview={overview}
            navigate={navigate}
          />
        )}
      </main>
      <footer className="app-footer">
        <Brand />
        <span>
          {t("general.creat-cu-drag-pentru-o-zi-care-merita-toata-magia")}
        </span>
        <span>
          {t("general.20-foarte-iubita") + " "}
          <Icon name="heart" size={15} />
        </span>
      </footer>
      <Confetti burst={burst} />
      <div className="toast-area">
        {toast && (
          <GuideSpeech
            className="toast-guide"
            title={t("general.un-miau-pentru-tine")}
            message={toast}
            mood={burst ? "celebrate" : "welcome"}
            speak={false}
          />
        )}
      </div>
    </>
  );
}
export default function App() {
  return (
    <MessageProvider>
      <>
        <AmbientBackground />
        <AppContent />
      </>
    </MessageProvider>
  );
}
