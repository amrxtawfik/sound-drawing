const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--autoplay-policy=no-user-gesture-required']});const p=await b.newPage({hasTouch:true});
await p.goto('http://localhost:8770/index.html?skin=hashiya');
await p.evaluate(()=>{const L=window.__sd; window.__g=0;});
await p.setInputFiles('#fileIn',process.argv[3]||'maqam_d.wav');
await p.evaluate(()=>{const iv=setInterval(()=>{const l=window.__sd.listener;if(l&&!l.__w){const g=l.glitch;l.glitch=function(){window.__g++;return g.apply(this,arguments)};l.__w=1;clearInterval(iv);}},20);});
await p.waitForTimeout(+(process.argv[4]||22)*1000);
const r=await p.evaluate(()=>({tap:window.__sd.tapKind,hits:window.__sd.log.filter(f=>f.hit).map(f=>f.t.toFixed(2)),glitches:window.__g,frames:window.__sd.log.length}));
console.log(process.argv[2], JSON.stringify(r));await b.close();})();
