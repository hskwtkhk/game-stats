const http = require('node:http');
const { URLSearchParams } = require('node:url');

const sample = '勝利,18,7,5\n敗北,12,10,3\n勝利,24,9,8';
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// サーバー側で入力を検証し、試合ごとのデータを作る。
function parse(raw) {
  const lines = raw.trim().split(/\r?\n/).filter(s => s.trim());
  if (!raw.trim() || lines.length > 200) throw Error('1～200試合を入力してください。');
  return lines.map((line,i) => {
    const [result,k,d,a,...extra] = line.split(',').map(s => s.trim());
    if (extra.length || !['勝利','敗北'].includes(result) || ![k,d,a].every(s => /^\d{1,4}$/.test(s ?? ''))) {
      throw Error(`${i+1}行目：勝利または敗北, キル, デス, アシスト（0～9999）を入力してください。`);
    }
    return {result,k:Number(k),d:Number(d),a:Number(a)};
  });
}
function summarize(rows) {
  const wins = rows.filter(r=>r.result==='勝利').length;
  const [k,d,a] = ['k','d','a'].map(key=>rows.reduce((s,r)=>s+r[key],0));
  return {matches:rows.length,wins,rate:(100*wins/rows.length).toFixed(1),k,d,a,kd:d?(k/d).toFixed(2):'—',kda:d?((k+a)/d).toFixed(2):'—'};
}
const summaryRows = s => [['試合数',s.matches],['勝利数',s.wins],['勝率 (%)',Number(s.rate)],['総キル',s.k],['総デス',s.d],['総アシスト',s.a],['K/D',s.kd==='—'?'算出不可':Number(s.kd)],['KDA',s.kda==='—'?'算出不可':Number(s.kda)]];
function page(raw=sample,rows=null,error='') {
 const s=rows&&summarize(rows);
 return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Game Stats | 戦績分析</title><style>
 :root{color-scheme:dark;font-family:system-ui,sans-serif;color:#edf3ff;background:#101827}*{box-sizing:border-box}body{margin:0}main{max-width:960px;margin:auto;padding:36px 20px 64px}header{margin-bottom:28px}small,.muted{color:#a7b5cb}h1{font-size:clamp(32px,6vw,52px);margin:8px 0;letter-spacing:-.04em}h2{font-size:19px;margin-top:0}.panel{background:#192538;border:1px solid #33445b;border-radius:16px;padding:24px;margin:16px 0}textarea{width:100%;min-height:145px;background:#101827;color:#edf3ff;border:1px solid #546880;border-radius:10px;padding:14px;font:16px monospace;line-height:1.7;resize:vertical}button{background:#73e0be;color:#092a25;border:0;border-radius:8px;padding:12px 18px;font-weight:700;font-size:15px;cursor:pointer;margin:6px 8px 0 0}button.secondary{background:#293a52;color:#eef3ff}button:hover{filter:brightness(1.1)}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}.metric{background:#101827;padding:16px;border-radius:10px}.metric strong{display:block;font-size:30px;margin-top:4px;color:#73e0be}.bar{height:12px;background:#d88890;border-radius:8px;overflow:hidden;margin:14px 0}.bar div{height:100%;background:#73e0be}table{width:100%;border-collapse:collapse;text-align:right}th,td{padding:10px 6px;border-bottom:1px solid #33445b}th:first-child,td:first-child{text-align:left}.error{color:#ffb3ba}p{line-height:1.7}footer{font-size:13px;color:#a7b5cb}</style></head><body><main>
 <header><small>GAME ANALYTICS / SERVER-SIDE WEB APP</small><h1>Game Stats</h1><p class="muted">対戦データから勝率やK/Dを分析する戦績集計ツール。</p></header>
 <form method="post" action="/analyze"><section class="panel"><h2>01　戦績入力</h2><label for="records">1行に1試合：勝利または敗北, キル, デス, アシスト</label><p class="muted">例：勝利,18,7,5　（最大200試合）</p><textarea id="records" name="records" required maxlength="15000" spellcheck="false">${escape(raw)}</textarea>${error?`<p role="alert" class="error">${escape(error)}</p>`:''}<div><button type="submit">戦績を分析する</button><button class="secondary" type="submit" formaction="/csv">CSV出力</button><button class="secondary" type="submit" formaction="/excel">Excel出力</button></div></section></form>
 ${s?`<section class="panel"><h2>02　分析結果</h2><div class="metrics">${[['試合数',s.matches],['勝率',s.rate+'%'],['K/D',s.kd],['KDA',s.kda]].map(([k,v])=>`<div class="metric"><small>${k}</small><strong>${v}</strong></div>`).join('')}</div><div class="bar" aria-label="勝率 ${s.rate}%"><div style="width:${s.rate}%"></div></div><p>勝利 ${s.wins} / 敗北 ${s.matches-s.wins}　｜　総キル ${s.k} / 総デス ${s.d} / 総アシスト ${s.a}</p><small>K/D＝総キル÷総デス、KDA＝（総キル＋総アシスト）÷総デス。デス0の場合は「—」。</small></section><section class="panel"><h2>03　試合別データ</h2><table><thead><tr><th>試合</th><th>結果</th><th>キル</th><th>デス</th><th>アシスト</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${r.result}</td><td>${r.k}</td><td>${r.d}</td><td>${r.a}</td></tr>`).join('')}</tbody></table></section>`:''}
 <footer>Node.jsで集計・入力検証・ファイル生成を実行します。戦績はサーバーに保存しません。</footer></main></body></html>`;
}
function csv(rows) {
 return '\uFEFF'+[['試合','結果','キル','デス','アシスト'],...rows.map((r,i)=>[i+1,r.result,r.k,r.d,r.a]),[],...summaryRows(summarize(rows))].map(r=>r.join(',')).join('\r\n')+'\r\n';
}
// 教材の xlsx-populate でセルの値・スタイル・シートを設定する。
async function excel(rows) {
 const XlsxPopulate=require('xlsx-populate');
 const book=await XlsxPopulate.fromBlankAsync();
 const sheet=book.sheet(0).name('戦績');
 sheet.cell('A1').value([['試合','結果','キル','デス','アシスト'],...rows.map((r,i)=>[i+1,r.result,r.k,r.d,r.a])]);
 sheet.range('A1:E1').style({bold:true,fill:'D7F5EA'});
 const sum=book.addSheet('集計');
 sum.cell('A1').value([['項目','値'],...summaryRows(summarize(rows))]);
 sum.range('A1:B1').style({bold:true,fill:'D7F5EA'});
 sum.column('A').width(20);sum.column('B').width(15);
 return book.outputAsync();
}
function html(res,status,body){res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(body);}
function download(res,type,name,body){res.writeHead(200,{'Content-Type':type,'Content-Disposition':`attachment; filename="${name}"`,'Cache-Control':'no-store'});res.end(body);}
const server=http.createServer(async(req,res)=>{
 const path=req.url.split('?')[0];
 if(req.method==='GET'&&path==='/') return html(res,200,page());
 if(req.method==='GET'&&path==='/health') {res.writeHead(200);return res.end('OK');}
 if(req.method!=='POST'||!['/analyze','/csv','/excel'].includes(path)){res.writeHead(404);return res.end('Not found');}
 let raw='';
 try {
   let size=0;const parts=[];
   for await(const chunk of req){size+=chunk.length;if(size<=150000)parts.push(chunk);}
   if(size>150000)return html(res,413,page('',null,'入力が大きすぎます。'));
   raw=new URLSearchParams(Buffer.concat(parts).toString()).get('records')||'';
   const rows=parse(raw);
   if(path==='/analyze')return html(res,200,page(raw,rows));
   if(path==='/csv')return download(res,'text/csv; charset=utf-8','game-stats.csv',csv(rows));
   try{return download(res,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','game-stats.xlsx',await excel(rows));}
   catch(e){console.error(e.message);return html(res,503,page(raw,rows,'Excel出力が利用できません。npm install を確認するか、CSV出力をご利用ください。'));}
 } catch(e){return html(res,400,page(raw.slice(0,15000),null,e.message));}
});
if(require.main===module)server.listen(Number(process.env.PORT)||8000,'0.0.0.0',()=>console.log('Game Stats server started'));
module.exports={server,parse,summarize,csv};
