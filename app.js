const IMG = {
  "hero": "assets/hero.jpg",
  "banarasi": "assets/banarasi.jpg",
  "kanjivaram": "assets/kanjivaram.jpg",
  "jamdani": "assets/jamdani.jpg",
  "ikat": "assets/ikat.jpg",
  "khadi": "assets/khadi.jpg",
  "shawl": "assets/shawl.jpg",
  "throwb": "assets/throwb.jpg"
};
const CATEGORIES = [
  {id:"sarees",label:"Sarees",blurb:"Six yards of heritage",image:IMG.banarasi},
  {id:"dupattas",label:"Dupattas",blurb:"Featherlight drapes",image:IMG.jamdani},
  {id:"stoles",label:"Stoles & Shawls",blurb:"Warmth, handspun",image:IMG.shawl},
  {id:"fabric",label:"Fabric by the Metre",blurb:"Make it your own",image:IMG.khadi},
  {id:"home",label:"Handloom Home",blurb:"Woven for living",image:IMG.throwb}
];
const PRODUCTS = [{"id":"1","slug":"banarasi-silk-saree-emerald","name":"Emerald Banarasi Silk Saree","weave":"Banarasi Katan","category":"sarees","price":28500,"compareAt":34000,"rating":4.9,"reviews":128,"colors":["Forest","Gold"],"origin":"Varanasi, Uttar Pradesh","fabric":"Pure mulberry silk with real zari","images":[IMG.banarasi,IMG.hero,IMG.kanjivaram],"badge":"Bestseller","description":"Woven on a pit loom over eleven weeks, this katan silk saree carries a hand-drawn kadhwa border in genuine gold zari. Each motif is individually woven, never cut — the mark of an authentic Banarasi.","details":["5.5m saree with 0.8m unstitched blouse piece","Handwoven kadhwa zari border and pallu","Dry clean only, store wrapped in muslin","GI-tagged Banaras handloom certificate included"]},{"id":"2","slug":"kanjivaram-silk-saree-terracotta","name":"Terracotta Kanjivaram Saree","weave":"Kanjivaram","category":"sarees","price":32400,"rating":4.8,"reviews":96,"colors":["Terracotta","Gold"],"origin":"Kanchipuram, Tamil Nadu","fabric":"Korvai silk with contrast gold border","images":[IMG.kanjivaram,IMG.banarasi,IMG.hero],"badge":"New","description":"A korvai Kanjivaram where body and border are woven separately and interlocked by three weavers working in rhythm. The temple border is drawn from Chola-era stonework.","details":["Three-shuttle korvai construction","Half-fine gold zari, 6.3m with blouse","Naturally lustrous, gains sheen with age","Handloom mark authenticated"]},{"id":"3","slug":"jamdani-cotton-dupatta-ivory","name":"Ivory Jamdani Cotton Dupatta","weave":"Jamdani","category":"dupattas","price":6800,"compareAt":8200,"rating":4.7,"reviews":214,"colors":["Ivory"],"origin":"Nadia, West Bengal","fabric":"100-count handspun cotton","images":[IMG.jamdani,IMG.khadi,IMG.hero],"description":"Jamdani motifs are woven from memory — no graph, no jacquard. Two weavers work a single loom, lifting warp threads by hand to float each flower into place.","details":["2.5m x 1m, feather-soft finish","Discontinuous supplementary weft motifs","Hand wash cold, dry in shade","Free of synthetic dyes"]},{"id":"4","slug":"ikat-cotton-stole-indigo","name":"Indigo Ikat Cotton Stole","weave":"Pochampally Ikat","category":"stoles","price":3200,"rating":4.6,"reviews":341,"colors":["Indigo","Ivory"],"origin":"Bhoodan Pochampally, Telangana","fabric":"Handspun cotton, natural indigo","images":[IMG.ikat,IMG.jamdani,IMG.khadi],"badge":"Bestseller","description":"Yarn is tie-dyed before it ever meets the loom, which is why ikat edges feather softly. This stole uses a single-ikat weft in fermented natural indigo.","details":["2.2m x 0.7m with hand-knotted tassels","Resist-dyed yarn, vat indigo","Colour deepens with washing","Made by a 14-weaver cooperative"]},{"id":"5","slug":"khadi-cotton-fabric-natural","name":"Undyed Khadi Cotton Fabric","weave":"Khadi","category":"fabric","price":1450,"rating":4.5,"reviews":189,"colors":["Natural"],"origin":"Kutch, Gujarat","fabric":"Hand-spun, hand-woven cotton","images":[IMG.khadi,IMG.jamdani,IMG.hero],"description":"Spun on a charkha and woven by hand, khadi breathes like nothing else. Sold by the metre in its undyed state so you can dye, print, or leave it be.","details":["Priced per metre, 44in width","Pre-shrunk and softened","Slight slub texture is inherent","Certified Khadi India mark"]},{"id":"6","slug":"pashmina-wool-shawl-terracotta","name":"Terracotta Handwoven Wool Shawl","weave":"Kani Pashmina","category":"stoles","price":18900,"compareAt":22500,"rating":4.9,"reviews":74,"colors":["Terracotta"],"origin":"Srinagar, Kashmir","fabric":"Fine pashmina wool with zari edge","images":[IMG.shawl,IMG.kanjivaram,IMG.hero],"description":"Hand-spun pashmina from the Changthangi goat, woven on a wooden handloom and finished with a whisper of gold thread along the selvedge.","details":["2m x 1m, 14-micron fibre","Ring-pass soft, exceptionally light","Dry clean only","GI-tagged Kashmir pashmina"]},{"id":"7","slug":"block-print-cotton-throw-forest","name":"Forest Block-Print Cotton Throw","weave":"Handblock Bagru","category":"home","price":4900,"rating":4.7,"reviews":158,"colors":["Forest","Ivory"],"origin":"Bagru, Rajasthan","fabric":"Handloom cotton, natural dyes","images":[IMG.throwb,IMG.khadi,IMG.hero],"description":"Hand-carved teak blocks stamp each repeat, one press at a time, onto handloom cotton dyed with madder and indigo. Small irregularities are the signature.","details":["1.4m x 2.1m fringed throw","Natural dyes, Bagru mud-resist process","Machine wash cold, gentle cycle","Reversible weave"]},{"id":"8","slug":"jamdani-cotton-saree-dawn","name":"Dawn Jamdani Cotton Saree","weave":"Jamdani","category":"sarees","price":9600,"rating":4.6,"reviews":112,"colors":["Ivory","Gold"],"origin":"Shantipur, West Bengal","fabric":"Fine cotton with silk zari butis","images":[IMG.jamdani,IMG.banarasi,IMG.khadi],"description":"A daily-wear jamdani in a barely-there ivory, scattered with gold butis. Light enough for summer, formal enough for the evening.","details":["5.5m with running blouse piece","Hand-woven butis across the body","Hand wash separately first three washes","Woven by a women-led weaving unit"]}];
const fmt = v => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(v);
const esc = s => String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const byId = id => PRODUCTS.find(p=>p.id===id);
const bySlug = s => PRODUCTS.find(p=>p.slug===s);

/* ---------- store ---------- */
const KEY="vaayan-store-v1";
let S = {cart:[],wishlist:[],orders:[],user:null};
try{ Object.assign(S, JSON.parse(localStorage.getItem(KEY)||"{}")); }catch(e){}
const save = ()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
const cartCount = ()=>S.cart.reduce((n,l)=>n+l.qty,0);
const cartLines = ()=>S.cart.map(l=>({p:byId(l.productId),qty:l.qty})).filter(l=>l.p);
const subtotal = ()=>cartLines().reduce((s,l)=>s+l.p.price*l.qty,0);
function addToCart(id,qty=1){const e=S.cart.find(l=>l.productId===id); e?e.qty+=qty:S.cart.push({productId:id,qty}); save(); sync(); openDrawer(); toast("Added to your bag");}
function setQty(id,qty){ if(qty<=0) S.cart=S.cart.filter(l=>l.productId!==id); else {const e=S.cart.find(l=>l.productId===id); if(e)e.qty=qty;} save(); sync(); render(); }
function toggleWish(id){const has=S.wishlist.includes(id); S.wishlist=has?S.wishlist.filter(x=>x!==id):[...S.wishlist,id]; save(); sync(); render(); toast(has?"Removed from wishlist":"Saved to wishlist");}
function placeOrder(address){const o={id:"HL-"+Math.floor(100000+Math.random()*899999),placedAt:new Date().toISOString(),status:"Processing",total:subtotal(),lines:S.cart.slice(),address}; S.orders.unshift(o); S.cart=[]; save(); sync(); return o;}

/* ---------- chrome ---------- */
const $ = s=>document.querySelector(s);
let toastT;
function toast(msg){const t=$("#toast"); t.textContent=msg; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),2200);}
function sync(){
  const c=cartCount(), w=S.wishlist.length;
  $("#cartCount").hidden=!c; $("#cartCount").textContent=c;
  $("#wishCount").hidden=!w; $("#wishCount").textContent=w;
  renderDrawer();
}
function openDrawer(){$("#drawer").classList.add("on");if($("#scrim"))$("#scrim").classList.add("on");$("#drawer").setAttribute("aria-hidden","false");}
function closeAll(){document.querySelectorAll(".drawer,.scrim,.modal,.mobilenav,.filters").forEach(e=>e.classList.remove("on","open"));$("#drawer").setAttribute("aria-hidden","true");$("#menuBtn").setAttribute("aria-expanded","false");}
$("#cartBtn").onclick=openDrawer; $("#closeDrawer").onclick=closeAll; if($("#scrim"))$("#scrim").onclick=closeAll;
$("#searchBtn").onclick=()=>{$("#searchModal").classList.add("on");if($("#scrim"))$("#scrim").classList.add("on");$("#searchInput").focus();searchRender("");};
$("#closeSearch").onclick=closeAll;
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeAll();});
$("#menuBtn").onclick=()=>{const m=$("#mobilenav");m.classList.add("open");if($("#scrim"))$("#scrim").classList.add("on");$("#menuBtn").setAttribute("aria-expanded","true");};
$("#mobilenav").innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem"><p class="brand" style="margin:0;font-size:1.6rem">Vaayan</p><button class="iconbtn" id="closeMobileNav" aria-label="Close menu">✕</button></div>`+[...document.querySelectorAll("#navlinks a")].map(a=>`<a href="${a.getAttribute("href")}">${a.textContent}</a>`).join("")+`<a href="#/wishlist">Wishlist</a><a href="#/auth">Sign in</a>`;
$("#mobilenav").onclick=e=>{if(e.target.tagName==="A")closeAll();};
$("#closeMobileNav").onclick=closeAll;
$("#footerCats").innerHTML=CATEGORIES.map(c=>`<li><a href="#/shop?category=${c.id}">${c.label}</a></li>`).join("");
$("#yr").textContent=new Date().getFullYear();
$("#searchInput").addEventListener("input",e=>searchRender(e.target.value));
function searchRender(q){
  const t=q.trim().toLowerCase();
  const res=(t?PRODUCTS.filter(p=>(p.name+p.weave+p.origin+p.fabric).toLowerCase().includes(t)):PRODUCTS.slice(0,5));
  $("#searchResults").innerHTML = res.length? res.map(p=>`<a href="#/product/${p.slug}" class="line" style="border:0;padding:.6rem;border-radius:1rem" onclick="closeAll()"><img src="${p.images[0]}" alt="${esc(p.name)}" style="width:3.2rem"><span style="flex:1"><b class="serif" style="font-size:1.05rem;display:block">${esc(p.name)}</b><span class="muted" style="font-size:.78rem">${esc(p.weave)} · ${esc(p.origin)}</span></span><span class="price">${fmt(p.price)}</span></a>`).join("")
    : `<p class="muted" style="padding:1.5rem;text-align:center;font-size:.875rem">No weaves match “${esc(q)}”.</p>`;
}
function renderDrawer(){
  const lines=cartLines();
  $("#drawerBody").innerHTML = lines.length? lines.map(l=>`
    <div class="line">
      <img src="${l.p.images[0]}" alt="${esc(l.p.name)}">
      <div style="flex:1">
        <a href="#/product/${l.p.slug}" class="serif" style="font-size:1.05rem" onclick="closeAll()">${esc(l.p.name)}</a>
        <p class="muted" style="font-size:.75rem">${esc(l.p.weave)}</p>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:.5rem">
          <span class="qty"><button onclick="setQty('${l.p.id}',${l.qty-1})" aria-label="Decrease">−</button><span>${l.qty}</span><button onclick="setQty('${l.p.id}',${l.qty+1})" aria-label="Increase">+</button></span>
          <span class="price">${fmt(l.p.price*l.qty)}</span>
        </div>
      </div>
    </div>`).join("")
    : `<div class="empty" style="padding:2.5rem 1rem"><p class="serif" style="font-size:1.35rem">Your bag is empty</p><p class="muted" style="font-size:.85rem;margin-top:.4rem">Start with a bestselling weave.</p><a class="btn btn-primary" style="margin-top:1rem" href="#/shop" onclick="closeAll()">Browse the collection</a></div>`;
  $("#drawerFoot").innerHTML = lines.length? `
    <div style="display:flex;justify-content:space-between;font-size:.9rem"><span class="muted">Subtotal</span><b>${fmt(subtotal())}</b></div>
    <p class="muted" style="font-size:.75rem;margin-top:.25rem">Taxes and insured shipping calculated at checkout.</p>
    <a class="btn btn-primary btn-lg" style="width:100%;margin-top:.9rem" href="#/checkout" onclick="closeAll()">Checkout</a>
    <a class="btn btn-ghost" style="width:100%;margin-top:.4rem" href="#/cart" onclick="closeAll()">View full bag</a>` : "";
}

/* ---------- product card ---------- */
function card(p){
  const on=S.wishlist.includes(p.id);
  return `<article class="pcard fade">
    <div class="pmedia">
      <a href="#/product/${p.slug}"><img loading="lazy" src="${p.images[0]}" alt="${esc(p.name)} — ${esc(p.weave)} handloom from ${esc(p.origin)}"></a>
      ${p.badge?`<span class="badge pbadge">${esc(p.badge)}</span>`:""}
      <button class="heart ${on?"on":""}" onclick="toggleWish('${p.id}')" aria-label="${on?"Remove from":"Add to"} wishlist" aria-pressed="${on}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20s-7-4.5-7-9.5A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.5C19 15.5 12 20 12 20Z"/></svg>
      </button>
      <div class="pquick"><button class="btn btn-sm" onclick="addToCart('${p.id}')">Add to bag</button></div>
    </div>
    <div class="pinfo">
      <p class="eyebrow muted" style="font-size:.62rem">${esc(p.weave)}</p>
      <a href="#/product/${p.slug}"><h3 class="pname" style="margin-top:.3rem">${esc(p.name)}</h3></a>
      <p style="margin-top:.4rem"><span class="price">${fmt(p.price)}</span>${p.compareAt?`<span class="strike">${fmt(p.compareAt)}</span>`:""}</p>
      <p class="muted" style="font-size:.75rem;margin-top:.2rem">★ ${p.rating} · ${p.reviews} reviews</p>
    </div>
  </article>`;
}
const skeletons = n => `<div class="grid-p">${Array.from({length:n}).map(()=>`<div><div class="skel" style="aspect-ratio:3/4;border-radius:1.25rem"></div><div class="skel" style="height:.8rem;width:40%;margin-top:.9rem"></div><div class="skel" style="height:1rem;width:80%;margin-top:.5rem"></div><div class="skel" style="height:.9rem;width:35%;margin-top:.5rem"></div></div>`).join("")}</div>`;

/* ---------- router ---------- */
function parse(){
  const h=location.hash.replace(/^#/,"")||"/";
  const [path,qs]=h.split("?");
  return {path, q:Object.fromEntries(new URLSearchParams(qs||""))};
}
const PAGES = {};
function render(){
  const {path,q}=parse();
  const seg=path.split("/").filter(Boolean);
  let html;
  if(!seg.length) html=PAGES.home();
  else if(seg[0]==="shop") html=PAGES.shop(q);
  else if(seg[0]==="product") html=PAGES.product(seg[1]);
  else if(PAGES[seg[0]]) html=PAGES[seg[0]](q);
  else html=`<div class="wrap section" style="text-align:center"><h1 style="font-size:3rem">404</h1><p class="muted">That page isn't on the loom.</p><a class="btn btn-primary" style="margin-top:1.5rem" href="#/">Go home</a></div>`;
  $("#main").innerHTML=html;
  document.querySelectorAll("#navlinks a").forEach(a=>a.classList.toggle("active",a.getAttribute("href")==="#"+(path==="/"&&!location.hash.includes("?")?"/":path+(q.category?"?category="+q.category:""))));
  document.title = (PAGES._title||"Vaayan — Handloom Atelier");
}
window.addEventListener("hashchange",()=>{render();window.scrollTo({top:0,behavior:"instant"});});

/* ---------- pages ---------- */
PAGES.home = () => {
  const featured=PRODUCTS.slice(0,4);
  return `
  <section class="hero"><div class="wrap hero-grid">
    <div class="fade">
      <p class="eyebrow" style="color:var(--terracotta)">Woven to order · Since 1987</p>
      <div class="gold-rule" style="margin:1.25rem 0"></div>
      <h1>The loom<br>remembers<br><em style="font-style:italic;color:var(--terracotta)">every hand.</em></h1>
      <p class="muted" style="margin-top:1.5rem;max-width:32rem">Banarasi katan, korvai Kanjivaram, Bengal jamdani — woven on pit looms by families we have known for three generations. No power looms, no middlemen.</p>
      <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:2rem">
        <a class="btn btn-primary btn-lg" href="#/shop">Explore the collection</a>
        <a class="btn btn-outline btn-lg" href="#/shop?category=sarees">Shop sarees</a>
      </div>
    </div>
    <div class="hero-img fade">
      <img src="${IMG.hero}" alt="A weaver's hands working a traditional pit loom in India">
      <div class="hero-chip">
        <div class="stat"><b>240</b><span>Weaving families</span></div>
        <div class="stat"><b>9</b><span>Clusters</span></div>
        <div class="stat"><b>11 wks</b><span>Avg. weave time</span></div>
      </div>
    </div>
  </div></section>

  <section class="wrap section" aria-labelledby="cath">
    <div class="sechead"><div><p class="eyebrow" style="color:var(--terracotta)">Browse</p><h2 id="cath" style="margin-top:.6rem">Shop by craft</h2></div><a class="btn btn-ghost btn-sm" href="#/shop">View all →</a></div>
    <div class="cats">${CATEGORIES.map(c=>`<a class="cat" href="#/shop?category=${c.id}"><img loading="lazy" src="${c.image}" alt="${esc(c.label)}"><span class="ov"><b class="serif" style="font-size:1.35rem">${esc(c.label)}</b><span style="font-size:.75rem;opacity:.8">${esc(c.blurb)}</span></span></a>`).join("")}</div>
  </section>

  <section class="wrap section" style="padding-top:0" aria-labelledby="feath">
    <div class="sechead"><div><p class="eyebrow" style="color:var(--terracotta)">This season</p><h2 id="feath" style="margin-top:.6rem">Featured weaves</h2></div><a class="btn btn-ghost btn-sm" href="#/shop">All weaves →</a></div>
    <div class="grid-p">${featured.map(card).join("")}</div>
  </section>

  <section class="strip"><div class="wrap">
    ${[["Woven to order","Nothing sits in a warehouse. Your piece starts on the loom the day you order."],["Fair-wage certified","Weavers set their own rates. We publish the split on every invoice."],["GI-authenticated","Banaras, Kanchipuram and Pochampally pieces ship with their GI certificate."]].map(([t,d])=>`<div><p class="eyebrow" style="color:var(--gold)">${t}</p><p style="margin-top:.75rem;font-size:.9rem;opacity:.8">${d}</p></div>`).join("")}
  </div></section>`;
};

PAGES.shop = (q) => {
  const cat=q.category||"all", sort=q.sort||"featured", max=Number(q.max||0), term=(q.q||"").toLowerCase();
  let items=PRODUCTS.filter(p=>(cat==="all"||p.category===cat)&&(!max||p.price<=max)&&(!term||(p.name+p.weave+p.origin).toLowerCase().includes(term)));
  if(sort==="low") items=[...items].sort((a,b)=>a.price-b.price);
  if(sort==="high") items=[...items].sort((a,b)=>b.price-a.price);
  if(sort==="rating") items=[...items].sort((a,b)=>b.rating-a.rating);
  const link = o => { const n={...q,...o}; Object.keys(n).forEach(k=>{if(!n[k]||n[k]==="all")delete n[k]}); const s=new URLSearchParams(n).toString(); return "#/shop"+(s?"?"+s:""); };
  const prices=[["Under ₹5,000",5000],["Under ₹10,000",10000],["Under ₹20,000",20000],["Any price",0]];
  return `<div class="wrap section" style="padding-top:2.5rem">
    <header style="max-width:38rem"><p class="eyebrow" style="color:var(--terracotta)">The collection</p><h1 style="font-size:clamp(2.2rem,5vw,3.4rem);margin-top:.75rem">${cat==="all"?"All weaves":esc(CATEGORIES.find(c=>c.id===cat)?.label||cat)}</h1><p class="muted" style="margin-top:.9rem;font-size:.9rem">${items.length} piece${items.length===1?"":"s"} · woven to order in 3–5 weeks</p></header>
    <div class="shoplay" style="margin-top:2.5rem">
      <div class="filterbtn-wrap"><button class="btn btn-outline" style="width:100%" onclick="document.querySelector('.filters').classList.add('on');if(document.getElementById('scrim'))document.getElementById('scrim').classList.add('on');">Filters &amp; Search</button></div>
      <aside class="filters" aria-label="Filters">
        <div class="filter-head"><p class="serif" style="font-size:1.5rem;margin:0">Filters</p><button class="iconbtn" onclick="closeAll()" aria-label="Close">✕</button></div>
        <div class="fgroup"><p class="eyebrow">Category</p><div style="margin-top:.6rem">
          ${[{id:"all",label:"All weaves"},...CATEGORIES].map(c=>`<a class="fitem" href="${link({category:c.id})}" style="${cat===c.id?"color:var(--fg);font-weight:500":""}"><input type="radio" ${cat===c.id?"checked":""} readonly aria-hidden="true" tabindex="-1">${esc(c.label)}</a>`).join("")}
        </div></div>
        <div class="fgroup"><p class="eyebrow">Price</p><div style="margin-top:.6rem">
          ${prices.map(([l,v])=>`<a class="fitem" href="${link({max:v||""})}" style="${max===v?"color:var(--fg);font-weight:500":""}"><input type="radio" ${max===v?"checked":""} readonly aria-hidden="true" tabindex="-1">${l}</a>`).join("")}
        </div></div>
        <div class="fgroup"><p class="eyebrow">Search within</p>
          <form style="margin-top:.6rem" onsubmit="event.preventDefault();location.hash='${link({q:"__Q__"})}'.replace('__Q__',encodeURIComponent(this.q.value))">
            <label class="sr" for="fq">Search</label><input id="fq" name="q" class="field" placeholder="e.g. jamdani" value="${esc(q.q||"")}">
          </form>
        </div>
        <div class="fgroup"><a class="btn btn-outline btn-sm" href="#/shop">Clear all filters</a></div>
      </aside>
      <section>
        <div style="display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;justify-content:space-between;margin-bottom:1.5rem">
          <div style="display:flex;gap:.5rem;flex-wrap:wrap">
            ${cat!=="all"?`<a class="chip" href="${link({category:""})}">${esc(CATEGORIES.find(c=>c.id===cat)?.label)} ✕</a>`:""}
            ${max?`<a class="chip" href="${link({max:""})}">Under ${fmt(max)} ✕</a>`:""}
            ${q.q?`<a class="chip" href="${link({q:""})}">“${esc(q.q)}” ✕</a>`:""}
          </div>
          <label style="display:flex;align-items:center;gap:.5rem;font-size:.8rem" class="muted">Sort
            <select class="field" style="width:auto;height:2.4rem" onchange="location.hash='${link({sort:"__S__"})}'.replace('__S__',this.value)">
              ${[["featured","Featured"],["low","Price: low to high"],["high","Price: high to low"],["rating","Top rated"]].map(([v,l])=>`<option value="${v}" ${sort===v?"selected":""}>${l}</option>`).join("")}
            </select>
          </label>
        </div>
        ${items.length?`<div class="grid-p">${items.map(card).join("")}</div>`:`<div class="empty"><p class="serif" style="font-size:1.6rem">No weaves match those filters</p><p class="muted" style="margin-top:.5rem;font-size:.9rem">Try widening the price range or clearing the category.</p><a class="btn btn-primary" style="margin-top:1.25rem" href="#/shop">Reset filters</a></div>`}
      </section>
    </div>
  </div>`;
};

PAGES.product = (slug) => {
  const p=bySlug(slug);
  if(!p) return `<div class="wrap section" style="text-align:center"><h1>Weave not found</h1><a class="btn btn-primary" style="margin-top:1.5rem" href="#/shop">Back to shop</a></div>`;
  const rel=PRODUCTS.filter(x=>x.id!==p.id).sort(a=>a.category===p.category?-1:1).slice(0,4);
  const on=S.wishlist.includes(p.id);
  window.__imgs=p.images;
  return `<div class="wrap section" style="padding-top:2rem">
    <nav style="font-size:.75rem" class="muted" aria-label="Breadcrumb"><a href="#/">Home</a> / <a href="#/shop">Shop</a> / <a href="#/shop?category=${p.category}">${esc(CATEGORIES.find(c=>c.id===p.category)?.label)}</a> / <span>${esc(p.name)}</span></nav>
    <div class="pdp" style="margin-top:1.75rem">
      <div>
        <div class="zoom" id="zoom" onmousemove="zoomMove(event)" onmouseleave="zoomOut()"><img id="zoomImg" src="${p.images[0]}" alt="${esc(p.name)} — full view"></div>
        <div class="thumbs">${p.images.map((src,i)=>`<button class="${i?"":"on"}" onclick="pickImg(this,'${i}')" aria-label="View image ${i+1}"><img src="${src}" alt=""></button>`).join("")}</div>
        <p class="muted" style="font-size:.72rem;margin-top:.6rem">Hover the image to zoom into the weave.</p>
      </div>
      <div class="fade">
        ${p.badge?`<span class="badge" style="background:var(--secondary);color:var(--primary)">${esc(p.badge)}</span>`:""}
        <h1 style="font-size:clamp(2rem,4.5vw,3rem);margin-top:.6rem">${esc(p.name)}</h1>
        <p class="muted" style="margin-top:.5rem;font-size:.85rem">${esc(p.weave)} · ${esc(p.origin)}</p>
        <p style="margin-top:1rem;font-size:1.4rem" class="serif">${fmt(p.price)}${p.compareAt?`<span class="strike">${fmt(p.compareAt)}</span>`:""}</p>
        <p class="muted" style="font-size:.8rem">★ ${p.rating} · ${p.reviews} reviews · inclusive of all taxes</p>
        <div class="gold-rule" style="margin:1.5rem 0"></div>
        <p style="font-size:.925rem">${esc(p.description)}</p>
        <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-top:1.75rem;align-items:center">
          <span class="qty"><button onclick="pdpQty(-1)" aria-label="Decrease quantity">−</button><span id="pq">1</span><button onclick="pdpQty(1)" aria-label="Increase quantity">+</button></span>
          <button class="btn btn-primary btn-lg" style="flex:1;min-width:12rem" onclick="addToCart('${p.id}',Number(document.getElementById('pq').textContent))">Add to bag</button>
          <button class="btn btn-outline" onclick="toggleWish('${p.id}')" aria-pressed="${on}">${on?"♥ Saved":"♡ Wishlist"}</button>
        </div>
        <div style="margin-top:2rem">
          ${[["Weave details",`<ul style="padding-left:1.1rem;display:grid;gap:.4rem">${p.details.map(d=>`<li>${esc(d)}</li>`).join("")}</ul>`],["Fabric & origin",`${esc(p.fabric)}. Woven in ${esc(p.origin)} on a traditional handloom.`],["Care",`Store folded in muslin, away from direct sun. Refold along a different line every few months.`],["Shipping & returns",`Insured shipping free within India. 7-day return on unworn pieces with tags intact.`]].map(([t,b],i)=>`<div class="acc ${i===0?"open":""}"><h4 onclick="this.parentNode.classList.toggle('open')" tabindex="0" role="button" onkeypress="if(event.key==='Enter')this.parentNode.classList.toggle('open')">${t}<span>＋</span></h4><div class="body">${b}</div></div>`).join("")}
        </div>
      </div>
    </div>
    <section style="margin-top:5rem" aria-labelledby="relh">
      <div class="sechead"><div><p class="eyebrow" style="color:var(--terracotta)">You may also like</p><h2 id="relh" style="margin-top:.5rem;font-size:2rem">Related weaves</h2></div></div>
      <div class="grid-p">${rel.map(card).join("")}</div>
    </section>
  </div>`;
};
function pickImg(btn,i){document.querySelectorAll(".thumbs button").forEach(b=>b.classList.remove("on"));btn.classList.add("on");document.getElementById("zoomImg").src=window.__imgs[i];}
function pdpQty(d){const el=document.getElementById("pq");el.textContent=Math.max(1,Number(el.textContent)+d);}
function zoomMove(e){const z=e.currentTarget,i=z.querySelector("img"),r=z.getBoundingClientRect();i.style.transformOrigin=`${((e.clientX-r.left)/r.width)*100}% ${((e.clientY-r.top)/r.height)*100}%`;i.style.transform="scale(2)";}
function zoomOut(){const i=document.getElementById("zoomImg");if(i){i.style.transform="none";}}

PAGES.wishlist = () => {
  const items=PRODUCTS.filter(p=>S.wishlist.includes(p.id));
  return `<div class="wrap section" style="padding-top:2.5rem">
    <header style="max-width:36rem"><p class="eyebrow" style="color:var(--terracotta)">Saved for later</p><h1 style="font-size:clamp(2.2rem,5vw,3.2rem);margin-top:.75rem">Wishlist</h1><p class="muted" style="margin-top:.9rem;font-size:.9rem">Pieces you are considering. We will tell you if a weave is nearing its last run.</p></header>
    <div style="margin-top:3rem">${items.length?`<div class="grid-p">${items.map(card).join("")}</div>`:`<div class="empty"><p class="serif" style="font-size:1.6rem">Your wishlist is empty</p><p class="muted" style="margin:.5rem auto 0;max-width:24rem;font-size:.9rem">Tap the heart on any weave to keep it here while you decide.</p><a class="btn btn-primary btn-lg" style="margin-top:1.5rem" href="#/shop">Browse the collection</a></div>`}</div>
  </div>`;
};

PAGES.cart = () => {
  const lines=cartLines();
  if(!lines.length) return `<div class="wrap section"><div class="empty"><p class="serif" style="font-size:1.8rem">Your bag is empty</p><p class="muted" style="margin-top:.5rem">Every piece is woven to order — start with a bestseller.</p><a class="btn btn-primary btn-lg" style="margin-top:1.5rem" href="#/shop">Browse the collection</a></div></div>`;
  return `<div class="wrap section" style="padding-top:2.5rem">
    <h1 style="font-size:clamp(2.2rem,5vw,3.2rem)">Your bag</h1>
    <div class="two" style="margin-top:2.5rem">
      <div>${lines.map(l=>`<div class="line" style="padding:1.25rem 0">
        <img src="${l.p.images[0]}" alt="${esc(l.p.name)}" style="width:7rem">
        <div style="flex:1">
          <a href="#/product/${l.p.slug}" class="serif" style="font-size:1.25rem">${esc(l.p.name)}</a>
          <p class="muted" style="font-size:.8rem">${esc(l.p.weave)} · ${esc(l.p.origin)}</p>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:.9rem;gap:1rem;flex-wrap:wrap">
            <span class="qty"><button onclick="setQty('${l.p.id}',${l.qty-1})" aria-label="Decrease">−</button><span>${l.qty}</span><button onclick="setQty('${l.p.id}',${l.qty+1})" aria-label="Increase">+</button></span>
            <button class="btn btn-ghost btn-sm muted" onclick="setQty('${l.p.id}',0)">Remove</button>
            <b class="price">${fmt(l.p.price*l.qty)}</b>
          </div>
        </div></div>`).join("")}
      </div>
      ${summary()}
    </div>
  </div>`;
};
function summary(cta="#/checkout",label="Proceed to checkout"){
  const sub=subtotal(), ship=sub>15000||sub===0?0:450, tax=Math.round(sub*0.05);
  return `<aside class="card" style="padding:1.75rem;position:sticky;top:6.5rem">
    <p class="eyebrow" style="color:var(--terracotta)">Order summary</p>
    <div style="margin-top:1.25rem;display:grid;gap:.6rem;font-size:.9rem">
      <div style="display:flex;justify-content:space-between"><span class="muted">Subtotal</span><span>${fmt(sub)}</span></div>
      <div style="display:flex;justify-content:space-between"><span class="muted">Insured shipping</span><span>${ship?fmt(ship):"Free"}</span></div>
      <div style="display:flex;justify-content:space-between"><span class="muted">GST (5%)</span><span>${fmt(tax)}</span></div>
      <div style="border-top:1px solid var(--border);padding-top:.75rem;display:flex;justify-content:space-between;font-size:1.05rem"><b>Total</b><b>${fmt(sub+ship+tax)}</b></div>
    </div>
    ${cta?`<a class="btn btn-primary btn-lg" style="width:100%;margin-top:1.4rem" href="${cta}">${label}</a>`:""}
    <p class="muted" style="font-size:.72rem;margin-top:.85rem">Woven to order · 3–5 weeks · free returns within 7 days</p>
  </aside>`;
}

let checkoutStep=1;
PAGES.checkout = () => {
  const lines=cartLines();
  if(!lines.length) return `<div class="wrap section"><div class="empty"><p class="serif" style="font-size:1.6rem">Nothing to check out</p><a class="btn btn-primary" style="margin-top:1.25rem" href="#/shop">Browse weaves</a></div></div>`;
  const steps=["Address","Delivery","Payment"];
  return `<div class="wrap section" style="padding-top:2.5rem">
    <h1 style="font-size:clamp(2rem,4.5vw,3rem)">Checkout</h1>
    <div class="steps" style="margin-top:1rem">${steps.map((s,i)=>`${i?"<span>→</span>":""}${checkoutStep===i+1?`<b>${i+1}. ${s}</b>`:`<span>${i+1}. ${s}</span>`}`).join("")}</div>
    <div class="two" style="margin-top:2.5rem">
      <form class="card" style="padding:1.75rem" onsubmit="event.preventDefault();nextStep(this)">
        ${checkoutStep===1?`
          <p class="serif" style="font-size:1.5rem">Shipping address</p>
          <div style="display:grid;gap:1rem;margin-top:1.25rem;grid-template-columns:1fr 1fr">
            <div><label class="lbl" for="fn">Full name</label><input class="field" id="fn" name="name" required value="${esc(S.user?.name||"")}"></div>
            <div><label class="lbl" for="ph">Phone</label><input class="field" id="ph" name="phone" required inputmode="tel"></div>
            <div style="grid-column:1/-1"><label class="lbl" for="ad">Address</label><textarea class="field" id="ad" name="address" rows="3" required></textarea></div>
            <div><label class="lbl" for="ct">City</label><input class="field" id="ct" name="city" required></div>
            <div><label class="lbl" for="pc">PIN code</label><input class="field" id="pc" name="pin" required inputmode="numeric"></div>
          </div>`:""}
        ${checkoutStep===2?`
          <p class="serif" style="font-size:1.5rem">Delivery</p>
          <div style="display:grid;gap:.75rem;margin-top:1.25rem">
            ${[["Standard insured","3–5 weeks after weaving · Free"],["Priority loom slot","2–3 weeks · ₹1,200"],["Atelier pickup","Collect in Varanasi · Free"]].map(([t,d],i)=>`<label class="fitem" style="border:1px solid var(--border);border-radius:1rem;padding:.9rem 1rem;color:var(--fg)"><input type="radio" name="ship" ${i?"":"checked"}><span><b style="display:block;font-size:.95rem">${t}</b><span class="muted" style="font-size:.8rem">${d}</span></span></label>`).join("")}
          </div>`:""}
        ${checkoutStep===3?`
          <p class="serif" style="font-size:1.5rem">Payment</p>
          <div style="display:grid;gap:1rem;margin-top:1.25rem">
            <div><label class="lbl" for="cc">Card number</label><input class="field" id="cc" required inputmode="numeric" placeholder="4242 4242 4242 4242"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
              <div><label class="lbl" for="ex">Expiry</label><input class="field" id="ex" required placeholder="MM/YY"></div>
              <div><label class="lbl" for="cv">CVC</label><input class="field" id="cv" required placeholder="123"></div>
            </div>
            <p class="muted" style="font-size:.75rem">Demo checkout — no real payment is taken.</p>
          </div>`:""}
        <div style="display:flex;gap:.75rem;margin-top:1.75rem">
          ${checkoutStep>1?`<button type="button" class="btn btn-outline" onclick="checkoutStep--;render()">Back</button>`:""}
          <button class="btn btn-primary btn-lg" style="flex:1">${checkoutStep===3?"Place order":"Continue"}</button>
        </div>
      </form>
      ${summary("","")}
    </div>
  </div>`;
};
function nextStep(form){
  if(checkoutStep<3){checkoutStep++;render();return;}
  const o=placeOrder("Delivered to your saved address");
  checkoutStep=1; location.hash="#/orders"; toast("Order "+o.id+" placed");
}

const STATUSES=["Processing","Woven","Shipped","Delivered"];
PAGES.orders = () => {
  if(!S.orders.length) return `<div class="wrap section"><header style="max-width:34rem"><p class="eyebrow" style="color:var(--terracotta)">Order history</p><h1 style="font-size:clamp(2.2rem,5vw,3.2rem);margin-top:.75rem">Your orders</h1></header><div class="empty" style="margin-top:2.5rem"><p class="serif" style="font-size:1.5rem">No orders yet</p><p class="muted" style="margin-top:.5rem;font-size:.9rem">Once you place an order you can track it from the loom to your door.</p><a class="btn btn-primary btn-lg" style="margin-top:1.5rem" href="#/shop">Start shopping</a></div></div>`;
  return `<div class="wrap section" style="padding-top:2.5rem">
    <header style="max-width:34rem"><p class="eyebrow" style="color:var(--terracotta)">Order history</p><h1 style="font-size:clamp(2.2rem,5vw,3.2rem);margin-top:.75rem">Your orders</h1></header>
    <div style="margin-top:2.5rem;display:grid;gap:1.25rem">
      ${S.orders.map(o=>{const idx=STATUSES.indexOf(o.status);return `<article class="card" style="padding:1.5rem">
        <div style="display:flex;flex-wrap:wrap;gap:.75rem;justify-content:space-between;align-items:center">
          <div><p class="serif" style="font-size:1.3rem">${o.id}</p><p class="muted" style="font-size:.8rem">Placed ${new Date(o.placedAt).toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}</p></div>
          <span class="badge" style="background:var(--secondary);color:var(--primary)">${o.status}</span>
          <b>${fmt(o.total)}</b>
        </div>
        <div class="track">${STATUSES.map((s,i)=>`${i?`<span class="bar ${i<=idx?"on":""}"></span>`:""}<span class="dot ${i<=idx?"on":""}" title="${s}"></span>`).join("")}</div>
        <div class="steps" style="margin-top:.5rem">${STATUSES.map(s=>`<span style="flex:1">${s}</span>`).join("")}</div>
        <div style="display:flex;gap:.75rem;margin-top:1.25rem;flex-wrap:wrap">${o.lines.map(l=>{const p=byId(l.productId);return p?`<a href="#/product/${p.slug}" style="display:flex;gap:.6rem;align-items:center"><img src="${p.images[0]}" alt="${esc(p.name)}" style="width:3rem;aspect-ratio:3/4;object-fit:cover;border-radius:.6rem"><span style="font-size:.8rem">${esc(p.name)}<br><span class="muted">× ${l.qty}</span></span></a>`:""}).join("")}</div>
      </article>`;}).join("")}
    </div>
  </div>`;
};

PAGES.dashboard = () => {
  if(!S.user) return PAGES.auth();
  const spend=S.orders.reduce((s,o)=>s+o.total,0);
  return `<div class="wrap section" style="padding-top:2.5rem">
    <header><p class="eyebrow" style="color:var(--terracotta)">Your account</p><h1 style="font-size:clamp(2.2rem,5vw,3.2rem);margin-top:.75rem">Hello, ${esc(S.user.name.split(" ")[0])}</h1></header>
    <div style="display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));margin-top:2rem">
      ${[["Orders",S.orders.length],["Wishlist",S.wishlist.length],["In bag",cartCount()],["Lifetime",fmt(spend)]].map(([l,v])=>`<div class="card" style="padding:1.25rem"><p class="eyebrow muted">${l}</p><p class="serif" style="font-size:1.9rem;margin-top:.3rem">${v}</p></div>`).join("")}
    </div>
    <div class="two" style="margin-top:2rem">
      <form class="card" style="padding:1.75rem" onsubmit="event.preventDefault();S.user={name:this.n.value,email:this.e.value};save();render();toast('Profile updated')">
        <p class="serif" style="font-size:1.5rem">Profile</p>
        <div style="display:grid;gap:1rem;margin-top:1.25rem;grid-template-columns:1fr 1fr">
          <div><label class="lbl" for="dn">Name</label><input class="field" id="dn" name="n" value="${esc(S.user.name)}" required></div>
          <div><label class="lbl" for="de">Email</label><input class="field" id="de" name="e" type="email" value="${esc(S.user.email)}" required></div>
        </div>
        <div style="display:flex;gap:.75rem;margin-top:1.5rem"><button class="btn btn-primary">Save changes</button><button type="button" class="btn btn-outline" onclick="S.user=null;save();location.hash='#/auth'">Sign out</button></div>
      </form>
      <aside class="card" style="padding:1.75rem">
        <p class="eyebrow" style="color:var(--terracotta)">Quick links</p>
        <div style="display:grid;gap:.6rem;margin-top:1.25rem;font-size:.9rem">
          <a href="#/orders">Order history &amp; tracking →</a><a href="#/wishlist">Your wishlist →</a><a href="#/cart">Your bag →</a><a href="#/shop">Continue shopping →</a>
        </div>
      </aside>
    </div>
  </div>`;
};

let authTab="login";
PAGES.auth = () => `<div class="wrap section" style="padding-top:2.5rem">
  <div class="two" style="grid-template-columns:1fr;max-width:64rem;margin-inline:auto">
    <div class="card" style="overflow:hidden;display:grid;grid-template-columns:1fr">
      <div style="display:grid;gap:0;grid-template-columns:1fr">
        <div style="padding:2.25rem">
          <p class="eyebrow" style="color:var(--terracotta)">Vaayan account</p>
          <h1 style="font-size:2.4rem;margin-top:.6rem">${authTab==="login"?"Welcome back":"Join the atelier"}</h1>
          <div class="tabs" style="margin-top:1.5rem">
            <button class="${authTab==="login"?"on":""}" onclick="authTab='login';render()">Sign in</button>
            <button class="${authTab==="register"?"on":""}" onclick="authTab='register';render()">Register</button>
          </div>
          <form style="display:grid;gap:1rem;margin-top:1.5rem;max-width:26rem" onsubmit="event.preventDefault();S.user={name:this.n?this.n.value:'Guest Weaver',email:this.e.value};save();location.hash='#/dashboard';toast('Signed in')">
            ${authTab==="register"?`<div><label class="lbl" for="an">Full name</label><input class="field" id="an" name="n" required></div>`:""}
            <div><label class="lbl" for="ae">Email</label><input class="field" id="ae" name="e" type="email" required></div>
            <div><label class="lbl" for="ap">Password</label><input class="field" id="ap" type="password" required minlength="6"></div>
            <button class="btn btn-primary btn-lg" style="margin-top:.4rem">${authTab==="login"?"Sign in":"Create account"}</button>
            <p class="muted" style="font-size:.72rem">Demo authentication — details stay in your browser.</p>
          </form>
        </div>
      </div>
    </div>
  </div>
</div>`;

sync(); render();
