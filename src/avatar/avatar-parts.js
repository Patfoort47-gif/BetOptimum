// Personnage 3D de BetOptimum (BET-49) : construction du footballeur, de la tête aux crampons, à partir d'une configuration d'avatar.
// Modélisation procédurale (aucun fichier à télécharger) : grosse tête expressive, yeux brillants, cheveux en mèches, maillot en maille, matériaux PBR.
// Le module reçoit l'espace de noms Three.js en paramètre : il n'importe rien et ne touche pas au DOM hors <canvas>. Le graphiste pourra remplacer ce personnage par un .glb (BET-47) sans changer la configuration.
import { SKINS, EYES, HAIR_COLORS, BOOTS, KITS, sanitizeAvatar } from './avatar-config.js';
import {
  drawKit,
  irisTexture,
  blushTexture,
  grassTexture,
  weaveTexture,
  ballTexture,
  glowTexture,
  shadowTexture
} from './avatar-scenes.js';

export const DIM = { hip: 0.72, thigh: 0.28, shin: 0.34, torso: 0.48, head: 0.33 };
const FACE_SHAPES = {
  round: { w: 1.05, h: 1, d: 1, jaw: 0.06, cheek: 0.05, chin: 0.02 },
  oval: { w: 0.98, h: 1.06, d: 1, jaw: -0.05, cheek: 0, chin: 0.07 },
  long: { w: 0.92, h: 1.14, d: 0.98, jaw: -0.1, cheek: -0.02, chin: 0.1 },
  square: { w: 1.02, h: 0.98, d: 1, jaw: 0.18, cheek: 0.02, chin: -0.03 },
  heart: { w: 1, h: 1.02, d: 1, jaw: -0.22, cheek: 0.07, chin: 0.08 },
  wide: { w: 1.14, h: 0.96, d: 1, jaw: 0.09, cheek: 0.09, chin: 0 }
};
const FACE_KEYS = ['round', 'oval', 'long', 'square', 'heart', 'wide'];
// Expressions : angle des paupières (-1,3 ouvert, 0,8 fermé), sourcils, bouche.
export const EXPRESSIONS = {
  smile: { mouth: 'smile', lid: [-1.28, -1.28], brow: [0, 0], tilt: 0, scale: 1 },
  focus: { mouth: 'flat', lid: [-0.78, -0.78], brow: [-0.014, -0.014], tilt: -0.24, scale: 1 },
  wink: { mouth: 'smile', lid: [-1.28, 0.85], brow: [0, -0.012], tilt: 0, scale: 1 },
  confident: { mouth: 'smirk', lid: [-1.12, -1.12], brow: [0.02, 0], tilt: 0.08, scale: 1 },
  joy: { mouth: 'open', lid: [-0.72, -0.72], brow: [0.014, 0.014], tilt: 0.16, scale: 1 },
  surprise: { mouth: 'o', lid: [-1.45, -1.45], brow: [0.034, 0.034], tilt: 0.22, scale: 1.12 }
};
const rng = (seed) => {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
};
const mix = (a, b, t) => {
  const p = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)),
    x = p(a),
    y = p(b);
  return `#${x
    .map((v, i) =>
      Math.round(v + (y[i] - v) * t)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;
};
const lerp = (a, b, t) => a + (b - a) * t;

export function buildCharacter(T, input, q) {
  const look = sanitizeAvatar(input),
    owned = [],
    disposables = new Set();
  const track = (object) => {
    disposables.add(object);
    return object;
  };
  const tex = (canvas, opts = {}) => {
    const t = track(new T.CanvasTexture(canvas));
    t.colorSpace = opts.linear ? T.NoColorSpace : T.SRGBColorSpace;
    t.anisotropy = 4;
    if (opts.repeat) {
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.repeat.set(...opts.repeat);
    }
    return t;
  };
  const std = (color, rough = 0.6, metal = 0, extra = {}) =>
    track(new T.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
  const phys = (color, extra = {}) => track(new T.MeshPhysicalMaterial({ color, ...extra }));
  const geo = (g) => track(g);
  const seg = q.segments,
    R = DIM.head,
    skinHex = SKINS[look.skin][0],
    kit = KITS[look.kit.item] ?? KITS['start-lime'],
    hairHex = HAIR_COLORS[look.hairColor][0],
    shape = FACE_SHAPES[FACE_KEYS[look.face]],
    female = look.body === 'f';
  const root = new T.Group(),
    lift = new T.Group(),
    baseKind = look.base,
    topY = baseKind === 'base-gold' ? 0.11 : baseKind === 'base-grass' ? 0.078 : 0.07;
  lift.position.y = topY;
  root.add(lift);
  const mesh = (geometry, material, parent, pos = [0, 0, 0], shadow = true) => {
    const m = new T.Mesh(geometry, material);
    m.position.set(...pos);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // Matériaux : peau douce (reflet de bord), maille du maillot, cheveux brillants.
  const skin = phys(mix(skinHex, '#d98a5a', 0.12), {
    roughness: 0.6,
    sheen: 0.35,
    sheenRoughness: 0.5,
    sheenColor: new T.Color(mix(skinHex, '#ff8f7a', 0.4)),
    clearcoat: 0.05,
    clearcoatRoughness: 0.6
  });
  const kitCanvas = document.createElement('canvas');
  kitCanvas.width = kitCanvas.height = q.segments > 30 ? 1024 : 512;
  drawKit(kitCanvas, look.kit.item, look.kit.number, look.kit.name);
  const weave = tex(weaveTexture(), { linear: true, repeat: [18, 12] });
  const jersey = phys('#ffffff', {
    map: tex(kitCanvas),
    roughness: 0.78,
    sheen: 0.8,
    sheenRoughness: 0.55,
    sheenColor: new T.Color(mix(kit.c1, '#ffffff', 0.5)),
    bumpMap: weave,
    bumpScale: 0.018
  });
  const sleeve = std(kit.c1, 0.78, 0, { bumpMap: weave, bumpScale: 0.012 }),
    trim = std(kit.c2, 0.7),
    shortsMat = std(kit.c2, 0.74, 0, { bumpMap: weave, bumpScale: 0.012 }),
    sockMat = std(kit.c1, 0.8);
  const hairMap = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#d9d9d9';
    x.fillRect(0, 0, 256, 256);
    const r = rng('streaks');
    for (let i = 0; i < 520; i++) {
      const g = 120 + Math.floor(r() * 135),
        px = r() * 256,
        w = 0.8 + r() * 2.2;
      x.strokeStyle = `rgba(${g},${g},${g},${0.35 + r() * 0.5})`;
      x.lineWidth = w;
      x.beginPath();
      x.moveTo(px, 0);
      x.bezierCurveTo(
        px + (r() - 0.5) * 14,
        80,
        px + (r() - 0.5) * 14,
        170,
        px + (r() - 0.5) * 10,
        256
      );
      x.stroke();
    }
    return tex(c, { repeat: [5, 1] });
  })();
  const hairMat = phys(hairHex, {
    map: hairMap,
    bumpMap: hairMap,
    bumpScale: 0.003,
    roughness: 0.68,
    sheen: 0.45,
    sheenRoughness: 0.65,
    sheenColor: new T.Color(mix(hairHex, '#ffffff', 0.18)),
    clearcoat: 0.04,
    clearcoatRoughness: 0.7
  });
  const stubble = phys(mix(hairHex, skinHex, 0.62), { roughness: 0.6, sheen: 0.4 });
  const boot = phys(BOOTS[look.boots][0], {
      roughness: 0.38,
      clearcoat: 0.7,
      clearcoatRoughness: 0.25
    }),
    sole = std('#101214', 0.7);

  // --- Squelette : racine > bassin > torse > (cou, tête, épaules) ; cuisses > genoux > pieds.
  const hips = new T.Group();
  hips.position.y = DIM.hip;
  lift.add(hips);
  const torso = new T.Group();
  hips.add(torso);
  // Bassin et short
  const pelvis = mesh(geo(new T.SphereGeometry(0.205, seg, 16)), shortsMat, hips);
  pelvis.scale.set(female ? 1.02 : 1, 0.66, 0.78);
  pelvis.position.y = -0.01;
  // Torse en révolution : profil mesuré en hauteur pour que la texture du maillot épouse le corps.
  const prof = female
    ? [
        [0, 0.17],
        [0.06, 0.184],
        [0.16, 0.158],
        [0.3, 0.196],
        [0.4, 0.2],
        [0.455, 0.15],
        [0.48, 0.07]
      ]
    : [
        [0, 0.178],
        [0.06, 0.194],
        [0.17, 0.178],
        [0.32, 0.212],
        [0.42, 0.218],
        [0.455, 0.155],
        [0.48, 0.07]
      ];
  const profile = [];
  for (let i = 0; i <= 28; i++) {
    const y = (DIM.torso * i) / 28;
    let k = 0;
    while (k < prof.length - 2 && prof[k + 1][0] < y) k++;
    const [y0, r0] = prof[k],
      [y1, r1] = prof[k + 1],
      t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0))),
      s = t * t * (3 - 2 * t);
    profile.push(new T.Vector2(lerp(r0, r1, s), y));
  }
  const chest = mesh(geo(new T.LatheGeometry(profile, seg)), jersey, torso);
  chest.scale.z = 0.74;
  const neck = mesh(geo(new T.CylinderGeometry(0.052, 0.06, 0.13, 16)), skin, torso, [
    0,
    DIM.torso + 0.035,
    0.005
  ]);
  const collar = mesh(geo(new T.TorusGeometry(0.075, 0.014, 8, 24)), trim, torso, [
    0,
    DIM.torso - 0.002,
    0.008
  ]);
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1, 1.05, 0.8);

  // --- Tête : sphère déformée (forme du visage), traits posés à sa surface.
  const head = new T.Group();
  head.position.set(0, DIM.torso + 0.02 + R * 0.94, 0.012);
  torso.add(head);
  const sphere = new T.SphereGeometry(R, seg, Math.round(seg * 0.75)),
    pos = sphere.attributes.position,
    nor = sphere.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i);
    const u = y / R,
      low = Math.max(0, -u);
    x *=
      shape.w *
      (1 + shape.jaw * Math.pow(low, 1.3) + shape.cheek * Math.max(0, 1 - Math.abs(u + 0.2) * 2.2));
    y *= shape.h;
    z *= shape.d;
    if (y < 0 && z > 0) y -= shape.chin * R * low * (z / R);
    pos.setXYZ(i, x, y, z);
    const nx = nor.getX(i) / shape.w,
      ny = nor.getY(i) / shape.h,
      nz = nor.getZ(i) / shape.d,
      l = Math.hypot(nx, ny, nz);
    nor.setXYZ(i, nx / l, ny / l, nz / l);
  }
  mesh(geo(sphere), skin, head);
  const faceZ = (x, y) =>
    R * shape.d * Math.sqrt(Math.max(0, 1 - (x / (R * shape.w)) ** 2 - (y / (R * shape.h)) ** 2));
  for (const side of [-1, 1]) {
    const ear = mesh(geo(new T.SphereGeometry(0.058, 16, 12)), skin, head, [
      side * R * shape.w * 0.985,
      -0.012,
      -0.01
    ]);
    ear.scale.set(0.42, 1, 0.78);
    ear.rotation.z = side * -0.12;
  }
  mesh(geo(new T.SphereGeometry(0.03, 16, 12)), skin, head, [
    0,
    -0.05,
    faceZ(0, -0.05) + 0.008
  ]).scale.set(1, 0.85, 1.1);
  // Joues rosées
  const blush = std('#ffffff', 1, 0, {
    map: tex(blushTexture()),
    transparent: true,
    depthWrite: false,
    opacity: look.skin >= 3 ? 0.35 : 0.75
  });
  for (const side of [-1, 1]) {
    const plane = new T.Mesh(geo(new T.PlaneGeometry(0.1, 0.075)), blush);
    plane.position.set(side * 0.165, -0.06, faceZ(side * 0.165, -0.06) + 0.004);
    plane.rotation.y = side * 0.5;
    head.add(plane);
  }
  // Yeux : blanc brillant, iris détaillé avec reflets, cornée réfléchissante, paupière qui se ferme.
  const irisMat = std('#ffffff', 0.25, 0, {
    map: tex(irisTexture(EYES[look.eyes][0])),
    transparent: true,
    emissive: '#ffffff',
    emissiveMap: tex(irisTexture(EYES[look.eyes][0])),
    emissiveIntensity: 0.1
  });
  const white = phys('#fbfbf8', { roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05 }),
    cornea = phys('#ffffff', {
      roughness: 0,
      transmission: 0,
      transparent: true,
      opacity: 0.14,
      clearcoat: 1,
      clearcoatRoughness: 0,
      envMapIntensity: 2.2
    }),
    shine = new T.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
  const eyes = [],
    lids = [],
    brows = [],
    browMat = std(mix(hairHex, '#000000', 0.25), 0.6);
  for (const side of [-1, 1]) {
    const x = side * 0.118,
      y = 0.03,
      z = faceZ(x, y) - 0.018,
      g = new T.Group();
    g.position.set(x, y, z);
    head.add(g);
    const ball = mesh(geo(new T.SphereGeometry(0.068, 24, 18)), white, g, [0, 0, 0], false);
    ball.scale.set(1, 1.18, 0.62);
    const irisGroup = new T.Group();
    irisGroup.position.z = 0.0425;
    g.add(irisGroup);
    const iris = new T.Mesh(geo(new T.CircleGeometry(0.04, 28)), irisMat);
    irisGroup.add(iris);
    const h1 = new T.Mesh(geo(new T.CircleGeometry(0.0125, 14)), shine);
    h1.position.set(0.014, 0.018, 0.002);
    irisGroup.add(h1);
    const h2 = new T.Mesh(geo(new T.CircleGeometry(0.0058, 10)), shine);
    h2.position.set(-0.014, -0.016, 0.002);
    irisGroup.add(h2);
    const glass = mesh(geo(new T.SphereGeometry(0.0705, 24, 18)), cornea, g, [0, 0, 0], false);
    glass.scale.set(1, 1.18, 0.66);
    const lid = new T.Group();
    g.add(lid);
    const lidMesh = mesh(
      geo(new T.SphereGeometry(0.0745, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2)),
      skin,
      lid,
      [0, 0, 0],
      false
    );
    lidMesh.scale.set(1.02, 1.2, 0.72);
    eyes.push({ group: g, iris: irisGroup, side });
    lids.push(lid);
    const curve = new T.CatmullRomCurve3([
        new T.Vector3(-0.058, -0.004, 0),
        new T.Vector3(-0.01, 0.013, 0.004),
        new T.Vector3(0.058, -0.002, 0)
      ]),
      brow = new T.Mesh(geo(new T.TubeGeometry(curve, 14, 0.0092, 6, false)), browMat);
    brow.position.set(x, 0.122, faceZ(x, 0.122) + 0.004);
    brow.scale.x = side;
    brow.rotation.y = side * 0.22;
    head.add(brow);
    brows.push(brow);
  }
  // Bouches : une par expression, une seule visible à la fois.
  const lipHex = mix(skinHex, '#9b2f33', 0.55),
    lips = std(lipHex, 0.45),
    dark = std('#340c12', 0.8),
    teeth = std('#fbfbf6', 0.4),
    tongue = std('#e0707a', 0.6);
  const mouth = new T.Group();
  mouth.position.set(0, -0.118, faceZ(0, -0.118) + 0.003);
  head.add(mouth);
  const arc = (arcLen, radius = 0.062) => {
    const m = new T.Mesh(geo(new T.TorusGeometry(radius, 0.0085, 8, 28, arcLen)), lips);
    m.rotation.z = Math.PI * 1.5 - arcLen / 2;
    m.position.y = radius * 0.85;
    return m;
  };
  const shapeMouth = (w, h) => {
    const s = new T.Shape();
    s.moveTo(-w, 0);
    s.quadraticCurveTo(0, h * 0.1, w, 0);
    s.quadraticCurveTo(w * 0.9, -h * 1.5, 0, -h * 1.6);
    s.quadraticCurveTo(-w * 0.9, -h * 1.5, -w, 0);
    return new T.ShapeGeometry(s, 14);
  };
  const flat = new T.Mesh(geo(new T.CapsuleGeometry(0.0075, 0.066, 4, 8)), lips);
  flat.rotation.z = Math.PI / 2;
  flat.position.y = -0.006;
  const mouths = { smile: arc(1.9), smirk: arc(1.25, 0.058), flat };
  mouths.smirk.position.x = 0.022;
  mouths.smirk.rotation.z += 0.2;
  const open = new T.Group();
  open.add(new T.Mesh(geo(shapeMouth(0.07, 0.05)), lips));
  const inner = new T.Mesh(geo(shapeMouth(0.058, 0.042)), dark);
  inner.position.z = 0.0015;
  open.add(inner);
  const tooth = new T.Mesh(geo(new T.PlaneGeometry(0.098, 0.017)), teeth);
  tooth.position.set(0, -0.009, 0.003);
  open.add(tooth);
  const tg = new T.Mesh(geo(new T.CircleGeometry(0.03, 16)), tongue);
  tg.scale.set(1.4, 0.65, 1);
  tg.position.set(0, -0.062, 0.003);
  open.add(tg);
  open.position.y = 0.016;
  mouths.open = open;
  const ring = new T.Group();
  ring.add(new T.Mesh(geo(new T.CircleGeometry(0.032, 20)), lips));
  const hole = new T.Mesh(geo(new T.CircleGeometry(0.023, 20)), dark);
  hole.position.z = 0.0015;
  ring.add(hole);
  ring.scale.set(0.85, 1.15, 1);
  ring.position.y = -0.01;
  mouths.o = ring;
  for (const key in mouths) {
    mouths[key].visible = false;
    mouth.add(mouths[key]);
  }

  // --- Cheveux : calotte, mèches (instances) et formes propres à chaque coiffure.
  const hairGroup = new T.Group();
  head.add(hairGroup);
  const hat = look.accessories.some((id) => id === 'acc-cap' || id === 'acc-crown');
  // Contour commun : front dégagé, tempes et nuque continues, sans calotte inclinée.
  const hr = R * 1.025,
    rg = rng(`hair${look.hair}`);
  const hairline = (phi) => 0.39 + (0.2 * (1 - Math.cos(phi))) / 2;
  const capGeo = (theta, k = 1) => {
    const g = new T.SphereGeometry(
        hr * k,
        seg,
        Math.round(seg * 0.6),
        0,
        Math.PI * 2,
        0,
        Math.PI / 2
      ),
      p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i),
        phi = Math.atan2(x, z),
        t = Math.acos(Math.min(1, Math.max(-1, y / (hr * k)))) / (Math.PI / 2),
        end = Math.min(theta, hairline(phi) * Math.PI),
        a = t * end;
      p.setXYZ(
        i,
        Math.sin(a) * Math.sin(phi) * hr * k * shape.w,
        Math.cos(a) * hr * k * shape.h,
        Math.sin(a) * Math.cos(phi) * hr * k * shape.d
      );
    }
    g.computeVertexNormals();
    return g;
  };
  const cap = (theta, material = hairMat, k = 1) =>
    mesh(geo(capGeo(theta, k)), material, hairGroup);
  const dirOf = (theta, phi) =>
    new T.Vector3(
      Math.sin(theta) * Math.sin(phi),
      Math.cos(theta),
      Math.sin(theta) * Math.cos(phi)
    );
  const clumpGeo = geo(new T.CapsuleGeometry(0.5, 1, 4, 8)),
    curlGeo = geo(new T.SphereGeometry(1, 10, 8)),
    ups = new T.Vector3(0, 1, 0),
    tmpM = new T.Matrix4(),
    tmpQ = new T.Quaternion(),
    tmpS = new T.Vector3(),
    tmpP = new T.Vector3();
  const tilt = new T.Matrix4();
  const place = (geometry, material, items) => {
    if (!items.length) return;
    const inst = new T.InstancedMesh(geometry, material, items.length);
    items.forEach((it, i) => {
      tmpM.compose(it.p, it.q, it.s);
      inst.setMatrixAt(i, tmpM);
    });
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.applyMatrix4(tilt);
    hairGroup.add(inst);
  };
  const strands = [],
    curls = [];
  const basisQ = (normal, tangent) => {
    const y = tangent.clone().addScaledVector(normal, -tangent.dot(normal)).normalize(),
      x = new T.Vector3().crossVectors(y, normal).normalize();
    return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, normal));
  };
  const strand = (theta, phi, len, w, th, sweep = 0, dirOverride = null) => {
    if (hat && theta < Math.PI * 0.34) return;
    const d = dirOf(theta, phi),
      t =
        dirOverride ??
        new T.Vector3(
          Math.cos(theta) * Math.sin(phi + sweep),
          -Math.sin(theta),
          Math.cos(theta) * Math.cos(phi + sweep)
        ).normalize();
    strands.push({
      p: d
        .clone()
        .multiply(new T.Vector3(shape.w, shape.h, shape.d))
        .multiplyScalar(hr * (dirOverride ? 0.99 : 1.0))
        .addScaledVector(t, len * 0.32),
      q: basisQ(d, t),
      s: new T.Vector3(w / 0.5, len / 2, th / 0.5)
    });
  };
  const curl = (theta, phi, r, lift = 1.04) => {
    if (hat && theta < Math.PI * 0.34) return;
    const d = dirOf(theta, phi);
    curls.push({
      p: d.multiply(new T.Vector3(shape.w, shape.h, shape.d)).multiplyScalar(hr * lift),
      q: new T.Quaternion(),
      s: new T.Vector3(r, r, r)
    });
  };
  const front = (phi) => Math.abs(Math.atan2(Math.sin(phi), Math.cos(phi))) < 0.85;
  const spread = (count, tMin, tMax, len, w, th, opts = {}) => {
    for (let i = 0; i < count * 0.8; i++) {
      const phi = rg() * Math.PI * 2,
        theta = lerp(tMin, Math.min(tMax, hairline(phi) - 0.035), rg()) * Math.PI;
      if (front(phi) && theta > Math.PI * (opts.hairline ?? 0.31)) continue;
      strand(theta, phi, len * (0.65 + rg() * 0.2), w * 0.8, th * 0.45, opts.sweep ?? 0.5);
    }
  };
  const style = [
    'short',
    'fade',
    'mohawk',
    'afro',
    'bun',
    'shaved',
    'curls',
    'long',
    'braids',
    'quiff',
    'curly',
    'ponytail'
  ][look.hair];
  // Mèches continues et effilées : plus de chapelets de sphères disjointes.
  const chain = (points, rad0, rad1, material = hairMat) => {
    const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
      g = new T.TubeGeometry(curve, 24, rad0, 8, false),
      position = g.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const t = Math.floor(i / 9) / 24,
        center = curve.getPointAt(t),
        v = new T.Vector3().fromBufferAttribute(position, i);
      v.sub(center)
        .multiplyScalar(lerp(1, rad1 / rad0, t))
        .add(center);
      position.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return mesh(geo(g), material, hairGroup);
  };
  const tie = (p, color = '#f4f4f0') => {
    const m = mesh(geo(new T.TorusGeometry(0.04, 0.011, 8, 16)), std(color, 0.5), hairGroup, p);
    m.rotation.x = Math.PI / 2;
    return m;
  };
  if (style === 'short') {
    cap(Math.PI * 0.6);
    spread(100, 0.03, 0.56, 0.085, 0.016, 0.01);
    for (let i = 0; i < 9; i++)
      strand(Math.PI * (0.25 + rg() * 0.05), (i - 4) * 0.17, 0.085, 0.03, 0.016, 0);
  } else if (style === 'fade') {
    cap(Math.PI * 0.52, stubble, 1.002);
    cap(Math.PI * 0.36, hairMat, 1.03);
    spread(60, 0.04, 0.34, 0.1, 0.026, 0.018, { sweep: 0.3 });
    for (let i = 0; i < 6; i++) strand(Math.PI * 0.3, (i - 2.5) * 0.22, 0.08, 0.024, 0.016, 0);
  } else if (style === 'mohawk') {
    cap(Math.PI * 0.56, stubble, 1.002);
    if (!hat) {
      const points = Array.from({ length: 13 }, (_, i) => {
        const a = lerp(-0.9, 1.25, i / 12);
        return [0, Math.cos(a) * hr * 1.17 * shape.h, Math.sin(a) * hr * shape.d];
      });
      chain(points, 0.042, 0.023);
    }
  } else if (style === 'afro') {
    cap(Math.PI * 0.62);
    for (let i = 0; i < 380; i++) {
      const theta = rg() * Math.PI * 0.66,
        phi = rg() * Math.PI * 2;
      if (front(phi) && theta > Math.PI * 0.36) continue;
      curl(theta, phi, 0.034 + rg() * 0.008, 1.1);
    }
  } else if (style === 'bun') {
    cap(Math.PI * 0.6);
    spread(70, 0.05, 0.56, 0.12, 0.024, 0.016, { sweep: 0.9 });
    mesh(geo(new T.SphereGeometry(0.105, 22, 16)), hairMat, hairGroup, [0, R * 0.86, -R * 0.6]);
    tie([0, R * 0.72, -R * 0.55]).rotation.x = Math.PI / 2.6;
  } else if (style === 'shaved') {
    cap(Math.PI * 0.58, stubble, 1.002);
  } else if (style === 'curls') {
    cap(Math.PI * 0.58);
    for (let i = 0; i < 240; i++) {
      const theta = rg() * Math.PI * 0.6,
        phi = rg() * Math.PI * 2;
      if (front(phi) && theta > Math.PI * 0.38) continue;
      curl(theta, phi, 0.029 + rg() * 0.007, 1.035);
    }
  } else if (style === 'long') {
    cap(Math.PI * 0.6);
    spread(80, 0.05, 0.58, 0.13, 0.025, 0.017, { sweep: 0.8 });
    const m = mesh(geo(new T.CapsuleGeometry(0.075, 0.3, 6, 12)), hairMat, hairGroup, [
      0,
      -0.16,
      -R * 0.8
    ]);
    m.scale.set(1.2, 1, 0.9);
    for (const s of [-1, 1]) {
      const lock = mesh(geo(new T.CapsuleGeometry(0.04, 0.2, 6, 10)), hairMat, hairGroup, [
        s * R * 0.92,
        -0.09,
        -R * 0.15
      ]);
      lock.rotation.z = s * 0.06;
    }
    tie([0, -0.03, -R * 0.82]);
  } else if (style === 'braids') {
    cap(Math.PI * 0.6);
    spread(60, 0.05, 0.56, 0.11, 0.024, 0.016, { sweep: 0.7 });
    for (let b = 0; b < 7; b++) {
      const phi = Math.PI * (0.62 + b * 0.125),
        d = dirOf(Math.PI * 0.56, phi).multiplyScalar(hr * 0.98),
        pts = [];
      for (let i = 0; i < 6; i++)
        pts.push([d.x * (1 + i * 0.05), d.y - i * 0.075, d.z * (1 + i * 0.07)]);
      chain(pts, 0.034, 0.024);
    }
  } else if (style === 'quiff') {
    cap(Math.PI * 0.58);
    spread(50, 0.05, 0.5, 0.1, 0.024, 0.016, { sweep: 0.4 });
    if (!hat)
      for (let i = 0; i < 7; i++)
        strand(
          Math.PI * 0.22,
          (i - 3) * 0.15,
          0.2,
          0.05,
          0.028,
          0,
          new T.Vector3((i - 3) * 0.05, 0.55, 0.83).normalize()
        );
  } else if (style === 'curly') {
    cap(Math.PI * 0.56);
    for (let i = 0; i < 170; i++) {
      const theta = rg() * Math.PI * 0.58,
        phi = rg() * Math.PI * 2;
      if (front(phi) && theta > Math.PI * 0.38) continue;
      curl(theta, phi, 0.034 + rg() * 0.012, 1.02);
    }
  } else if (style === 'ponytail') {
    cap(Math.PI * 0.6);
    spread(80, 0.05, 0.56, 0.12, 0.024, 0.016, { sweep: 1.2 });
    chain(
      [
        [0, 0.2, -0.35],
        [0, 0.215, -0.43],
        [0, 0.17, -0.5],
        [0, 0.08, -0.54],
        [0, -0.04, -0.55],
        [0, -0.16, -0.54]
      ],
      0.052,
      0.03
    );
    tie([0, 0.19, -0.34]);
  }
  place(clumpGeo, hairMat, strands);
  place(curlGeo, hairMat, curls);

  // --- Accessoires
  const acc = (id) => look.accessories.includes(id),
    gold = phys('#e6b422', { metalness: 1, roughness: 0.22, clearcoat: 0.5 });
  if (acc('acc-cap')) {
    const c = mesh(
      geo(new T.SphereGeometry(R * 1.1, seg, 16, 0, Math.PI * 2, 0, Math.PI * 0.5)),
      std(kit.c1, 0.65),
      head,
      [0, R * 0.1, -0.01]
    );
    c.rotation.x = -0.22;
    c.scale.set(shape.w, shape.h * 0.95, shape.d);
    const brim = mesh(
      geo(new T.CylinderGeometry(R * 0.72, R * 0.72, 0.012, 28, 1, false, -Math.PI / 2, Math.PI)),
      std(mix(kit.c1, '#000000', 0.25), 0.6),
      head,
      [0, R * 0.47, R * 0.76]
    );
    brim.rotation.x = 0.2;
    brim.scale.z = 1.1;
    mesh(geo(new T.SphereGeometry(0.022, 10, 8)), trim, head, [0, R * 1.07, -R * 0.06]);
  }
  if (acc('acc-cap')) {
    for (const angle of [-0.65, 0, 0.65]) {
      const seam = mesh(
        geo(new T.TorusGeometry(R * 1.104, 0.0025, 4, 24, Math.PI * 0.5)),
        trim,
        head,
        [0, R * 0.1, -0.01],
        false
      );
      seam.rotation.set(-0.22, angle, Math.PI * 0.25);
    }
  }
  if (acc('acc-headband')) {
    const b = mesh(geo(new T.TorusGeometry(R * 1.015, 0.024, 10, seg)), std(kit.c2, 0.6), head, [
      0,
      R * 0.38,
      -R * 0.04
    ]);
    b.rotation.x = Math.PI / 2 - 0.2;
    b.scale.set(shape.w, shape.d, 1);
  }
  if (acc('acc-crown')) {
    const c = new T.Group();
    c.position.set(0, R * 0.94, 0);
    c.rotation.x = -0.1;
    head.add(c);
    mesh(geo(new T.CylinderGeometry(0.19, 0.17, 0.06, 28, 1, true)), gold, c);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2,
        spike = mesh(geo(new T.ConeGeometry(0.034, 0.11, 10)), gold, c, [
          Math.sin(a) * 0.18,
          0.08,
          Math.cos(a) * 0.18
        ]);
      spike.rotation.set(Math.cos(a) * 0.12, 0, -Math.sin(a) * 0.12);
      mesh(
        geo(new T.SphereGeometry(0.016, 10, 8)),
        std(['#e63946', '#3a86ff', '#2ec27e'][i % 3], 0.2, 0.1, {
          emissive: ['#e63946', '#3a86ff', '#2ec27e'][i % 3],
          emissiveIntensity: 0.5
        }),
        c,
        [Math.sin(a) * 0.18, 0.03, Math.cos(a) * 0.18],
        false
      );
    }
  }
  if (acc('acc-glasses')) {
    const frame = std('#adb5c3', 0.24, 0.8),
      lensMat = phys('#9bc4ff', {
        transparent: true,
        opacity: 0.22,
        roughness: 0.05,
        clearcoat: 1,
        envMapIntensity: 2
      });
    for (const s of [-1, 1]) {
      const x = s * 0.118,
        y = 0.03,
        z = faceZ(x, y) + 0.008,
        r = mesh(geo(new T.TorusGeometry(0.074, 0.0085, 10, 32)), frame, head, [x, y, z], false);
      r.scale.set(1, 1.1, 1);
      const lens = new T.Mesh(geo(new T.CircleGeometry(0.072, 28)), lensMat);
      lens.position.set(x, y, z);
      lens.scale.set(1, 1.1, 1);
      head.add(lens);
      const arm = mesh(
        geo(new T.CylinderGeometry(0.006, 0.006, 0.2, 6)),
        frame,
        head,
        [s * (R * shape.w * 0.98), y, z - 0.1],
        false
      );
      arm.rotation.x = Math.PI / 2;
    }
    mesh(
      geo(new T.CylinderGeometry(0.006, 0.006, 0.05, 6)),
      frame,
      head,
      [0, 0.04, faceZ(0, 0.04) + 0.008],
      false
    ).rotation.z = Math.PI / 2;
  }
  if (acc('acc-headphones')) {
    const dk = std('#1a1c20', 0.45, 0.2),
      ac = std(kit.c1, 0.4);
    const band = mesh(
      geo(new T.TorusGeometry(R * 1.12, 0.017, 10, 40, Math.PI)),
      dk,
      head,
      [0, -0.005, -0.01]
    );
    band.scale.set(shape.w, shape.h, 1);
    for (const s of [-1, 1]) {
      const cup = mesh(geo(new T.CylinderGeometry(0.088, 0.088, 0.05, 28)), dk, head, [
        s * R * shape.w * 1.1,
        -0.005,
        -0.01
      ]);
      cup.rotation.z = Math.PI / 2;
      const pad = mesh(geo(new T.TorusGeometry(0.075, 0.02, 10, 24)), ac, head, [
        s * R * shape.w * 1.04,
        -0.005,
        -0.01
      ]);
      pad.rotation.y = Math.PI / 2;
    }
  }
  if (acc('acc-scarf')) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 32;
    const x = c.getContext('2d');
    for (let i = 0; i < 8; i++) {
      x.fillStyle = i % 2 ? kit.c2 : kit.c1;
      x.fillRect(i * 16, 0, 16, 32);
    }
    const st = tex(c),
      sc = mesh(
        geo(new T.TorusGeometry(0.098, 0.042, 14, 28)),
        std('#ffffff', 0.85, 0, { map: st }),
        torso,
        [0, DIM.torso + 0.0, 0.01]
      );
    sc.rotation.x = Math.PI / 2;
    sc.scale.set(1, 1.05, 0.9);
    const tail = mesh(
      geo(new T.BoxGeometry(0.075, 0.26, 0.028)),
      std('#ffffff', 0.85, 0, { map: st }),
      torso,
      [0.07, DIM.torso - 0.14, 0.17]
    );
    tail.rotation.z = 0.08;
    tail.rotation.x = -0.08;
  }

  // --- Bras : épaule > coude > main.
  const armX = female ? 0.242 : 0.262,
    arms = {};
  for (const [key, s] of [
    ['L', 1],
    ['R', -1]
  ]) {
    const shoulder = new T.Group();
    shoulder.position.set(s * armX, DIM.torso - 0.075, 0);
    torso.add(shoulder);
    mesh(geo(new T.SphereGeometry(0.068, 18, 14)), sleeve, shoulder);
    const upper = mesh(
      geo(new T.CapsuleGeometry(0.054, 0.15, 6, 14)),
      sleeve,
      shoulder,
      [0, -0.12, 0]
    );
    upper.scale.set(1.04, 1, 1.04);
    mesh(geo(new T.CylinderGeometry(0.059, 0.059, 0.026, 18)), trim, shoulder, [0, -0.2, 0]);
    mesh(geo(new T.CapsuleGeometry(0.046, 0.12, 6, 14)), skin, shoulder, [0, -0.255, 0]);
    const elbow = new T.Group();
    elbow.position.y = -0.235;
    shoulder.add(elbow);
    mesh(geo(new T.SphereGeometry(0.047, 14, 12)), skin, elbow);
    mesh(geo(new T.CapsuleGeometry(0.043, 0.14, 6, 14)), skin, elbow, [0, -0.11, 0]);
    const hand = new T.Group();
    hand.position.y = -0.235;
    elbow.add(hand);
    const palm = mesh(geo(new T.SphereGeometry(0.056, 16, 12)), skin, hand);
    palm.scale.set(0.88, 1.1, 0.75);
    const thumb = mesh(geo(new T.CapsuleGeometry(0.016, 0.034, 4, 8)), skin, hand, [
      -s * 0.045,
      0.01,
      0.03
    ]);
    thumb.rotation.z = -s * 0.6;
    if (key === 'L' && acc('acc-captain')) {
      const band = mesh(
        geo(new T.CylinderGeometry(0.062, 0.062, 0.05, 20, 1, true)),
        std('#f5d418', 0.6, 0, { side: T.DoubleSide }),
        shoulder,
        [0, -0.09, 0]
      );
      mesh(
        geo(new T.CylinderGeometry(0.0635, 0.0635, 0.008, 20, 1, true)),
        std('#101214', 0.6, 0, { side: T.DoubleSide }),
        shoulder,
        [0, -0.09, 0]
      );
      const badge = document.createElement('canvas');
      badge.width = badge.height = 64;
      const bc = badge.getContext('2d');
      bc.fillStyle = '#f5d418';
      bc.fillRect(0, 0, 64, 64);
      bc.fillStyle = '#101214';
      bc.font = 'bold 48px sans-serif';
      bc.textAlign = 'center';
      bc.fillText('C', 32, 49);
      mesh(
        geo(new T.PlaneGeometry(0.045, 0.045)),
        std('#ffffff', 0.7, 0, { map: tex(badge), side: T.DoubleSide }),
        shoulder,
        [0, -0.09, 0.063]
      );
    }
    arms[key] = { shoulder, elbow, hand };
  }
  // --- Jambes : cuisse > genou > pied avec crampons.
  const legs = {},
    legX = female ? 0.092 : 0.105;
  for (const [key, s] of [
    ['L', 1],
    ['R', -1]
  ]) {
    const thigh = new T.Group();
    thigh.position.set(s * legX, -0.02, 0);
    hips.add(thigh);
    mesh(geo(new T.CapsuleGeometry(0.082, 0.2, 6, 14)), skin, thigh, [0, -0.14, 0]);
    mesh(geo(new T.CapsuleGeometry(0.104, 0.1, 6, 14)), shortsMat, thigh, [0, -0.07, 0]);
    const knee = new T.Group();
    knee.position.y = -DIM.thigh;
    thigh.add(knee);
    mesh(geo(new T.SphereGeometry(0.075, 16, 12)), skin, knee);
    const shin = mesh(geo(new T.CapsuleGeometry(0.07, DIM.shin - 0.1, 6, 14)), sockMat, knee, [
      0,
      -DIM.shin / 2 - 0.01,
      0
    ]);
    shin.scale.set(1, 1, 1.02);
    const band = mesh(geo(new T.TorusGeometry(0.073, 0.011, 8, 22)), trim, knee, [0, -0.09, 0]);
    band.rotation.x = Math.PI / 2;
    const foot = new T.Group();
    foot.position.y = -DIM.shin;
    knee.add(foot);
    const shoe = mesh(geo(new T.SphereGeometry(0.07, 22, 16)), boot, foot, [0, -0.05, 0.05]);
    shoe.scale.set(1.02, 0.8, 1.78);
    const plate = mesh(geo(new T.SphereGeometry(0.072, 18, 10)), sole, foot, [0, -0.092, 0.052]);
    plate.scale.set(1.04, 0.16, 1.8);
    for (const [sx, sz] of [
      [-0.035, -0.02],
      [0.035, -0.02],
      [-0.035, 0.13],
      [0.035, 0.13]
    ])
      mesh(
        geo(new T.CylinderGeometry(0.008, 0.014, 0.026, 6)),
        sole,
        foot,
        [sx, -0.108, sz],
        false
      );
    legs[key] = { thigh, knee, foot };
  }
  // --- Ballon (poses « ballon sous le bras » et « pied sur le ballon »)
  const ballTex = tex(ballTexture()),
    ballMat = phys('#ffffff', {
      map: ballTex,
      roughness: 0.35,
      clearcoat: 0.5,
      clearcoatRoughness: 0.3
    });
  const ball = mesh(geo(new T.SphereGeometry(0.125, 36, 26)), ballMat, lift, [0, 0.125, 0.5]);
  ball.visible = false;

  // --- Objets de vitrine posés au sol
  const trophyGroup = new T.Group();
  lift.add(trophyGroup);
  const lathe = (pts, m) =>
    mesh(
      geo(
        new T.LatheGeometry(
          pts.map(([r, y]) => new T.Vector2(r, y)),
          28
        )
      ),
      m,
      new T.Group()
    );
  const makeTrophy = (id) => {
    const g = new T.Group();
    if (id === 'trophy-crystal') {
      const crystal = phys('#8cddf2', { metalness: 0.35, roughness: 0.08, clearcoat: 1 });
      const star = new T.Shape();
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 + Math.PI / 2,
          r = i % 2 ? 0.058 : 0.13,
          x = Math.cos(a) * r,
          y = Math.sin(a) * r;
        i ? star.lineTo(x, y) : star.moveTo(x, y);
      }
      star.closePath();
      const gem = mesh(
        geo(
          new T.ExtrudeGeometry(star, {
            depth: 0.035,
            bevelEnabled: true,
            bevelSize: 0.008,
            bevelThickness: 0.008,
            bevelSegments: 2,
            steps: 1
          })
        ),
        crystal,
        g,
        [0, 0.28, 0]
      );
      mesh(geo(new T.CylinderGeometry(0.025, 0.035, 0.15, 16)), gold, g, [0, 0.12, 0]);
      mesh(
        geo(new T.CylinderGeometry(0.09, 0.1, 0.045, 24)),
        std('#142036', 0.3, 0.6),
        g,
        [0, 0.0225, 0]
      );
    } else if (id === 'trophy-laurel') {
      for (const side of [-1, 1])
        for (let i = 0; i < 7; i++) {
          const a = ((i / 7) * 0.8 + 0.1) * Math.PI,
            x = side * Math.sin(a) * 0.12,
            y = 0.13 + Math.cos(a) * 0.12;
          const leaf = mesh(geo(new T.SphereGeometry(0.027, 12, 8)), gold, g, [x, y + 0.12, 0]);
          leaf.scale.set(0.55, 1.3, 0.3);
          leaf.rotation.z = -side * a;
        }
      mesh(geo(new T.CylinderGeometry(0.018, 0.025, 0.11, 16)), gold, g, [0, 0.1, 0]);
      mesh(
        geo(new T.CylinderGeometry(0.085, 0.095, 0.045, 24)),
        std('#163a30', 0.4, 0.3),
        g,
        [0, 0.0225, 0]
      );
    } else if (id === 'trophy-cup') {
      g.add(
        ...[
          lathe(
            [
              [0, 0],
              [0.07, 0],
              [0.08, 0.02],
              [0.04, 0.04],
              [0.025, 0.16],
              [0.05, 0.19],
              [0.11, 0.26],
              [0.13, 0.36],
              [0.1, 0.36],
              [0.0, 0.3]
            ],
            gold
          )
        ]
      );
      const h = new T.TorusGeometry(0.07, 0.014, 8, 16, Math.PI);
      for (const s of [-1, 1]) {
        const handle = mesh(geo(h), gold, g, [s * 0.13, 0.28, 0], false);
        handle.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
    } else if (id === 'trophy-pichichi') {
      mesh(
        geo(new T.CylinderGeometry(0.075, 0.095, 0.05, 24)),
        std('#1a1c20', 0.4, 0.5),
        g,
        [0, 0.025, 0]
      );
      g.add(
        lathe(
          [
            [0, 0.05],
            [0.045, 0.05],
            [0.03, 0.12],
            [0.022, 0.2],
            [0.04, 0.22],
            [0, 0.24]
          ],
          gold
        )
      );
      const sc = mesh(geo(new T.SphereGeometry(0.07, 26, 20)), gold, g, [0, 0.31, 0]);
      sc.scale.y = 1.08;
      for (const s of [-1, 1]) {
        const laurel = mesh(
          geo(new T.TorusGeometry(0.085, 0.011, 8, 20, Math.PI * 0.85)),
          gold,
          g,
          [0, 0.3, 0],
          false
        );
        laurel.rotation.set(0, s * 0.5, s > 0 ? Math.PI * 0.08 : Math.PI * 0.92);
      }
    } else if (id === 'trophy-ball') {
      mesh(
        geo(new T.SphereGeometry(0.13, 30, 22)),
        phys('#e6b422', { metalness: 1, roughness: 0.2, clearcoat: 0.6 }),
        g,
        [0, 0.19, 0]
      );
      mesh(
        geo(new T.CylinderGeometry(0.07, 0.09, 0.06, 20)),
        std('#1a1c20', 0.4, 0.5),
        g,
        [0, 0.03, 0]
      );
    } else if (id === 'trophy-boot') {
      const b = mesh(geo(new T.SphereGeometry(0.1, 22, 16)), gold, g, [0, 0.12, 0.03]);
      b.scale.set(0.8, 0.75, 1.7);
      const shaft = mesh(geo(new T.CapsuleGeometry(0.062, 0.1, 6, 12)), gold, g, [0, 0.21, -0.07]);
      shaft.rotation.x = -0.2;
      mesh(
        geo(new T.CylinderGeometry(0.09, 0.1, 0.035, 20)),
        std('#1a1c20', 0.4, 0.5),
        g,
        [0, 0.0175, 0]
      );
    } else {
      const palm = mesh(geo(new T.SphereGeometry(0.09, 20, 14)), gold, g, [0, 0.17, 0]);
      palm.scale.set(1, 1.1, 0.6);
      for (let i = 0; i < 4; i++) {
        const f = mesh(geo(new T.CapsuleGeometry(0.016, 0.075, 4, 8)), gold, g, [
          -0.052 + i * 0.035,
          0.27,
          0
        ]);
        f.rotation.z = (i - 1.5) * -0.06;
      }
      const th = mesh(geo(new T.CapsuleGeometry(0.018, 0.06, 4, 8)), gold, g, [0.095, 0.2, 0]);
      th.rotation.z = -1;
      mesh(
        geo(new T.CylinderGeometry(0.07, 0.09, 0.035, 20)),
        std('#1a1c20', 0.4, 0.5),
        g,
        [0, 0.0175, 0]
      );
    }
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return g;
  };
  look.showcase.forEach((id, i) => {
    const t = makeTrophy(id),
      spots = [
        [-0.55, 0.32],
        [0.55, 0.32],
        [0, 0.6]
      ],
      spot = spots[i % 3];
    t.position.set(spot[0], 0, spot[1]);
    t.scale.setScalar(look.showcase.length > 2 ? 0.85 : 1);
    t.rotation.y = -spot[0] * 0.6;
    trophyGroup.add(t);
  });

  // --- Socle
  const base = new T.Group();
  root.add(base);
  const baseTop = 0.07;
  const addRing = (r, color, intensity) => {
    const m = mesh(
      geo(new T.TorusGeometry(r, 0.012, 8, 72)),
      std(color, 0.3, 0, { emissive: color, emissiveIntensity: intensity }),
      base,
      [0, baseTop + 0.001, 0],
      false
    );
    m.rotation.x = Math.PI / 2;
    return m;
  };
  const disc = (r0, r1, h, material, y = 0) =>
    mesh(geo(new T.CylinderGeometry(r0, r1, h, 72)), material, base, [0, y + h / 2, 0]);
  let neon = null;
  if (baseKind === 'base-grass') {
    const grass = std('#ffffff', 0.95, 0, { map: tex(grassTexture(), { repeat: [2.2, 2.2] }) });
    disc(0.66, 0.68, 0.07, std('#3a2a1c', 0.9));
    const top = new T.Mesh(geo(new T.CylinderGeometry(0.64, 0.64, 0.012, 72)), grass);
    top.position.y = 0.072;
    top.receiveShadow = true;
    base.add(top);
  } else if (baseKind === 'base-silver') {
    const metal = phys('#d7dce3', { metalness: 1, roughness: 0.22, clearcoat: 0.4 });
    disc(0.68, 0.7, 0.05, metal);
    disc(0.6, 0.62, 0.03, metal, 0.05);
    addRing(0.64, '#9db8ff', 0.5);
  } else if (baseKind === 'base-gold') {
    disc(0.7, 0.72, 0.05, gold);
    disc(0.6, 0.62, 0.035, gold, 0.05);
    disc(0.46, 0.48, 0.025, std('#111317', 0.45, 0.3), 0.085);
  } else if (baseKind === 'base-neon') {
    disc(0.66, 0.68, 0.07, std('#0c0f16', 0.35, 0.4));
    neon = addRing(0.6, '#2ee6ff', 1.6);
    addRing(0.5, '#ff3bd4', 1.2);
  } else {
    disc(0.64, 0.66, 0.07, std('#171b1f', 0.42, 0.35));
    addRing(0.6, '#c6ff3d', 0.7);
  }
  const shadowDisc = new T.Mesh(
    geo(new T.PlaneGeometry(0.95, 0.62)),
    new T.MeshBasicMaterial({
      map: tex(shadowTexture()),
      transparent: true,
      depthWrite: false,
      opacity: 0.95
    })
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.set(0, topY + 0.004, 0);
  base.add(shadowDisc);
  let glow = null;
  if (neon && q.glow) {
    glow = new T.Mesh(
      geo(new T.PlaneGeometry(1.8, 1.8)),
      new T.MeshBasicMaterial({
        map: tex(glowTexture('#2ee6ff')),
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
        opacity: 0.55,
        toneMapped: false
      })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = topY + 0.01;
    base.add(glow);
  }
  return {
    look,
    root,
    lift,
    hips,
    torso,
    head,
    arms,
    legs,
    eyes,
    lids,
    brows,
    mouths,
    mouth,
    ball,
    neon,
    glow,
    baseTop: topY,
    shapeScale: shape,
    faceZ,
    top: topY + DIM.hip + DIM.torso + R * 2 + 0.1,
    dispose() {
      for (const object of disposables) object.dispose?.();
      root.traverse((o) => {
        if (o.isInstancedMesh) o.dispose?.();
      });
    }
  };
}
