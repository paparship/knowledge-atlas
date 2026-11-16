import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const ID = /^[a-zA-Z0-9_-]{1,80}$/;
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const json = async file => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
const exists = async file => !!(await fs.stat(file).catch(() => null));
async function atomic(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + '.' + crypto.randomUUID() + '.tmp';
  await fs.writeFile(tmp, text, 'utf8');
  await fs.rename(tmp, file);
}
const writeJSON = (file, value) => atomic(file, JSON.stringify(value, null, 2) + '\n');
function checkNode(node) {
  if (!ID.test(node.id) || typeof node.title !== 'string' || !node.title.trim()) throw fail('节点 ID 或标题无效');
  if (!Array.isArray(node.blocks) || node.blocks.length > 40) throw fail('内容块格式无效');
  const ids = new Set();
  for (const b of node.blocks) {
    if (!ID.test(b.id) || ids.has(b.id) || !['markdown', 'html'].includes(b.format) || typeof b.content !== 'string') throw fail('内容块 ID、格式或正文无效');
    if (b.content.length > 2_000_000) throw fail('单块内容不能超过 2 MB');
    ids.add(b.id);
  }
}

export async function createApp(workspace = path.join(ROOT, 'workspace')) {
  for (const dir of ['inbox', 'confirmed', 'history', 'assets']) await fs.mkdir(path.join(workspace, dir), { recursive: true });
  if (!await exists(path.join(workspace, 'graph.json'))) await writeJSON(path.join(workspace, 'graph.json'), { schemaVersion: 1, edges: [], positions: {}, camera: { yaw: 0.2, pitch: -0.15, zoom: 1 } });
  async function readArea(area) {
    const nodes = [];
    for (const ent of (await fs.readdir(path.join(workspace, area), { withFileTypes: true })).sort((a,b)=>a.name.localeCompare(b.name))) {
      if (!ent.isDirectory() || !ID.test(ent.name)) continue;
      const dir = path.join(workspace, area, ent.name);
      if (!await exists(path.join(dir, 'node.json'))) continue;
      const meta = await json(path.join(dir, 'node.json'));
      if (meta.id !== ent.name || !Array.isArray(meta.blocks)) throw fail('节点目录与 ID 不一致：' + ent.name);
      const blocks = [];
      for (const block of meta.blocks) {
        if (!ID.test(block.id) || !['markdown', 'html'].includes(block.format) || block.file !== `${block.id}.${block.format === 'html' ? 'html' : 'md'}`) throw fail('非法内容文件：' + ent.name);
        blocks.push({ id: block.id, format: block.format, content: await fs.readFile(path.join(dir, block.file), 'utf8') });
      }
      const node = { id: meta.id, title: meta.title, blocks, updatedAt: meta.updatedAt || null };
      checkNode(node); nodes.push(node);
    }
    return nodes;
  }
  async function readState() {
    const draft = await readArea('inbox'), confirmed = await readArea('confirmed');
    const graph = await json(path.join(workspace, 'graph.json'));
    if (graph.schemaVersion !== 1 || !Array.isArray(graph.edges) || !graph.positions) throw fail('graph.json 格式无效');
    const allIds = new Set([...draft, ...confirmed].map(n=>n.id));
    const edgeIds = new Set();
    for (const e of graph.edges) {
      if (!ID.test(e.id) || edgeIds.has(e.id) || !allIds.has(e.source) || !allIds.has(e.target) || typeof e.label !== 'string' || !['related','parent-child'].includes(e.type ?? 'related') || !['draft','confirmed'].includes(e.status)) throw fail('关系无效或引用了不存在的节点：' + e.id);
      edgeIds.add(e.id);
    }
    const state = { schemaVersion: 1, draft, confirmed, graph };
    return { ...state, revision: hash(state) };
  }
  async function writeNode(area, node) {
    checkNode(node);
    const dir = path.join(workspace, area, node.id);
    for (const b of node.blocks) await atomic(path.join(dir, b.id + (b.format === 'html' ? '.html' : '.md')), b.content);
    await writeJSON(path.join(dir, 'node.json'), { id: node.id, title: node.title.trim(), updatedAt: new Date().toISOString(), blocks: node.blocks.map(b=>({id:b.id, format:b.format, file:b.id+(b.format==='html'?'.html':'.md')})) });
  }
  let queue = Promise.resolve();
  const mutate = payload => {
    const task = queue.then(async () => {
      const s = await readState();
      if (payload.revision !== s.revision) throw fail('文件已被其他操作修改，请重新载入后合并。当前编辑仍保留。', 409);
      const { action } = payload;
      const id = payload.id;
      if (id !== undefined && !ID.test(id)) throw fail('无效 ID');
      const allowed = ['saveNode','approveNode','deleteNode','saveEdge','deleteEdge','saveLayout','restoreNode'];
      if (!allowed.includes(action)) throw fail('未知操作');
      if (action === 'saveNode') checkNode(payload.node);
      let restore;
      if (action === 'restoreNode') {
        if (!/^[a-zA-Z0-9_.-]+\.json$/.test(payload.history)) throw fail('无效历史文件');
        const old = await json(path.join(workspace, 'history', payload.history));
        restore = old.draft.find(n=>n.id===id) || old.confirmed.find(n=>n.id===id);
        if (!restore) throw fail('该版本没有此节点');
      }
      const ids = new Set([...s.draft,...s.confirmed].map(n=>n.id));
      if (action === 'approveNode' && !s.draft.some(n=>n.id===id)) throw fail('没有待确认草稿');
      if (action === 'saveEdge') {
        const e = payload.edge;
        if (!ID.test(e?.id) || !ids.has(e.source) || !ids.has(e.target) || e.source===e.target || typeof e.label !== 'string' || !['related','parent-child'].includes(e.type ?? 'related') || (e.type!=='parent-child' && !e.label.trim()) || !['draft','confirmed'].includes(e.status)) throw fail('关系格式无效');
      }
      if (action === 'saveLayout') {
        for (const [key,p] of Object.entries(payload.positions || {})) if (!ids.has(key) || !Array.isArray(p) || p.length!==3 || p.some(v=>!Number.isFinite(v) || Math.abs(v)>100000)) throw fail('节点坐标无效');
        if (!payload.camera || ['yaw','pitch','zoom'].some(k=>!Number.isFinite(payload.camera[k])) || payload.camera.zoom<=0) throw fail('视角无效');
      }
      await writeJSON(path.join(workspace,'history',Date.now()+'-'+crypto.randomUUID().slice(0,8)+'.json'), s);
      if (action === 'saveNode') await writeNode('inbox', payload.node);
      if (action === 'restoreNode') await writeNode('inbox', restore);
      if (action === 'approveNode') {
        await writeNode('confirmed', s.draft.find(n=>n.id===id));
        await fs.rm(path.join(workspace,'inbox',id), {recursive:true,force:true});
      }
      if (action === 'deleteNode') {
        for (const area of ['inbox','confirmed']) await fs.rm(path.join(workspace,area,id), {recursive:true,force:true});
        s.graph.edges=s.graph.edges.filter(e=>e.source!==id && e.target!==id); delete s.graph.positions[id];
      }
      if (action === 'saveEdge') s.graph.edges=[...s.graph.edges.filter(e=>e.id!==payload.edge.id),payload.edge];
      if (action === 'deleteEdge') s.graph.edges=s.graph.edges.filter(e=>e.id!==id);
      if (action === 'saveLayout') { s.graph.positions=payload.positions; s.graph.camera=payload.camera; }
      if (['deleteNode','saveEdge','deleteEdge','saveLayout'].includes(action)) await writeJSON(path.join(workspace,'graph.json'),s.graph);
      return readState();
    });
    queue=task.catch(()=>{}); return task;
  };
  const server = http.createServer(async (req,res)=>{
    const send=(status,value,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(type.startsWith('application/json')?JSON.stringify(value):value);};
    try {
      const host=req.headers.host || '';
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) throw fail('无效主机',403);
      if (req.headers.origin && req.headers.origin !== `http://${host}`) throw fail('跨来源请求已拒绝',403);
      const url=new URL(req.url,`http://${host}`);
      if (url.pathname==='/api/state' && req.method==='GET') return send(200,await readState());
      if (url.pathname==='/api/history' && req.method==='GET') return send(200,(await fs.readdir(path.join(workspace,'history'))).filter(n=>n.endsWith('.json')).sort().reverse());
      if (url.pathname==='/api/history-entry' && req.method==='GET') {
        const name=url.searchParams.get('name'); if (!/^[a-zA-Z0-9_.-]+\.json$/.test(name||'')) throw fail('无效历史文件');
        return send(200,await json(path.join(workspace,'history',name)));
      }
      if (url.pathname==='/api/action' && req.method==='POST') {
        if (!req.headers['content-type']?.startsWith('application/json')) throw fail('需要 JSON 请求',415);
        let body='',size=0; for await (const chunk of req) { size+=chunk.length; if(size>8_000_000) throw fail('请求过大',413); body+=chunk; }
        return send(200,await mutate(JSON.parse(body)));
      }
      if (url.pathname.startsWith('/assets/') && req.method==='GET') {
        const name=decodeURIComponent(url.pathname.slice(8));
        if (!/^[\w.-]+$/.test(name)) throw fail('无效附件路径');
        const ext=path.extname(name).toLowerCase();
        const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.mp4':'video/mp4','.pdf':'application/pdf'}[ext];
        if(!mime) throw fail('不支持的附件类型');
        return send(200,await fs.readFile(path.join(workspace,'assets',name)),mime);
      }
      const assets={'/':'index.html','/prism.js':'prism.js','/app.js':'app.js','/style.css':'style.css'};
      if (req.method==='GET' && assets[url.pathname]) {
        const file=assets[url.pathname]; return send(200,await fs.readFile(path.join(ROOT,'public',file)),file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');
      }
      send(404,{error:'未找到'});
    } catch(e) { send(e.status || (e.code==='ENOENT'?404:500),{error:e.message}); }
  });
  return { server, readState, mutate };
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const {server}=await createApp(process.env.ATLAS_WORKSPACE || undefined);
  server.listen(Number(process.env.PORT || 4317),'127.0.0.1',()=>console.log(`Knowledge Atlas: http://127.0.0.1:${server.address().port}`));
}
