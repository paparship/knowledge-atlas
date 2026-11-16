import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Readable} from 'node:stream';
import {createApp} from '../server.mjs';

const node=(id='alpha',content='初始理解')=>({id,title:id,blocks:[{id:'note',format:'markdown',content}]});
async function fixture(t){const dir=await fs.mkdtemp(path.join(process.cwd(),'tests','atlas-test-'));const app=await createApp(dir);t.after(async()=>{app.server.close();await fs.rm(dir,{recursive:true,force:true});});return{...app,dir};}
test('确认后编辑保留正式内容，历史恢复只生成草稿',async t=>{
 const a=await fixture(t);let s=await a.readState();s=await a.mutate({action:'saveNode',node:node(),revision:s.revision});
 s=await a.mutate({action:'approveNode',id:'alpha',revision:s.revision});assert.equal(s.draft.length,0);assert.equal(s.confirmed[0].blocks[0].content,'初始理解');
 s=await a.mutate({action:'saveNode',node:node('alpha','新观点'),revision:s.revision});assert.equal(s.confirmed[0].blocks[0].content,'初始理解');assert.equal(s.draft[0].blocks[0].content,'新观点');
 const entries=await fs.readdir(path.join(a.dir,'history'));let old;for(const name of entries){const snap=JSON.parse(await fs.readFile(path.join(a.dir,'history',name),'utf8'));if(snap.confirmed.length)old=name;}
 s=await a.mutate({action:'restoreNode',id:'alpha',history:old,revision:s.revision});assert.equal(s.draft[0].blocks[0].content,'初始理解');assert.equal(s.confirmed[0].blocks[0].content,'初始理解');
});
test('外部修改使旧 revision 失效，拒绝覆盖',async t=>{const a=await fixture(t);let s=await a.readState();s=await a.mutate({action:'saveNode',node:node(),revision:s.revision});await fs.writeFile(path.join(a.dir,'inbox/alpha/note.md'),'外部编辑');await assert.rejects(a.mutate({action:'saveNode',node:node('alpha','覆盖'),revision:s.revision}),e=>e.status===409);assert.equal((await a.readState()).draft[0].blocks[0].content,'外部编辑');});
test('并发写入仅一个相同 revision 可以提交',async t=>{const a=await fixture(t);const s=await a.readState();const out=await Promise.allSettled([a.mutate({action:'saveNode',node:node('a'),revision:s.revision}),a.mutate({action:'saveNode',node:node('b'),revision:s.revision})]);assert.equal(out.filter(r=>r.status==='fulfilled').length,1);assert.equal((await a.readState()).draft.length,1);});
test('关系引用验证、删除节点清理边和坐标',async t=>{const a=await fixture(t);let s=await a.readState();s=await a.mutate({action:'saveNode',node:node('a'),revision:s.revision});s=await a.mutate({action:'saveNode',node:node('b'),revision:s.revision});await assert.rejects(a.mutate({action:'saveEdge',edge:{id:'e',source:'a',target:'missing',label:'关系',status:'draft'},revision:s.revision}));s=await a.mutate({action:'saveEdge',edge:{id:'e',source:'a',target:'b',label:'关系',status:'draft'},revision:s.revision});s=await a.mutate({action:'saveLayout',positions:{a:[1,2,3],b:[4,5,6]},camera:{yaw:0,pitch:0,zoom:1},revision:s.revision});s=await a.mutate({action:'deleteNode',id:'a',revision:s.revision});assert.equal(s.graph.edges.length,0);assert.equal(s.graph.positions.a,undefined);assert.equal(s.draft.length,1);});
test('HTML 精确往返，非法目录与内容文件被拒绝',async t=>{const a=await fixture(t);let s=await a.readState();const html='<script>const text="中文";</script>';s=await a.mutate({action:'saveNode',node:{id:'demo',title:'演示',blocks:[{id:'page',format:'html',content:html}]},revision:s.revision});assert.equal(s.draft[0].blocks[0].content,html);await assert.rejects(a.mutate({action:'saveNode',node:node('../escape'),revision:s.revision}));const file=path.join(a.dir,'inbox/demo/node.json');const meta=JSON.parse(await fs.readFile(file,'utf8'));meta.blocks[0].file='../../outside.html';await fs.writeFile(file,JSON.stringify(meta));await assert.rejects(a.readState(),/非法内容文件/);});
test('HTTP API 可读取数据，拒绝跨来源修改',async t=>{
 const a=await fixture(t);
 const request=(url,method='GET',headers={})=>new Promise(resolve=>{
   const req=Readable.from([]);Object.assign(req,{url,method,headers:{host:'127.0.0.1:4317',...headers}});
   const res={writeHead(status,h){this.status=status;},end(body){resolve({status:this.status,body});}};
   a.server.emit('request',req,res);
 });
 const r=await request('/api/state');assert.equal(r.status,200);assert.equal(JSON.parse(r.body).draft.length,0);
 const blocked=await request('/api/action','POST',{'content-type':'application/json',origin:'https://unrelated.example'});
 assert.equal(blocked.status,403);
  const home=await request('/');assert.equal(home.status,200);assert.match(home.body.toString(),/<canvas id="graph"/);
});
