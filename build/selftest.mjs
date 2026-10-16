#!/usr/bin/env node
// build/selftest.mjs — le build doit échouer (ou neutraliser) ce qu'il prétend contrôler. Zéro dépendance.
// Chaque scénario altère une COPIE JETABLE du site (jamais le dépôt) puis rejoue generate / validate / flatten.
//   node build/selftest.mjs        (aussi : npm run selftest, lancé par tools/check.sh)
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmpRoot = mkdtempSync(path.join(tmpdir(), 'brs-selftest-'));
let failures = 0, count = 0;

function copie() {
  const dir = mkdtempSync(path.join(tmpRoot, 'site-'));
  for (const f of readdirSync(ROOT)) {
    if (['node_modules', '.git', '.claude'].includes(f)) continue;
    if (f === 'assets') { symlinkSync(path.join(ROOT, 'assets'), path.join(dir, 'assets')); continue; }
    cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true });
  }
  return dir;
}
const lire = (d, f) => readFileSync(path.join(d, f), 'utf8');
const ecrire = (d, f, s) => writeFileSync(path.join(d, f), s);
const contenu = (d, fn) => { const c = JSON.parse(lire(d, 'content/site-content.json')); fn(c); ecrire(d, 'content/site-content.json', JSON.stringify(c, null, 2)); };
function node(d, script, env = {}) {
  const r = spawnSync('node', [path.join('build', script)], { cwd: d, encoding: 'utf8', env: { ...process.env, BUILD_DATE: '2026-01-01', GO_LIVE: '', ...env } });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
}
function scenario(nom, fn) {
  count++;
  const d = copie();
  try { fn(d); console.log(`  ok   ${nom}`); }
  catch (e) { failures++; console.log(`  KO   ${nom} : ${e.message}`); }
}
function ko(cond, msg) { if (!cond) throw new Error(msg); }
const doitEchouer = (r, motif, quoi) => { ko(!r.ok, `${quoi} : le build aurait dû échouer`); ko(r.out.includes(motif), `${quoi} : message sans « ${motif} » : ${r.out.slice(0, 200)}`); };

// -- 1. Clés manquantes, nulles, mal typées : le build s'arrête, il ne sort plus de trou silencieux.
scenario('clé absente (hero.badge) → generate échoue', (d) => { contenu(d, (c) => delete c.hero.badge); doitEchouer(node(d, 'generate.mjs'), 'hero.badge', 'hero.badge'); });
scenario('clé absente (hero.ctaPrimaryHref) → generate échoue', (d) => { contenu(d, (c) => delete c.hero.ctaPrimaryHref); doitEchouer(node(d, 'generate.mjs'), 'hero.ctaPrimaryHref', 'ctaPrimaryHref'); });
scenario('#each sur une clé fautive → generate échoue', (d) => { contenu(d, (c) => { c.sections.capacites.cartes = c.sections.capacites.cards; delete c.sections.capacites.cards; }); doitEchouer(node(d, 'generate.mjs'), '#each sections.capacites.cards', 'each'); });
scenario('#each sur un non-tableau → generate échoue', (d) => { contenu(d, (c) => { c.sections.capacites.cards = 'oups'; }); doitEchouer(node(d, 'generate.mjs'), 'pas un tableau', 'each non-tableau'); });
scenario('valeur null → generate échoue', (d) => { contenu(d, (c) => { c.hero.lede = null; }); doitEchouer(node(d, 'generate.mjs'), 'valeur null', 'null'); });

// -- 2. Échappement : le contenu est du texte.
scenario('alt avec guillemets, balise et & → attribut intact, un seul jeu width/height', (d) => {
  contenu(d, (c) => { c.hero.imageAlt = 'Borne "IRVE" <b>gras</b> & co > fin'; });
  ko(node(d, 'generate.mjs').ok, 'generate a échoué');
  const html = lire(d, 'home/index.html');
  const tag = html.match(/<img\b(?:"[^"]*"|[^>"])*alt="Borne &quot;IRVE&quot; &lt;b&gt;gras&lt;\/b&gt; &amp; co &gt; fin"(?:"[^"]*"|[^>"])*>/);
  ko(tag, 'alt non échappé ou balise img coupée');
  ko((tag[0].match(/\bwidth="/g) || []).length === 1, 'plusieurs width dans la balise img');
});
scenario('</script><script> dans une réponse FAQ → JSON-LD valide, aucun script injecté', (d) => {
  contenu(d, (c) => { c.faq.items[0].answer = 'ok</script><script>alert(1)</script>'; });
  ko(node(d, 'generate.mjs').ok, 'generate a échoué');
  const html = lire(d, 'home/index.html');
  ko(!html.includes('<script>alert(1)'), 'script injecté');
  ko(node(d, 'validate.mjs').ok, 'validate refuse un JSON-LD pourtant échappé');
});
scenario('</script><script> dans un titre de carte → rien d\'exécutable dans le HTML', (d) => {
  contenu(d, (c) => { c.sections.capacites.cards[0].title = '</script><script>alert(1)</script>'; });
  ko(node(d, 'generate.mjs').ok, 'generate a échoué');
  ko(!lire(d, 'home/index.html').includes('<script>alert(1)'), 'script injecté');
});

// -- 3. Références : polices, ancres, canonical, sitemap.
const build = (d) => { ko(node(d, 'generate.mjs').ok, 'generate'); ko(node(d, 'validate.mjs').ok, 'validate de départ'); };
scenario('url() de police inexistante dans le CSS → validate échoue', (d) => { ecrire(d, 'css/main.css', lire(d, 'css/main.css') + "\n.x{background:url('../assets/fonts/NOPE.woff2')}\n"); ko(node(d, 'generate.mjs').ok, 'generate'); doitEchouer(node(d, 'validate.mjs'), 'NOPE.woff2', 'url()'); });
scenario('ancre de navigation vers un id inexistant → validate échoue', (d) => { contenu(d, (c) => { c.nav.primary[0].href = '#inexistant'; }); ko(node(d, 'generate.mjs').ok, 'generate'); doitEchouer(node(d, 'validate.mjs'), '#inexistant', 'ancre'); });
scenario('canonical qui ne vise pas domaine + chemin → validate échoue', (d) => { build(d); ecrire(d, 'home/index.html', lire(d, 'home/index.html').replace(/(<link rel="canonical" href=")[^"]+/, '$1https://brsconnect.fr/home/autre/')); doitEchouer(node(d, 'validate.mjs'), 'Canonical', 'canonical'); });
scenario('sitemap qui liste une URL noindex en préview → validate échoue', (d) => { build(d); ecrire(d, 'sitemap.xml', '<?xml version="1.0"?><urlset><url><loc>https://brsconnect.fr/</loc></url></urlset>'); doitEchouer(node(d, 'validate.mjs'), 'noindex', 'sitemap'); });
scenario('racine sans noindex en préview → validate échoue', (d) => { build(d); ecrire(d, 'index.html', lire(d, 'index.html').replace('<meta name="robots" content="noindex">', '')); doitEchouer(node(d, 'validate.mjs'), 'noindex', 'racine'); });

scenario('classe CSS jamais employée → validate échoue', (d) => { ecrire(d, 'css/main.css', lire(d, 'css/main.css') + '\n.zzz-morte{color:red}\n'); ko(node(d, 'generate.mjs').ok, 'generate'); doitEchouer(node(d, 'validate.mjs'), '.zzz-morte', 'CSS mort'); });
scenario('classe du template sans règle CSS → validate échoue', (d) => { ecrire(d, 'templates/index.template.html', lire(d, 'templates/index.template.html').replace('class="eyebrow"', 'class="eyebrow sans-regle"')); ko(node(d, 'generate.mjs').ok, 'generate'); doitEchouer(node(d, 'validate.mjs'), 'sans-regle', 'classe sans règle'); });

// -- 3 bis. Typographie française : espace insécable avant « : ; ? ! », entre chiffres ; le contrôle FAQ reste vrai.
scenario('« Quoi ? » et « 7 à 22 kW » reçoivent des espaces insécables, validate reste vert', (d) => {
  contenu(d, (c) => { c.faq.items[0].question = 'Quoi ? Oui : 7 à 22 kW'; });
  ko(node(d, 'generate.mjs').ok, 'generate');
  ko(lire(d, 'home/index.html').includes('Quoi\u00a0? Oui\u00a0: 7 à 22\u00a0kW'), 'espaces insécables absents');
  const v = node(d, 'validate.mjs'); ko(v.ok, 'validate : ' + v.out.slice(0, 200));
});
scenario('l\'apostrophe entre deux lettres devient courbe dans le texte visible, jamais dans une URL, et validate reste vert', (d) => {
  contenu(d, (c) => { c.faq.items[0].question = "Qu'est-ce que l'exploitant ?"; c.nav.ctaHref = "mailto:a@example.org?subject=l'essai"; });
  ko(node(d, 'generate.mjs').ok, 'generate');
  const h = lire(d, 'home/index.html');
  ko(h.includes('Qu’est-ce que l’exploitant'), 'apostrophes courbes absentes du texte visible');
  ko(h.includes("subject=l'essai"), "l'URL ne doit pas être typographiée");
  const v = node(d, 'validate.mjs'); ko(v.ok, 'validate : ' + v.out.slice(0, 200));
});
scenario('l\'URL d\'un lien n\'est jamais « typographiée »', (d) => {
  contenu(d, (c) => { c.nav.ctaHref = 'mailto:a@example.org?subject=Devenir partenaire : test'; });
  ko(node(d, 'generate.mjs').ok, 'generate'); ko(!lire(d, 'home/index.html').match(/href="mailto:[^"]*\u00a0/), 'NBSP dans une URL');
});

// -- 3 ter. Règles de design du DESIGN-GUIDE (build/design-lint.mjs) : chaque règle casse validate, l'exception documentée passe.
const css = (d, ajout) => { ecrire(d, 'css/main.css', lire(d, 'css/main.css') + '\n' + ajout + '\n'); ko(node(d, 'generate.mjs').ok, 'generate'); };
scenario('style="…" inline dans le template → validate échoue', (d) => { ecrire(d, 'templates/index.template.html', lire(d, 'templates/index.template.html').replace('class="eyebrow"', 'class="eyebrow" style="color:red"')); ko(node(d, 'generate.mjs').ok, 'generate'); doitEchouer(node(d, 'validate.mjs'), 'style="', 'style inline'); });
scenario('gradient de fond → validate échoue', (d) => { css(d, '.badge-pill{background:linear-gradient(red,blue)}'); doitEchouer(node(d, 'validate.mjs'), 'gradient', 'gradient'); });
scenario('gradient en masque, même sur un conteneur de logos → validate échoue (aucune exception)', (d) => { css(d, '.badge-pill{mask-image:linear-gradient(90deg,transparent,black)}'); doitEchouer(node(d, 'validate.mjs'), 'gradient', 'masque'); });
scenario('police mono sur `code` → validate échoue (aucune exception)', (d) => { css(d, 'code{font-family:var(--font-mono)}'); doitEchouer(node(d, 'validate.mjs'), 'font-family', 'police mono'); });
scenario('emoji dans le contenu → validate échoue', (d) => { contenu(d, (c) => { c.hero.lede = c.hero.lede + ' 🚀'; }); ko(node(d, 'generate.mjs').ok, 'generate'); doitEchouer(node(d, 'validate.mjs'), 'emoji', 'emoji'); });
scenario('pictogramme ✓ dans le contenu → validate échoue', (d) => { contenu(d, (c) => { c.hero.lede = c.hero.lede + ' ✓'; }); ko(node(d, 'generate.mjs').ok, 'generate'); doitEchouer(node(d, 'validate.mjs'), 'emoji', 'dingbat'); });
scenario('font-family hors Inter → validate échoue', (d) => { css(d, ".badge-pill{font-family:Georgia,serif}"); doitEchouer(node(d, 'validate.mjs'), 'font-family', 'police'); });
scenario('@font-face d\'une autre famille → validate échoue', (d) => { ecrire(d, 'css/base.css', lire(d, 'css/base.css') + "\n@font-face{ font-family:'Autre'; src:url('../assets/fonts/NOPE.woff2'); }\n"); ko(node(d, 'generate.mjs').ok, 'generate'); doitEchouer(node(d, 'validate.mjs'), 'Autre', '@font-face'); });
scenario('transform dans un :hover → validate échoue', (d) => { css(d, '.btn-pill--primary:hover{transform:translateY(-2px)}'); doitEchouer(node(d, 'validate.mjs'), ':hover', 'hover'); });
scenario('box-shadow dans un :hover → validate échoue', (d) => { css(d, '.badge-pill:hover{box-shadow:0 2px 4px red}'); doitEchouer(node(d, 'validate.mjs'), 'box-shadow', 'hover ombre'); });
scenario('nouvelle animation infinie → validate échoue', (d) => { css(d, '@keyframes pulse{ to{ opacity:.5 } }\n.badge-pill{animation:pulse 1s infinite}'); doitEchouer(node(d, 'validate.mjs'), 'pulse', 'boucle'); });
scenario('boucle du badge non coupée sous reduced-motion → validate échoue', (d) => {
  const f = lire(d, 'css/main.css'); ko(f.includes('@media (prefers-reduced-motion:reduce){\n  .certif-badge__ring{ animation:none; }\n}'), 'main.css inattendu');
  ecrire(d, 'css/main.css', f.replace('@media (prefers-reduced-motion:reduce){\n  .certif-badge__ring{ animation:none; }\n}', ''));
  ko(node(d, 'generate.mjs').ok, 'generate'); doitEchouer(node(d, 'validate.mjs'), 'certif-spin', 'reduced-motion');
});
scenario('border-radius en dur (12px) → validate échoue', (d) => { css(d, '.badge-pill{border-radius:12px}'); doitEchouer(node(d, 'validate.mjs'), 'border-radius', 'rayon'); });
scenario('--radius-image modifié → validate échoue', (d) => { ecrire(d, 'css/tokens.css', lire(d, 'css/tokens.css').replace('--radius-image: 20px;', '--radius-image: 8px;')); ko(node(d, 'generate.mjs').ok, 'generate'); doitEchouer(node(d, 'validate.mjs'), '--radius-image', 'jeton'); });

// -- 4. Bascule go-live.
function golive(d) { const cfg = lire(d, 'build/config.mjs'); ko(cfg.includes('export const PREVIEW = true;'), 'config.mjs inattendu'); ecrire(d, 'build/config.mjs', cfg.replace('export const PREVIEW = true;', 'export const PREVIEW = false;')); }
scenario('PREVIEW=false sans GO_LIVE=1 → generate et validate échouent', (d) => { golive(d); doitEchouer(node(d, 'generate.mjs'), 'GO_LIVE=1', 'generate'); doitEchouer(node(d, 'validate.mjs'), 'GO_LIVE=1', 'validate'); });
scenario('PREVIEW=false + GO_LIVE=1 avec feedbackWidget (Ybug) → validate échoue', (d) => {
  golive(d); const env = { GO_LIVE: '1' };
  contenu(d, (c) => { c.meta.feedbackWidget = true; });
  ko(node(d, 'generate.mjs', env).ok, 'generate go-live');
  rmSync(path.join(d, 'home'), { recursive: true });
  doitEchouer(node(d, 'validate.mjs', env), 'feedbackWidget', 'Ybug hors préview');
});
scenario('PREVIEW=false + GO_LIVE=1 : home/ à supprimer, puis build complet, flat noindex', (d) => {
  golive(d); const env = { GO_LIVE: '1' };
  contenu(d, (c) => { c.meta.feedbackWidget = false; });
  ko(node(d, 'generate.mjs', env).ok, 'generate go-live');
  doitEchouer(node(d, 'validate.mjs', env), 'home/', 'home/ présent');
  rmSync(path.join(d, 'home'), { recursive: true });
  const v = node(d, 'validate.mjs', env); ko(v.ok, 'validate go-live : ' + v.out.slice(0, 300));
  ko(node(d, 'flatten.mjs', env).ok, 'flatten go-live');
  ko(lire(d, 'index-flat.html').includes('<meta name="robots" content="noindex">'), 'flat sans noindex hors préview');
  ko(!lire(d, 'index.html').includes('noindex'), 'la page publiée porte noindex');
  ko(/<loc>https:\/\/brsconnect\.fr\/<\/loc>/.test(lire(d, 'sitemap.xml')), 'sitemap sans la page');
});

// -- 5. Le dépôt lui-même passe.
scenario('le dépôt tel quel : generate, validate, flatten', (d) => { ko(node(d, 'generate.mjs').ok, 'generate'); const v = node(d, 'validate.mjs'); ko(v.ok, 'validate : ' + v.out.slice(0, 300)); ko(node(d, 'flatten.mjs').ok, 'flatten'); });

rmSync(tmpRoot, { recursive: true, force: true });
console.log(failures ? `\n${failures} scénario(s) en échec sur ${count}` : `\n${count} scénarios OK`);
process.exit(failures ? 1 : 0);
