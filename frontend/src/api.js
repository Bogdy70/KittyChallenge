export async function api(path,options={}) {
 const {body,...rest}=options;const response=await fetch(`/api${path}`,{credentials:'same-origin',...rest,headers:{...(body!==undefined&&!(body instanceof Blob)?{'Content-Type':'application/json'}:{}),...rest.headers},body:body===undefined?undefined:body instanceof Blob?body:JSON.stringify(body)});
 const data=await response.json().catch(()=>({message:'Serverul nu răspunde. Verifică conexiunea.'}));
 if(!response.ok){const error=Object.assign(new Error(data.message||'Nu am putut salva. Încearcă din nou.'),{status:response.status});if(response.status===401&&path!=='/login'&&path!=='/me')window.dispatchEvent(new Event('kitty:expired'));throw error;}
 return data;
}
export function useHash(){return window.location.hash.slice(1)||'home';}
