export const PIECE_COUNTS=[10,100,200,500];
export function gridFor(count,aspect=1.4) {
 if(!PIECE_COUNTS.includes(count))throw new Error('Alege 10, 100, 200 sau 500 de piese.');
 let best={rows:2,cols:count/2},score=Infinity;
 for(let rows=2;rows<=count/2;rows++){if(count%rows)continue;const cols=count/rows;const next=Math.abs(Math.log(cols/rows/aspect));if(next<score){score=next;best={rows,cols};}}
 return best;
}
export function validatePlacement(placed,count) {
 if(!Array.isArray(placed)||placed.length>count||placed.some(x=>!Number.isInteger(x)||x<0||x>=count))throw new Error('Progresul puzzle-ului nu este valid.');
 return [...new Set(placed)].sort((a,b)=>a-b);
}
