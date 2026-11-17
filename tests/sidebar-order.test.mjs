import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function fixture(){
  const node=(id,day)=>({id,title:id,updatedAt:day?`2026-01-${String(day).padStart(2,'0')}T00:00:00Z`:null,status:'draft'});
  const items=[node('root',1),node('branch',2),node('leaf',10),node('sibling',6),node('other',8),node('undated',null)];
  const edges=[['root','branch'],['branch','leaf'],['root','sibling']].map(([source,target])=>({source,target,type:'parent-child'}));
  const elements=new Map();
  const $=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',querySelectorAll:()=>[]});return elements.get(id);};
  const expandedNodes=new Set(['root']);
  const context=vm.createContext({$,document:{querySelectorAll:()=>[]},state:{draft:items,confirmed:[],graph:{edges}},filter:'all',selected:null,sidebarView:'tree',expandedNodes,nodes:()=>items,visible:()=>items.filter(n=>!$('#search').value||n.id.includes($('#search').value)),getNode:id=>items.find(n=>n.id===id),esc:s=>s});
  vm.runInContext(source.slice(source.indexOf('function nodeUpdatedTime('),source.indexOf('function guard(')),context);
  const order=()=>{context.renderList();return [...$('#nodeList').innerHTML.matchAll(/data-node="([^"]+)"/g)].map(m=>m[1]);};
  return {context,items,edges,$,order,expandedNodes};
}

test('树按后代最近更新排序，同时保留祖先、同级顺序与折叠状态',()=>{
  const f=fixture();
  assert.deepEqual(f.order(),['root','branch','leaf','sibling','other','undated']);
  assert.deepEqual([...f.expandedNodes],['root']);
  assert.match(f.$('#nodeList').innerHTML,/<ul hidden>/);
  const oldRootTime=f.items[0].updatedAt;
  f.items.find(n=>n.id==='sibling').updatedAt='2026-01-12T00:00:00Z';
  assert.deepEqual(f.order(),['root','sibling','branch','leaf','other','undated']);
  assert.equal(f.items[0].updatedAt,oldRootTime);
});

test('列表按节点自身时间排序，保存后立即改变顺序；搜索保留祖先',()=>{
  const f=fixture();f.context.sidebarView='list';
  assert.deepEqual(f.order(),['leaf','other','sibling','branch','root','undated']);
  f.items.find(n=>n.id==='other').updatedAt='2026-01-15T00:00:00Z';
  assert.equal(f.order()[0],'other');
  f.context.sidebarView='tree';assert.equal(f.order()[0],'other');
  f.$('#search').value='leaf';assert.deepEqual(f.order(),['root','branch','leaf']);
});

test('普通关联不影响树排序，循环关系不会导致无限遍历',()=>{
  const f=fixture();
  f.edges.push({source:'undated',target:'leaf',type:'related'});
  assert.equal(f.order().at(-1),'undated');
  f.edges.push({source:'leaf',target:'root',type:'parent-child'});
  const order=f.order();assert.equal(order.length,6);assert.equal(new Set(order).size,6);
});
