// Erzeugt eine EINZELNE, in sich geschlossene preview.html (CSS + Daten + Routing inline),
// damit man im Chat-Vorschaufenster durch alle Bücher klicken kann.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "books.json"), "utf8"));
const css = fs.readFileSync(path.join(ROOT, "src", "styles.css"), "utf8");

const html = `<!doctype html><html lang="de"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vorschau · Renate & Chris</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=Spline+Sans+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${css}</style></head><body>
<header class="mast"><div class="wrap mast-row">
  <a class="brand" href="#" onclick="showCatalog();return false">Renate&nbsp;<span>&amp;</span>&nbsp;Chris</a>
  <nav class="mast-nav"><a href="#" onclick="showCatalog();return false">Bücher</a><a href="#" onclick="showCatalog();return false">Über uns</a></nav>
</div></header>
<main class="wrap" id="app"></main>
<footer class="site wrap">
  <div class="soc"><a href="#">Instagram</a><a href="#">Facebook</a><a href="#">renateleeb.photos</a><a href="#">cleebration.com</a></div>
  <div class="cr">© ${new Date().getFullYear()} Renate &amp; Chris Leeb · renateundchris.com</div>
</footer>
<script>
const DATA = ${JSON.stringify(data)};
const {people, roleLabels, typeLabels, books} = DATA;
const bySlug = s => books.find(b=>b.slug===s);
const eur = n => "€\\u00a0"+Number(n).toFixed(2).replace(".",",");
const contribs = b => b.contributors.map(c=>people[c.person]+" · "+roleLabels[c.role]).join("  ·  ");
const state = {person:"alle", role:"alle", type:"alle"};

function coverHTML(b){
  return b.cover
    ? '<img src="'+b.cover+'" alt="'+b.title+'" loading="lazy" onerror="this.outerHTML=&quot;<div class=fallback style=background:'+b.accent+'>'+b.title+'</div>&quot;">'
    : '<div class="fallback" style="background:'+b.accent+'">'+b.title+'</div>';
}
function chip(dim,val,lab,on){return '<button class="chip" data-dim="'+dim+'" data-value="'+val+'" aria-pressed="'+(on?'true':'false')+'">'+lab+'</button>'}

function showCatalog(){
  document.body.style.removeProperty("--accent");document.body.style.removeProperty("--accent-ink");document.body.style.removeProperty("--wash");
  const personChips = chip("person","alle","Alle",1)+chip("person","chris","Chris H. Leeb")+chip("person","renate","Renate Leeb");
  const roleChips = chip("role","alle","Alle",1)+Object.entries(roleLabels).map(([v,l])=>chip("role",v,l)).join("");
  const typeChips = chip("type","alle","Alle",1)+Object.entries(typeLabels).map(([v,l])=>chip("type",v,l)).join("");
  document.getElementById("app").innerHTML =
    '<section class="hero"><div class="eyebrow">'+books.length+' Bücher · ein Regal</div>'+
    '<h1>Geschichten, die <em>quer</em> denken, <em>rund</em> erzählen und <em>tief</em> gehen.</h1>'+
    '<p class="lede">Bücher von Renate Leeb und Chris H. Leeb. Filtere nach Person, Rolle oder Buchtyp – und blättere dich durch alle sechs.</p></section>'+
    '<div class="filterbar">'+
      '<div class="fgroup"><span class="flabel">Person</span><div class="chips">'+personChips+'</div></div>'+
      '<div class="fgroup"><span class="flabel">Rolle</span><div class="chips">'+roleChips+'</div></div>'+
      '<div class="fgroup"><span class="flabel">Typ</span><div class="chips">'+typeChips+'</div></div>'+
      '<div class="fmeta" id="fmeta"></div></div>'+
    '<section class="shelf" id="shelf"></section>'+
    newsletterHTML("newsletter-allgemein");
  document.querySelectorAll(".filterbar .chip").forEach(c=>c.addEventListener("click",()=>{
    state[c.dataset.dim]=c.dataset.value;
    c.parentNode.querySelectorAll(".chip").forEach(x=>x.setAttribute("aria-pressed",String(x===c)));
    renderShelf();
  }));
  renderShelf();
}
function renderShelf(){
  const shelf=document.getElementById("shelf");
  const list=books.filter(b=>{
    const persons=b.contributors.map(c=>c.person), roles=b.contributors.map(c=>c.role);
    return (state.person==="alle"||persons.includes(state.person))
      && (state.role==="alle"||roles.includes(state.role))
      && (state.type==="alle"||b.type===state.type);
  });
  shelf.innerHTML=list.map(b=>{
    const by=(b.author&&(b.type==="biografie"))?("von "+b.author):contribs(b);
    return '<a class="card" href="#" onclick="showBook(\\''+b.slug+'\\');return false">'+
      '<div class="frame">'+coverHTML(b)+'</div>'+
      '<div class="c-meta"><span class="c-kicker"><span class="c-dot" style="background:'+b.accent+'"></span>'+typeLabels[b.type]+'</span>'+
      '<span class="c-title">'+b.title+'</span><span class="c-by">'+by+'</span>'+
      '<span class="c-price">ab '+eur(b.price)+' · BoD</span></div></a>';
  }).join("");
  document.getElementById("fmeta").textContent=list.length+(list.length===1?" Buch":" Bücher");
}
function newsletterHTML(tag){
  return '<section class="news"><div class="inner"><div>'+
    '<div class="eyebrow" style="color:rgba(236,238,236,.7)">Newsletter</div>'+
    '<h2>Erfahre, wenn das nächste Buch erscheint.</h2>'+
    '<p>Neue Bücher, Lesungen und Hintergründe – kein Spam, jederzeit abbestellbar.</p></div>'+
    '<div><div class="nl-form"><input type="email" placeholder="deine@e-mail.at"><button type="button" onclick="this.textContent=\\'Eingetragen ✓\\'">Anmelden</button></div>'+
    '<div class="nl-tag">Interesse-Tag: '+tag+'</div></div></div></section>';
}
function shopButtons(b){
  let h='<a class="buy primary" href="'+b.bodUrl+'" target="_blank" rel="noopener">Books on Demand <small>günstigster Preis</small></a>';
  (b.shops||[]).forEach(s=>h+='<a class="buy" href="'+s.u+'" target="_blank" rel="noopener">'+s.n+'</a>');
  h+='<a class="buy ghost" href="https://www.genialokal.de/" target="_blank" rel="noopener">Deine Buchhandlung <small>vor Ort</small></a>';
  return h;
}
function showBook(slug){
  const b=bySlug(slug);
  document.body.style.setProperty("--accent",b.accent);
  document.body.style.setProperty("--accent-ink",b.accentInk);
  document.body.style.setProperty("--wash",b.wash);
  const meta=[["ISBN",b.isbn]];
  if(b.isbnEbook)meta.push(["ISBN E-Book",b.isbnEbook]);
  meta.push(["Format",b.format],["Erschienen",b.year],["Preis","ab "+eur(b.price)+(b.priceEbook?" · E-Book "+eur(b.priceEbook):"")]);
  const rel=(b.related||[]).map(s=>{const r=bySlug(s);return r?'<a class="rel" href="#" onclick="showBook(\\''+r.slug+'\\');return false"><span class="sw" style="background:'+r.accent+'"></span><span><span class="rt">'+r.title+'</span><br><span class="rty">'+typeLabels[r.type]+'</span></span></a>':''}).join("");
  const tag=b.type==="bildband"?("bildband-"+b.slug):b.type;
  document.getElementById("app").innerHTML=
    '<div class="detailwrap"><a class="back" href="#" onclick="showCatalog();return false">← Alle Bücher</a>'+
    '<article class="detail"><div class="cover">'+coverHTML(b)+'</div><div>'+
    '<div class="d-eyebrow"><span class="badge">'+typeLabels[b.type]+'</span><span class="contribs">'+contribs(b)+'</span></div>'+
    '<h1>'+b.title+'</h1><p class="sub">'+(b.subtitle||"")+((b.author&&b.type==="biografie")?(" · von "+b.author):"")+'</p>'+
    '<p class="blurb">'+b.blurb+'</p>'+
    '<div class="buy-label">Überall erhältlich</div><div class="buys">'+shopButtons(b)+'</div>'+
    '<dl class="meta">'+meta.map(m=>'<div><dt>'+m[0]+'</dt><dd>'+m[1]+'</dd></div>').join("")+'</dl>'+
    '<div class="origin"><div class="h">Wie alles begann</div><p>'+b.origin+'</p></div>'+
    '</div></article>'+
    '<section class="related"><div class="h">Das könnte dir auch gefallen</div><div class="rel-grid">'+rel+'</div></section>'+
    newsletterHTML(tag)+'</div>';
  window.scrollTo({top:0,behavior:"smooth"});
}
showCatalog();
</script></body></html>`;

fs.writeFileSync(path.join(ROOT, "dist", "preview.html"), html);
console.log("✓ preview.html erzeugt");
