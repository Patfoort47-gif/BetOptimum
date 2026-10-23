// Personnage 3D de BetMaster (BET-49) : construction du footballeur, de la tête aux crampons, à partir d'une configuration d'avatar.
// Modélisation procédurale (aucun fichier à télécharger) : grosse tête expressive, yeux brillants, cheveux en mèches, maillot en maille, matériaux PBR.
// Le module reçoit l'espace de noms Three.js en paramètre : il n'importe rien et ne touche pas au DOM hors <canvas>. Le graphiste pourra remplacer ce personnage par un .glb (BET-47) sans changer la configuration.
import { SKINS, EYES, HAIR_COLORS, BOOTS, KITS, sanitizeAvatar } from './avatar-config.js';
import { drawKit, irisTexture, blushTexture, grassTexture, weaveTexture, ballTexture, glowTexture, shadowTexture } from './avatar-scenes.js';

export const DIM = { hip: .72, thigh: .28, shin: .34, torso: .48, head: .33 };
const FACE_SHAPES = { round: { w: 1.05, h: 1, d: 1, jaw: .06, cheek: .05, chin: .02 }, oval: { w: .98, h: 1.06, d: 1, jaw: -.05, cheek: 0, chin: .07 }, long: { w: .92, h: 1.14, d: .98, jaw: -.1, cheek: -.02, chin: .1 }, square: { w: 1.02, h: .98, d: 1, jaw: .18, cheek: .02, chin: -.03 }, heart: { w: 1, h: 1.02, d: 1, jaw: -.22, cheek: .07, chin: .08 }, wide: { w: 1.14, h: .96, d: 1, jaw: .09, cheek: .09, chin: 0 } };
const FACE_KEYS = ['round', 'oval', 'long', 'square', 'heart', 'wide'];
// Expressions : angle des paupières (-1,3 ouvert, 0,8 fermé), sourcils, bouche.
export const EXPRESSIONS = {
  smile: { mouth: 'smile', lid: [-1.28, -1.28], brow: [0, 0], tilt: 0, scale: 1 }, focus: { mouth: 'flat', lid: [-.78, -.78], brow: [-.014, -.014], tilt: -.24, scale: 1 },
  wink: { mouth: 'smile', lid: [-1.28, .85], brow: [0, -.012], tilt: 0, scale: 1 }, confident: { mouth: 'smirk', lid: [-1.12, -1.12], brow: [.02, 0], tilt: .08, scale: 1 },
  joy: { mouth: 'open', lid: [-.72, -.72], brow: [.014, .014], tilt: .16, scale: 1 }, surprise: { mouth: 'o', lid: [-1.45, -1.45], brow: [.034, .034], tilt: .22, scale: 1.12 }
};
const rng = seed => { let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h = Math.imul(h ^ h >>> 15, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; };
const mix = (a, b, t) => { const p = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)), x = p(a), y = p(b); return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`; };
const lerp = (a, b, t) => a + (b - a) * t;

export function buildCharacter(T, input, q) {
  const look = sanitizeAvatar(input), owned = [], disposables = new Set();
  const track = object => { disposables.add(object); return object; };
  const tex = (canvas, opts = {}) => { const t = track(new T.CanvasTexture(canvas)); t.colorSpace = opts.linear ? T.NoColorSpace : T.SRGBColorSpace; t.anisotropy = 4; if (opts.repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(...opts.repeat); } return t; };
  const std = (color, rough = .6, metal = 0, extra = {}) => track(new T.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
  const phys = (color, extra = {}) => track(new T.MeshPhysicalMaterial({ color, ...extra }));
  const geo = g => track(g);
  const seg = q.segments, R = DIM.head, skinHex = SKINS[look.skin][0], kit = KITS[look.kit.item] ?? KITS['start-lime'], hairHex = HAIR_COLORS[look.hairColor][0], shape = FACE_SHAPES[FACE_KEYS[look.face]], female = look.body === 'f';
  const root = new T.Group(), lift = new T.Group(), baseKind = look.base, topY = baseKind === 'base-gold' ? .11 : baseKind === 'base-grass' ? .078 : .07; lift.position.y = topY; root.add(lift);
  const mesh = (geometry, material, parent, pos = [0, 0, 0], shadow = true) => { const m = new T.Mesh(geometry, material); m.position.set(...pos); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; };

  // Matériaux : peau douce (reflet de bord), maille du maillot, cheveux brillants.
  const skin = phys(mix(skinHex, '#d98a5a', .12), { roughness: .6, sheen: .35, sheenRoughness: .5, sheenColor: new T.Color(mix(skinHex, '#ff8f7a', .4)), clearcoat: .05, clearcoatRoughness: .6 });
  const kitCanvas = document.createElement('canvas'); kitCanvas.width = kitCanvas.height = q.segments > 30 ? 1024 : 512;
  drawKit(kitCanvas, look.kit.item, look.kit.number, look.kit.name);
  const weave = tex(weaveTexture(), { linear: true, repeat: [18, 12] });
  const jersey = phys('#ffffff', { map: tex(kitCanvas), roughness: .78, sheen: .8, sheenRoughness: .55, sheenColor: new T.Color(mix(kit.c1, '#ffffff', .5)), bumpMap: weave, bumpScale: .6 });
  const sleeve = std(kit.c1, .78, 0, { bumpMap: weave, bumpScale: .5 }), trim = std(kit.c2, .7), shortsMat = std(kit.c2, .74, 0, { bumpMap: weave, bumpScale: .5 }), sockMat = std(kit.c1, .8);
  const hairMap = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#d9d9d9'; x.fillRect(0, 0, 256, 256); const r = rng('streaks'); for (let i = 0; i < 520; i++) { const g = 120 + Math.floor(r() * 135), px = r() * 256, w = .8 + r() * 2.2; x.strokeStyle = `rgba(${g},${g},${g},${.35 + r() * .5})`; x.lineWidth = w; x.beginPath(); x.moveTo(px, 0); x.bezierCurveTo(px + (r() - .5) * 14, 80, px + (r() - .5) * 14, 170, px + (r() - .5) * 10, 256); x.stroke(); } return tex(c, { repeat: [5, 1] }); })();
  const hairMat = phys(hairHex, { map: hairMap, bumpMap: hairMap, bumpScale: 1.4, roughness: .4, sheen: 1, sheenRoughness: .35, sheenColor: new T.Color(mix(hairHex, '#ffffff', .45)), clearcoat: .25, clearcoatRoughness: .45 });
  const stubble = phys(mix(hairHex, skinHex, .62), { roughness: .6, sheen: .4 });
  const boot = phys(BOOTS[look.boots][0], { roughness: .38, clearcoat: .7, clearcoatRoughness: .25 }), sole = std('#101214', .7);

  // --- Squelette : racine > bassin > torse > (cou, tête, épaules) ; cuisses > genoux > pieds.
  const hips = new T.Group(); hips.position.y = DIM.hip; lift.add(hips);
  const torso = new T.Group(); hips.add(torso);
  // Bassin et short
  const pelvis = mesh(geo(new T.SphereGeometry(.205, seg, 16)), shortsMat, hips); pelvis.scale.set(female ? 1.02 : 1, .66, .78); pelvis.position.y = -.01;
  // Torse en révolution : profil mesuré en hauteur pour que la texture du maillot épouse le corps.
  const prof = female ? [[0, .17], [.06, .184], [.16, .158], [.3, .196], [.4, .2], [.455, .15], [.48, .07]] : [[0, .178], [.06, .194], [.17, .178], [.32, .212], [.42, .218], [.455, .155], [.48, .07]];
  const profile = []; for (let i = 0; i <= 28; i++) { const y = DIM.torso * i / 28; let k = 0; while (k < prof.length - 2 && prof[k + 1][0] < y) k++; const [y0, r0] = prof[k], [y1, r1] = prof[k + 1], t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0))), s = t * t * (3 - 2 * t); profile.push(new T.Vector2(lerp(r0, r1, s), y)); }
  const chest = mesh(geo(new T.LatheGeometry(profile, seg)), jersey, torso); chest.scale.z = .74;
  const neck = mesh(geo(new T.CylinderGeometry(.052, .06, .13, 16)), skin, torso, [0, DIM.torso + .035, 0.005]);
  const collar = mesh(geo(new T.TorusGeometry(.075, .014, 8, 24)), trim, torso, [0, DIM.torso - .002, .008]); collar.rotation.x = Math.PI / 2; collar.scale.set(1, 1.05, .8);

  // --- Tête : sphère déformée (forme du visage), traits posés à sa surface.
  const head = new T.Group(); head.position.set(0, DIM.torso + .02 + R * .94, .012); torso.add(head);
  const sphere = new T.SphereGeometry(R, seg, Math.round(seg * .75)), pos = sphere.attributes.position, nor = sphere.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); const u = y / R, low = Math.max(0, -u);
    x *= shape.w * (1 + shape.jaw * Math.pow(low, 1.3) + shape.cheek * Math.max(0, 1 - Math.abs(u + .2) * 2.2)); y *= shape.h; z *= shape.d; if (y < 0 && z > 0) y -= shape.chin * R * low * (z / R);
    pos.setXYZ(i, x, y, z); const nx = nor.getX(i) / shape.w, ny = nor.getY(i) / shape.h, nz = nor.getZ(i) / shape.d, l = Math.hypot(nx, ny, nz); nor.setXYZ(i, nx / l, ny / l, nz / l);
  }
  mesh(geo(sphere), skin, head);
  const faceZ = (x, y) => R * shape.d * Math.sqrt(Math.max(0, 1 - (x / (R * shape.w)) ** 2 - (y / (R * shape.h)) ** 2));
  for (const side of [-1, 1]) { const ear = mesh(geo(new T.SphereGeometry(.058, 16, 12)), skin, head, [side * R * shape.w * .985, -.012, -.01]); ear.scale.set(.42, 1, .78); ear.rotation.z = side * -.12; }
  mesh(geo(new T.SphereGeometry(.03, 16, 12)), skin, head, [0, -.05, faceZ(0, -.05) + .008]).scale.set(1, .85, 1.1);
  // Joues rosées
  const blush = std('#ffffff', 1, 0, { map: tex(blushTexture()), transparent: true, depthWrite: false, opacity: look.skin >= 3 ? .35 : .75 });
  for (const side of [-1, 1]) { const plane = new T.Mesh(geo(new T.PlaneGeometry(.1, .075)), blush); plane.position.set(side * .165, -.06, faceZ(side * .165, -.06) + .004); plane.rotation.y = side * .5; head.add(plane); }
  // Yeux : blanc brillant, iris détaillé avec reflets, cornée réfléchissante, paupière qui se ferme.
  const irisMat = std('#ffffff', .25, 0, { map: tex(irisTexture(EYES[look.eyes][0])), transparent: true, emissive: '#ffffff', emissiveMap: tex(irisTexture(EYES[look.eyes][0])), emissiveIntensity: .1 });
  const white = phys('#fbfbf8', { roughness: .22, clearcoat: 1, clearcoatRoughness: .05 }), cornea = phys('#ffffff', { roughness: 0, transmission: 0, transparent: true, opacity: .14, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 2.2 }), shine = new T.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
  const eyes = [], lids = [], brows = [], browMat = std(mix(hairHex, '#000000', .25), .6);
  for (const side of [-1, 1]) {
    const x = side * .118, y = .03, z = faceZ(x, y) - .018, g = new T.Group(); g.position.set(x, y, z); head.add(g);
    const ball = mesh(geo(new T.SphereGeometry(.068, 24, 18)), white, g, [0, 0, 0], false); ball.scale.set(1, 1.18, .62);
    const irisGroup = new T.Group(); irisGroup.position.z = .0425; g.add(irisGroup);
    const iris = new T.Mesh(geo(new T.CircleGeometry(.04, 28)), irisMat); irisGroup.add(iris);
    const h1 = new T.Mesh(geo(new T.CircleGeometry(.0125, 14)), shine); h1.position.set(.014, .018, .002); irisGroup.add(h1);
    const h2 = new T.Mesh(geo(new T.CircleGeometry(.0058, 10)), shine); h2.position.set(-.014, -.016, .002); irisGroup.add(h2);
    const glass = mesh(geo(new T.SphereGeometry(.0705, 24, 18)), cornea, g, [0, 0, 0], false); glass.scale.set(1, 1.18, .66);
    const lid = new T.Group(); g.add(lid); const lidMesh = mesh(geo(new T.SphereGeometry(.0745, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2)), skin, lid, [0, 0, 0], false); lidMesh.scale.set(1.02, 1.2, .72);
    eyes.push({ group: g, iris: irisGroup, side }); lids.push(lid);
    const curve = new T.CatmullRomCurve3([new T.Vector3(-.058, -.004, 0), new T.Vector3(-.01, .013, .004), new T.Vector3(.058, -.002, 0)]), brow = new T.Mesh(geo(new T.TubeGeometry(curve, 14, .0092, 6, false)), browMat);
    brow.position.set(x, .122, faceZ(x, .122) + .004); brow.scale.x = side; brow.rotation.y = side * .22; head.add(brow); brows.push(brow);
  }
  // Bouches : une par expression, une seule visible à la fois.
  const lipHex = mix(skinHex, '#9b2f33', .55), lips = std(lipHex, .45), dark = std('#340c12', .8), teeth = std('#fbfbf6', .4), tongue = std('#e0707a', .6);
  const mouth = new T.Group(); mouth.position.set(0, -.118, faceZ(0, -.118) + .003); head.add(mouth);
  const arc = (arcLen, radius = .062) => { const m = new T.Mesh(geo(new T.TorusGeometry(radius, .0085, 8, 28, arcLen)), lips); m.rotation.z = Math.PI * 1.5 - arcLen / 2; m.position.y = radius * .85; return m; };
  const shapeMouth = (w, h) => { const s = new T.Shape(); s.moveTo(-w, 0); s.quadraticCurveTo(0, h * .1, w, 0); s.quadraticCurveTo(w * .9, -h * 1.5, 0, -h * 1.6); s.quadraticCurveTo(-w * .9, -h * 1.5, -w, 0); return new T.ShapeGeometry(s, 14); };
  const flat = new T.Mesh(geo(new T.CapsuleGeometry(.0075, .066, 4, 8)), lips); flat.rotation.z = Math.PI / 2; flat.position.y = -.006;
  const mouths = { smile: arc(1.9), smirk: arc(1.25, .058), flat };
  mouths.smirk.position.x = .022; mouths.smirk.rotation.z += .2;
  const open = new T.Group(); open.add(new T.Mesh(geo(shapeMouth(.07, .05)), lips)); const inner = new T.Mesh(geo(shapeMouth(.058, .042)), dark); inner.position.z = .0015; open.add(inner);
  const tooth = new T.Mesh(geo(new T.PlaneGeometry(.098, .017)), teeth); tooth.position.set(0, -.009, .003); open.add(tooth); const tg = new T.Mesh(geo(new T.CircleGeometry(.03, 16)), tongue); tg.scale.set(1.4, .65, 1); tg.position.set(0, -.062, .003); open.add(tg); open.position.y = .016; mouths.open = open;
  const ring = new T.Group(); ring.add(new T.Mesh(geo(new T.CircleGeometry(.032, 20)), lips)); const hole = new T.Mesh(geo(new T.CircleGeometry(.023, 20)), dark); hole.position.z = .0015; ring.add(hole); ring.scale.set(.85, 1.15, 1); ring.position.y = -.01; mouths.o = ring;
  for (const key in mouths) { mouths[key].visible = false; mouth.add(mouths[key]); }

  // --- Cheveux : calotte, mèches (instances) et formes propres à chaque coiffure.
  const hairGroup = new T.Group(); head.add(hairGroup);
  const hat = look.accessories.some(id => id === 'acc-cap' || id === 'acc-crown');
  const hr = R * 1.045, rg = rng(`hair${look.hair}`), capGeo = (theta, k = 1) => { const g = new T.SphereGeometry(hr * k, seg, Math.round(seg * .6), 0, Math.PI * 2, 0, theta), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + .018 * Math.sin(x * 62 + z * 31) * Math.sin(y * 57 + x * 20); p.setXYZ(i, x * n * shape.w, y * n * shape.h, z * n * shape.d); } g.computeVertexNormals(); return g; };
  const TILT = -.42, cap = (theta, material = hairMat, k = 1) => { const m = mesh(geo(capGeo(theta - Math.PI * .08, k)), material, hairGroup); m.rotation.x = TILT; return m; };
  const dirOf = (theta, phi) => new T.Vector3(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi));
  const clumpGeo = geo(new T.CapsuleGeometry(.5, 1, 4, 8)), curlGeo = geo(new T.SphereGeometry(1, 10, 8)), ups = new T.Vector3(0, 1, 0), tmpM = new T.Matrix4(), tmpQ = new T.Quaternion(), tmpS = new T.Vector3(), tmpP = new T.Vector3();
  const tilt = new T.Matrix4().makeRotationX(-.42);
  const place = (geometry, material, items) => { if (!items.length) return; const inst = new T.InstancedMesh(geometry, material, items.length); items.forEach((it, i) => { tmpM.compose(it.p, it.q, it.s); inst.setMatrixAt(i, tmpM); }); inst.castShadow = true; inst.receiveShadow = true; inst.applyMatrix4(tilt); hairGroup.add(inst); };
  const strands = [], curls = [];
  const basisQ = (normal, tangent) => { const y = tangent.clone().addScaledVector(normal, -tangent.dot(normal)).normalize(), x = new T.Vector3().crossVectors(y, normal).normalize(); return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, normal)); };
  const strand = (theta, phi, len, w, th, sweep = 0, dirOverride = null) => {
    if (hat && theta < Math.PI * .34) return;
    const d = dirOf(theta, phi), t = dirOverride ?? new T.Vector3(Math.cos(theta) * Math.sin(phi + sweep), -Math.sin(theta), Math.cos(theta) * Math.cos(phi + sweep)).normalize();
    strands.push({ p: d.clone().multiply(new T.Vector3(shape.w, shape.h, shape.d)).multiplyScalar(hr * (dirOverride ? .99 : 1.0)).addScaledVector(t, len * .32), q: basisQ(d, t), s: new T.Vector3(w / .5, len / 2, th / .5) });
  };
  const curl = (theta, phi, r, lift = 1.04) => { if (hat && theta < Math.PI * .34) return; const d = dirOf(theta, phi); curls.push({ p: d.multiply(new T.Vector3(shape.w, shape.h, shape.d)).multiplyScalar(hr * lift), q: new T.Quaternion(), s: new T.Vector3(r, r, r) }); };
  const front = phi => Math.abs(Math.atan2(Math.sin(phi), Math.cos(phi))) < .85;
  const spread = (count, tMin, tMax, len, w, th, opts = {}) => { for (let i = 0; i < count * .8; i++) { const theta = lerp(tMin, Math.min(tMax, .5), rg()) * Math.PI, phi = rg() * Math.PI * 2; if (front(phi) && theta > Math.PI * (opts.hairline ?? .31)) continue; strand(theta, phi, len * (.7 + rg() * .45), w, th * .8, opts.sweep ?? .5); } };
  const style = ['short', 'fade', 'mohawk', 'afro', 'bun', 'shaved', 'curls', 'long', 'braids', 'quiff', 'curly', 'ponytail'][look.hair];
  const chain = (points, rad0, rad1, material = hairMat) => points.forEach((p, i) => { const t = i / Math.max(1, points.length - 1), m = mesh(geo(new T.SphereGeometry(lerp(rad0, rad1, t), 12, 9)), material, hairGroup, p); m.scale.set(1, 1.25, 1); });
  const tie = (p, color = '#f4f4f0') => { const m = mesh(geo(new T.TorusGeometry(.04, .011, 8, 16)), std(color, .5), hairGroup, p); m.rotation.x = Math.PI / 2; return m; };
  if (style === 'short') { cap(Math.PI * .6); spread(80, .03, .56, .15, .026, .017); for (let i = 0; i < 9; i++) strand(Math.PI * (.25 + rg() * .05), (i - 4) * .17, .085, .03, .016, 0); }
  else if (style === 'fade') { cap(Math.PI * .52, stubble, .995); cap(Math.PI * .36, hairMat, 1.03); spread(60, .04, .34, .1, .026, .018, { sweep: .3 }); for (let i = 0; i < 6; i++) strand(Math.PI * .3, (i - 2.5) * .22, .08, .024, .016, 0); }
  else if (style === 'mohawk') { cap(Math.PI * .56, stubble, .995); for (let i = 0; i < 13; i++) { const a = lerp(-1.1, 1.2, i / 12), d = new T.Vector3(0, Math.cos(a), Math.sin(a)), lean = new T.Vector3(0, Math.cos(a - .5), Math.sin(a - .5)); if (hat) continue; tmpQ.setFromUnitVectors(ups, lean.normalize()); strands.push({ p: d.multiplyScalar(hr * .97).addScaledVector(lean, .07), q: tmpQ.clone(), s: new T.Vector3(.032 / .5, .17 / 2, .02 / .5) }); } }
  else if (style === 'afro') { cap(Math.PI * .62); for (let i = 0; i < 150; i++) { const theta = rg() * Math.PI * .66, phi = rg() * Math.PI * 2; if (front(phi) && theta > Math.PI * .36) continue; curl(theta, phi, .07 + rg() * .03, 1.2); } }
  else if (style === 'bun') { cap(Math.PI * .6); spread(70, .05, .56, .12, .024, .016, { sweep: .9 }); mesh(geo(new T.SphereGeometry(.105, 22, 16)), hairMat, hairGroup, [0, R * .86, -R * .6]); tie([0, R * .72, -R * .55]).rotation.x = Math.PI / 2.6; }
  else if (style === 'shaved') { cap(Math.PI * .58, stubble, .992); }
  else if (style === 'curls') { cap(Math.PI * .58); for (let i = 0; i < 120; i++) { const theta = rg() * Math.PI * .6, phi = rg() * Math.PI * 2; if (front(phi) && theta > Math.PI * .38) continue; curl(theta, phi, .052 + rg() * .018, 1.03); } }
  else if (style === 'long') { cap(Math.PI * .6); spread(80, .05, .58, .13, .025, .017, { sweep: .8 }); const m = mesh(geo(new T.CapsuleGeometry(.075, .3, 6, 12)), hairMat, hairGroup, [0, -.16, -R * .8]); m.scale.set(1.2, 1, .9); for (const s of [-1, 1]) { const lock = mesh(geo(new T.CapsuleGeometry(.04, .2, 6, 10)), hairMat, hairGroup, [s * R * .92, -.09, -R * .15]); lock.rotation.z = s * .06; } tie([0, -.03, -R * .82]); }
  else if (style === 'braids') { cap(Math.PI * .6); spread(60, .05, .56, .11, .024, .016, { sweep: .7 }); for (let b = 0; b < 7; b++) { const phi = Math.PI * (.62 + b * .125), d = dirOf(Math.PI * .56, phi).multiplyScalar(hr * .98), pts = []; for (let i = 0; i < 6; i++) pts.push([d.x * (1 + i * .05), d.y - i * .075, d.z * (1 + i * .07)]); chain(pts, .034, .024); } }
  else if (style === 'quiff') { cap(Math.PI * .58); spread(50, .05, .5, .1, .024, .016, { sweep: .4 }); if (!hat) for (let i = 0; i < 7; i++) strand(Math.PI * .22, (i - 3) * .15, .2, .05, .028, 0, new T.Vector3((i - 3) * .05, .55, .83).normalize()); }
  else if (style === 'curly') { cap(Math.PI * .56); for (let i = 0; i < 170; i++) { const theta = rg() * Math.PI * .58, phi = rg() * Math.PI * 2; if (front(phi) && theta > Math.PI * .38) continue; curl(theta, phi, .034 + rg() * .012, 1.02); } }
  else if (style === 'ponytail') { cap(Math.PI * .6); spread(80, .05, .56, .12, .024, .016, { sweep: 1.2 }); chain([[0, .2, -.35], [0, .215, -.43], [0, .17, -.5], [0, .08, -.54], [0, -.04, -.55], [0, -.16, -.54]], .052, .03); tie([0, .19, -.34]); }
  place(clumpGeo, hairMat, strands); place(curlGeo, hairMat, curls);

  // --- Accessoires
  const acc = id => look.accessories.includes(id), gold = phys('#e6b422', { metalness: 1, roughness: .22, clearcoat: .5 });
  if (acc('acc-cap')) { const c = mesh(geo(new T.SphereGeometry(R * 1.1, seg, 16, 0, Math.PI * 2, 0, Math.PI * .5)), std(kit.c1, .65), head, [0, R * .1, -.01]); c.rotation.x = -.22; c.scale.set(shape.w, shape.h * .95, shape.d); const brim = mesh(geo(new T.CylinderGeometry(R * .72, R * .72, .012, 28, 1, false, -Math.PI / 2, Math.PI)), std(mix(kit.c1, '#000000', .25), .6), head, [0, R * .47, R * .76]); brim.rotation.x = .2; brim.scale.z = 1.1; mesh(geo(new T.SphereGeometry(.022, 10, 8)), trim, head, [0, R * 1.07, -R * .06]); }
  if (acc('acc-headband')) { const b = mesh(geo(new T.TorusGeometry(R * 1.015, .024, 10, seg)), std(kit.c2, .6), head, [0, R * .38, -R * .04]); b.rotation.x = Math.PI / 2 - .2; b.scale.set(shape.w, shape.d, 1); }
  if (acc('acc-crown')) { const c = new T.Group(); c.position.set(0, R * .94, 0); c.rotation.x = -.1; head.add(c); mesh(geo(new T.CylinderGeometry(.19, .17, .06, 28, 1, true)), gold, c); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, spike = mesh(geo(new T.ConeGeometry(.034, .11, 10)), gold, c, [Math.sin(a) * .18, .08, Math.cos(a) * .18]); spike.rotation.set(Math.cos(a) * .12, 0, -Math.sin(a) * .12); mesh(geo(new T.SphereGeometry(.016, 10, 8)), std(['#e63946', '#3a86ff', '#2ec27e'][i % 3], .2, .1, { emissive: ['#e63946', '#3a86ff', '#2ec27e'][i % 3], emissiveIntensity: .5 }), c, [Math.sin(a) * .18, .03, Math.cos(a) * .18], false); } }
  if (acc('acc-glasses')) { const frame = std('#111317', .35, .3), lensMat = phys('#9bc4ff', { transparent: true, opacity: .22, roughness: .05, clearcoat: 1, envMapIntensity: 2 }); for (const s of [-1, 1]) { const x = s * .118, y = .03, z = faceZ(x, y) + .008, r = mesh(geo(new T.TorusGeometry(.074, .0085, 10, 32)), frame, head, [x, y, z], false); r.scale.set(1, 1.1, 1); const lens = new T.Mesh(geo(new T.CircleGeometry(.072, 28)), lensMat); lens.position.set(x, y, z); lens.scale.set(1, 1.1, 1); head.add(lens); const arm = mesh(geo(new T.CylinderGeometry(.006, .006, .2, 6)), frame, head, [s * (R * shape.w * .98), y, z - .1], false); arm.rotation.x = Math.PI / 2; } mesh(geo(new T.CylinderGeometry(.006, .006, .05, 6)), frame, head, [0, .04, faceZ(0, .04) + .008], false).rotation.z = Math.PI / 2; }
  if (acc('acc-headphones')) { const dk = std('#1a1c20', .45, .2), ac = std(kit.c1, .4); const band = mesh(geo(new T.TorusGeometry(R * 1.12, .017, 10, 40, Math.PI)), dk, head, [0, -.005, -.01]); band.scale.set(shape.w, shape.h, 1); for (const s of [-1, 1]) { const cup = mesh(geo(new T.CylinderGeometry(.088, .088, .05, 28)), dk, head, [s * R * shape.w * 1.1, -.005, -.01]); cup.rotation.z = Math.PI / 2; const pad = mesh(geo(new T.TorusGeometry(.075, .02, 10, 24)), ac, head, [s * R * shape.w * 1.04, -.005, -.01]); pad.rotation.y = Math.PI / 2; } }
  if (acc('acc-scarf')) { const c = document.createElement('canvas'); c.width = 128; c.height = 32; const x = c.getContext('2d'); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? kit.c2 : kit.c1; x.fillRect(i * 16, 0, 16, 32); } const st = tex(c), sc = mesh(geo(new T.TorusGeometry(.098, .042, 14, 28)), std('#ffffff', .85, 0, { map: st }), torso, [0, DIM.torso + .0, .01]); sc.rotation.x = Math.PI / 2; sc.scale.set(1, 1.05, .9); const tail = mesh(geo(new T.BoxGeometry(.075, .26, .028)), std('#ffffff', .85, 0, { map: st }), torso, [.07, DIM.torso - .14, .17]); tail.rotation.z = .08; tail.rotation.x = -.08; }

  // --- Bras : épaule > coude > main.
  const armX = female ? .242 : .262, arms = {};
  for (const [key, s] of [['L', 1], ['R', -1]]) {
    const shoulder = new T.Group(); shoulder.position.set(s * armX, DIM.torso - .075, 0); torso.add(shoulder);
    mesh(geo(new T.SphereGeometry(.068, 18, 14)), sleeve, shoulder);
    const upper = mesh(geo(new T.CapsuleGeometry(.054, .15, 6, 14)), sleeve, shoulder, [0, -.12, 0]); upper.scale.set(1.04, 1, 1.04);
    mesh(geo(new T.CylinderGeometry(.059, .059, .026, 18)), trim, shoulder, [0, -.2, 0]);
    mesh(geo(new T.CapsuleGeometry(.046, .12, 6, 14)), skin, shoulder, [0, -.255, 0]);
    const elbow = new T.Group(); elbow.position.y = -.235; shoulder.add(elbow);
    mesh(geo(new T.SphereGeometry(.047, 14, 12)), skin, elbow);
    mesh(geo(new T.CapsuleGeometry(.043, .14, 6, 14)), skin, elbow, [0, -.11, 0]);
    const hand = new T.Group(); hand.position.y = -.235; elbow.add(hand); const palm = mesh(geo(new T.SphereGeometry(.056, 16, 12)), skin, hand); palm.scale.set(.88, 1.1, .75);
    const thumb = mesh(geo(new T.CapsuleGeometry(.016, .034, 4, 8)), skin, hand, [-s * .045, .01, .03]); thumb.rotation.z = -s * .6;
    if (key === 'L' && acc('acc-captain')) { const band = mesh(geo(new T.CylinderGeometry(.062, .062, .05, 20, 1, true)), std('#f5d418', .6, 0, { side: T.DoubleSide }), shoulder, [0, -.09, 0]); mesh(geo(new T.CylinderGeometry(.0635, .0635, .008, 20, 1, true)), std('#101214', .6, 0, { side: T.DoubleSide }), shoulder, [0, -.09, 0]); }
    arms[key] = { shoulder, elbow, hand };
  }
  // --- Jambes : cuisse > genou > pied avec crampons.
  const legs = {}, legX = female ? .092 : .105;
  for (const [key, s] of [['L', 1], ['R', -1]]) {
    const thigh = new T.Group(); thigh.position.set(s * legX, -.02, 0); hips.add(thigh);
    mesh(geo(new T.CapsuleGeometry(.082, .2, 6, 14)), skin, thigh, [0, -.14, 0]);
    mesh(geo(new T.CapsuleGeometry(.104, .1, 6, 14)), shortsMat, thigh, [0, -.07, 0]);
    const knee = new T.Group(); knee.position.y = -DIM.thigh; thigh.add(knee);
    mesh(geo(new T.SphereGeometry(.075, 16, 12)), skin, knee);
    const shin = mesh(geo(new T.CapsuleGeometry(.07, DIM.shin - .1, 6, 14)), sockMat, knee, [0, -DIM.shin / 2 - .01, 0]); shin.scale.set(1, 1, 1.02);
    const band = mesh(geo(new T.TorusGeometry(.073, .011, 8, 22)), trim, knee, [0, -.09, 0]); band.rotation.x = Math.PI / 2;
    const foot = new T.Group(); foot.position.y = -DIM.shin; knee.add(foot);
    const shoe = mesh(geo(new T.SphereGeometry(.07, 22, 16)), boot, foot, [0, -.05, .05]); shoe.scale.set(1.02, .8, 1.78);
    const plate = mesh(geo(new T.SphereGeometry(.072, 18, 10)), sole, foot, [0, -.092, .052]); plate.scale.set(1.04, .16, 1.8);
    for (const [sx, sz] of [[-.035, -.02], [.035, -.02], [-.035, .13], [.035, .13]]) mesh(geo(new T.CylinderGeometry(.008, .014, .026, 6)), sole, foot, [sx, -.108, sz], false);
    legs[key] = { thigh, knee, foot };
  }
  // --- Ballon (poses « ballon sous le bras » et « pied sur le ballon »)
  const ballTex = tex(ballTexture()), ballMat = phys('#ffffff', { map: ballTex, roughness: .35, clearcoat: .5, clearcoatRoughness: .3 });
  const ball = mesh(geo(new T.SphereGeometry(.125, 36, 26)), ballMat, lift, [0, .125, .5]); ball.visible = false;

  // --- Objets de vitrine posés au sol
  const trophyGroup = new T.Group(); lift.add(trophyGroup);
  const lathe = (pts, m) => mesh(geo(new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), 28)), m, new T.Group());
  const makeTrophy = id => {
    const g = new T.Group();
    if (id === 'trophy-cup') { g.add(...[lathe([[0, 0], [.07, 0], [.08, .02], [.04, .04], [.025, .16], [.05, .19], [.11, .26], [.13, .36], [.1, .36], [.0, .3]], gold)]); const h = new T.TorusGeometry(.07, .014, 8, 16, Math.PI); for (const s of [-1, 1]) { const handle = mesh(geo(h), gold, g, [s * .13, .28, 0], false); handle.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2; } }
    else if (id === 'trophy-pichichi') { mesh(geo(new T.CylinderGeometry(.075, .095, .05, 24)), std('#1a1c20', .4, .5), g, [0, .025, 0]); g.add(lathe([[0, .05], [.045, .05], [.03, .12], [.022, .2], [.04, .22], [0, .24]], gold)); const sc = mesh(geo(new T.SphereGeometry(.07, 26, 20)), gold, g, [0, .31, 0]); sc.scale.y = 1.08; for (const s of [-1, 1]) { const laurel = mesh(geo(new T.TorusGeometry(.085, .011, 8, 20, Math.PI * .85)), gold, g, [0, .3, 0], false); laurel.rotation.set(0, s * .5, s > 0 ? Math.PI * .08 : Math.PI * .92); } }
    else if (id === 'trophy-ball') { mesh(geo(new T.SphereGeometry(.13, 30, 22)), phys('#e6b422', { metalness: 1, roughness: .2, clearcoat: .6 }), g, [0, .19, 0]); mesh(geo(new T.CylinderGeometry(.07, .09, .06, 20)), std('#1a1c20', .4, .5), g, [0, .03, 0]); }
    else if (id === 'trophy-boot') { const b = mesh(geo(new T.SphereGeometry(.1, 22, 16)), gold, g, [0, .12, .03]); b.scale.set(.8, .75, 1.7); const shaft = mesh(geo(new T.CapsuleGeometry(.062, .1, 6, 12)), gold, g, [0, .21, -.07]); shaft.rotation.x = -.2; mesh(geo(new T.CylinderGeometry(.09, .1, .035, 20)), std('#1a1c20', .4, .5), g, [0, .0175, 0]); }
    else { const palm = mesh(geo(new T.SphereGeometry(.09, 20, 14)), gold, g, [0, .17, 0]); palm.scale.set(1, 1.1, .6); for (let i = 0; i < 4; i++) { const f = mesh(geo(new T.CapsuleGeometry(.016, .075, 4, 8)), gold, g, [-.052 + i * .035, .27, 0]); f.rotation.z = (i - 1.5) * -.06; } const th = mesh(geo(new T.CapsuleGeometry(.018, .06, 4, 8)), gold, g, [.095, .2, 0]); th.rotation.z = -1; mesh(geo(new T.CylinderGeometry(.07, .09, .035, 20)), std('#1a1c20', .4, .5), g, [0, .0175, 0]); }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g;
  };
  look.showcase.forEach((id, i) => { const t = makeTrophy(id), spots = [[-.55, .32], [.55, .32], [0, .6]], spot = spots[i % 3]; t.position.set(spot[0], 0, spot[1]); t.scale.setScalar(look.showcase.length > 2 ? .85 : 1); t.rotation.y = -spot[0] * .6; trophyGroup.add(t); });

  // --- Socle
  const base = new T.Group(); root.add(base);
  const baseTop = .07;
  const addRing = (r, color, intensity) => { const m = mesh(geo(new T.TorusGeometry(r, .012, 8, 72)), std(color, .3, 0, { emissive: color, emissiveIntensity: intensity }), base, [0, baseTop + .001, 0], false); m.rotation.x = Math.PI / 2; return m; };
  const disc = (r0, r1, h, material, y = 0) => mesh(geo(new T.CylinderGeometry(r0, r1, h, 72)), material, base, [0, y + h / 2, 0]);
  let neon = null;
  if (baseKind === 'base-grass') { const grass = std('#ffffff', .95, 0, { map: tex(grassTexture(), { repeat: [2.2, 2.2] }) }); disc(.66, .68, .07, std('#3a2a1c', .9)); const top = new T.Mesh(geo(new T.CylinderGeometry(.64, .64, .012, 72)), grass); top.position.y = .072; top.receiveShadow = true; base.add(top); }
  else if (baseKind === 'base-silver') { const metal = phys('#d7dce3', { metalness: 1, roughness: .22, clearcoat: .4 }); disc(.68, .7, .05, metal); disc(.6, .62, .03, metal, .05); addRing(.64, '#9db8ff', .5); }
  else if (baseKind === 'base-gold') { disc(.7, .72, .05, gold); disc(.6, .62, .035, gold, .05); disc(.46, .48, .025, std('#111317', .45, .3), .085); }
  else if (baseKind === 'base-neon') { disc(.66, .68, .07, std('#0c0f16', .35, .4)); neon = addRing(.6, '#2ee6ff', 1.6); addRing(.5, '#ff3bd4', 1.2); }
  else { disc(.64, .66, .07, std('#171b1f', .42, .35)); addRing(.6, '#c6ff3d', .7); }
  const shadowDisc = new T.Mesh(geo(new T.PlaneGeometry(.95, .62)), new T.MeshBasicMaterial({ map: tex(shadowTexture()), transparent: true, depthWrite: false, opacity: .95 })); shadowDisc.rotation.x = -Math.PI / 2; shadowDisc.position.set(0, topY + .004, 0); base.add(shadowDisc);
  let glow = null; if (neon && q.glow) { glow = new T.Mesh(geo(new T.PlaneGeometry(1.8, 1.8)), new T.MeshBasicMaterial({ map: tex(glowTexture('#2ee6ff')), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: .55, toneMapped: false })); glow.rotation.x = -Math.PI / 2; glow.position.y = topY + .01; base.add(glow); }
  return {
    look, root, lift, hips, torso, head, arms, legs, eyes, lids, brows, mouths, mouth, ball, neon, glow, baseTop: topY, shapeScale: shape, faceZ,
    top: topY + DIM.hip + DIM.torso + R * 2 + .1,
    dispose() { for (const object of disposables) object.dispose?.(); root.traverse(o => { if (o.isInstancedMesh) o.dispose?.(); }); }
  };
}
