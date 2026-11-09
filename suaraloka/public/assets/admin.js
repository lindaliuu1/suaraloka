const $=s=>document.querySelector(s);let editId=null;const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path,options={}){const r=await fetch(path,{credentials:'same-origin',...options});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Permintaan gagal');return j}
function view(logged){$('#login').classList.toggle('hidden',logged);$('#dashboard').classList.toggle('hidden',!logged);$('#logout').classList.toggle('hidden',!logged);if(logged)refresh()}
$('#login-form').onsubmit=async e=>{e.preventDefault();$('#login-error').textContent='';try{await api('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:$('#password').value})});$('#password').value='';view(true)}catch(err){$('#login-error').textContent=err.message}};
$('#logout').onclick=async()=>{await api('/api/logout',{method:'POST'});view(false)};
async function refresh(){try{const {articles}=await api('/api/articles?all=1');$('#rows').innerHTML=articles.length?articles.map(a=>`<tr><td><strong>${esc(a.title)}</strong><br><small class="muted">/${esc(a.slug)}</small></td><td>${esc(a.category)}</td><td><span class="status ${a.status==='published'?'live':''}">${a.status==='published'?'Terbit':'Draft'}</span></td><td>${esc((a.published_at||a.created_at).slice(0,10))}</td><td><button data-edit="${a.id}">Edit</button><button data-delete="${a.id}">Hapus</button>${a.status==='published'?`<a href="/artikel/${encodeURIComponent(a.slug)}" target="_blank" rel="noopener">Lihat</a>`:''}</td></tr>`).join(''):'<tr><td colspan="5">Belum ada berita. Buat berita pertama melalui formulir di atas.</td></tr>'}catch(e){$('#rows').innerHTML='<tr><td colspan="5">'+esc(e.message)+'</td></tr>'}}
$('#rows').onclick=async e=>{const btn=e.target.closest('button');if(!btn)return;const id=btn.dataset.edit||btn.dataset.delete;if(btn.dataset.delete){if(!confirm('Hapus berita ini secara permanen?'))return;try{await api('/api/articles/'+id,{method:'DELETE',headers:{'content-type':'application/json'}});await refresh()}catch(err){alert(err.message)}return}try{const {article:a}=await api('/api/articles/'+id);editId=a.id;for(const key of ['title','slug','excerpt','body','category','author','image'])$('#'+key).value=a[key]||'';$('#image-preview').textContent=a.image?'Gambar tersimpan: '+a.image:'';$('#editor-title').textContent='Edit Berita #'+id;$('#editor').scrollIntoView({behavior:'smooth'})}catch(err){alert(err.message)}};
function reset(){editId=null;$('#article-form').reset();$('#image').value='';$('#image-preview').textContent='';$('#editor-title').textContent='Buat Berita Baru';$('#message').textContent=''}$('#reset').onclick=reset;
$('#image-file').onchange=async()=>{const file=$('#image-file').files[0];if(!file)return;$('#image-preview').textContent='Mengunggah...';try{const data=new FormData();data.append('image',file);const r=await api('/api/upload',{method:'POST',body:data});$('#image').value=r.url;$('#image-preview').textContent='Gambar berhasil diunggah: '+r.url}catch(e){$('#image').value='';$('#image-preview').textContent=e.message}};
$('#article-form').onsubmit=async e=>{e.preventDefault();const status=e.submitter?.dataset.status||'draft';const data={status};for(const key of ['title','slug','excerpt','body','category','author','image'])data[key]=$('#'+key).value;$('#message').textContent='Menyimpan...';try{const result=await api(editId?'/api/articles/'+editId:'/api/articles',{method:editId?'PUT':'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});$('#message').textContent=status==='published'?'Berita berhasil diterbitkan.':'Draft berhasil disimpan.';await refresh();editId=result.id;$('#editor-title').textContent='Edit Berita #'+editId}catch(err){$('#message').textContent='Gagal: '+err.message}};
api('/api/me').then(x=>view(x.authenticated)).catch(()=>view(false));

// Simple editing shortcuts; saved content remains Markdown text.
function insertFormat(kind) {
 const field=$('#body');const start=field.selectionStart,end=field.selectionEnd;
 const selected=field.value.slice(start,end);let before='',after='',fallback='teks';
 if(kind==='bold'){before='**';after='**';}
 if(kind==='italic'){before='*';after='*';}
 if(kind==='heading'){before='\n## ';fallback='Subjudul';}
 if(kind==='list'){before='\n- ';fallback='Poin daftar';}
 if(kind==='link'){before='[';after='](https://example.com)';fallback='teks tautan';}
 const content=selected||fallback;
 field.setRangeText(before+content+after,start,end,'select');field.focus();
 field.setSelectionRange(start+before.length,start+before.length+content.length);
 $('#article-preview').classList.add('hidden');
}
document.querySelectorAll('[data-format]').forEach(button=>button.addEventListener('click',()=>insertFormat(button.dataset.format)));
$('#preview-toggle').addEventListener('click',()=>{ const p=$('#article-preview');p.classList.toggle('hidden');p.textContent=$('#body').value;$('#preview-toggle').textContent=p.classList.contains('hidden')?'Pratinjau teks':'Tutup pratinjau'; });
