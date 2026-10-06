# Kitty Party ✦ La mulți ani, 20!

O aplicație aniversară în română, cu Cavalerul Miau, pisicuțe animate, exerciții de matrice și un puzzle din fotografia aleasă de organizator. Două conturi, progres separat și un atelier privat de administrare.

![Pagina principală](docs/home-desktop.png)

[Previzualizare pe telefon](docs/home-mobile.png) · [Autentificare](docs/login-desktop.png)

## Pornire rapidă

Ai nevoie de **Node.js 24 sau mai nou**. Din folderul proiectului:

```powershell
npm ci
npm run build
npm start
```

Deschide **http://localhost:3001**. În Windows poți folosi și `./scripts/start-app.ps1`.

Pentru dezvoltare, `npm run dev` pornește API-ul pe 3001 și Vite pe **http://localhost:5174**, cu actualizare automată. Frontend-ul folosește un proxy local pentru API și imagini. Fonturile sunt incluse local; nu există cereri către Google Fonts.

## Cele două conturi și parolele

La prima pornire, aplicația generează automat **config/accounts.json**, cu parole aleatoare diferite. Poți genera fișierul și înainte de pornire:

```powershell
npm run accounts
```

Deschide **config/accounts.json** în editor. Acolo vezi și modifici numele de utilizator, parola și numele afișat pentru fiecare cont:

| Identificator stabil | Utilizator inițial | Rol                                            |
| -------------------- | ------------------ | ---------------------------------------------- |
| admin                | admin              | Administrator; poate testa și ambele provocări |
| birthday             | sarbatorita        | Contul invitatei                               |

Păstrează identificatorii `admin` / `birthday` și câte un rol `admin` / `player`. Parolele trebuie să aibă 10–128 de caractere. **Repornește serverul după modificări.** Schimbarea unei parole invalidează sesiunile acelui cont, fără să-i șteargă progresul. Nu există pagină sau API de înregistrare.

`config/accounts.example.json` explică structura și nu este folosit ca sursă a parolelor reale. Fișierul real, baza de date și fotografiile sunt excluse din Git. Parolele în clar există în fișierul local solicitat pentru configurare; baza de date păstrează hash-uri scrypt cu salt. Protejează accesul la folderul local și nu publica acest fișier.

## Pregătește cadoul

1. Intră ca administrator și deschide **Atelier → Petrecerea**.
2. Personalizează numele sărbătoritei și mesajul de pe prima pagină.
3. Alege dificultatea matricelor și salvează.
4. Încarcă o fotografie JPEG, PNG sau WebP. Imaginea de pornire este o ilustrație originală cu pisicuțe, pentru probă.
5. Alege **10, 100, 200 sau 500 de piese** și salvează.
6. Opțional, adaugă exerciții în **Atelier → Exercițiile**. Soluția este calculată automat înainte de adăugare.
7. Verifică progresul separat al celor două conturi în **Atelier → Progresul**.

O fotografie nouă sau alt număr de piese creează un puzzle nou pentru ambele conturi. Modificarea dificultății și a exercițiilor se aplică **seturilor noi**; un set deja început rămâne intact. Apasă „Vreau un set nou” în pagina Matrici pentru a-l înlocui, după confirmare.

## Matrici & mustăți

- **Pui de pisică:** 5 exerciții, cu adunare, înmulțire cu scalar, transpusă, determinant și inversă simplă 2 × 2.
- **Pisică isteață:** 7 exerciții; adaugă scădere și produs de matrice, iar inversele pot avea fracții.
- **Super pisică:** 9 exerciții, inclusiv determinant și inversă 3 × 3.
- Matrice de maximum 3 × 3, numere generate între −3 și 3; inversele generate sunt nesingulare. Exercițiile personalizate acceptă întregi între −9 și 9.
- Căsuțe interactive, verificare pe fiecare element, indicii și soluții explicate. Sunt acceptate `1/2`, `0.5` și `0,5`.
- Până la 20 de exerciții personalizate, adăugate după cele generate.
- Consultarea unei soluții este înregistrată, fără penalizare. Un exercițiu se consideră rezolvat după trimiterea unui răspuns corect.
- Progresul, încercările, indiciile și soluțiile consultate sunt păstrate pe server. Un nou set generează alte numere și înlocuiește progresul setului precedent.

## Piese de fericire

- Piese SVG cu contururi complementare, generate din imagine; număr exact de piese, adaptând rândurile și coloanele la orientarea fotografiei.
- Proporțiile fotografiei sunt păstrate; piesele pot fi dreptunghiulare, mai ales la setul de 10.
- Trage o piesă sau selecteaz-o și apasă pe locul ei. Piesa se fixează numai în poziția corectă.
- Cu tastatura: Tab / Enter pentru piesă și locul de pe tablă.
- Zoom 50–300%, model suprapus, indiciu pentru piesa selectată și amestecarea cutiei.
- Cutie paginată cu 24 de piese: varianta de 500 nu afișează toate miniaturile simultan.
- Salvare automată pe server; progresul revine după reîncărcare sau conectare de pe alt dispozitiv. Dacă salvarea eșuează, un mesaj oferă reîncercarea.
- Fotografiile se optimizează în browser la maximum 2000 px și sunt servite numai utilizatorilor conectați. Originalul poate avea maximum 20 MB; serverul acceptă până la 8 MB pentru fișierul optimizat.

## Cavalerul Miau

Un pisoi alb-negru în armură, cu pelerină magenta și sabie, te însoțește de la autentificare la ultima piesă. Ilustrația SVG este originală: clipește, respiră, mișcă pelerina și ridică sabia la reușite. Bulele lui conțin indicii reale, explicațiile soluțiilor și încurajări după încercări.

Butonul **Ascultă** citește mesajul numai la cerere, prin vocea română instalată pe dispozitiv (Web Speech API). Dacă aceasta lipsește, ghidul explică situația și mesajul rămâne scris. Nu este necesar un serviciu AI sau o cheie API.

## Design și arhitectură

React + Vite, CSS propriu, fonturi locale DM Sans / Outfit și ilustrații SVG originale. Fundal aurora animat, panouri intens colorate, magenta, roz, lavandă, verde, albastru și galben; pisicuțe care clipesc și mișcă coada, butoane cu gradient animat, steluțe, bandă aniversară și confetti. Animațiile respectă `prefers-reduced-motion`.

Din Orderly sunt păstrate structura cont → dashboard → provocare, componentele reutilizabile, separarea API-ului și persistența. Pentru o aplicație de două persoane, serverul **Node.js + SQLite** înlocuiește Spring/PostgreSQL/Keycloak și reduce configurarea la un singur proces. Nu este necesar un server extern pentru autentificare sau baze de date.

```text
frontend/src/
  App.jsx                autentificare, navigare, dashboard
  Art.jsx                pisicuțe, iconițe, progres, confetti
  Guide.jsx              cavaler SVG, dialog, voce opțională, aurora
  MathChallenge.jsx      interfața exercițiilor
  PuzzleChallenge.jsx    puzzle, gesturi, zoom, salvare
  Admin.jsx              configurare, fotografii, exerciții, progres
  api.js                 client HTTP și sesiune expirată
  styles.css             componente de bază și responsive
  celebration.css        paleta aniversară, ghid și animații
server/
  index.mjs              API, sesiuni, SQLite și fișiere statice
  accounts.mjs           generare / validare conturi din fișier
  math.mjs               generare, validare, soluții și verificare
  puzzle.mjs             dimensiunile grilei și validarea progresului
public/                  ilustrații SVG originale
tests/                   teste matematice și integrare API
scripts/browser-check.mjs  verificări reale în browser, izolate de datele aplicației
```

Sesiunile folosesc cookie-uri HttpOnly, SameSite=Strict, cu expirare la 7 zile. Baza de date păstrează hash-ul tokenului. API-ul verifică rolul pentru toate operațiile administrative și identifică progresul exclusiv din sesiune. Există limitare a încercărilor de autentificare, verificare de origine pentru mutațiile browserului, limite de upload și antete de securitate. Baza de date folosește WAL și foreign keys.

Fișiere persistente:

- `data/kitty.sqlite` — conturi, sesiuni, setări, exerciții și progres.
- `data/uploads/` — fotografii încărcate; imaginile vechi rămân păstrate local.
- `config/accounts.json` — configurarea locală a celor două conturi.

Pentru backup simplu, oprește aplicația și copiază **data/** și **config/** împreună. Nu șterge aceste directoare la actualizarea codului.

## Docker și acces de pe alt dispozitiv

```powershell
docker compose up --build -d
```

Aceleași directoare `data/` și `config/` sunt montate în container. Implicit, serverul și Compose ascultă doar pe localhost. Pentru LAN/Tailscale, setează `HOST=0.0.0.0` la pornirea Node sau schimbă publicarea portului Compose în `3001:3001`, apoi folosește adresa privată a calculatorului gazdă. Serverul livrează frontend-ul și API-ul de la aceeași origine; nu este nevoie să reconstruiești URL-uri pentru alt hostname.

Pentru găzduire publică, pune aplicația în spatele unui reverse proxy cu **HTTPS** și setează `COOKIE_SECURE=true`. Această implementare nu publică singură un site sau un tunel și nu configurează firewall-ul. Pe Linux, directoarele montate trebuie să permită scrierea utilizatorului containerului (`node`, UID 1000).

Variabile opționale: `PORT` (3001), `HOST` (127.0.0.1), `DATA_DIR`, `ACCOUNTS_FILE`, `COOKIE_SECURE`. Pornirea Node folosește variabilele procesului; Docker Compose citește `.env`. Nu sunt necesare chei API sau servicii plătite.

## Verificări

```powershell
npm test
npm run build
npm run test:browser
```

Testele browser folosesc Edge instalat în Windows. Pe Linux/macOS rulează înainte `npx playwright install chromium`. Conturile, fotografiile și progresul testelor sunt create într-un director temporar și apoi eliminate. Capturile sunt salvate local în `artifacts/`, exclus din Git.

Sunt testate operațiile și fracțiile, 1.500 de seturi generate, identitatea `A × A⁻¹ = I`, validarea, permisiunile, conturile, sesiunile, schimbarea parolei, upload-ul privat și persistența. Testele în browser verifică desktop/mobil, rezolvarea matricelor, puzzle prin click / drag / tastatură, administrarea și redarea a 500 de piese.

GitHub Actions rulează testele Node, compilarea și scenariile browser în Chromium. La eșec, capturile sunt disponibile ca artefact al rulării. `npm run format` formatează sursele cu Prettier.

## Limite deliberate

- Puzzle-ul este o tablă cu locuri fixe și piese care se fixează corect, fără rotire sau grupuri libere de piese.
- Progresul este persistent, dar aplicația are nevoie de conexiune pentru autentificare și salvare. Nu este un mod offline.
- Setările noi devin vizibile după reîncărcare; nu există sincronizare în timp real între ferestrele deschise.
- Conturile sunt configurate local, fără resetare prin e-mail, înregistrare sau servicii externe.
- Nu există cronometru, penalizări sau blocarea unei provocări în spatele celeilalte.

Referința inițială de arhitectură și stil este păstrată în [ORDERLY_BASELINE.md](ORDERLY_BASELINE.md).
