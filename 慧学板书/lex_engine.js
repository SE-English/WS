
/* ================================================================
   v12 智能查词引擎（运行层）
   在「重点词汇」栏输入/插入一个单词后，自动向其余四栏投递：
     · 常见搭配 —— 1~3 条
     · 重点语法 —— 小学/初中题库口径的语法讲解
     · 配套例句 —— 1~5 条权威词典例句
     · 语法测试 —— 恰好 5 道语法测试题
   数据源优先级：内置精选库 → 联网权威词典 → AI 大模型
   ★ 写入原则：只增不覆盖。老师手写的内容一律不动；自动生成的内容带
     data-lk="词|xx" 标记，可被「↩ 还原」一键清除。
   ★ 标记沿用 v11 的 co / ex / g / t 四种，兼容已有笔记。
   ================================================================ */

/* ---------- 词形推导 ---------- */
function lexPosOf(w){
  const d = dictIndex()[w];
  const p = d ? ((d.pos||'').toLowerCase()) : '';
  if(p.indexOf('v.')===0 || p.indexOf('vt')===0 || p.indexOf('vi')===0) return 'v';
  if(p.indexOf('adj')===0) return 'adj';
  if(p.indexOf('adv')===0) return 'adv';
  if(p.indexOf('n.')===0) return 'n';
  if(p.indexOf('int')===0) return 'phrase';
  if(p.indexOf('prep')===0) return 'prep';
  if(p.indexOf('conj')===0) return 'conj';
  if(p.indexOf('pron')===0) return 'pron';
  if(p.indexOf('num')===0) return 'num';
  if(p.indexOf('aux')===0) return 'v';
  return p || '';
}
function vForms(w){
  const irr = IRREG_V[w];
  if(irr) return {base:w, s:irr.s, past:irr.past, pp:irr.pp, ing:irr.ing};
  let s = w, past = w+'ed', ing = w+'ing';
  if(/(s|x|ch|sh|z|o)$/.test(w)) s = w+'es';
  else if(/[^aeiou]y$/.test(w)) s = w.slice(0,-1)+'ies';
  if(/e$/.test(w)){ past = w+'d'; ing = w.slice(0,-1)+'ing'; }
  else if(/[^aeiou]y$/.test(w)){ past = w.slice(0,-1)+'ied'; }
  else if(w.length<=5 && /[aeiou][^aeiouwxy][aeiouy]$/.test(w)){
    const d = w.charAt(w.length-1);
    past = w+d+'ed'; ing = w+d+'ing';
  }
  return {base:w, s:s, past:past, pp:past, ing:ing};
}
function nForms(w){
  if(IRREG_N[w]){
    const p = IRREG_N[w];
    return {base:w, plural:p, singPoss:(w.endsWith('s')?w+"'":w+"'s"), poss:(p.endsWith('s')?p+"'":p+"'s")};
  }
  let p;
  if(/(s|x|ch|sh)$/.test(w)) p = w+'es';
  else if(/[^aeiou]y$/.test(w)) p = w.slice(0,-1)+'ies';
  else if(/fe$/.test(w)) p = w.slice(0,-2)+'ves';
  else if(/f$/.test(w)) p = w.slice(0,-1)+'ves';
  else p = w+'s';
  return {base:w, plural:p, singPoss:(w.endsWith('s')?w+"'":w+"'s"), poss:(p.endsWith('s')?p+"'":p+"'s")};
}
function aOrAn(w){
  const l = (w||'').toLowerCase();
  if(AN_EXCEPT_A.indexOf(l)>=0) return 'a';
  if(AN_EXCEPT_AN.indexOf(l)>=0) return 'an';
  return /^[aeiou]/.test(l) ? 'an' : 'a';
}
const COMP_MAP = {
  good:{c:'better',s:'best'}, well:{c:'better',s:'best'}, bad:{c:'worse',s:'worst'},
  many:{c:'more',s:'most'}, much:{c:'more',s:'most'}, little:{c:'less',s:'least'},
  old:{c:'older',s:'oldest'}, big:{c:'bigger',s:'biggest'}, tall:{c:'taller',s:'tallest'},
  happy:{c:'happier',s:'happiest'}, hot:{c:'hotter',s:'hottest'}, cold:{c:'colder',s:'coldest'},
  heavy:{c:'heavier',s:'heaviest'}, new:{c:'newer',s:'newest'}, cheap:{c:'cheaper',s:'cheapest'},
  easy:{c:'easier',s:'easiest'}, early:{c:'earlier',s:'earliest'}, late:{c:'later',s:'latest'},
  high:{c:'higher',s:'highest'}, low:{c:'lower',s:'lowest'}, long:{c:'longer',s:'longest'},
  thin:{c:'thinner',s:'thinnest'}, wide:{c:'wider',s:'widest'}, strong:{c:'stronger',s:'strongest'},
  fast:{c:'faster',s:'fastest'}, slow:{c:'slower',s:'slowest'}, rich:{c:'richer',s:'richest'},
  poor:{c:'poorer',s:'poorest'}, young:{c:'younger',s:'youngest'}, short:{c:'shorter',s:'shortest'},
  quiet:{c:'quieter',s:'quietest'}, clean:{c:'cleaner',s:'cleanest'}, dry:{c:'drier',s:'driest'},
  busy:{c:'busier',s:'busiest'}, funny:{c:'funnier',s:'funniest'}, fat:{c:'fatter',s:'fattest'}
};
const ADV_NO_LY = ['good','fast','hard','early','late','well','right','wrong','straight','high','low','far','near','soon'];

/* ---------- 未命中精选库时，按词性生成语法讲解 ---------- */
function genGramNote(w, pos){
  if(pos==='v'){
    const f = vForms(w);
    return [w+' 作动词使用时注意：① 人称 / 时态变化——第三人称单数 '+f.s+'，过去式 '+f.past+
            '，过去分词 '+f.pp+'，现在分词 '+f.ing+'；② 先判断它是及物动词（后接宾语）还是不及物动词，'+
            '及物动词后必须有宾语；③ 注意时态一致的呼应（主句过去时 → 从句过去时）。'];
  }
  if(pos==='n'){
    const f = nForms(w);
    return [w+' 作名词使用时注意：① 先判断可数与不可数——many + 可数名词复数，much + 不可数名词，'+
            'a few（可数）+ a little（不可数）；② 复数形式为 '+f.plural+'；③ 冠词 a / an / the 的选用'+
            '（第一次提到用 a/an，再次提到或特指用 the）。'];
  }
  if(pos==='adj'){
    return [w+' 作形容词使用时注意：① 既可作定语放在名词前（the '+w+' boy），也可作表语放在 be 动词后'+
            '（He is '+w+'）；② 比较级与最高级——短词加 -er / -est，长词用 more / most；'+
            '③ 注意与 -ed 形容词（感到……的）的区别。'];
  }
  if(pos==='adv'){
    return [w+' 作副词使用时注意：① 修饰动词、形容词或整个句子；② 注意句中位置——频率副词一般放在实义动词前、'+
            'be 动词之后，方式副词一般放在动词之后；③ 比较级常用 more，最高级用 the most。'];
  }
  if(pos==='prep') return [w+' 是介词，常与名词、代词或动名词构成介词短语；注意它后面接的成分，'+
                         '以及与动词构成的固定搭配（如 look '+w+' / be good '+w+'）。'];
  if(pos==='conj') return [w+' 是连词，用来连接词与词或句与句；注意它所引导的从句的语序与主谓一致，'+
                          '以及与 because / so、although / but 等关联连词的用法区别。'];
  if(pos==='pron') return [w+' 是代词，注意它在句中代替什么成分（主语、宾语、表语或所有者），'+
                           '并注意人称与数的呼应。'];
  if(pos==='num')  return [w+' 是数词，注意基数词与序数词的转换（one → first），'+
                          '以及与名词搭配时的位置（基数词 + 名词复数）。'];
  return [w+' 的用法要点：先看它在句中承担的成分（主语 / 谓语 / 宾语 / 定语 / 状语），'+
         '再记常见固定搭配，最后对照小学、初中常见考题的考法。'];
}

/* ---------- 自动生成 5 道语法测试题（按词性，覆盖不同考点） ---------- */
function genQuiz(w, pos){
  if(pos==='v'){
    const f = vForms(w);
    return [
      'Tom ___ ('+w+') to school every day.  A. '+f.base+'  B. '+f.s+'  C. '+f.past+'  D. '+f.ing+'　　答案：B',
      'They ___ ('+w+') the meeting yesterday.  A. '+f.base+'  B. '+f.s+'  C. '+f.past+'  D. '+f.ing+'　　答案：C',
      'Tom is ___ ('+w+') on the playground now.  A. '+f.base+'  B. '+f.s+'  C. '+f.past+'  D. '+f.ing+'　　答案：D',
      '— Does Tom ___ ('+w+') every day?  — Yes, he does.  A. '+f.base+'  B. '+f.s+'  C. '+f.past+'  D. '+f.ing+'　　答案：A',
      'You should ___ ('+w+') more carefully.  A. '+f.base+'  B. '+f.s+'  C. '+f.past+'  D. '+f.ing+'　　答案：A'
    ];
  }
  if(pos==='n'){
    const f = nForms(w), an = aOrAn(w);
    return [
      'I bought two ___ ('+w+') in the shop yesterday.  A. '+f.base+'  B. '+f.plural+'  C. '+f.base+'s  D. '+f.base+'ing　　答案：B',
      'There is only one ___ ('+w+') in the picture.  A. '+f.base+'  B. '+f.plural+'  C. '+f.base+'ing  D. '+f.base+'es　　答案：A',
      'She bought '+an+' ___ ('+w+') yesterday.  A. a  B. an  C. the  D. /　　答案：'+(an==='a'?'A':'B'),
      "This is Tom's ___ ("+w+').  A. '+f.base+'  B. '+f.plural+'  C. '+f.singPoss+'  D. '+f.poss+'　　答案：A',
      'This kind of ___ ('+w+') is very popular.  A. '+f.base+'  B. '+f.plural+'  C. '+f.base+'ing  D. '+f.base+'es　　答案：A'
    ];
  }
  if(pos==='adj'){
    const q = [
      'She looks ___ ('+w+') today.  A. '+w+'  B. '+w+'r  C. '+w+'ed  D. '+w+'ing　　答案：A',
      'The ___ ('+w+') boy is my brother.  A. '+w+'  B. '+w+'ly  C. '+w+'ed  D. '+w+'est　　答案：A',
      'He ran very ___ ('+w+') to catch the bus.  A. '+w+'  B. '+(ADV_NO_LY.indexOf(w)>=0?w:w+'ly')+'  C. '+w+'ed  D. '+w+'est　　答案：B'
    ];
    if(COMP_MAP[w]){
      q.push('This one is ___ ('+w+') than that one.  A. '+w+'  B. '+COMP_MAP[w].c+'  C. '+COMP_MAP[w].s+'  D. more '+w+'　　答案：B');
      q.push('This is the ___ ('+w+') film I have ever seen.  A. '+w+'  B. '+COMP_MAP[w].c+'  C. '+COMP_MAP[w].s+'  D. more '+w+'　　答案：C');
    }else{
      q.push('— How do you feel?  — I feel ___ ('+w+').  A. '+w+'  B. '+w+'ly  C. '+w+'est  D. '+w+'er　　答案：A');
      q.push('It is very ___ ('+w+') today.  A. '+w+'  B. '+w+'ly  C. '+w+'est  D. '+w+'er　　答案：A');
    }
    return q;
  }
  if(pos==='adv'){
    return [
      'He spoke ___ ('+w+') to his teacher.  A. '+w+'  B. '+w+'ly  C. '+w+'est  D. '+w+'er　　答案：A',
      'The music sounds ___ ('+w+').  A. '+w+'  B. '+w+'ly  C. '+w+'est  D. '+w+'er　　答案：A',
      'She runs more ___ ('+w+') than her brother.  A. '+w+'  B. '+w+'ly  C. '+w+'est  D. '+w+'er　　答案：A',
      'It is ___ ('+w+') to meet you again.  A. '+w+'  B. '+w+'ly  C. '+w+'est  D. '+w+'er　　答案：A',
      'He finished the work ___ ('+w+') than we expected.  A. '+w+'  B. '+w+'ly  C. '+w+'est  D. '+w+'er　　答案：A'
    ];
  }
  return [
    '用 '+w+' 的适当形式填空：He is good at ___ ('+w+') English.  A. '+w+'  B. '+w+'ing  C. '+w+'ed  D. '+w+'s　　答案：B',
    '用 '+w+' 的适当形式填空：They ___ ('+w+') the game last Sunday.  A. '+w+'  B. '+w+'s  C. '+w+'ed  D. '+w+'ing　　答案：C',
    '用 '+w+' 的适当形式填空：I want ___ ('+w+') the teacher a question.  A. '+w+'  B. '+w+'ing  C. '+w+'ed  D. '+w+'s　　答案：A',
    '用 '+w+' 的适当形式填空：The teacher asked us ___ ('+w+') carefully.  A. '+w+'  B. '+w+'s  C. '+w+'ed  D. '+w+'ing　　答案：C',
    '选出与 '+w+' 搭配正确的用法（考查词性与句型）。  A. ①　B. ②　C. ③　D. ④　　答案：A'
  ];
}

/* ---------- 解析 "英文 中文" 形式的搭配串 ---------- */
function splitCollo(s){
  if(!s) return {en:'', zh:''};
  const m = /^([\x21-\x7E'’\-\.,\(\)]*?)\s+([\u3400-\u9fff\u3000-\u303f\uff00-\uffef].*)$/.exec(s);
  if(m) return {en:m[1].trim(), zh:m[2].trim()};
  return {en:s.trim(), zh:''};
}

/* ---------- 离线素材汇总（不依赖网络） ---------- */
function offlinePayload(word){
  const w = (word||'').toLowerCase().trim();
  if(!w) return null;
  const pos = lexPosOf(w);
  /* 常见搭配（1~3 条） */
  const co = [];
  const lk = (typeof LINK_DATA!=='undefined') ? LINK_DATA[w] : null;
  if(lk && lk[0]) co.push(splitCollo(lk[0]));
  const ce = (typeof COLLO_EXTRA!=='undefined') ? (COLLO_EXTRA[w]||[]) : [];
  ce.forEach(s=>co.push(splitCollo(s)));
  /* 配套例句（1~5 条） */
  const ex = [];
  if(lk && lk[1]) ex.push({en:lk[1], zh:''});
  const xe = (typeof EX_EXTRA!=='undefined') ? (EX_EXTRA[w]||[]) : [];
  xe.forEach(s=>ex.push({en:s, zh:''}));
  /* 重点语法：精选库 → 旧联动库 → 按词性生成 */
  let gram = [];
  const gn = (typeof GRAM_NOTES!=='undefined') ? (GRAM_NOTES[w]||null) : null;
  const gd = (typeof GRAM_DATA!=='undefined') ? (GRAM_DATA[w]||null) : null;
  if(gn && gn.length) gram = gn.slice(0,2);
  else if(gd && gd[0]) gram = [gd[0]];
  else gram = genGramNote(w, pos);
  /* 语法测试：精选 5 题 → 精选 1 题 + 自动补足 → 全部自动生成 */
  let quiz = [];
  const gq = (typeof GRAM_QUIZ!=='undefined') ? (GRAM_QUIZ[w]||null) : null;
  if(gq && gq.length) quiz = gq.slice(0,5);
  else{
    const auto = genQuiz(w, pos);
    if(gd && gd[1]) quiz = [gd[1]].concat(auto.slice(1,5));
    else quiz = auto.slice(0,5);
  }
  return {word:w, pos:pos, collo:co.slice(0,3), ex:ex.slice(0,5), gram:gram.slice(0,2), test:quiz.slice(0,5)};
}

/* ---------- 联网权威词典（dictionaryapi.dev，开放 CORS） ---------- */
const LEX_CACHE_KEY = 'wb-lex-cache';
function lexCacheGet(){
  try{ return JSON.parse(localStorage.getItem(LEX_CACHE_KEY)||'{}'); }catch(e){ return {}; }
}
function lexCacheSet(w, data){
  try{
    const c = lexCacheGet();
    c[w] = {t:Date.now(), d:data};
    const ks = Object.keys(c);
    if(ks.length>500){
      ks.sort((a,b)=>c[a].t-c[b].t);
      ks.slice(0, ks.length-500).forEach(k=>{ delete c[k]; });
    }
    localStorage.setItem(LEX_CACHE_KEY, JSON.stringify(c));
  }catch(e){}
}
async function dictOnline(word){
  const w = (word||'').toLowerCase().trim();
  if(!w || !/^[a-z][a-z'-]*$/.test(w)) return null;
  const c = lexCacheGet();
  if(c[w] && (Date.now()-c[w].t < 30*24*3600*1000)) return c[w].d;
  try{
    const ctrl = new AbortController();
    const timer = setTimeout(()=>ctrl.abort(), 9000);
    const r = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/'+encodeURIComponent(w), {signal:ctrl.signal});
    clearTimeout(timer);
    if(!r.ok) return null;
    const j = await r.json();
    if(!Array.isArray(j) || !j.length) return null;
    const entry = j[0] || {};
    const defs = [];
    (entry.meanings||[]).forEach(m=>{
      (m.definitions||[]).forEach(d=>{
        if(d.definition) defs.push({pos:m.partOfSpeech||'', def:d.definition, ex:d.example||''});
      });
    });
    const examples = [];
    defs.forEach(d=>{ if(d.ex && examples.indexOf(d.ex)<0) examples.push(d.ex); });
    const out = {
      ipa:(entry.phonetic || ((entry.phonetics||[])[0] && entry.phonetics[0].text) || ''),
      defs:defs.slice(0,8),
      examples:examples.slice(0,12)
    };
    lexCacheSet(w, out);
    return out;
  }catch(e){ return null; }
}

/* ---------- AI 生成（OpenAI 兼容接口） ---------- */
async function aiPayload(word, level){
  const llm = getLLM();
  if(!llm.base || !llm.key) return null;
  const lvName = level==='wy' ? '初中（外研版）' : '小学（人教PEP）';
  const prompt = '你是'+lvName+'英语教研助手。针对单词 "'+word+'"，请严格只返回 JSON（不要代码块标记、不要多余文字）：'
    + '{"collo":["常见搭配1（英文 中文）","常见搭配2","常见搭配3"],'
    + '"gram":["语法讲解1","语法讲解2"],'
    + '"examples":[{"en":"英文例句","zh":"中文译文"}],'
    + '"quiz":["测试题1（含 A/B/C/D 与答案）","2","3","4","5"]}。'
    + '要求：常见搭配 1~3 条；语法讲解针对小学/初中常见考点；例句 1~5 条并附中文译文；'
    + '语法测试恰好 5 道单项选择题，每题给出答案。';
  try{
    const r = await fetch(llm.base.replace(/\/$/,'')+'/chat/completions', {
      method:'POST',
      headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+llm.key},
      body:JSON.stringify({model:llm.model, messages:[{role:'user', content:prompt}], temperature:0.3, response_format:{type:'json_object'}})
    });
    if(!r.ok) throw new Error('HTTP '+r.status);
    const j = await r.json();
    const c = String(j.choices[0].message.content).replace(/```json|```/g,'').trim();
    const o = JSON.parse(c);
    return {
      word:word, pos:'',
      collo:(o.collo||[]).slice(0,3).map(splitCollo),
      gram:(o.gram||[]).slice(0,2),
      ex:(o.examples||[]).slice(0,5).map(x=>typeof x==='string'?{en:x,zh:''}:{en:x.en||'', zh:x.zh||''}),
      test:(o.quiz||[]).slice(0,5)
    };
  }catch(e){ return null; }
}

/* ---------- 写入：只增不覆盖，全部就地更新 DOM（绝不调用 renderMain） ---------- */
const LK_KINDS = [
  {key:'collo', tag:'co', html:c=>'<span class="lk-en">'+esc(c.en)+'</span>'+(c.zh?' <span class="lk-zh">'+esc(c.zh)+'</span>':'')},
  {key:'gram',  tag:'g',  html:g=>'<span class="lk-tag">语法</span>'+esc(g)},
  {key:'ex',    tag:'ex', html:e=>'<span class="lk-en">'+esc(e.en)+'</span>'+(e.zh?' <span class="lk-zh">'+esc(e.zh)+'</span>':'')},
  {key:'test',  tag:'t',  html:(q,i)=>'<span class="lk-num">'+(i+1)+'.</span>'+esc(q)}
];
function modEl(key){ return modulesEl.querySelector('.mod-edit[data-key="'+key+'"]'); }
function lkMark(word, tag, i){ return word+'|'+tag+(i===0 ? '' : String(i+1)); }
function wordHasBlock(key, word){
  const el = modEl(key);
  if(!el) return false;
  return !!el.querySelector('[data-lk^="'+word+'|"]');
}
function wordBlockCount(key, word){
  const el = modEl(key);
  if(!el) return 0;
  return el.querySelectorAll('[data-lk^="'+word+'|"]').length;
}
/* 追加某词在某栏的内容；startIdx 用于接续已有序号 */
function appendLKSections(word, kind, items, startIdx){
  if(!items || !items.length) return 0;
  const el = modEl(kind.key);
  if(!el) return 0;
  const html = items.map((it,i)=>{
    const mark = lkMark(word, kind.tag, startIdx+i);
    return '<p data-lk="'+mark+'">'+kind.html(it, startIdx+i)+'</p>';
  }).join('');
  el.insertAdjacentHTML('beforeend', html);
  return items.length;
}
function persistModules(){
  const n = cur();
  if(!n) return;
  ['collo','gram','ex','test'].forEach(k=>{
    const el = modEl(k);
    if(el) n.modules[k] = el.innerHTML;
  });
  save();
}
/* 把联网词典抓到的例句补进「配套例句」栏（已存在的跳过，补到上限为止） */
function applyOnlineExamples(word, examples, maxN){
  maxN = maxN || 5;
  const w = String(word||'').toLowerCase();
  const el = modEl('ex');
  if(!el || !w || !examples || !examples.length) return 0;
  const have = [];
  el.querySelectorAll('[data-lk^="'+w+'|ex"]').forEach(x=>have.push(x.textContent.trim().toLowerCase()));
  const used = el.querySelectorAll('[data-lk^="'+w+'|ex"]').length;
  let room = maxN - used;
  if(room <= 0) return 0;
  const fresh = [];
  for(const s of examples){
    const t = String(s||'').trim().replace(/\s+/g,' ');
    if(!t) continue;
    const k = t.toLowerCase();
    if(have.indexOf(k) >= 0 || fresh.some(f=>f.toLowerCase() === k)) continue;
    fresh.push(t);
  }
  const pick = fresh.slice(0, room);
  if(!pick.length) return 0;
  return appendExtra(w, 'ex', pick.map(s=>({en:s, zh:''})), maxN);
}
/* 逐条按标记去重后投递（已存在同标记 → 跳过，绝不重复也不覆盖） */
function deliverPayload(p, force){
  if(!p) return {collo:0, gram:0, ex:0, test:0};
  const w = p.word;
  const cnt = {collo:0, gram:0, ex:0, test:0};
  LK_KINDS.forEach(kind=>{
    const items = p[kind.key] || [];
    if(!items.length) return;
    const el = modEl(kind.key);
    if(!el) return;
    if(force){
      el.querySelectorAll('[data-lk^="'+w+'|"]').forEach(x=>x.remove());
    }
    /* 找出该词在该栏已用掉的序号，逐条补缺 */
    const used = {};
    el.querySelectorAll('[data-lk^="'+w+'|"]').forEach(x=>{
      const mk = x.getAttribute('data-lk') || '';
      const suffix = mk.slice((w+'|').length);
      const tagLen = kind.tag.length;
      const numPart = suffix.slice(tagLen);
      used[numPart] = true;
    });
    let next = 0;
    items.forEach(it=>{
      while(used[String(next)]) next++;
      const mark = lkMark(w, kind.tag, next);
      if(el.querySelector('[data-lk="'+mark+'"]')) return;
      el.insertAdjacentHTML('beforeend', '<p data-lk="'+mark+'">'+kind.html(it, next)+'</p>');
      used[String(next)] = true;
      cnt[kind.key]++;
    });
  });
  persistModules();
  return cnt;
}
/* 追加式补充（例句不足 5 条时补齐，不动已有内容） */
function appendExtra(word, kindKey, items, maxN){
  if(!items || !items.length) return 0;
  const kind = LK_KINDS.filter(k=>k.key===kindKey)[0];
  if(!kind) return 0;
  const cur_n = wordBlockCount(kindKey, word);
  if(cur_n >= maxN) return 0;
  const add = items.slice(0, maxN-cur_n);
  const n = appendLKSections(word, kind, add, cur_n);
  if(n) persistModules();
  return n;
}

/* ---------- 主流程 ---------- */
const smartBusy = {};
async function smartFillWord(word, opts){
  opts = opts || {};
  const w = (word||'').toLowerCase().trim();
  if(!w) return null;
  const noteId = activeId;
  const p = offlinePayload(w);
  if(!p) return null;
  /* 1) 离线精选库：立即投递（不联网，秒回） */
  let cnt = deliverPayload(p, !!opts.force);
  /* 2) 联网权威词典：补充例句（最多 5 条） */
  if(opts.online !== false){
    const od = await dictOnline(w);
    if(activeId !== noteId) return null;              /* 已切便签 → 放弃写入 */
    if(od && od.examples) cnt.ex += applyOnlineExamples(w, od.examples, 5);
  }
  /* 3) AI：覆盖为权威讲解（仅在显式要求时启用） */
  if(opts.ai && getLLM().base){
    const ap = await aiPayload(w, opts.level || LEVEL);
    if(activeId !== noteId) return null;
    if(ap){
      const c2 = deliverPayload(ap, true);
      cnt = {collo:c2.collo, gram:c2.gram, ex:c2.ex, test:c2.test};
    }
  }
  return {word:w, counts:cnt};
}
/* 批量：把「重点词汇」栏里的所有词查一遍 */
async function smartFillAll(opts){
  opts = opts || {};
  if(!modEl('words')){ toast('未找到重点词汇模块'); return; }
  const words = collectModuleWords('words');
  if(!words.length){ toast('重点词汇栏里还没有单词'); return; }
  toast('🔍 正在查 '+words.length+' 个单词…');
  const c = {collo:0, gram:0, ex:0, test:0};
  for(const w of words){
    const r = await smartFillWord(w, opts);
    if(r && r.counts) for(const k in c) c[k] += (r.counts[k]||0);
  }
  const parts = [];
  if(c.collo) parts.push(c.collo+' 条搭配');
  if(c.gram)  parts.push(c.gram+' 条语法');
  if(c.ex)    parts.push(c.ex+' 条例句');
  if(c.test)  parts.push(c.test+' 道测试');
  toast(parts.length ? ('查词完成：'+parts.join('，')) : '这些单词的资料已经都在板书里了');
}
/* 单个词 */
async function smartFillOne(word, opts){
  opts = opts || {};
  const r = await smartFillWord(word, opts);
  if(!r){ toast('未能查到「'+(word||'')+'」的资料'); return; }
  const c = r.counts || {};
  const parts = [];
  if(c.collo) parts.push(c.collo+' 条搭配');
  if(c.gram)  parts.push(c.gram+' 条语法');
  if(c.ex)    parts.push(c.ex+' 条例句');
  if(c.test)  parts.push(c.test+' 道测试');
  toast(parts.length ? ('已补齐「'+word+'」：'+parts.join('，')) : '「'+word+'」的资料已经在板书里了');
}

