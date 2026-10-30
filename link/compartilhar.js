/* IALINK · Compartilhar link — v1 · por @pessoaco
   Usado por TODOS os painéis (Copiloto de Vendas, Prospects, Financeiro, Rota, Prazo).
   Gera um link que abre SEM login, com a "foto" da tela naquele momento:
   - só o que está visível (o que está escondido, outras representadas/períodos, nem sai do aparelho)
   - sem o código da página (quem abre não consegue trocar filtro, período, representada ou vendedor)
   - sem comissão, a não ser que quem tem o Financeiro completo escolha "com comissão"
   - o link vale 30 dias e depois é apagado sozinho (fluxo n8n Compartilhar_Link_Paineis)
   Na página: <script src="https://pessoaco.github.io/Kpis/link/compartilhar.js?v=1"></script>
   e um botão: onclick="IALinkCompartilhar({ painel:'financeiro', titulo:()=>'...', perguntarComissao:true })"
*/
(function(){
  const WEBHOOK = "https://auto.ialink.com.br/webhook/compartilhar-link";
  const VIEWER = "https://pessoaco.github.io/Kpis/link/?t=";

  function css(){
    if(document.getElementById('ial-share-css')) return;
    const s = document.createElement('style'); s.id = 'ial-share-css';
    s.textContent = `
      .ial-fundo{position:fixed;inset:0;background:rgba(20,20,30,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px}
      .ial-caixa{background:#fff;color:#1d1d1f;border-radius:12px;max-width:440px;width:100%;padding:18px 18px 14px;font:14px/1.45 Arial,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.25)}
      .ial-caixa h3{margin:0 0 8px;font-size:16px}
      .ial-caixa p{margin:6px 0}
      .ial-caixa .ial-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;justify-content:flex-end}
      .ial-caixa button{border:1px solid #c9c9d1;background:#f4f4f7;border-radius:8px;padding:7px 12px;font:600 13px Arial,sans-serif;cursor:pointer;color:#1d1d1f}
      .ial-caixa button.ial-pri{background:#2b4a8b;border-color:#2b4a8b;color:#fff}
      .ial-caixa input{width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #c9c9d1;border-radius:8px;font:13px Arial,sans-serif;margin:4px 0}
      .ial-caixa .ial-link{font:12px monospace;word-break:break-all;background:#f4f4f7;border-radius:8px;padding:8px}
      .ial-caixa .ial-peq{font-size:11.5px;color:#666}
      .ial-caixa .ial-erro{color:#b3261e;font-weight:600}
      @media print{.ial-fundo{display:none!important}}`;
    document.head.appendChild(s);
  }
  function caixa(html){
    css();
    fechar();
    const f = document.createElement('div'); f.className = 'ial-fundo'; f.id = 'ial-share';
    f.innerHTML = '<div class="ial-caixa">' + html + '</div>';
    f.addEventListener('click', e => { if(e.target === f) fechar(); });
    document.body.appendChild(f);
    return f;
  }
  function fechar(){ const f = document.getElementById('ial-share'); if(f) f.remove(); }
  function esc(s){ return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function lerCreds(){ try { return JSON.parse(localStorage.getItem('pv_auth') || 'null'); } catch(e){ return null; } }

  // ---------- a "foto" da tela ----------
  function tirarComissao(raiz){
    raiz.querySelectorAll('.fin-card.comissao,.nota-preco,.btn-imprimir-lista').forEach(e => e.remove());
    raiz.querySelectorAll('table').forEach(tb => {
      const cab = tb.querySelector('thead tr') || tb.querySelector('tr');
      if(!cab) return;
      const idx = [];
      Array.from(cab.children).forEach((c,i) => { if(/comiss/i.test(c.textContent)) idx.push(i); });
      if(!idx.length) return;
      tb.querySelectorAll('tr').forEach(tr => { idx.slice().reverse().forEach(i => { if(tr.children[i]) tr.children[i].remove(); }); });
    });
  }
  function foto(comComissao){
    const orig = document.body.querySelectorAll('*');
    const marcar = [];
    orig.forEach((el, i) => {
      if(el.closest('#ial-share')) { marcar.push(i); return; }
      const cs = getComputedStyle(el);
      if(cs.display === 'none' || cs.visibility === 'hidden') marcar.push(i);
    });
    const html = document.documentElement.cloneNode(true);
    const body = html.querySelector('body');
    const copia = body.querySelectorAll('*');
    // valores digitados nos campos (o clone so leva o atributo original)
    orig.forEach((el, i) => {
      const c = copia[i]; if(!c) return;
      if(el.tagName === 'INPUT'){ if(el.type === 'checkbox' || el.type === 'radio'){ if(el.checked) c.setAttribute('checked',''); else c.removeAttribute('checked'); } else c.setAttribute('value', el.value); }
      if(el.tagName === 'TEXTAREA') c.textContent = el.value;
      if(el.tagName === 'SELECT') Array.from(el.options).forEach((o,j) => { if(c.options && c.options[j]){ if(o.selected) c.options[j].setAttribute('selected',''); else c.options[j].removeAttribute('selected'); } });
    });
    marcar.forEach(i => { if(copia[i]) copia[i].setAttribute('data-ial-fora','1'); });
    html.querySelectorAll('[data-ial-fora]').forEach(e => e.remove());
    // nada de codigo, botoes de acao, login, "sair", voltar
    html.querySelectorAll('script,noscript,iframe,object,embed,template,.no-print,.so-tela,.nav-voltar,[data-nao-compartilhar],#login,#tela-carregando,#btn-sair,#btn-logout,#btn-refresh,#btn-imprimir,#btn-compartilhar').forEach(e => e.remove());
    // anotacoes internas da pagina (comentarios) nao vao junto
    const tw = document.createTreeWalker(html, NodeFilter.SHOW_COMMENT); const coments = [];
    while(tw.nextNode()) coments.push(tw.currentNode);
    coments.forEach(c => c.remove());
    // o link e uma foto, nao o painel ao vivo
    const hojeTxt = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' });
    const tt = document.createTreeWalker(html.querySelector('body') || html, NodeFilter.SHOW_TEXT);
    while(tt.nextNode()) if(/ao vivo/i.test(tt.currentNode.nodeValue)) tt.currentNode.nodeValue = tt.currentNode.nodeValue.replace(/ao vivo/ig, 'foto de ' + hojeTxt);
    html.querySelectorAll('*').forEach(e => {
      Array.from(e.attributes).forEach(a => { if(/^on/i.test(a.name)) e.removeAttribute(a.name); });
      e.removeAttribute('contenteditable');
      if(e.tagName === 'A'){ const h = e.getAttribute('href') || ''; if(/^\s*javascript:/i.test(h) || h.startsWith('#')) e.removeAttribute('href'); else e.setAttribute('target','_blank'); }
    });
    if(!comComissao){
      tirarComissao(html);
      const texto = (html.querySelector('body') || html).textContent.replace(/sem valores de comiss[ãa]o/ig, '');
      if(/comiss/i.test(texto)) throw new Error('A tela ainda mostra comissão; o link não foi criado. Fale com o suporte.');
    }
    const head = html.querySelector('head');
    const base = document.createElement('base'); base.setAttribute('href', location.href.split('#')[0]);
    head.insertBefore(base, head.firstChild);
    return '<!doctype html>' + html.outerHTML;
  }
  async function compacta(txt){
    const cs = new CompressionStream('gzip');
    const buf = new Uint8Array(await new Response(new Blob([txt]).stream().pipeThrough(cs)).arrayBuffer());
    let s = ''; for(let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  }

  // ---------- telas ----------
  function pedirLogin(op, msg){
    const f = caixa(`<h3>🔗 Compartilhar link</h3>
      <p>Para criar o link, entre com o seu login do painel.</p>
      ${msg ? '<p class="ial-erro">' + esc(msg) + '</p>' : ''}
      <input id="ial-u" placeholder="usuário" autocapitalize="none" autocomplete="username">
      <input id="ial-p" type="password" placeholder="senha" autocomplete="current-password">
      <div class="ial-btns"><button id="ial-x">Cancelar</button><button class="ial-pri" id="ial-ok">Entrar</button></div>`);
    f.querySelector('#ial-x').onclick = fechar;
    f.querySelector('#ial-ok').onclick = () => {
      const c = { user: f.querySelector('#ial-u').value.trim(), pass: f.querySelector('#ial-p').value };
      if(!c.user || !c.pass) return;
      try { localStorage.setItem('pv_auth', JSON.stringify(c)); } catch(e){}
      fechar(); iniciar(op, c);
    };
  }
  function perguntaComissao(op, creds){
    const f = caixa(`<h3>🔗 Compartilhar link</h3>
      <p>O link vai <b>com ou sem os valores de comissão</b>?</p>
      <p class="ial-peq">Com comissão: para a diretoria conferir o pagamento à representada. Sem comissão: para conferência das entregas.</p>
      <div class="ial-btns"><button id="ial-x">Cancelar</button><button id="ial-sem">Sem comissão</button><button class="ial-pri" id="ial-com">Com comissão</button></div>`);
    f.querySelector('#ial-x').onclick = fechar;
    f.querySelector('#ial-sem').onclick = () => { fechar(); criar(op, creds, false); };
    f.querySelector('#ial-com').onclick = () => { fechar(); criar(op, creds, true); };
  }
  async function criar(op, creds, comComissao){
    let titulo = document.title;
    try { if(typeof op.titulo === 'function') titulo = op.titulo() || titulo; else if(op.titulo) titulo = op.titulo; } catch(e){}
    let conteudo;
    try { conteudo = await compacta(foto(comComissao)); }
    catch(e){ caixa(`<h3>🔗 Compartilhar link</h3><p class="ial-erro">${esc(e.message || e)}</p><div class="ial-btns"><button id="ial-x">Fechar</button></div>`).querySelector('#ial-x').onclick = fechar; return; }
    const f = caixa('<h3>🔗 Compartilhar link</h3><p>⏳ Criando o link…</p>');
    const corpo = new URLSearchParams({ acao: 'criar', user: creds.user, pass: creds.pass, painel: op.painel, titulo,com_comissao: comComissao ? 'sim' : 'nao', conteudo });
    let r;
    try {
      const resp = await fetch(WEBHOOK, { method: 'POST', body: corpo });
      r = await resp.json();
    } catch(e){ r = { ok: false, erro: 'Sem resposta do servidor. Verifique a internet e tente de novo.' }; }
    if(!r || !r.ok){
      if(r && /senha/i.test(r.erro || '')){ try { localStorage.removeItem('pv_auth'); } catch(e){} pedirLogin(op, r.erro); return; }
      caixa(`<h3>🔗 Compartilhar link</h3><p class="ial-erro">${esc((r && r.erro) || 'Não deu para criar o link.')}</p><div class="ial-btns"><button id="ial-x">Fechar</button></div>`).querySelector('#ial-x').onclick = fechar;
      return;
    }
    const link = VIEWER + encodeURIComponent(r.token);
    const ate = new Date(r.expira_em).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' });
    const g = caixa(`<h3>🔗 Link pronto</h3>
      <div class="ial-link" id="ial-l">${esc(link)}</div>
      <p class="ial-peq">Abre sem login, com a tela como está agora${comComissao ? ' (<b>com comissão</b>)' : ' (sem comissão)'}. Quem abrir não consegue trocar período, representada ou vendedor. Vale até <b>${ate}</b>.</p>
      <div class="ial-btns"><button id="ial-x">Fechar</button><button id="ial-abrir">Abrir</button>${navigator.share ? '<button id="ial-env">Enviar…</button>' : ''}<button class="ial-pri" id="ial-cp">Copiar link</button></div>`);
    g.querySelector('#ial-x').onclick = fechar;
    g.querySelector('#ial-abrir').onclick = () => window.open(link, '_blank', 'noopener');
    g.querySelector('#ial-cp').onclick = async e => {
      try { await navigator.clipboard.writeText(link); e.target.textContent = '✓ Copiado'; }
      catch(_){ const rg = document.createRange(); rg.selectNodeContents(g.querySelector('#ial-l')); const s = getSelection(); s.removeAllRanges(); s.addRange(rg); e.target.textContent = 'Ctrl+C para copiar'; }
    };
    const env = g.querySelector('#ial-env');
    if(env) env.onclick = () => navigator.share({ title: titulo, url: link }).catch(() => {});
  }
  function iniciar(op, creds){
    if(!creds || !creds.user || !creds.pass){ pedirLogin(op); return; }
    let pergunta = false;
    try { pergunta = typeof op.perguntarComissao === 'function' ? op.perguntarComissao() : !!op.perguntarComissao; } catch(e){}
    if(pergunta) perguntaComissao(op, creds); else criar(op, creds, false);
  }
  window.IALinkCompartilhar = function(op){
    op = op || {};
    if(!op.painel){ alert('Painel não informado.'); return; }
    if(!window.CompressionStream){ alert('Este navegador é antigo demais para compartilhar link. Use o Chrome atualizado.'); return; }
    iniciar(op, lerCreds());
  };
  window.IALinkCompartilhar.versao = 'v1';
  window.IALinkCompartilhar._fotoTeste = c => compacta(foto(!!c));   // so para teste: nao envia nada

})();
