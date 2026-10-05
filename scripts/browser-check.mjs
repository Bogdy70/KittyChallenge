import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createApp} from '../server/index.mjs';
import {solve} from '../server/math.mjs';
const dir=mkdtempSync(join(tmpdir(),'kitty-browser-'));
const accountsPath=join(dir,'accounts.json');
writeFileSync(accountsPath,JSON.stringify([{id:'admin',role:'admin',username:'admin',displayName:'Organizatorul',password:'browser-admin-password'},{id:'birthday',role:'player',username:'sarbatorita',displayName:'Sărbătorita',password:'browser-player-password'}]));
const server=createApp({dataDir:dir,accountsPath});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const out=resolve('artifacts');mkdirSync(out,{recursive:true});
let page;
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const overflow=async()=>{const details=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,items:[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+2).map(e=>({tag:e.tagName,cls:typeof e.className==='string'?e.className:'svg',right:Math.round(e.getBoundingClientRect().right)})).slice(0,15)}));assert.ok(details.scroll<=details.width+2,JSON.stringify(details));};
 await page.goto(base);await page.getByRole('heading',{name:'Hei, sărbătorito!'}).waitFor();await page.screenshot({path:join(out,'01-login-desktop.png'),fullPage:true});await overflow();
 await page.getByLabel('Nume de utilizator').fill('sarbatorita');await page.getByLabel('Parolă',{exact:true}).fill('browser-player-password');await page.getByRole('button',{name:'Să înceapă surpriza'}).click();await page.getByRole('heading',{name:'Două provocări. O zi specială.'}).waitFor();await page.screenshot({path:join(out,'02-home-desktop.png'),fullPage:true});await overflow();
 assert.equal(await page.getByRole('button',{name:'Atelier',exact:true}).count(),0);
 await page.getByRole('button',{name:'Matrici',exact:true}).click();await page.getByRole('heading',{name:'Încălzirea mustăților'}).waitFor();await page.getByRole('button',{name:'Un indiciu',exact:true}).click();await page.getByText('O șoaptă de la pisicuță').waitFor();
 await page.screenshot({path:join(out,'03-math-desktop.png'),fullPage:true});await overflow();
 const run=await page.evaluate(()=>fetch('/api/math').then(r=>r.json()));
 for(let n=0;n<run.exercises.length;n++){
  const e=run.exercises[n];await page.locator('.exercise-nav').nth(n).click();const result=solve(e);
  for(let i=0;i<result.length;i++)for(let j=0;j<result[i].length;j++)await page.getByLabel(`Rezultat, rândul ${i+1}, coloana ${j+1}`,{exact:true}).fill(result[i][j]);
  await page.getByRole('button',{name:'Verifică răspunsul'}).click();await page.getByText('Purrfect! Ai găsit răspunsul.').waitFor();
 }
 await page.getByRole('heading',{name:'Minte sclipitoare, misiune îndeplinită!'}).waitFor();
 await page.getByRole('button',{name:'Puzzle',exact:true}).click();await page.getByRole('heading',{name:'Cutia cu piese'}).waitFor();await page.getByRole('button',{name:'Alege piesa 1',exact:true}).click();await page.getByRole('button',{name:'Indiciu',exact:true}).click();await page.getByRole('button',{name:'Locul 1, 1',exact:true}).click();await page.getByText('Progres salvat. Pisicuța are grijă de el.').waitFor();
 await page.screenshot({path:join(out,'04-puzzle-desktop.png'),fullPage:true});await overflow();await page.reload();await page.getByRole('button',{name:'Locul 1, 1, completat',exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Acasă',exact:true}).click();await page.getByRole('heading',{name:'Două provocări. O zi specială.'}).waitFor();await page.screenshot({path:join(out,'05-home-mobile.png'),fullPage:true});await overflow();
 await page.getByRole('button',{name:'Matrici',exact:true}).click();await page.getByRole('heading',{name:'Încălzirea mustăților'}).waitFor();await page.screenshot({path:join(out,'06-math-mobile.png'),fullPage:true});await overflow();
 await page.getByRole('button',{name:'Puzzle',exact:true}).click();await page.getByRole('heading',{name:'Cutia cu piese'}).waitFor();await page.screenshot({path:join(out,'07-puzzle-mobile.png'),fullPage:true});await overflow();
 await page.getByRole('button',{name:'Ieși din cont'}).click();await page.getByRole('heading',{name:'Hei, sărbătorito!'}).waitFor();await page.screenshot({path:join(out,'08-login-mobile.png'),fullPage:true});await overflow();
 await page.getByLabel('Nume de utilizator').fill('admin');await page.getByLabel('Parolă',{exact:true}).fill('browser-admin-password');await page.getByRole('button',{name:'Să înceapă surpriza'}).click();await page.getByRole('button',{name:'Atelier',exact:true}).click();await page.getByRole('heading',{name:'O petrecere pe numele ei.'}).waitFor();await overflow();
 await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:join(out,'09-admin-desktop.png'),fullPage:true});
 await page.getByLabel('Nivelul de dificultate').selectOption('spicy');await page.getByRole('radio',{name:/500/}).check();await page.getByRole('button',{name:'Salvează surpriza'}).click();await page.getByText('Surpriza a fost actualizată.').waitFor();
 const picture=await page.locator('.admin-photo img').screenshot();await page.locator('input[type=file]').setInputFiles({name:'amintire.png',mimeType:'image/png',buffer:picture});await page.getByText('Fotografia a devenit un puzzle!').waitFor();
 await page.getByRole('tab',{name:'Exercițiile'}).click();await page.getByLabel('Titlul exercițiului').fill('Exercițiul nostru');await page.getByRole('button',{name:'Adaugă exercițiul'}).click();await page.getByText('Exercițiul nostru',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Matrici',exact:true}).click();await page.getByRole('button',{name:'Vreau un set nou'}).click();await page.getByText('Super pisică',{exact:true}).waitFor();assert.equal(await page.locator('.exercise-nav').count(),10);
 await page.getByRole('button',{name:'Puzzle',exact:true}).click();await page.getByRole('heading',{name:'Cutia cu piese'}).waitFor();assert.equal(await page.locator('.puzzle-slot').count(),500);assert.equal(await page.locator('.tray-piece').count(),24);await overflow();
 await page.getByRole('button',{name:'Mai multe piese'}).click();await page.getByText('Cutia 2 din 21').waitFor();
 await page.screenshot({path:join(out,'10-puzzle-500.png'),fullPage:true});
 assert.deepEqual(errors,[],'no browser runtime errors');console.log('Browser checks passed: login, matrix completion, hints, puzzle placement/persistence, mobile layouts, admin settings/photo/exercise, 500 pieces.');
}catch(e){if(page)await page.screenshot({path:join(out,'failure.png'),fullPage:true}).catch(()=>{});throw e;}finally{await browser.close();await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
