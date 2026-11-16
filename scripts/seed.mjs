import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../workspace');
const samples=[
 ['tcp-window','TCP 滑动窗口',[0,0,70],`# 接收端如何限制发送速度？
> 示例草稿，由 Agent 写入，等待你组织与审核。

接收端用通告窗口表达还能接收多少数据。发送端需要同时考虑接收窗口和拥塞窗口。

## 我想验证的问题
- ACK 确认的是哪一段数据？
- 窗口大小变化时，哪些字节还能继续发送？
- 流量控制与拥塞控制各自在保护什么？

下面的演示只模拟按序发送与累计确认。每格抽象表示一个等长数据段，窗口容量固定为四格。`],
 ['flow-control','流量控制与拥塞控制',[-270,-170,-40],`# 两种限制来自哪里？
> 示例草稿，尚未代表你的个人结论。

- 流量控制关注接收端的处理和缓冲能力。
- 拥塞控制关注网络路径能承受的发送速率。

在 TCP 中，可发送的在途数据量同时受这两类限制影响。

## 待补充
用一个“接收端很快，但路径拥塞”的案例解释它们为何需要分别存在。`],
 ['cache','缓存：复用一次计算',[-280,125,60],`# 什么结果值得保留？
> 示例草稿，待你补充自己的项目经验。

缓存把一次获取或计算的结果保留下来，让后续请求有机会复用。

## 我会先问
- 相同输入会重复出现吗？
- 重新计算有多贵？
- 结果多久会变化？
- 使用过期结果会带来什么影响？

## 待验证的观点
缓存收益需要结合命中率、维护成本和一致性要求一起判断。`],
 ['invalidation','缓存失效与一致性',[-60,240,-90],`# 结果变了，缓存怎么知道？
> 示例草稿，尚未审核。

可以考虑按时间过期、写入时失效，以及按版本区分结果。不同做法对应不同的陈旧数据窗口和实现成本。

## 留给自己的问题
在我做过的项目中，允许数据陈旧多久？这个容忍时间来自业务要求，还是只是实现上的默认值？`],
 ['queue','队列与生产消费',[255,-130,80],`# 谁生产，谁消费？
> 示例草稿，等待你加入实践依据。

队列可以把生产与消费在时间上解耦，但积压需要有明确的处理方式。

## 需要做出的选择
- 队列是否有界？
- 满了以后等待、丢弃还是返回失败？
- 多个生产者和消费者如何同步？

先明确这些问题，再讨论具体数据结构与锁的实现。`],
 ['backpressure','背压：让上游感知积压',[260,130,-40],`# 下游忙不过来时怎么办？
> 示例草稿，尚未确认。

当消费能力低于生产速度时，可以让上游等待、降低生产速率或停止提交。

## 关联假设
接收窗口和有界队列都可以帮助理解“下游如何表达容量限制”。它们属于不同场景，具体机制需要分别说明。`],
 ['unity-pool','Unity 对象池：待整理',[370,260,100],`# 哪些对象值得复用？
> 孤立节点示例，可以暂时没有任何关联。

## 待记录的实验
- 选取一个频繁创建和销毁对象的场景。
- 比较使用对象池前后的性能测量。
- 记录回收时需要重置哪些状态。

等实际完成实验后，再写下自己的结论。`]
];
const demo=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{font:13px/1.7 system-ui,'Microsoft YaHei',sans-serif;background:#f7f9f2;color:#3f5643;padding:18px;margin:0}h3{margin:0 0 5px;font-size:16px}p{color:#89977e;font-size:11px}.cells{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;margin:25px 0 16px}.cell{border:1px solid #d7e0ce;border-radius:5px;text-align:center;padding:12px 0;background:white}.sent{background:#f0dfb9;border-color:#cda764}.acked{background:#cae0cf;border-color:#82ae8b}.window{box-shadow:0 0 0 2px #749b75}button{border:1px solid #cbd8bf;border-radius:5px;background:white;color:#416046;padding:8px;margin:4px 3px 4px 0;cursor:pointer}button:disabled{opacity:.4;cursor:default}.state{padding:12px;background:#eaf1e3;border-radius:5px;font-size:12px}.legend{font-size:10px;color:#929c89;margin-bottom:15px}</style></head><body>
<h3>滑动窗口 · 手动实验</h3><p>每格代表一个等长数据段。点击发送，再观察累计确认如何移动窗口。</p><div id="cells" class="cells"></div><div class="legend">绿色：已确认　黄色：在途　描边：当前窗口</div><div class="state" id="state"></div><p><button id="send">发送下一段</button><button id="ack">确认最早一段</button><button id="reset">重置</button></p>
<script>let sent=0,ack=0;function draw(){document.getElementById('cells').innerHTML=Array.from({length:8},(_,i)=>'<div class="cell '+(i<ack?'acked':i<sent?'sent':'')+' '+(i>=ack&&i<ack+4?'window':'')+'">'+(i+1)+'</div>').join('');document.getElementById('state').textContent='已确认 '+ack+' 段 · 在途 '+(sent-ack)+' 段 · 可继续发送 '+Math.min(4-(sent-ack),8-sent)+' 段';document.getElementById('send').disabled=sent>=8||sent-ack>=4;document.getElementById('ack').disabled=ack>=sent;}document.getElementById('send').onclick=()=>{sent++;draw()};document.getElementById('ack').onclick=()=>{ack++;draw()};document.getElementById('reset').onclick=()=>{sent=0;ack=0;draw()};draw();<\/script></body></html>`;
for(const [id,title,position,text]of samples){const dir=path.join(root,'inbox',id);await fs.mkdir(dir,{recursive:true});if(await fs.stat(path.join(dir,'node.json')).catch(()=>null))continue;const blocks=[{id:'note',format:'markdown',file:'note.md'}];await fs.writeFile(path.join(dir,'note.md'),text+'\n');if(id==='tcp-window'){blocks.push({id:'demo',format:'html',file:'demo.html'});await fs.writeFile(path.join(dir,'demo.html'),demo);}await fs.writeFile(path.join(dir,'node.json'),JSON.stringify({id,title,blocks},null,2)+'\n');}
const edges=[['tcp-window','flow-control','窗口机制帮助区分两种发送限制'],['tcp-window','backpressure','从接收容量理解上游限速'],['queue','backpressure','队列积压引出上游反馈'],['cache','invalidation','复用结果需要处理变化']].map(([source,target,label],i)=>({id:'example-edge-'+(i+1),source,target,label,status:'draft'}));
if(!await fs.stat(path.join(root,'graph.json')).catch(()=>null))await fs.writeFile(path.join(root,'graph.json'),JSON.stringify({schemaVersion:1,edges,positions:Object.fromEntries(samples.map(([id,title,p])=>[id,p])),camera:{yaw:.12,pitch:-.12,zoom:1.35}},null,2)+'\n');
for(const dir of ['confirmed','assets','history'])await fs.mkdir(path.join(root,dir),{recursive:true});
console.log('Seed complete: 7 draft nodes, 4 draft relations.');
