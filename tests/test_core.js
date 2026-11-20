// node test_core.js : feature and reference tests with assertions
const fs = require('fs'), L = require('../listen.js');
function readWav(p){const b=fs.readFileSync(p);let o=12,sr=0,data=null;while(o<b.length){const id=b.toString('ascii',o,o+4),sz=b.readUInt32LE(o+4);if(id==='fmt ')sr=b.readUInt32LE(o+12);if(id==='data')data=b.subarray(o+8,o+8+sz);o+=8+sz+(sz%2);}const x=new Float32Array(data.length/2);for(let i=0;i<x.length;i++)x[i]=data.readInt16LE(2*i)/32768;return{x,sr};}
function run(file){const {x,sr}=readWav(file),lis=L.Listener(sr),fr=[];for(let s=0;s+2048<=x.length;s+=1024)fr.push(lis.push(x.subarray(s,s+2048)));return {fr,lis,sr};}
const med=a=>{a=a.filter(v=>v===v).sort((p,q)=>p-q);return a.length?a[a.length>>1]:NaN;};
let fails=0; const check=(name,ok,detail)=>{console.log((ok?'PASS ':'FAIL ')+name+(detail?'  ('+detail+')':''));if(!ok)fails++;};

// 1. the mixed scene
const T=JSON.parse(fs.readFileSync('scene_truth.json'));
const {fr,sr}=run('scene.wav'); const at=t=>(T.segments.find(s=>t>=s.t0&&t<s.t1)||{}).src;
const by={}; fr.forEach(f=>{const s=at(f.t+1024/sr);if(!s)return;const b=by[s]=by[s]||{k:{},bri:[],bre:[],vow:[],n:0};b.n++;b.k[f.kind]=(b.k[f.kind]||0)+1;if(f.active){b.bri.push(f.brightness);b.bre.push(f.breath);if(f.kind==='tone')b.vow.push(f.vowel);}});
for(const [s,b] of Object.entries(by)) console.log('   ',s.padEnd(7),JSON.stringify(b.k).padEnd(44),'bright',med(b.bri).toFixed(2),'breath',med(b.bre).toFixed(2),'vowel',med(b.vow).toFixed(2));
const share=(s,k)=>(by[s].k[k]||0)/by[s].n;
check('quiet is quiet', share('quiet','quiet')>0.9, (100*share('quiet','quiet')).toFixed(0)+'%');
check('voices are tone', share('voiceA','tone')>0.85 && share('voiceB','tone')>0.85);
check('oud is tone', share('oud','tone')>0.75, (100*share('oud','tone')).toFixed(0)+'%');
check('ney is breathier than the voices', med(by.ney.bre) > med(by.voiceA.bre)+0.15 && med(by.ney.bre) > med(by.voiceB.bre)+0.15, `ney ${med(by.ney.bre).toFixed(2)} vs ${med(by.voiceA.bre).toFixed(2)}/${med(by.voiceB.bre).toFixed(2)}`);
check('oud is brighter than the voices', med(by.oud.bri) > med(by.voiceA.bri)+0.15, `oud ${med(by.oud.bri).toFixed(2)} vs ${med(by.voiceA.bri).toFixed(2)}`);
check('the two voices differ in vowel colour', Math.abs(med(by.voiceA.vow)-med(by.voiceB.vow))>0.2, `${med(by.voiceA.vow).toFixed(2)} vs ${med(by.voiceB.vow).toFixed(2)}`);
check('drum never holds a note', fr.filter(f=>at(f.t+1024/sr)==='drum'&&f.held).length/by.drum.n < 0.05, (100*fr.filter(f=>at(f.t+1024/sr)==='drum'&&f.held).length/by.drum.n).toFixed(1)+'% held');
// onset F-measure on the drum hits (50 ms window)
const hits=T.drum_hits.map(h=>h.t+32.63), ons=fr.filter(f=>f.onset&&at(f.t+1024/sr)==='drum').map(f=>f.t+1024/sr);
let tp=0; const used=new Set(); hits.forEach(h=>{const i=ons.findIndex((o,k)=>!used.has(k)&&Math.abs(o-h)<0.05);if(i>=0){tp++;used.add(i);}});
const P=tp/Math.max(1,ons.length),R=tp/hits.length,F=2*P*R/Math.max(1e-9,P+R);
check('drum onsets F > 0.9', F>0.9, `F ${F.toFixed(2)}, ${tp}/${hits.length} hits, ${ons.length} onsets`);
// pitch accuracy: voice A median f0 sits on Bayati degrees above D3
const vA=fr.filter(f=>at(f.t)==='voiceA'&&f.held).map(f=>(((f.cents-(-1900))%1200)+1200)%1200);
const deg=[0,150,300,500,700,800,1000,1200], err=vA.map(c=>Math.min(...deg.map(d=>Math.abs(c-d))));
check('held notes sit on the true degrees (median error < 15 cents)', med(err)<15, `median ${med(err).toFixed(1)} cents`);

// 2. maqam melody: one lock, on D
const M=run('maqam_d.wav'); const locks=M.fr.filter(f=>f.qararChanged).map(f=>({t:f.t,q:f.qarar}));
const q=M.lis.tonic.lockedCents(), dErr=q===null?999:Math.min(Math.abs(q-500),1200-Math.abs(q-500));
check('maqam: qarar locks on D within 15 cents', dErr<15, `locked at ${q} (D = 500), error ${dErr}`);
check('maqam: exactly one lock', locks.length===1, `${locks.length} locks at ${locks.map(l=>l.t.toFixed(1)+'s').join(', ')}`);
// 3. speech: no lock
const Sp=run('speech30.wav');
check('speech: no qarar in 30 s', Sp.lis.tonic.lockedCents()===null, `locked ${Sp.lis.tonic.lockedCents()}`);
const tonalSpeech=Sp.fr.filter(f=>f.held).length/Sp.fr.length;
check('speech: few held notes', tonalSpeech<0.1, (100*tonalSpeech).toFixed(1)+'% of frames held');
console.log(fails?`\n${fails} FAILED`:'\nALL PASS');
// 4. hits are confirmed only when no pitch follows: voices make almost none, the drum makes about as many as it plays
{
  const T2=JSON.parse(fs.readFileSync('scene_truth.json')); const R=run('scene.wav'); const at2=t=>(T2.segments.find(s=>t>=s.t0&&t<s.t1)||{}).src;
  const voiceHits=R.fr.filter(f=>f.hit&&['voiceA','voiceB','oud','ney'].includes(at2(f.hit.t+1024/R.sr))).length;
  const drumHits=R.fr.filter(f=>f.hit&&at2(f.hit.t+1024/R.sr)==='drum').length;
  check('singing and plucking make (almost) no hits', voiceHits<=2, voiceHits+' hits');
  check('drum hits are confirmed', drumHits>=0.8*T2.drum_hits.length, drumHits+' of '+T2.drum_hits.length);
  console.log(fails?`${fails} FAILED`:'ALL PASS (with hits)');
}
