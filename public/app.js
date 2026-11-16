const PUBLIC_MODE = document.querySelector('meta[name="atlas-mode"]')?.content === 'public';
if (PUBLIC_MODE) document.documentElement.classList.add('public-mode');
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = prefix => prefix+'-'+crypto.randomUUID().slice(0,8);
let state, filter='all', selected=null, tab='read', editing=null, dirty=false, positions={}, camera={panX:0,panY:0,yaw:.2,pitch:-.15,zoom:1}, layoutDirty=false, busy=false;
let hitNodes=[], hitEdges=[], hovered=null, toastTimer, expanded=false;
const canvas=$('#graph'), ctx=canvas.getContext('2d');
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4500);}
async function api(url, options){if(PUBLIC_MODE){if(url!=='/api/state')throw Error('公开页面仅供浏览');url='./state.json';}const r=await fetch(url,options);const data=await r.json();if(!r.ok)throw Error(data.error||'读取失败');return data;}
function nodes(){if(!state)return [];const m=new Map(state.confirmed.map(n=>[n.id,{...n,status:'confirmed'}]));for(const n of state.draft)m.set(n.id,{...n,status:'draft',hasConfirmed:m.has(n.id)});return [...m.values()];}
function getNode(id){const n=filter==='confirmed'?state?.confirmed.find(n=>n.id===id):null;return n?{...n,status:'confirmed'}:nodes().find(n=>n.id===id);}
function visible(){const q=$('#search').value.trim().toLowerCase();return (filter==='confirmed'?state.confirmed.map(n=>({...n,status:'confirmed'})):nodes()).filter(n=>(filter==='all'||filter==='confirmed'||n.status==='draft')&&(!q||[n.title,...n.blocks.map(b=>b.content)].join(' ').toLowerCase().includes(q)));}
function graphNodes(){let a=visible();if($('#neighbors').checked&&selected){const ids=new Set([selected]);for(const e of state.graph.edges)if(e.source===selected||e.target===selected){ids.add(e.source);ids.add(e.target);}a=a.filter(n=>ids.has(n.id));}return a;}
let hierarchy=new Map();
function buildHierarchy(){
  const info=new Map(nodes().map(n=>[n.id,{parents:[],children:[],level:null}]));
  for(const e of state.graph.edges){
    if(e.type!=='parent-child'||!info.has(e.source)||!info.has(e.target))continue;
    if(!info.get(e.source).children.includes(e.target))info.get(e.source).children.push(e.target);
    if(!info.get(e.target).parents.includes(e.source))info.get(e.target).parents.push(e.source);
  }
  const queue=[];
  for(const [id,item] of info)if(item.children.length&&!item.parents.length){item.level=1;queue.push(id);}
  for(let i=0;i<queue.length;i++){
    const parent=info.get(queue[i]);
    for(const id of parent.children){const child=info.get(id);if(child.level===null){child.level=parent.level+1;queue.push(id);}}
  }
  return info;
}
function hierarchyPositions(){
  const result={}, roots=[...hierarchy].filter(([,v])=>v.level===1), placed=new Set();
  let right=0;
  for(const [root] of roots){
    if(placed.has(root))continue;
    const local={[root]:[0,0,0]},levels=new Map(),queue=[{id:root,depth:0}],seen=new Set([root]);
    for(let i=0;i<queue.length;i++)for(const id of hierarchy.get(queue[i].id).children){
      if(seen.has(id)||placed.has(id))continue;seen.add(id);
      const depth=queue[i].depth+1;queue.push({id,depth});
      if(!levels.has(depth))levels.set(depth,[]);levels.get(depth).push(id);
    }
    for(const [depth,ids] of levels){
      const radius=Math.max(280*depth,ids.length*55);
      ids.forEach((id,i)=>{
        const y=1-2*(i+.5)/ids.length,angle=i*Math.PI*(3-Math.sqrt(5)),ring=Math.sqrt(1-y*y);
        local[id]=[Math.cos(angle)*ring*radius,y*radius,Math.sin(angle)*ring*radius];
      });
    }
    const xs=Object.values(local).map(p=>p[0]);
    const left=Math.min(...xs),width=Math.max(...xs)-left;
    // Reserve the entire tree's extent before placing the next root.
    for(const [id,p] of Object.entries(local)){result[id]=[p[0]-left+right,p[1],p[2]];placed.add(id);}
    right+=width+420;
  }
  const remaining=nodes().filter(n=>!placed.has(n.id));
  if(remaining.length){
    const bottom=Object.keys(result).length?Math.max(...Object.values(result).map(p=>p[1]))+280:0;
    const columns=Math.min(4,remaining.length),center=Object.keys(result).length?(right-420)/2:0;
    remaining.forEach((n,i)=>{result[n.id]=[center+(i%columns-(columns-1)/2)*320,bottom+Math.floor(i/columns)*160,Math.sin(i*2.4)*120];});
  }
  const points=Object.values(result);
  if(points.length){
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const factor=Math.min(1,900/Math.max(1,maxX-minX),580/Math.max(1,maxY-minY));
    for(const p of points){p[0]=(p[0]-(minX+maxX)/2)*factor;p[1]=(p[1]-(minY+maxY)/2)*factor;p[2]*=factor;}
  }
  return result;
}
function assignPositions(){hierarchy=buildHierarchy();const defaults=hierarchyPositions();if(!layoutDirty&&nodes().some(n=>!positions[n.id]))positions=defaults;else for(const n of nodes())if(!positions[n.id])positions[n.id]=defaults[n.id];}
function adopt(data,keepLayout=true){state=data;if(!keepLayout||!layoutDirty){positions=structuredClone(state.graph.positions);camera={panX:0,panY:0,yaw:.2,pitch:-.15,zoom:1,...state.graph.camera};}assignPositions();renderList();if(selected&&!getNode(selected)){selected=null;$('#detail').hidden=true;}if(selected&&tab!=='edit')renderDetail();}
async function load(force=false){try{const data=await api('/api/state');if(!state||data.revision!==state.revision){if(!force&&(dirty||layoutDirty||$('#modal').open)){ $('#sync').textContent='检测到外部修改 · 本地编辑已保留';return;}adopt(data,!force);$('#sync').textContent=PUBLIC_MODE?'公开知识库':'已同步本地工作区';} }catch(e){$('#sync').textContent='数据读取失败';toast(e.message);}}
async function action(body){if(PUBLIC_MODE)return false;if(busy)return false;busy=true;try{const data=await api('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,revision:state.revision})});adopt(data);$('#sync').textContent='已保存到工作区';return true;}catch(e){toast(e.message);return false;}finally{busy=false;}}
let sidebarView='tree';
try { sidebarView=localStorage.getItem('atlas-sidebar-view')||'tree'; } catch {}
const expandedNodes=new Set();
try {
  const saved=JSON.parse(localStorage.getItem('atlas-expanded-nodes')||'[]');
  if(Array.isArray(saved))for(const id of saved)if(typeof id==='string')expandedNodes.add(id);
} catch {}
function renderList(){
  const all=nodes(),items=visible();
  $('#allCount').textContent=all.length;$('#draftCount').textContent=state.draft.length;$('#confirmedCount').textContent=state.confirmed.length;$('#listCount').textContent=items.length;
  $('#scopeTitle').textContent={all:'全部节点',draft:'未整理区',confirmed:'正式记录'}[filter];
  const button=n=>'<button class="node-item '+(n.id===selected?'active ':'')+(n.status==='confirmed'?'formal':'')+'" data-node="'+esc(n.id)+'"><span class="dot" role="img" aria-label="'+(n.status==='confirmed'?'已确认':'未整理')+'"></span><strong>'+esc(n.title)+'</strong></button>';
  let html='';
  if(sidebarView==='list')html=items.map(button).join('');
  else {
    const eligible=filter==='confirmed'?state.confirmed:all.filter(n=>filter!=='draft'||n.status==='draft');
    const eligibleIds=new Set(eligible.map(n=>n.id));
    const shown=new Map(items.map(n=>[n.id,n]));
    const edges=state.graph.edges.filter(e=>e.type==='parent-child'&&eligibleIds.has(e.source)&&eligibleIds.has(e.target));
    // Keep matching nodes in their chapter context during search.
    let changed=true;
    while(changed){changed=false;for(const e of edges)if(shown.has(e.target)&&!shown.has(e.source)){shown.set(e.source,getNode(e.source));changed=true;}}
    const parent=new Map(),children=new Map();
    for(const e of edges)if(shown.has(e.source)&&shown.has(e.target)&&!parent.has(e.target)&&e.source!==e.target){parent.set(e.target,e.source);if(!children.has(e.source))children.set(e.source,[]);children.get(e.source).push(e.target);}
    const visited=new Set(),searching=!!$('#search').value.trim();
    const branch=id=>{
      if(visited.has(id))return '';visited.add(id);
      const n=shown.get(id),kids=(children.get(id)||[]).filter(k=>!visited.has(k));
      const open=searching||expandedNodes.has(id);
      const toggle=kids.length?'<button class="tree-toggle" data-toggle="'+esc(id)+'" aria-label="'+(open?'收起':'展开')+esc(n.title)+'" aria-expanded="'+open+'">'+(open?'▾':'▸')+'</button>':'<span class="tree-spacer"></span>';
      // Walk collapsed branches too, so they are not rendered again as roots.
      const nested=kids.map(branch).join('');
      return '<li><div class="tree-row">'+toggle+button(n)+'</div>'+(nested?'<ul'+(open?'':' hidden')+'>'+nested+'</ul>':'')+'</li>';
    };
    const roots=[...shown.keys()].filter(id=>!parent.has(id));
    html='<ul class="node-tree">'+roots.map(branch).join('')+[...shown.keys()].filter(id=>!visited.has(id)).map(branch).join('')+'</ul>';
  }
  $('#nodeList').innerHTML=items.length?html:'<p class="empty-list">还没有符合条件的节点。</p>';
  $('#graphStats').textContent=all.length+' 个节点 / '+state.graph.edges.length+' 条关联';
  $('#nodeList').querySelectorAll('[data-node]').forEach(b=>b.onclick=()=>selectNode(b.dataset.node));
  $('#nodeList').querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>{const id=b.dataset.toggle;expandedNodes.has(id)?expandedNodes.delete(id):expandedNodes.add(id);try{localStorage.setItem('atlas-expanded-nodes',JSON.stringify([...expandedNodes]));}catch{}renderList();});
  document.querySelectorAll('[data-view]').forEach(b=>{b.setAttribute('aria-pressed',b.dataset.view===sidebarView);b.onclick=()=>{sidebarView=b.dataset.view;try{localStorage.setItem('atlas-sidebar-view',sidebarView);}catch{}renderList();};});
}
function guard(){return !dirty||confirm('当前编辑尚未保存，要放弃这些修改吗？');}
function selectNode(id){if(!guard())return;selected=id;tab='read';dirty=false;editing=null;renderList();renderDetail();}
function inline(s){return esc(s).replace(/!\[([^\]]*)\]\((\/assets\/[\w.-]+)\)/g,(_,alt,src)=>'<img alt="'+alt+'" src="'+new URL('./'+src.slice(1),location.href).href+'">').replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1 ↗</a>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');}
function codeBlock(source, language){
  const grammar=Object.hasOwn(Prism.languages,language)?Prism.languages[language]:null;
  const html=grammar?Prism.highlight(source,grammar,language):esc(source);
  return '<pre><code'+(grammar?' class="language-'+esc(language)+'"':'')+'>'+html+'</code></pre>';
}
function markdown(src){let out='',code=false,language='',buf=[],list=false;const closeList=()=>{if(list){out+='</ul>';list=false;}};const lines=src.split('\n');for(let row=0;row<lines.length;row++){const line=lines[row];if(!code&&line.trim().startsWith('|')&&/^\s*\|?\s*:?-{3,}:?\s*\|/.test(lines[row+1]||'')){closeList();const cells=l=>l.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());out+='<div class="table-scroll"><table><thead><tr>'+cells(line).map(c=>'<th>'+inline(c)+'</th>').join('')+'</tr></thead><tbody>';row++;while(row+1<lines.length&&lines[row+1].trim().startsWith('|')){row++;out+='<tr>'+cells(lines[row]).map(c=>'<td>'+inline(c)+'</td>').join('')+'</tr>';}out+='</tbody></table></div>';continue;}if(line.trim().startsWith('\x60\x60\x60')){closeList();if(code){out+=codeBlock(buf.join('\n'),language);buf=[];}if(!code)language=line.trim().slice(3).trim().split(/\s+/)[0].toLowerCase();code=!code;continue;}if(code){buf.push(line);continue;}if(/^\s*[-*] /.test(line)){if(!list){out+='<ul>';list=true;}out+='<li>'+inline(line.replace(/^\s*[-*] /,''))+'</li>';continue;}closeList();const m=line.match(/^(#{1,3}) (.*)$/);if(m)out+=`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`;else if(line.startsWith('> '))out+='<blockquote>'+inline(line.slice(2))+'</blockquote>';else if(/^---+$/.test(line))out+='<hr>';else if(line.trim())out+='<p>'+inline(line)+'</p>';}closeList();if(code)out+=codeBlock(buf.join('\n'),language);return out;}
function renderBlocks(blocks, root){blocks=blocks.map(b=>({...b,content:b.format==='html'?b.content.replaceAll('/assets/',new URL('./assets/',location.href).href):b.content}));root.innerHTML=blocks.map((b,i)=>`<section class="content-block">${b.format==='html'?`<iframe class="demo-frame" title="交互演示 ${i+1}" sandbox="allow-scripts"></iframe>`:`<div class="prose">${markdown(b.content)}</div>`}</section>`).join('');let index=0;for(const b of blocks)if(b.format==='html'){const frame=root.querySelectorAll('iframe')[index++];frame.srcdoc=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: ${new URL('./assets/',location.href).href}; media-src ${new URL('./assets/',location.href).href}; connect-src 'none'; form-action 'none'; base-uri 'none'"><meta charset="utf-8">`+b.content;}}
function renderDetail(){const n=getNode(selected);if(!n)return;const el=$('#detail');el.hidden=false;el.classList.toggle('expanded',expanded);el.innerHTML=`<div class="detail-head"><div class="detail-title"><h2>${esc(n.title)}</h2><div class="icon-actions"><button id="expand" title="放大阅读">⤢</button><button id="closeDetail" title="关闭">×</button></div></div><div class="detail-status"><span class="badge ${n.status==='confirmed'?'confirmed':''}">${n.status==='draft'?'未整理 · 待确认':'已确认'}</span><span class="node-id">${n.id}</span></div><div class="tabs">${(PUBLIC_MODE?[['read','阅读']]:[['read','阅读'],['edit','编辑'],['compare','版本对照'],['history','历史']]).map(([id,label])=>`<button data-tab="${id}" class="${tab===id?'active':''}">${label}</button>`).join('')}</div></div><div class="detail-body" id="detailBody"></div><div class="detail-footer" id="detailFooter"></div>`;
  $('#expand').onclick=()=>{expanded=!expanded;el.classList.toggle('expanded',expanded);};$('#closeDetail').onclick=()=>{if(!guard())return;selected=null;dirty=false;editing=null;el.hidden=true;renderList();};
  el.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(!guard())return;dirty=false;tab=b.dataset.tab;editing=null;renderDetail();});
  const body=$('#detailBody'),foot=$('#detailFooter');
  if(tab==='read'){renderBlocks(n.blocks,body);renderLinks(n,body);if(PUBLIC_MODE){foot.hidden=true;return;}foot.innerHTML=`<button id="editNow">编辑内容</button>${n.status==='draft'?'<button class="primary" id="approve">确认纳入正式区</button>':''}<button class="danger" id="deleteNode">删除</button>`;$('#editNow').onclick=()=>{tab='edit';renderDetail();};if($('#approve'))$('#approve').onclick=()=>approval(n);$('#deleteNode').onclick=()=>{const count=state.graph.edges.filter(e=>e.source===n.id||e.target===n.id).length;showModal(`<h2>删除「${esc(n.title)}」？</h2><p>草稿和正式版本将一并移除，同时删除 ${count} 条关联。历史记录保留。</p><div class="modal-actions"><button data-cancel>取消</button><button id="confirmDelete">删除节点</button></div>`);$('#confirmDelete').onclick=async()=>{if(await action({action:'deleteNode',id:n.id})){closeModal();toast('节点已删除');}};};}
  if(tab==='edit')renderEditor(n);
  if(tab==='links')renderLinks(n);
  if(tab==='compare'){const old=state.confirmed.find(v=>v.id===n.id),draft=state.draft.find(v=>v.id===n.id);body.innerHTML='<p class="muted">对照标题与正文源码。HTML 的交互效果可在阅读页运行。</p><div class="compare"><div><h3>已确认版本</h3><pre>'+esc(old?serialize(old):'尚无正式版本')+'</pre></div><div><h3>当前草稿</h3><pre>'+esc(draft?serialize(draft):'没有待确认修改')+'</pre></div></div>';if(draft){foot.innerHTML='<button class="primary" id="approve">审核并确认</button>';$('#approve').onclick=()=>approval(n);}}
  if(tab==='history')renderHistory(n);
}
const serialize=n=>n.title+'\n\n'+n.blocks.map(b=>`[${b.id} · ${b.format}]\n${b.content}`).join('\n\n');
function renderEditor(n){editing ||= structuredClone(n);const body=$('#detailBody');body.innerHTML=`<label class="field">标题<input id="editTitle" value="${esc(editing.title)}"></label><div id="editBlocks"></div><button id="addMarkdown">＋ Markdown</button> <button id="addHtml">＋ HTML</button><p class="muted">保存后写入未整理区。已有正式版本会继续保留。</p>`;
  function blocks(){const box=$('#editBlocks');box.innerHTML=editing.blocks.map((b,i)=>`<div class="edit-block"><div class="row"><span class="muted">${i+1} · ${b.id}</span><div><select data-format="${i}" aria-label="内容格式"><option value="markdown" ${b.format==='markdown'?'selected':''}>Markdown</option><option value="html" ${b.format==='html'?'selected':''}>HTML</option></select> <button data-remove="${i}" title="移除内容块">×</button></div></div><textarea data-content="${i}" aria-label="内容块 ${i+1}" spellcheck="false">${esc(b.content)}</textarea></div>`).join('');box.querySelectorAll('[data-content]').forEach(t=>t.oninput=()=>{editing.blocks[+t.dataset.content].content=t.value;dirty=true;});box.querySelectorAll('[data-format]').forEach(t=>t.onchange=()=>{editing.blocks[+t.dataset.format].format=t.value;dirty=true;});box.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{editing.blocks.splice(+b.dataset.remove,1);dirty=true;blocks();});}blocks();
  $('#editTitle').oninput=e=>{editing.title=e.target.value;dirty=true;};$('#addMarkdown').onclick=()=>{editing.blocks.push({id:uid('text'),format:'markdown',content:''});dirty=true;blocks();};$('#addHtml').onclick=()=>{editing.blocks.push({id:uid('demo'),format:'html',content:'<!doctype html>\n<html lang="zh-CN"><body>\n<h2>交互演示</h2>\n</body></html>'});dirty=true;blocks();};
  $('#detailFooter').innerHTML='<button class="primary" id="saveDraft">保存草稿</button><button id="previewEdit">预览当前编辑</button><span class="muted">Ctrl / ⌘ + S</span>';
  $('#saveDraft').onclick=async()=>{if(await action({action:'saveNode',node:editing})){dirty=false;editing=null;filter='all';document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'));renderList();tab='read';renderDetail();toast('草稿已保存');}};
  $('#previewEdit').onclick=()=>{showModal('<h2>编辑预览</h2><div id="previewBlocks"></div><div class="modal-actions"><button data-cancel>继续编辑</button></div>');renderBlocks(editing.blocks,$('#previewBlocks'));};
}
function approval(n){showModal(`<h2>确认这份理解</h2><p>将「${esc(n.title)}」的当前草稿保存为正式版本。</p><label class="muted"><input id="reviewed" type="checkbox"> 我已逐字审核文字，并检查其中的演示。</label><div class="modal-actions"><button data-cancel>继续检查</button><button id="approveFinal" class="primary" disabled>确认纳入正式区</button></div>`);$('#reviewed').onchange=e=>$('#approveFinal').disabled=!e.target.checked;$('#approveFinal').onclick=async()=>{if(await action({action:'approveNode',id:n.id})){closeModal();toast('已保存为正式记录');}};}
function renderLinks(n, body){
  const edges=state.graph.edges.filter(e=>e.source===n.id||e.target===n.id);
  const section=document.createElement('section');
  section.className='reading-links';
  section.setAttribute('aria-label','关联节点');
  section.innerHTML='<div class="reading-links-head"><h3>关联节点 <span class="muted">'+edges.length+'</span></h3><button id="newEdge">＋ 建立关联</button></div>'+
    (edges.length?'<ul class="reading-links-list">'+edges.map(e=>{
      const outgoing=e.source===n.id;
      const other=getNode(outgoing?e.target:e.source);
      return '<li class="reading-link"><div class="reading-link-main"><button class="reading-link-title" data-go="'+esc(other?.id)+'">'+esc(other?.title)+' ↗</button><p class="muted">'+(e.type==='parent-child'?(outgoing?'子章节':'上级章节'):(outgoing?'本节点 → 对方':'对方 → 本节点'))+(e.label?' · '+esc(e.label):'')+'</p></div><div class="reading-link-actions"><span class="badge '+(e.status==='confirmed'?'confirmed':'')+'">'+(e.status==='confirmed'?'已确认':'未确认')+'</span><button data-edge="'+esc(e.id)+'" aria-label="编辑与'+esc(other?.title)+'的关系">编辑</button></div></li>';
    }).join('')+'</ul>':'<p class="muted">暂无关联节点</p>');
  body.append(section);
  section.querySelectorAll('[data-edge]').forEach(b=>b.onclick=()=>edgeDialog(state.graph.edges.find(e=>e.id===b.dataset.edge)));
  section.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>selectNode(b.dataset.go));
  section.querySelector('#newEdge').onclick=()=>edgeDialog();
}
function edgeDialog(edge){if(PUBLIC_MODE)return;const options=value=>nodes().map(n=>`<option value="${n.id}" ${n.id===value?'selected':''}>${esc(n.title)}</option>`).join('');showModal(`<h2>${edge?'编辑联系':'建立联系'}</h2><label class="field">起点<select id="edgeSource">${options(edge?.source||selected)}</select></label><label class="field">终点<select id="edgeTarget">${options(edge?.target||nodes().find(n=>n.id!==selected)?.id)}</select></label><label class="field">关系类型<select id="edgeType"><option value="related" ${edge?.type!=='parent-child'?'selected':''}>普通关联</option><option value="parent-child" ${edge?.type==='parent-child'?'selected':''}>上级 → 子章节</option></select></label><label class="field">关系说明（章节关系可留空）<textarea id="edgeLabel" style="min-height:90px" placeholder="这两个节点如何关联？">${esc(edge?.label||'')}</textarea></label><label class="muted"><input id="edgeApproved" type="checkbox" ${edge?.status==='confirmed'?'checked':''}> 我确认这条关系代表我的理解</label><div class="modal-actions">${edge?'<button id="removeEdge">删除</button>':''}<button data-cancel>取消</button><button class="primary" id="saveEdge">保存关系</button></div>`);$('#saveEdge').onclick=async()=>{const e={id:edge?.id||uid('edge'),source:$('#edgeSource').value,target:$('#edgeTarget').value,type:$('#edgeType').value,label:$('#edgeLabel').value,status:$('#edgeApproved').checked?'confirmed':'draft'};if(await action({action:'saveEdge',edge:e})){closeModal();toast('关系已保存');}};if(edge)$('#removeEdge').onclick=async()=>{if(await action({action:'deleteEdge',id:edge.id})){closeModal();toast('关系已删除');}};}
async function renderHistory(n){const body=$('#detailBody');body.innerHTML='<p class="muted">读取历史…</p>';try{const files=await api('/api/history');if(selected!==n.id||tab!=='history')return;body.innerHTML='<p class="muted">每次应用写入前保留工作区快照。选择快照可查看并恢复为草稿。</p>'+files.map(f=>`<div class="history-item">${new Date(Number(f.split('-')[0])).toLocaleString('zh-CN')}<button data-history="${f}">查看</button></div>`).join('')+(files.length?'':'<p class="muted">首次编辑后会出现历史。</p>');body.querySelectorAll('[data-history]').forEach(b=>b.onclick=async()=>{try{const old=await api('/api/history-entry?name='+encodeURIComponent(b.dataset.history));const item=old.draft.find(v=>v.id===n.id)||old.confirmed.find(v=>v.id===n.id);showModal('<h2>历史内容</h2><div class="history-preview"><pre>'+esc(item?serialize(item):'这个快照中还没有该节点')+'</pre></div><div class="modal-actions"><button data-cancel>关闭</button>'+(item?'<button class="primary" id="restore">恢复为草稿</button>':'')+'</div>');if(item)$('#restore').onclick=async()=>{if(await action({action:'restoreNode',id:n.id,history:b.dataset.history})){closeModal();tab='read';renderDetail();toast('历史内容已恢复为草稿');}};}catch(e){toast(e.message);}});}catch(e){body.textContent=e.message;}}
function showModal(html){$('#modalBody').innerHTML=html;$('#modal').showModal();$('#modalBody').querySelectorAll('[data-cancel]').forEach(b=>b.onclick=closeModal);}
function closeModal(){$('#modal').close();}

// A perspective projection of persistent 3D coordinates. Camera changes never rewrite node positions.
let w=1,h=1,dpr=1;
new ResizeObserver(()=>{const r=canvas.getBoundingClientRect();w=r.width;h=r.height;dpr=Math.min(devicePixelRatio,2);canvas.width=w*dpr;canvas.height=h*dpr;}).observe(canvas);
function project(p){const cy=Math.cos(camera.yaw),sy=Math.sin(camera.yaw),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch);const x=p[0]*cy-p[2]*sy,z=p[0]*sy+p[2]*cy,y=p[1]*cp-z*sp,zz=p[1]*sp+z*cp;const scale=650/(900+zz)*camera.zoom*Math.min(w/800,h/650);return {x:w*.5+(camera.panX||0)+x*scale,y:h*.52+(camera.panY||0)+y*scale,z:zz,scale};}
const graphStyle = getComputedStyle(canvas);
const graphFont = graphStyle.getPropertyValue('--font-ui').trim();
const draftColor = graphStyle.getPropertyValue('--draft').trim();
const confirmedColor = graphStyle.getPropertyValue('--confirmed').trim();

function draw(){requestAnimationFrame(draw);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);if(!state)return;
  const ns=graphNodes(),ids=new Set(ns.map(n=>n.id));$('#graphEmpty').hidden=ns.length>0;const map=new Map(ns.map(n=>[n.id,{...project(positions[n.id]),node:n}]));hitEdges=[];
  for(const e of state.graph.edges){if(!ids.has(e.source)||!ids.has(e.target))continue;const a=map.get(e.source),b=map.get(e.target),active=selected===e.source||selected===e.target;ctx.strokeStyle=active?'#4974c0':'#a3b2c9';ctx.lineWidth=active?1.5:1;ctx.setLineDash(e.status==='draft'?[4,5]:[]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);const ang=Math.atan2(b.y-a.y,b.x-a.x),tx=b.x-Math.cos(ang)*20,ty=b.y-Math.sin(ang)*20;ctx.beginPath();ctx.moveTo(tx-Math.cos(ang-.5)*6,ty-Math.sin(ang-.5)*6);ctx.lineTo(tx,ty);ctx.lineTo(tx-Math.cos(ang+.5)*6,ty-Math.sin(ang+.5)*6);ctx.stroke();if(active&&e.type!=='parent-child'&&e.label.trim()){const label=e.label.length>15?e.label.slice(0,15)+'…':e.label;ctx.font=`12px ${graphFont}`;const tw=ctx.measureText(label).width;const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;ctx.fillStyle='#f8faff';ctx.fillRect(mx-tw/2-5,my-10,tw+10,20);ctx.fillStyle='#42556e';ctx.textAlign='center';ctx.fillText(label,mx,my+4);}hitEdges.push({a,b,edge:e});}
  hitNodes=[...map.values()].sort((a,b)=>b.z-a.z);
  for (const point of hitNodes) {
    const node = point.node;
    const active = node.id === selected;
    const highlighted = active || node.id === hovered;
    const tier=hierarchy.get(node.id);
    const isOverview=!!tier?.children.length;
    const baseRadius = Math.max(6, Math.min(9, 10 * point.scale));
    const radius = isOverview ? baseRadius + 2 : baseRadius;
    point.r = radius;

    if (highlighted) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 5, 0, Math.PI * 2);
      ctx.fillStyle = '#dce9ff';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = node.status === 'draft' ? draftColor : confirmedColor;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const label = node.title.length > 20 ? node.title.slice(0, 20) + '…' : node.title;
    ctx.font = `${isOverview || active ? 600 : 500} ${isOverview?16:13}px ${graphFont}`;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#f8faff';
    ctx.lineWidth = 4;
    ctx.strokeText(label, point.x, point.y + radius + 17);
    ctx.fillStyle = active ? '#174da8' : '#303c50';
    ctx.fillText(label, point.x, point.y + radius + 17);

  }
}
function point(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
function hit(p){return [...hitNodes].reverse().find(n=>Math.hypot(n.x-p.x,n.y-p.y)<Math.max(22,n.r+12));}
let drag=null;
canvas.onpointerdown=e=>{if(e.button!==0&&e.button!==1)return;e.preventDefault();const p=point(e),n=hit(p);drag={pointerId:e.pointerId,pan:e.button===1,x:p.x,y:p.y,startX:p.x,startY:p.y,node:e.button===0&&e.shiftKey?n:null,moved:false};canvas.style.cursor="grabbing";canvas.setPointerCapture(e.pointerId);};
canvas.addEventListener("auxclick",e=>{if(e.button===1)e.preventDefault();});
canvas.onpointermove=e=>{const p=point(e);if(!drag){const n=hit(p);hovered=n?.node.id;canvas.style.cursor=n?'pointer':'grab';return;}if(e.pointerId!==drag.pointerId)return;const dx=p.x-drag.x,dy=p.y-drag.y;drag.moved ||= Math.hypot(p.x-drag.startX,p.y-drag.startY)>4;if(drag.pan){camera.panX=(camera.panX||0)+dx;camera.panY=(camera.panY||0)+dy;}else if(drag.node){const pos=positions[drag.node.node.id],scale=drag.node.scale;const vx=dx/scale,vy=dy/scale,cy=Math.cos(camera.yaw),sy=Math.sin(camera.yaw),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch);pos[0]+=vx*cy+vy*sp*sy;pos[1]+=vy*cp;pos[2]+=-vx*sy+vy*sp*cy;}else{camera.yaw+=dx*.006;camera.pitch=Math.max(-1.4,Math.min(1.4,camera.pitch+dy*.006));}layoutDirty=true;drag.x=p.x;drag.y=p.y;};
canvas.onpointerup=e=>{if(!drag||e.pointerId!==drag.pointerId)return;const p=point(e);if(!drag.pan&&!drag.moved){const n=hit(p);if(n)selectNode(n.node.id);else{const edge=hitEdges.find(({a,b})=>{const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;if(!l)return false;const t=((p.x-a.x)*dx+(p.y-a.y)*dy)/l;return t>.1&&t<.9&&Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<6;});if(edge)edgeDialog(edge.edge);}}drag=null;canvas.style.cursor="grab";if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);};canvas.onpointercancel=()=>{drag=null;canvas.style.cursor="grab";};canvas.onlostpointercapture=()=>{drag=null;canvas.style.cursor="grab";};
canvas.addEventListener('wheel',e=>{e.preventDefault();camera.zoom=Math.max(.25,Math.min(4,camera.zoom*Math.exp(-e.deltaY*.001)));layoutDirty=true;},{passive:false});
$('#zoomIn').onclick=()=>{camera.zoom=Math.min(4,camera.zoom*1.2);layoutDirty=true;};$('#zoomOut').onclick=()=>{camera.zoom=Math.max(.25,camera.zoom/1.2);layoutDirty=true;};$('#resetView').onclick=()=>{camera={panX:0,panY:0,yaw:.2,pitch:-.15,zoom:1};layoutDirty=true;};$('#hierarchyLayout').onclick=()=>{positions=hierarchyPositions();camera={panX:0,panY:0,yaw:.2,pitch:-.15,zoom:1};layoutDirty=true;toast('已按章节层级排列，可保存布局');};$('#saveLayout').onclick=async()=>{if(await action({action:'saveLayout',positions,camera})){layoutDirty=false;toast('节点位置与视角已保存');}};
$('#search').oninput=()=>renderList();document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{if(!guard())return;dirty=false;editing=null;tab='read';filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderList();if(selected)renderDetail();});
$('#newNode').onclick=()=>{if(!guard())return;showModal('<h2>记录一个新的理解</h2><label class="field">节点标题<input id="newTitle" placeholder="例如：我如何理解缓存失效" autofocus></label><div class="modal-actions"><button data-cancel>取消</button><button class="primary" id="createNode">创建草稿</button></div>');$('#newTitle').focus();$('#createNode').onclick=async()=>{const node={id:uid('node'),title:$('#newTitle').value,blocks:[{id:'note',format:'markdown',content:''}]};if(await action({action:'saveNode',node})){closeModal();dirty=false;selected=node.id;tab='edit';editing=null;renderList();renderDetail();}};};
$('#reload').onclick=async()=>{if(!guard())return;if(!PUBLIC_MODE&&layoutDirty&&!confirm('重新载入将放弃未保存的布局调整，继续吗？'))return;dirty=false;layoutDirty=false;location.reload();};
$('#help').onclick=()=>{if(PUBLIC_MODE){showModal('<h2>操作说明</h2><ul><li>搜索或点击节点阅读，底部关联可跳转。</li><li>左键拖动旋转，中键拖动平移，滚轮缩放。</li><li>拖动预览分隔线调整宽度，动画可直接操作。</li></ul><div class="modal-actions"><button data-cancel>关闭</button></div>');return;}showModal('<h2>操作说明</h2><ul><li>点击节点阅读，进入编辑页撰写 Markdown 或 HTML。</li><li>左键拖动空白旋转 3D 空间；中键拖动平移；滚轮缩放；按住 Shift 拖动节点调整位置。</li><li>在阅读底部建立关联，或点击已有连线查看说明。</li><li>「保存布局」记录位置与视角；「只看相邻节点」聚焦当前节点周围。</li><li>保存草稿后，可查看版本对照，再确认纳入正式区。</li><li>工作区文件会定期刷新，修改中的编辑器会保留你的内容。</li></ul><div class="modal-actions"><button data-cancel>关闭</button></div>');};
window.addEventListener('beforeunload',e=>{if(!PUBLIC_MODE&&(dirty||layoutDirty)){e.preventDefault();e.returnValue='';}});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();if(tab==='edit'&&$('#saveDraft'))$('#saveDraft').click();else $('#saveLayout').click();}if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();$('#search').focus();}});
await load(true);draw();if(!PUBLIC_MODE)setInterval(()=>{if(!busy&&!$('#modal').open)load();},2500);

// Resizable detail panel.
{
const handle = document.querySelector('#detailResize');
const detail = document.querySelector('#detail');
const sidebar = document.querySelector('.sidebar');
let width;
let drag;

function limits() {
  return { min: 280, max: Math.max(280, document.body.clientWidth - sidebar.getBoundingClientRect().width - 247) };
}
function resize(value) {
  const { min, max } = limits();
  width = Math.round(Math.max(min, Math.min(max, value)));
  detail.style.setProperty('--detail-width', `${width}px`);
  sync();
}
function sync() {
  const { min, max } = limits();
  handle.setAttribute('aria-valuemin', min);
  handle.setAttribute('aria-valuemax', max);
  handle.setAttribute('aria-valuenow', Math.round(detail.getBoundingClientRect().width));
}
handle.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  event.preventDefault();
  handle.focus();
  drag = { x: event.clientX, width: detail.getBoundingClientRect().width };
  handle.setPointerCapture(event.pointerId);
  document.body.classList.add('resizing');
});
handle.addEventListener('pointermove', event => {
  if (drag) resize(drag.width + drag.x - event.clientX);
});
function stop() { drag = null; document.body.classList.remove('resizing'); }
handle.addEventListener('pointerup', stop);
handle.addEventListener('pointercancel', stop);
handle.addEventListener('lostpointercapture', stop);
window.addEventListener('blur', stop);
handle.addEventListener('keydown', event => {
  const { min, max } = limits();
  const current = detail.getBoundingClientRect().width;
  const step = event.shiftKey ? 64 : 16;
  const target = { ArrowLeft: current + step, ArrowRight: current - step, Home: min, End: max }[event.key];
  if (target === undefined) return;
  event.preventDefault();
  resize(target);
});
window.addEventListener('resize', () => { if (width !== undefined) resize(width); else sync(); });
new ResizeObserver(sync).observe(detail);

}
