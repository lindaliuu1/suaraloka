const enc = new TextEncoder();
const json = (data, status=200, extra={}) => new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
const bad = (message,status=400)=>json({error:message},status);
const cookie = (req,name)=>req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';
const hex = b=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');

async function sign(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    {
      name: 'HMAC',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(message)
  );

  return hex(signature);
}

async function authorized(req,env){const token=cookie(req,'sl_session');if(!token||!env.SESSION_SECRET)return false;const [expiry,sig]=token.split('.');if(!/^\d+$/.test(expiry)||Number(expiry)<Date.now()||!sig)return false;const expected=await sign(env.SESSION_SECRET,expiry);if(expected.length!==sig.length)return false;let mismatch=0;for(let i=0;i<sig.length;i++)mismatch|=sig.charCodeAt(i)^expected.charCodeAt(i);return mismatch===0;}
const slugify=s=>String(s||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,100);
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function articleHTML(a){const title=escapeHtml(a.title),desc=escapeHtml(a.excerpt||a.title),img=a.image?.startsWith('/media/')?`<meta property="og:image" content="https://suaraloka.com${escapeHtml(a.image)}">`:'';return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | Suaraloka</title><meta name="description" content="${desc}"><meta property="og:title" content="${title}"><meta property="og:description" content="${desc}">${img}<link rel="canonical" href="https://suaraloka.com/artikel/${encodeURIComponent(a.slug)}"><link rel="stylesheet" href="/assets/style.css"></head><body><header class="top"><div class="wrap head"><a class="brand" href="/"><span class="brandmark">S</span><span>SUARA<span class="accent">LOKA</span><small>Suara Lokal, Wawasan Nasional</small></span></a><nav><a href="/">Beranda</a><a href="/berita/">Berita</a><a href="/admin/">Redaksi</a></nav></div></header><main class="wrap article-page"><a class="muted" href="/berita/">← Kembali ke berita</a><div class="eyebrow">${escapeHtml(a.category)}</div><h1>${title}</h1><p class="muted">${escapeHtml(a.author)} · ${escapeHtml((a.published_at||a.created_at).slice(0,10))}</p>${a.image?.startsWith('/media/')?`<img class="article-cover" src="${escapeHtml(a.image)}" alt="${title}">`:''}<div class="article-body">${escapeHtml(a.body).split(/\n\n+/).map(p=>`<p>${p.replace(/\n/g,'<br>')}</p>`).join('')}</div><a class="btn" href="/berita/">Lihat berita lainnya</a></main><footer><div class="wrap">© ${new Date().getUTCFullYear()} Suaraloka · Portal Informasi & Berita</div></footer></body></html>`;}
export default {async fetch(req,env){try{
 const url=new URL(req.url),p=url.pathname,method=req.method;
 if(p==='/api/login'&&method==='POST'){
  if(!env.ADMIN_PASSWORD||!env.SESSION_SECRET)return bad('Secret admin belum dikonfigurasi',503);
  if(req.headers.get('content-type')?.split(';')[0]!=='application/json')return bad('Format tidak didukung',415);
  const input=await req.json().catch(()=>({}));if(typeof input.password!=='string'||input.password.length>256)return bad('Password salah',401);
  const a=enc.encode(input.password),b=enc.encode(env.ADMIN_PASSWORD);let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a[i]||0)^(b[i]||0);if(diff!==0)return bad('Password salah',401);
  const expiry=String(Date.now()+8*60*60*1000),sig=await sign(env.SESSION_SECRET,expiry);
  return json({ok:true},200,{'set-cookie':`sl_session=${expiry}.${sig}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`});
 }
 if(p==='/api/logout'&&method==='POST')return json({ok:true},200,{'set-cookie':'sl_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});
 if(p==='/api/me')return json({authenticated:await authorized(req,env)});
 if(p.startsWith('/media/')&&method==='GET'){
  const key=p.slice(7);if(!/^[a-f0-9-]{36}\.(webp|png|jpg|jpeg|gif)$/.test(key))return bad('Tidak ditemukan',404);
  const obj=await env.MEDIA.get(key);if(!obj)return bad('Tidak ditemukan',404);
  return new Response(obj.body,{headers:{'content-type':obj.httpMetadata?.contentType||'image/jpeg','cache-control':'public, max-age=86400','x-content-type-options':'nosniff'}});
 }
 if(p==='/api/articles'&&method==='GET'){
  const admin=await authorized(req,env),showAll=url.searchParams.get('all')==='1'&&admin;
  const category=url.searchParams.get('category')||'',q=(url.searchParams.get('q')||'').slice(0,100);
  const where=[...(showAll?[]:["status='published'"]),...(category?['category=?']:[]),...(q?['(title LIKE ? OR excerpt LIKE ?)']:[])];
  const args=[...(category?[category]:[]),...(q?[`%${q}%`,`%${q}%`]:[])];
  const sql=`SELECT id,title,slug,excerpt,category,image,author,status,created_at,published_at FROM articles ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY COALESCE(published_at,created_at) DESC LIMIT 100`;
  const data=await env.DB.prepare(sql).bind(...args).all();return json({articles:data.results});
 }
 if(p==='/api/articles'&&method==='POST'||/^\/api\/articles\/\d+$/.test(p)&&['PUT','DELETE'].includes(method)||p==='/api/upload'&&method==='POST'){
  if(!await authorized(req,env))return bad('Login admin diperlukan',401);
  if(req.headers.get('origin')!==url.origin)return bad('Origin tidak valid',403);
  if(p==='/api/upload'){
   const file=(await req.formData()).get('image');if(!(file instanceof File))return bad('Pilih gambar',400);
   if(file.size>5*1024*1024||file.size===0)return bad('Ukuran gambar maksimal 5 MB',400);
   const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};const ext=types[file.type];if(!ext)return bad('Format gambar harus JPG, PNG, WebP, atau GIF',400);
   const bytes=new Uint8Array(await file.arrayBuffer());const isJpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;const isPng=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;const isGif=String.fromCharCode(...bytes.slice(0,3))==='GIF';const isWebp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';if(!({jpg:isJpg,png:isPng,gif:isGif,webp:isWebp})[ext])return bad('Isi gambar tidak valid',400);
   const key=crypto.randomUUID()+'.'+ext;await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:file.type}});return json({url:'/media/'+key});
  }
  const id=Number(p.split('/').pop());if(method==='DELETE'){const result=await env.DB.prepare('DELETE FROM articles WHERE id=?').bind(id).run();return json({ok:result.meta.changes>0});}
  const a=await req.json().catch(()=>({}));if(!a.title||!a.body||typeof a.title!=='string'||typeof a.body!=='string')return bad('Judul dan isi berita wajib diisi');
  if(a.title.length>180||a.body.length>100000)return bad('Teks terlalu panjang');
  const slug=slugify(a.slug||a.title);if(!slug)return bad('Slug tidak valid');
  const status=a.status==='published'?'published':'draft';const category=String(a.category||'Umum').slice(0,40);const excerpt=String(a.excerpt||'').slice(0,350);const image=String(a.image||'');if(image&&!/^\/media\/[a-f0-9-]{36}\.(jpg|jpeg|png|webp|gif)$/.test(image))return bad('URL gambar tidak valid');
  const author=String(a.author||'Redaksi Suaraloka').slice(0,80);
  try{
   if(method==='POST'){const r=await env.DB.prepare("INSERT INTO articles(title,slug,excerpt,body,category,image,author,status,published_at) VALUES(?,?,?,?,?,?,?,?,CASE WHEN ?='published' THEN datetime('now') ELSE NULL END)").bind(a.title,slug,excerpt,a.body,category,image,author,status,status).run();return json({ok:true,id:r.meta.last_row_id});}
   const old=await env.DB.prepare('SELECT published_at FROM articles WHERE id=?').bind(id).first();if(!old)return bad('Berita tidak ditemukan',404);
   await env.DB.prepare("UPDATE articles SET title=?,slug=?,excerpt=?,body=?,category=?,image=?,author=?,status=?,updated_at=datetime('now'),published_at=CASE WHEN ?='published' THEN COALESCE(published_at,datetime('now')) ELSE NULL END WHERE id=?").bind(a.title,slug,excerpt,a.body,category,image,author,status,status,id).run();return json({ok:true,id});
  }catch(e){if(String(e).includes('UNIQUE'))return bad('Slug sudah dipakai',409);throw e;}
 }
 if(/^\/api\/articles\/\d+$/.test(p)&&method==='GET'){
  if(!await authorized(req,env))return bad('Login admin diperlukan',401);
  const article=await env.DB.prepare('SELECT * FROM articles WHERE id=?').bind(Number(p.split('/').pop())).first();return article?json({article}):bad('Tidak ditemukan',404);
 }
 if(p.startsWith('/api/'))return bad('Endpoint tidak ditemukan',404);
 if(p.startsWith('/artikel/')&&method==='GET'){
  const slug=decodeURIComponent(p.slice('/artikel/'.length)).replace(/\/$/,'');const a=await env.DB.prepare("SELECT * FROM articles WHERE slug=? AND status='published'").bind(slug).first();if(!a)return new Response('Berita tidak ditemukan',{status:404});return new Response(articleHTML(a),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=60'}});
 }
 if(p.startsWith('/kategori/')&&method==='GET')return env.ASSETS.fetch(new Request(new URL('/berita/',url),req));
 return env.ASSETS.fetch(req);
 }catch(e){console.error(e);return bad('Terjadi kesalahan server',500);}}};
