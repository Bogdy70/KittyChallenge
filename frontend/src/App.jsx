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
  const [form, setForm] = useState({ username: "", password: "" }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [show, setShow] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(await api("/login", { method: "POST", body: form }));
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
          <Icon name="heart" size={15} /> făcut cu drag
        </span>
      </div>
      <div className="login-layout">
        <section className="login-story">
          <div className="eyebrow">
            <span className="live-dot" /> O PETRECERE DOAR PENTRU TINE
          </div>
          <h1>
            Mai mult
            <br />
            decât un <span className="hand-underline">cadou.</span>
          </h1>
          <p>
            Un pic de joacă. Un strop de magie.
            <br />
            Și o mulțime de motive să zâmbești.
          </p>
          <PartyArt />
          <div className="story-footer">
            <span>✦ Pisicuțe incluse</span>
            <span>✦ Zâmbete garantate</span>
          </div>
        </section>
        <section className="login-card">
          <span className="login-cat-badge">
            <KnightCat />
          </span>
          <div className="eyebrow">BINE AI VENIT ÎN CLUB</div>
          <h2>
            Hei, sărbătorito<span className="pink">!</span>
          </h2>
          <p>
            Surpriza ta începe cu un mic „miau”.
            <br />
            Intră în cont și descoperă ce ți-am pregătit.
          </p>
          <form onSubmit={submit}>
            <label>
              Nume de utilizator
              <input
                autoComplete="username"
                required
                placeholder="Numele tău de utilizator"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </label>
            <label>
              Parolă
              <div className="password-field">
                <input
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="Secretul nostru"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Ascunde parola" : "Arată parola"}
                  aria-pressed={show}
                >
                  <Icon name="eye" />
                </button>
              </div>
            </label>
            <ErrorBox>{error}</ErrorBox>
            <button className="button rainbow wide" disabled={busy}>
              {busy ? "Deschidem cadoul…" : "Să înceapă surpriza"}
              <Icon name="arrow" />
            </button>
          </form>
          <div className="login-note">
            <Icon name="lock" size={15} /> O invitație specială. Doar pentru voi
            doi.
          </div>
        </section>
      </div>
      <footer className="login-bottom">
        LA MULȚI ANI!!! <span>20 de ani. Nenumărate aventuri.</span> ♥
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
  const math = overview?.math,
    puzzle = overview?.puzzle;
  const done =
    !!math &&
    math.solved === math.exercises.length &&
    puzzle?.placed.length === puzzle?.count;
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="live-dot" /> ZIUA TA. REGULILE PISICUȚELOR.
          </div>
          <h1>
            La mulți
            <br />
            <span className="pink hand-underline">ani!!!</span>{" "}
            <span className="little-star">✳</span>
          </h1>
          <p>
            <strong>{settings.recipient},</strong> {settings.message}
          </p>
          <div className="hero-chips">
            <span>
              <Icon name="heart" size={16} /> făcute cu drag
            </span>
            <span>
              <Icon name="spark" size={16} /> zero grabă, multă joacă
            </span>
          </div>
        </div>
        <PartyArt />
      </section>
      <div className="ticker" aria-hidden="true">
        <div>
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i}>
              MIAU MULȚI ANI <span>✦</span> ASTĂZI E DESPRE TINE <span>✦</span>
            </span>
          ))}
        </div>
      </div>
      <GuideSpeech
        className="welcome-guide"
        title={`Bun venit în aventură, ${settings.recipient}!`}
        message="Eu sunt Cavalerul Miau, paznicul cadoului tău. Am o sabie mică și mult curaj pentru noi amândoi. Alegi tu prima misiune?"
        detail="La matrici îți șoptesc indicii. La puzzle căutăm împreună locul fiecărei amintiri. Fără grabă — astăzi sărbătorim 20 de ani de tine!"
      />
      <section className="challenges">
        <div className="section-title">
          <div>
            <div className="eyebrow">MICILE TALE AVENTURI</div>
            <h2>Două provocări. O zi specială.</h2>
          </div>
          <span className="tag white">
            <Icon name="paw" size={16} /> în ritmul tău
          </span>
        </div>
        <div className="challenge-grid">
          <article className="challenge-card math-card">
            <div className="card-top">
              <span className="number-label">01 / PENTRU MINTE</span>
              <span className="pill">
                {math?.exercises.length || 5} exerciții
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
              <span className="matrix-formula">A + B = ♡</span>
            </div>
            <h3>Matrici & mustăți</h3>
            <p>
              Numere mici, satisfacții mari. Rezolvă, descoperă și lasă
              pisicuțele să te ghideze.
            </p>
            <Progress
              value={math?.solved || 0}
              max={math?.exercises.length || 5}
              label="Exerciții rezolvate"
            />
            <button
              className="button dark wide"
              onClick={() => navigate("math")}
            >
              {math?.solved ? "Continuă aventura" : "Hai la joacă"}
              <Icon name="arrow" />
            </button>
          </article>
          <article className="challenge-card puzzle-card">
            <div className="card-top">
              <span className="number-label">02 / PENTRU SUFLET</span>
              <span className="pill">{puzzle?.count || 10} piese</span>
            </div>
            <div className="challenge-illustration puzzle-mini">
              <div className="polaroid">
                <img
                  src={puzzle?.url || "/demo-photo.svg"}
                  alt="Previzualizare puzzle"
                />
                <span>o amintire, piesă cu piesă ♡</span>
              </div>
              <div className="puzzle-sticker">
                <Icon name="puzzle" size={43} />
              </div>
            </div>
            <h3>Piese de fericire</h3>
            <p>
              O imagine specială, ascunsă în bucățele. Pune-le la loc și
              descoperă povestea.
            </p>
            <Progress
              value={puzzle?.placed.length || 0}
              max={puzzle?.count || 10}
              label="Piese la locul lor"
            />
            <button
              className="button dark wide"
              onClick={() => navigate("puzzle")}
            >
              {puzzle?.placed.length
                ? "Continuă povestea"
                : "Descoperă puzzle-ul"}
              <Icon name="arrow" />
            </button>
          </article>
        </div>
      </section>
      <GuideSpeech
        className="journey-note"
        mood={done ? "celebrate" : "encourage"}
        title={
          done ? "Toate lăbuțele sus! Ai reușit!" : "Pactul nostru de cavaler"
        }
        message={
          done
            ? "Ambele misiuni sunt gata! Îmi ridic sabia pentru tine: la mulți ani, cu iubire, aventuri și o mie de motive să zâmbești!"
            : "Promit să țin cu tine și când răspunsul nu iese din prima. Tu promite-mi doar că îți dai voie să te bucuri."
        }
        detail={
          done
            ? "Tu ești cea mai frumoasă surpriză. Miau!"
            : "Indiciile sunt pentru ajutor, pauzele pentru încărcat superputerile. Suntem o echipă."
        }
      />
    </>
  );
}
function AppContent() {
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
      const [s, math, puzzle] = await Promise.all([
        api("/settings"),
        api("/math"),
        api("/puzzle"),
      ]);
      setSettings(s);
      setOverview({ math, puzzle });
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);
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
      setToast("Sesiunea a expirat. Intră din nou în cont.");
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
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function celebrate(message) {
    setBurst(Date.now());
    setToast(message);
    refresh();
  }
  async function logout() {
    try {
      await api("/logout", { method: "POST" });
      setUser(null);
      setOverview(null);
      setSettings(null);
      navigate("home");
    } catch (e) {
      setToast(e.message);
    }
  }
  if (checking) return <Loading />;
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
    ["home", "home", "Acasă"],
    ["math", "matrix", "Matrici"],
    ["puzzle", "puzzle", "Puzzle"],
    ...(user.role === "admin" ? [["admin", "settings", "Atelier"]] : []),
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
        Sari la conținut
      </a>
      <header className="app-header">
        <button
          className="brand-button"
          onClick={() => navigate("home")}
          aria-label="Kitty Party, acasă"
        >
          <Brand />
        </button>
        <nav aria-label="Navigare principală">
          {nav.map(([key, icon, label]) => (
            <button
              key={key}
              className={page === key ? "nav-item active" : "nav-item"}
              onClick={() => navigate(key)}
              aria-current={page === key ? "page" : undefined}
            >
              <Icon name={icon} />
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
              {user.role === "admin" ? "organizator" : "invitata de onoare"}
            </small>
          </span>
          <button
            className="icon-button"
            onClick={logout}
            aria-label="Ieși din cont"
            title="Ieși din cont"
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
                Încearcă din nou
              </button>
            )}
          </>
        ) : page === "math" ? (
          <MathChallenge celebrate={celebrate} onProgress={refresh} />
        ) : page === "puzzle" ? (
          <PuzzleChallenge celebrate={celebrate} onProgress={refresh} />
        ) : page === "admin" && user.role === "admin" ? (
          <Admin
            settings={settings}
            onSaved={(s) => {
              setSettings(s);
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
        <span>Creat cu drag, pentru o zi care merită toată magia.</span>
        <span>
          20 & foarte iubită <Icon name="heart" size={15} />
        </span>
      </footer>
      <Confetti burst={burst} />
      <div className="toast-area">
        {toast && (
          <GuideSpeech
            className="toast-guide"
            title="Un miau pentru tine"
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
    <>
      <AmbientBackground />
      <AppContent />
    </>
  );
}
