// ============================================================
// 🐷 PIG RACING - racing.js
// Versione pulita e consolidata
// ============================================================

// ============================================================
// 1. COSTANTI
// ============================================================

const KART_COLORS = [
    0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f,
    0x9b59b6, 0xe67e22, 0x1abc9c, 0xff69b4
];

const KART_CSS = [
    '#e74c3c', '#3498db', '#2ecc71', '#f1c40f',
    '#9b59b6', '#e67e22', '#1abc9c', '#ff69b4'
];

const BOT_NAMES = ['Porky', 'Hamlet', 'Bacon', 'Truffle', 'Peppa', 'Oinker', 'Waddle', 'Snout'];

const ITEM_EMOJI = {
    banana: '🍌',
    greenShell: '🟢',
    redShell: '🔴',
    boost: '⭐',
    lightning: '⚡'
};

const MAX_SPEED = 30;
const ACCELERATION = 18;
const BRAKE_FORCE = 25;
const FRICTION = 0.97;
const TURN_SPEED = 2.3;
const OFFROAD_FRIC = 0.92;
const OFFROAD_MAX = 12;
const BOOST_MULT = 1.6;
const BOOST_DUR = 2.0;
const STUN_DUR = 1.5;
const LIGHTNING_DUR = 3.0;
const LIGHTNING_SLOW = 0.4;
const COLLISION_R = 2.0;
const ITEMBOX_R = 3.0;
const SHELL_SPEED = 40;
const BANANA_R = 1.5;
const SHELL_R = 1.2;
const SHELL_BOUNCES = 3;

const TRACK_SAMPLES = 800;
const FIREBASE_SYNC = 250;

// ============================================================
// 2. PISTE
// ============================================================

const TRACKS = {
    porcile: {
        name: 'Circuito Porcile',
        icon: '🏖️',
        diff: 'Facile',
        roadW: 16,
        theme: {
            ground: 0x4a7c23,
            road: 0x666666,
            barrier: 0x8B4513,
            sky: 0x87CEEB,
            fog: 0x87CEEB
        },
        pts: [
            [0,0],[55,12],[115,5],[165,-25],[195,-70],[195,-130],
            [170,-175],[120,-200],[60,-195],[10,-170],[-20,-130],[-35,-75],[-25,-30]
        ],
        itemT: [.1,.2,.35,.5,.6,.75,.85,.95],
        deco: 'farm'
    },

    prosciutto: {
        name: 'Monte Prosciutto',
        icon: '🏔️',
        diff: 'Medio',
        roadW: 14,
        theme: {
            ground: 0x6B4226,
            road: 0x555555,
            barrier: 0x777777,
            sky: 0x6ca6cd,
            fog: 0x6ca6cd
        },
        pts: [
            [0,0],[50,18],[105,5],[145,-35],[120,-75],[70,-65],[20,-80],
            [-15,-120],[-5,-165],[40,-185],[95,-170],[135,-130],
            [110,-90],[55,-78],[-10,-45],[-30,-15]
        ],
        itemT: [.08,.18,.28,.38,.5,.6,.72,.82,.92],
        deco: 'mountain'
    },

    pancetta: {
        name: 'Vulcano Pancetta',
        icon: '🌋',
        diff: 'Difficile',
        roadW: 12,
        theme: {
            ground: 0x2c2c2c,
            road: 0x444444,
            barrier: 0x555555,
            sky: 0x1a0a00,
            fog: 0x1a0a00
        },
        pts: [
            [0,0],[25,10],[60,-12],[90,-40],[70,-70],[40,-55],[25,-80],
            [50,-115],[90,-125],[125,-100],[115,-65],[140,-40],[165,-55],
            [155,-90],[120,-130],[65,-150],[10,-140],[-20,-105],[-30,-60],[-20,-25]
        ],
        itemT: [.06,.14,.22,.32,.42,.52,.62,.72,.82,.9,.96],
        deco: 'volcano'
    }
};

// ============================================================
// 3. STATO GLOBALE
// ============================================================

const G = {
    state: 'loading', // loading, menu, lobby, countdown, racing, results
    trackId: 'porcile',
    totalLaps: 3,
    botCount: 3,
    botDiff: 'medium',

    scene: null,
    camera: null,
    renderer: null,

    curve: null,
    lookupTable: [],
    roadW: 16,
    trackCenter: { x: 0, z: 0 },
    trackSize: 200,

    karts: [],
    playerIdx: 0,

    items: [],
    itemBoxes: [],

    raceTime: 0,
    countdownVal: 3,
    finishOrder: [],
    raceStartTime: 0,
    firstFinishTime: 0,

    keys: {},
    lastTime: 0,
    syncTimer: 0,

    isMulti: !!matchId,
    unsubscribe: null,
    gameData: null,

    camPos: null,
    camTarget: null,
    camFov: 70,

    intervals: [],
    listeners: [],
    flags: {
        snapshotPatched: false,
        introDone: false
    },

    fpsSamples: [],
    localPrefsLoaded: false
};

// ============================================================
// 4. UTILITY BASE
// ============================================================

function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function angleDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
}

function dist2D(x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    return Math.sqrt(dx * dx + dz * dz);
}

function fmtTime(ms) {
    const s = ms / 1000;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const cs = Math.floor((s - Math.floor(s)) * 100);
    return `${m}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function ordinalIT(n) {
    if (n === 1) return '1°';
    if (n === 2) return '2°';
    if (n === 3) return '3°';
    return `${n}°`;
}

function normalizeT(t) {
    return ((t % 1) + 1) % 1;
}

function lightenHex(hex, amt = 0.1) {
    let r = (hex >> 16) & 255;
    let g = (hex >> 8) & 255;
    let b = hex & 255;
    r = Math.min(255, Math.floor(r + (255 - r) * amt));
    g = Math.min(255, Math.floor(g + (255 - g) * amt));
    b = Math.min(255, Math.floor(b + (255 - b) * amt));
    return (r << 16) | (g << 8) | b;
}

function safeDispose(obj) {
    if (!obj) return;
    try {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m?.dispose?.());
            else obj.material.dispose?.();
        }
    } catch (e) {}
}

function removeSceneObject(obj) {
    if (!obj) return;
    try {
        if (obj.parent) obj.parent.remove(obj);
        safeDispose(obj);
    } catch (e) {}
}

function roundRectCanvas(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function addManagedInterval(fn, ms) {
    const id = setInterval(fn, ms);
    G.intervals.push(id);
    return id;
}

function addManagedListener(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    G.listeners.push({ target, event, handler, options });
}

function clearManagedIntervals() {
    G.intervals.forEach(id => clearInterval(id));
    G.intervals = [];
}

function clearManagedListeners() {
    G.listeners.forEach(l => {
        l.target.removeEventListener(l.event, l.handler, l.options);
    });
    G.listeners = [];
}

function showOverlay(id) {
    document.getElementById(id)?.classList.add('active');
}

function hideOverlay(id) {
    document.getElementById(id)?.classList.remove('active');
}

function showHUD() {
    document.getElementById('hud')?.classList.add('active');
}

function hideHUD() {
    document.getElementById('hud')?.classList.remove('active');
}

function setOverlayText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function getTrackPoint(t) {
    return G.curve.getPoint(normalizeT(t));
}

function getTrackTangent(t) {
    return G.curve.getTangent(normalizeT(t)).normalize();
}

function getPositionWeight(place, total) {
    return (place - 1) / Math.max(1, total - 1);
}

// ============================================================
// 5. TOAST / UI EFFETTI
// ============================================================

function showRacingToast(msg, color = '#03dac6', text = '#000') {
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = color;
    toast.style.color = text;
    toast.style.padding = '12px 22px';
    toast.style.borderRadius = '25px';
    toast.style.fontWeight = 'bold';
    toast.style.zIndex = '99999';
    toast.style.boxShadow = '0 4px 15px rgba(0,0,0,0.35)';
    document.body.appendChild(toast);

    toast.animate([
        { transform: 'translateX(-50%) translateY(12px)', opacity: 0 },
        { transform: 'translateX(-50%) translateY(0)', opacity: 1 },
        { transform: 'translateX(-50%) translateY(0)', opacity: 1 },
        { transform: 'translateX(-50%) translateY(-12px)', opacity: 0 }
    ], {
        duration: 1800,
        easing: 'ease'
    }).onfinish = () => toast.remove();
}

function showCenterBanner(text, bg = 'rgba(0,0,0,0.75)', color = '#fff', duration = 1400) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.position = 'fixed';
    el.style.top = '50%';
    el.style.left = '50%';
    el.style.transform = 'translate(-50%, -50%) scale(0.8)';
    el.style.padding = '18px 34px';
    el.style.borderRadius = '14px';
    el.style.background = bg;
    el.style.color = color;
    el.style.fontSize = '2rem';
    el.style.fontWeight = '900';
    el.style.letterSpacing = '1px';
    el.style.zIndex = '99998';
    el.style.boxShadow = '0 10px 30px rgba(0,0,0,0.4)';
    el.style.pointerEvents = 'none';
    document.body.appendChild(el);

    el.animate([
        { transform: 'translate(-50%, -50%) scale(0.8)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.15 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.8 },
        { transform: 'translate(-50%, -50%) scale(1.1)', opacity: 0 }
    ], {
        duration,
        easing: 'cubic-bezier(.2,.8,.2,1)'
    }).onfinish = () => el.remove();
}

function spawnScreenBurst(color = '#ffffff', count = 20) {
    for (let i = 0; i < count; i++) {
        const d = document.createElement('div');
        d.style.position = 'fixed';
        d.style.left = `${45 + Math.random() * 10}%`;
        d.style.top = `${42 + Math.random() * 10}%`;
        d.style.width = `${4 + Math.random() * 10}px`;
        d.style.height = d.style.width;
        d.style.background = color;
        d.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        d.style.zIndex = '120';
        d.style.pointerEvents = 'none';
        document.body.appendChild(d);

        const angle = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 220;
        const tx = Math.cos(angle) * dist;
        const ty = Math.sin(angle) * dist;

        d.animate([
            { transform: 'translate(0,0) scale(1)', opacity: 1 },
            { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
        ], {
            duration: 650 + Math.random() * 350,
            easing: 'cubic-bezier(.2,.8,.2,1)'
        }).onfinish = () => d.remove();
    }
}

function fireVictoryConfetti() {
    const colors = ['#f1c40f', '#ffffff', '#e67e22', '#ffd700'];
    for (let i = 0; i < 120; i++) {
        const p = document.createElement('div');
        p.style.position = 'fixed';
        p.style.left = `${Math.random() * 100}%`;
        p.style.top = '-5%';
        p.style.width = `${5 + Math.random() * 10}px`;
        p.style.height = p.style.width;
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.borderRadius = Math.random() > 0.4 ? '50%' : '0';
        p.style.pointerEvents = 'none';
        p.style.zIndex = '9999';
        document.body.appendChild(p);

        const tx = (Math.random() - 0.5) * 260;
        const dur = 1800 + Math.random() * 2200;
        p.animate([
            { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
            { transform: `translate(${tx}px, ${window.innerHeight + 80}px) rotate(${(Math.random()-0.5)*900}deg)`, opacity: 0 }
        ], {
            duration: dur,
            easing: 'cubic-bezier(.2,.7,.2,1)'
        }).onfinish = () => p.remove();
    }
}

// ============================================================
// 6. THREE.JS SETUP
// ============================================================

function initRenderer() {
    G.scene = new THREE.Scene();
    G.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.5, 800);
    G.camera.position.set(0, 30, -30);

    G.renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('rc'),
        antialias: true
    });
    G.renderer.setSize(window.innerWidth, window.innerHeight);
    G.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    G.renderer.shadowMap.enabled = true;
    G.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    G.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    G.scene.add(new THREE.AmbientLight(0x404040, 0.6));
    G.scene.add(new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.5));

    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(80, 120, 60);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -200;
    dir.shadow.camera.right = 200;
    dir.shadow.camera.top = 200;
    dir.shadow.camera.bottom = -200;
    dir.shadow.camera.far = 500;
    G.scene.add(dir);

    G.camPos = new THREE.Vector3();
    G.camTarget = new THREE.Vector3();

    addManagedListener(window, 'resize', () => {
        G.camera.aspect = window.innerWidth / window.innerHeight;
        G.camera.updateProjectionMatrix();
        G.renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// ============================================================
// 7. LOOKUP TRACK
// ============================================================

function buildLookupTable(curve) {
    G.lookupTable = [];
    for (let i = 0; i <= TRACK_SAMPLES; i++) {
        const t = i / TRACK_SAMPLES;
        const p = curve.getPoint(t);
        G.lookupTable.push({ x: p.x, z: p.z, t });
    }
}

function findClosestTrackInfo(x, z) {
    let best = null;
    let bestD2 = Infinity;

    const step = 12;
    let bestIdx = 0;

    for (let i = 0; i < G.lookupTable.length; i += step) {
        const p = G.lookupTable[i];
        const dx = p.x - x;
        const dz = p.z - z;
        const d2 = dx * dx + dz * dz;
        if (d2 < bestD2) {
            bestD2 = d2;
            bestIdx = i;
            best = p;
        }
    }

    const from = Math.max(0, bestIdx - step);
    const to = Math.min(G.lookupTable.length - 1, bestIdx + step);

    bestD2 = Infinity;
    for (let i = from; i <= to; i++) {
        const p = G.lookupTable[i];
        const dx = p.x - x;
        const dz = p.z - z;
        const d2 = dx * dx + dz * dz;
        if (d2 < bestD2) {
            bestD2 = d2;
            best = p;
        }
    }

    const tangent = getTrackTangent(best.t);
    const nx = -tangent.z;
    const nz = tangent.x;
    const offX = x - best.x;
    const offZ = z - best.z;
    const lateral = offX * nx + offZ * nz;

    return {
        t: best.t,
        px: best.x,
        pz: best.z,
        dist: Math.sqrt(bestD2),
        tangent,
        lateral
    };
}

// ============================================================
// 8. COSTRUZIONE PISTA
// ============================================================

function clearTrackScene() {
    while (G.scene.children.length > 3) {
        const c = G.scene.children[G.scene.children.length - 1];
        G.scene.remove(c);
        safeDispose(c);
    }
    G.items = [];
    G.itemBoxes = [];
}

function buildTrack(trackId) {
    clearTrackScene();

    const td = TRACKS[trackId];
    G.roadW = td.roadW;
    G.scene.background = new THREE.Color(td.theme.sky);
    G.scene.fog = new THREE.Fog(td.theme.fog, 150, 450);

    const pts = td.pts.map(p => new THREE.Vector3(p[0], 0, p[1]));
    G.curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
    buildLookupTable(G.curve);

    let mnX = Infinity, mxX = -Infinity, mnZ = Infinity, mxZ = -Infinity;
    G.lookupTable.forEach(p => {
        if (p.x < mnX) mnX = p.x;
        if (p.x > mxX) mxX = p.x;
        if (p.z < mnZ) mnZ = p.z;
        if (p.z > mxZ) mxZ = p.z;
    });

    const pad = 80;
    G.trackCenter = { x: (mnX + mxX) / 2, z: (mnZ + mxZ) / 2 };
    G.trackSize = Math.max(mxX - mnX, mxZ - mnZ) + pad * 2;

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(G.trackSize, G.trackSize),
        new THREE.MeshPhongMaterial({ color: td.theme.ground })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(G.trackCenter.x, -0.05, G.trackCenter.z);
    ground.receiveShadow = true;
    G.scene.add(ground);

    createRoadMesh(G.curve, td.roadW, td.theme);
    createCurbs(G.curve, td.roadW);
    createBarriers(G.curve, td.roadW, td.theme);
    createFinishLine(G.curve, td.roadW);
    spawnItemBoxes(G.curve, td.itemT, td.roadW);

    addDecorations(G.curve, td);
    addCheckpointBeacons();
    addTrackBoostVisuals();
    addTrackHaze();
    createStartGridVisual();
}

function createRoadMesh(curve, width, theme) {
    const S = 300;
    const pos = [], idx = [], uvs = [];

    for (let i = 0; i <= S; i++) {
        const t = i / S;
        const p = curve.getPoint(t);
        const tg = curve.getTangent(t);
        const n = new THREE.Vector3(-tg.z, 0, tg.x).normalize();
        const L = p.clone().add(n.clone().multiplyScalar(width / 2));
        const R = p.clone().add(n.clone().multiplyScalar(-width / 2));

        pos.push(L.x, 0.02, L.z, R.x, 0.02, R.z);
        uvs.push(0, t * 20, 1, t * 20);

        if (i < S) {
            const v = i * 2;
            idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const road = new THREE.Mesh(
        geo,
        new THREE.MeshPhongMaterial({ color: theme.road })
    );
    road.receiveShadow = true;
    G.scene.add(road);

    const lp = [];
    for (let i = 0; i < S; i += 3) {
        const p1 = curve.getPoint(i / S);
        const p2 = curve.getPoint(Math.min((i + 1.5) / S, 1));
        lp.push(p1.x, 0.04, p1.z, p2.x, 0.04, p2.z);
    }

    if (lp.length) {
        const lg = new THREE.BufferGeometry();
        lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
        G.scene.add(
            new THREE.LineSegments(
                lg,
                new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })
            )
        );
    }
}

function createCurbs(curve, width) {
    const S = 300;
    const cw = 0.8;

    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const cx = cv.getContext('2d');
    for (let y = 0; y < 64; y += 8) {
        cx.fillStyle = (Math.floor(y / 8) % 2 === 0) ? '#cc0000' : '#ffffff';
        cx.fillRect(0, y, 64, 8);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;

    [1, -1].forEach(side => {
        const pos = [], uvs = [], idx = [];
        for (let i = 0; i <= S; i++) {
            const t = i / S;
            const p = curve.getPoint(t);
            const tg = curve.getTangent(t);
            const n = new THREE.Vector3(-tg.z, 0, tg.x).normalize().multiplyScalar(side);

            const inner = p.clone().add(n.clone().multiplyScalar(width / 2 - cw));
            const outer = p.clone().add(n.clone().multiplyScalar(width / 2));

            pos.push(inner.x, 0.03, inner.z, outer.x, 0.03, outer.z);
            uvs.push(0, t * 40, 1, t * 40);

            if (i < S) {
                const v = i * 2;
                idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(idx);
        geo.computeVertexNormals();

        G.scene.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ map: tex })));
    });
}

function createBarriers(curve, width, theme) {
    const S = 150;
    const h = 1.5;
    const dist = width / 2 + 1.5;

    [1, -1].forEach(side => {
        const pos = [], idx = [];

        for (let i = 0; i <= S; i++) {
            const t = i / S;
            const p = curve.getPoint(t);
            const tg = curve.getTangent(t);
            const n = new THREE.Vector3(-tg.z, 0, tg.x).normalize().multiplyScalar(side * dist);
            const b = p.clone().add(n);

            pos.push(b.x, 0, b.z, b.x, h, b.z);

            if (i < S) {
                const v = i * 2;
                idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setIndex(idx);
        geo.computeVertexNormals();

        const wall = new THREE.Mesh(
            geo,
            new THREE.MeshPhongMaterial({ color: theme.barrier, side: THREE.DoubleSide })
        );
        wall.castShadow = true;
        G.scene.add(wall);
    });
}

function createFinishLine(curve, width) {
    const p = curve.getPoint(0);
    const tg = curve.getTangent(0);
    const n = new THREE.Vector3(-tg.z, 0, tg.x).normalize();
    const fw = tg.clone().normalize().multiplyScalar(1.5);

    const L1 = p.clone().add(n.clone().multiplyScalar(width / 2)).add(fw);
    const R1 = p.clone().add(n.clone().multiplyScalar(-width / 2)).add(fw);
    const L2 = p.clone().add(n.clone().multiplyScalar(width / 2)).sub(fw);
    const R2 = p.clone().add(n.clone().multiplyScalar(-width / 2)).sub(fw);

    const pos = [
        L1.x, .05, L1.z,
        R1.x, .05, R1.z,
        L2.x, .05, L2.z,
        R2.x, .05, R2.z
    ];

    const uv = [0,0, 1,0, 0,1, 1,1];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex([0,1,2, 1,3,2]);
    geo.computeVertexNormals();

    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const cx = cv.getContext('2d');
    for (let y = 0; y < 64; y += 8) {
        for (let x = 0; x < 64; x += 8) {
            cx.fillStyle = ((x / 8 + y / 8) % 2 === 0) ? '#fff' : '#111';
            cx.fillRect(x, y, 8, 8);
        }
    }

    G.scene.add(
        new THREE.Mesh(
            geo,
            new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(cv) })
        )
    );
}
function spawnItemBoxes(curve, positions, width) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#FFD700';
    cx.fillRect(0, 0, 64, 64);
    cx.fillStyle = '#996600';
    cx.font = 'bold 48px Arial';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText('?', 32, 36);
    const tex = new THREE.CanvasTexture(cv);

    positions.forEach((t, i) => {
        const p = curve.getPoint(t);
        const tg = curve.getTangent(t);
        const n = new THREE.Vector3(-tg.z, 0, tg.x).normalize();

        const side = (i % 2 === 0) ? 1 : -1;
        const offset = n.clone().multiplyScalar(side * (width * 0.15));
        const pos = p.clone().add(offset);
        pos.y = 1.6;

        const geo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
        const mat = new THREE.MeshPhongMaterial({ map: tex, emissive: 0x332200 });
        const box = new THREE.Mesh(geo, mat);
        box.position.copy(pos);
        box.castShadow = true;

        const halo = new THREE.Mesh(
            new THREE.TorusGeometry(1.6, 0.12, 8, 24),
            new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.45 })
        );
        halo.rotation.x = Math.PI / 2;
        halo.position.y = 0.1;
        box.add(halo);

        G.scene.add(box);

        G.itemBoxes.push({
            mesh: box,
            t,
            active: true,
            respawn: 0,
            baseY: pos.y,
            rotSpeed: 1.8 + Math.random() * 1.5
        });
    });
}

function addCheckpointBeacons() {
    const ts = [0.25, 0.5, 0.75];
    ts.forEach(t => {
        const p = getTrackPoint(t);
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(1.1, 3.8, 12),
            new THREE.MeshPhongMaterial({ color: 0x00e5ff, emissive: 0x004455 })
        );
        cone.position.set(p.x, 2.2, p.z);
        cone.castShadow = true;
        G.scene.add(cone);

        G.items.push({
            type: 'checkpointFX',
            mesh: cone,
            ttl: 999999,
            spinOnly: true
        });
    });
}

function addTrackBoostVisuals() {
    const ts = [0.12, 0.37, 0.63, 0.88];
    ts.forEach((t, idx) => {
        const p = getTrackPoint(t);
        const tg = getTrackTangent(t);

        const segW = Math.min(6, G.roadW * 0.52);
        const segL = 3.8;

        const geo = new THREE.PlaneGeometry(segW, segL);
        const mat = new THREE.MeshBasicMaterial({
            color: idx % 2 === 0 ? 0x00e5ff : 0x00ffaa,
            transparent: true,
            opacity: 0.28,
            side: THREE.DoubleSide
        });

        const pad = new THREE.Mesh(geo, mat);
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(p.x, 0.06, p.z);
        pad.rotation.z = Math.atan2(tg.z, tg.x) - Math.PI / 2;
        G.scene.add(pad);

        G.items.push({
            type: 'boostFX',
            mesh: pad,
            ttl: 999999,
            pulse: true,
            pulseBase: 0.28,
            pulsePhase: idx * 0.9
        });
    });
}

function addTrackHaze() {
    const haze = new THREE.Mesh(
        new THREE.PlaneGeometry(G.trackSize * 0.95, G.trackSize * 0.95),
        new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.025,
            side: THREE.DoubleSide
        })
    );
    haze.rotation.x = -Math.PI / 2;
    haze.position.set(G.trackCenter.x, 0.12, G.trackCenter.z);
    G.scene.add(haze);

    G.items.push({
        type: 'haze',
        mesh: haze,
        ttl: 999999
    });
}

function createStartGridVisual() {
    const p = getTrackPoint(0);
    const tg = getTrackTangent(0);
    const n = new THREE.Vector3(-tg.z, 0, tg.x).normalize();

    for (let row = 0; row < 4; row++) {
        for (let col = -1; col <= 1; col += 2) {
            const slot = new THREE.Mesh(
                new THREE.PlaneGeometry(2.2, 4.2),
                new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.06,
                    side: THREE.DoubleSide
                })
            );

            const pos = p.clone()
                .sub(tg.clone().multiplyScalar(row * 4.5 + 2.5))
                .add(n.clone().multiplyScalar(col * 1.7));

            slot.rotation.x = -Math.PI / 2;
            slot.rotation.z = Math.atan2(tg.z, tg.x) - Math.PI / 2;
            slot.position.set(pos.x, 0.05, pos.z);
            G.scene.add(slot);

            G.items.push({
                type: 'gridFX',
                mesh: slot,
                ttl: 12,
                fadeGrid: true
            });
        }
    }
}

// ============================================================
// 9. DECORAZIONI
// ============================================================

function addDecorations(curve, td) {
    const decoCount = 120;
    for (let i = 0; i < decoCount; i++) {
        const t = Math.random();
        const p = curve.getPoint(t);
        const tg = curve.getTangent(t);
        const n = new THREE.Vector3(-tg.z, 0, tg.x).normalize();

        const dist = td.roadW / 2 + 8 + Math.random() * 35;
        const side = Math.random() < 0.5 ? -1 : 1;
        const pos = p.clone().add(n.clone().multiplyScalar(dist * side));
        pos.y = 0;

        if (td.deco === 'farm') {
            if (Math.random() < 0.6) G.scene.add(createTree(pos.x, pos.z, 0x2e8b57, 0x8b5a2b, 2.8 + Math.random() * 2.2));
            else G.scene.add(createHay(pos.x, pos.z));
        } else if (td.deco === 'mountain') {
            if (Math.random() < 0.55) G.scene.add(createPine(pos.x, pos.z, 3 + Math.random() * 2));
            else G.scene.add(createRock(pos.x, pos.z, 1.5 + Math.random() * 2.5, 0x777777));
        } else if (td.deco === 'volcano') {
            if (Math.random() < 0.7) G.scene.add(createRock(pos.x, pos.z, 1.2 + Math.random() * 3.2, 0x3a3a3a));
            else G.scene.add(createLavaBlob(pos.x, pos.z));
        }
    }

    if (td.deco === 'farm') {
        for (let i = 0; i < 8; i++) {
            const t = i / 8;
            const p = curve.getPoint(t);
            const tg = curve.getTangent(t);
            const n = new THREE.Vector3(-tg.z, 0, tg.x).normalize();
            const pos = p.clone().add(n.multiplyScalar(td.roadW / 2 + 20 + Math.random() * 10));
            G.scene.add(createFenceSegment(pos.x, pos.z, Math.random() * Math.PI));
        }
    }

    if (td.deco === 'volcano') {
        G.scene.add(createVolcano(G.trackCenter.x + 10, G.trackCenter.z - 20));
    }
}

function createTree(x, z, leafColor = 0x2e8b57, trunkColor = 0x8b5a2b, scale = 3) {
    const g = new THREE.Group();

    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25 * scale, 0.35 * scale, 1.8 * scale, 8),
        new THREE.MeshPhongMaterial({ color: trunkColor })
    );
    trunk.position.y = 0.9 * scale;
    trunk.castShadow = true;
    g.add(trunk);

    const crown = new THREE.Mesh(
        new THREE.SphereGeometry(0.95 * scale, 12, 12),
        new THREE.MeshPhongMaterial({ color: leafColor })
    );
    crown.position.y = 2.35 * scale;
    crown.castShadow = true;
    g.add(crown);

    g.position.set(x, 0, z);
    return g;
}

function createPine(x, z, scale = 3) {
    const g = new THREE.Group();

    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2 * scale, 0.28 * scale, 1.5 * scale, 8),
        new THREE.MeshPhongMaterial({ color: 0x6b4f2a })
    );
    trunk.position.y = 0.75 * scale;
    trunk.castShadow = true;
    g.add(trunk);

    for (let i = 0; i < 3; i++) {
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry((1.0 - i * 0.18) * scale, 1.6 * scale, 10),
            new THREE.MeshPhongMaterial({ color: 0x2d5a27 })
        );
        cone.position.y = (1.6 + i * 0.8) * scale;
        cone.castShadow = true;
        g.add(cone);
    }

    g.position.set(x, 0, z);
    return g;
}

function createRock(x, z, scale = 2, color = 0x777777) {
    const geo = new THREE.DodecahedronGeometry(scale, 0);
    const mat = new THREE.MeshPhongMaterial({ color, flatShading: true });
    const rock = new THREE.Mesh(geo, mat);
    rock.position.set(x, scale * 0.7, z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.scale.set(1.1, 0.8, 1.3);
    rock.castShadow = true;
    rock.receiveShadow = true;
    return rock;
}

function createHay(x, z) {
    const g = new THREE.Group();
    for (let i = 0; i < 2; i++) {
        const bale = new THREE.Mesh(
            new THREE.CylinderGeometry(1.2, 1.2, 1.4, 16),
            new THREE.MeshPhongMaterial({ color: 0xd4af37 })
        );
        bale.rotation.z = Math.PI / 2;
        bale.position.set(i * 1.6, 1.2, 0);
        bale.castShadow = true;
        g.add(bale);
    }
    g.position.set(x, 0, z);
    g.rotation.y = Math.random() * Math.PI;
    return g;
}

function createFenceSegment(x, z, rot = 0) {
    const g = new THREE.Group();

    for (let i = -1; i <= 1; i++) {
        const post = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 2, 0.3),
            new THREE.MeshPhongMaterial({ color: 0x8b5a2b })
        );
        post.position.set(i * 2.2, 1, 0);
        post.castShadow = true;
        g.add(post);
    }

    for (let j = 0; j < 2; j++) {
        const rail = new THREE.Mesh(
            new THREE.BoxGeometry(5, 0.18, 0.2),
            new THREE.MeshPhongMaterial({ color: 0x9c6b30 })
        );
        rail.position.set(0, 0.7 + j * 0.6, 0);
        rail.castShadow = true;
        g.add(rail);
    }

    g.position.set(x, 0, z);
    g.rotation.y = rot;
    return g;
}

function createLavaBlob(x, z) {
    const g = new THREE.Group();

    const blob = new THREE.Mesh(
        new THREE.SphereGeometry(1.8 + Math.random() * 1.5, 10, 10),
        new THREE.MeshPhongMaterial({ color: 0xff5500, emissive: 0xaa2200, flatShading: true })
    );
    blob.scale.y = 0.22;
    blob.position.y = 0.12;
    g.add(blob);

    const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.2, 2.6, 20),
        new THREE.MeshBasicMaterial({ color: 0xffaa33, side: THREE.DoubleSide, transparent: true, opacity: 0.25 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    g.add(ring);

    g.position.set(x, 0, z);
    return g;
}

function createVolcano(x, z) {
    const g = new THREE.Group();

    const body = new THREE.Mesh(
        new THREE.ConeGeometry(20, 24, 18, 1, true),
        new THREE.MeshPhongMaterial({ color: 0x4a2c1d, flatShading: true, side: THREE.DoubleSide })
    );
    body.position.y = 12;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    const crater = new THREE.Mesh(
        new THREE.CylinderGeometry(6.8, 4.5, 3.5, 18),
        new THREE.MeshPhongMaterial({ color: 0x2c1a12 })
    );
    crater.position.y = 23;
    crater.castShadow = true;
    g.add(crater);

    const lava = new THREE.Mesh(
        new THREE.CylinderGeometry(5.5, 5.5, 1.2, 18),
        new THREE.MeshPhongMaterial({ color: 0xff4500, emissive: 0xaa2200 })
    );
    lava.position.y = 24.2;
    g.add(lava);

    g.position.set(x, 0, z);
    return g;
}

// ============================================================
// 10. KART
// ============================================================

function createKart(name, color, isBot = false, isRemote = false) {
    const kart = {
        name,
        color,
        colorCss: KART_CSS[Math.max(0, KART_COLORS.indexOf(color))],
        isBot,
        isRemote,

        mesh: new THREE.Group(),
        x: 0,
        y: 0.6,
        z: 0,
        speed: 0,
        heading: 0,
        steer: 0,

        lap: 1,
        lapProgress: 0,
        lapScore: 0,
        place: 1,
        finished: false,
        finishTime: 0,

        item: null,
        boostTimer: 0,
        stunTimer: 0,
        lightningTimer: 0,
        wrongWay: 0,
        shellCooldown: 0,

        lastProgress: 0,
        crossedStartLock: 0,

        rx: 0,
        rz: 0,
        rheading: 0,
        remoteSpeed: 0,

        __bestLap: 0,
        __lapStartStamp: 0,
        __prevLapForTime: 1,
        __lapStartTimes: {},
        __lapAnnounced: new Set(),
        __cpFlags: { a: false, b: false, c: false },
        __lastPlace: undefined,
        __rubber: 1.0
    };

    buildKartMesh(kart, color);
    attachKartShadow(kart);
    G.scene.add(kart.mesh);
    return kart;
}

function buildKartMesh(kart, color) {
    const g = kart.mesh;

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.9, 4.2),
        new THREE.MeshPhongMaterial({ color })
    );
    body.position.y = 1.0;
    body.castShadow = true;
    g.add(body);

    const hood = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.55, 1.7),
        new THREE.MeshPhongMaterial({ color: lightenHex(color, 0.16) })
    );
    hood.position.set(0, 1.45, 0.9);
    hood.castShadow = true;
    g.add(hood);

    const seat = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.8, 1.6),
        new THREE.MeshPhongMaterial({ color: 0x222222 })
    );
    seat.position.set(0, 1.55, -0.7);
    seat.castShadow = true;
    g.add(seat);

    const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.45, 14);
    const wheelMat = new THREE.MeshPhongMaterial({ color: 0x111111 });
    const wheelOffsets = [
        [-1.45, 0.55, 1.35],
        [ 1.45, 0.55, 1.35],
        [-1.45, 0.55,-1.35],
        [ 1.45, 0.55,-1.35]
    ];

    wheelOffsets.forEach(o => {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(o[0], o[1], o[2]);
        w.castShadow = true;
        w.userData.isWheel = true;
        g.add(w);
    });

    for (let i = -1; i <= 1; i += 2) {
        const ex = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.14, 0.6, 8),
            new THREE.MeshPhongMaterial({ color: 0x888888 })
        );
        ex.rotation.x = Math.PI / 2;
        ex.position.set(i * 0.6, 0.8, -2.15);
        g.add(ex);
    }

    const pig = createPigDriver();
    pig.position.set(0, 1.95, -0.35);
    pig.userData.isPigDriver = true;
    g.add(pig);

    const tag = createNameTag(kart.name, kart.colorCss);
    tag.position.set(0, 4.7, 0);
    g.add(tag);

    g.traverse(o => {
        if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });
}

function createPigDriver() {
    const g = new THREE.Group();

    const skin = 0xffb6c1;
    const dark = 0xcc7f96;

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.85, 16, 16),
        new THREE.MeshPhongMaterial({ color: skin })
    );
    head.position.y = 0.45;
    g.add(head);

    const snout = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 12, 12),
        new THREE.MeshPhongMaterial({ color: 0xff9eb2 })
    );
    snout.scale.set(1.25, 0.85, 0.9);
    snout.position.set(0, 0.22, 0.68);
    g.add(snout);

    const nost1 = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8),
        new THREE.MeshPhongMaterial({ color: dark })
    );
    nost1.position.set(-0.09, 0.22, 0.92);
    g.add(nost1);

    const nost2 = nost1.clone();
    nost2.position.x = 0.09;
    g.add(nost2);

    const earGeo = new THREE.ConeGeometry(0.18, 0.45, 10);
    const earMat = new THREE.MeshPhongMaterial({ color: skin });

    const e1 = new THREE.Mesh(earGeo, earMat);
    e1.position.set(-0.35, 1.0, 0);
    e1.rotation.z = 0.5;
    e1.rotation.x = -0.2;
    g.add(e1);

    const e2 = e1.clone();
    e2.position.x = 0.35;
    e2.rotation.z = -0.5;
    g.add(e2);

    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const eyeMat = new THREE.MeshPhongMaterial({ color: 0x111111 });

    const eye1 = new THREE.Mesh(eyeGeo, eyeMat);
    eye1.position.set(-0.18, 0.48, 0.72);
    g.add(eye1);

    const eye2 = eye1.clone();
    eye2.position.x = 0.18;
    g.add(eye2);

    const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 12, 12),
        new THREE.MeshPhongMaterial({ color: 0x5dade2 })
    );
    body.scale.set(1.15, 0.9, 0.85);
    body.position.set(0, -0.4, -0.15);
    g.add(body);

    const wheel = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.035, 8, 20),
        new THREE.MeshPhongMaterial({ color: 0x222222 })
    );
    wheel.rotation.x = 1.1;
    wheel.position.set(0, -0.02, 0.38);
    g.add(wheel);

    return g;
}

function createNameTag(text, bgColor) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext('2d');

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    roundRectCanvas(ctx, 0, 0, 256, 64, 16);
    ctx.fill();

    ctx.fillStyle = bgColor || '#03dac6';
    roundRectCanvas(ctx, 4, 4, 248, 56, 12);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.font = 'bold 28px Segoe UI';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 34);

    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(4.5, 1.1, 1);
    return sp;
}

function attachKartShadow(k) {
    if (!k || !k.mesh || k.shadowDisk) return;

    const disk = new THREE.Mesh(
        new THREE.CircleGeometry(1.75, 18),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })
    );
    disk.rotation.x = -Math.PI / 2;
    disk.position.y = 0.03;
    k.mesh.add(disk);
    k.shadowDisk = disk;
}
// ============================================================
// 11. POSIZIONAMENTO KART / SETUP GARA
// ============================================================

function buildUniqueBotName(index) {
    const base = BOT_NAMES[index % BOT_NAMES.length];
    const cycle = Math.floor(index / BOT_NAMES.length);
    return cycle > 0 ? `${base} ${cycle + 1}` : base;
}

function setupRaceParticipants() {
    cleanupRaceObjectsOnly();

    G.karts = [];
    G.finishOrder = [];
    G.raceTime = 0;
    G.firstFinishTime = 0;

    let colorIdx = 0;

    if (G.isMulti) {
        const players = G.gameData?.partecipanti || [mioNome];
        players.forEach((p, i) => {
            const isMe = p === mioNome;
            const kart = createKart(
                p,
                KART_COLORS[colorIdx % KART_COLORS.length],
                false,
                !isMe
            );
            G.karts.push(kart);
            if (isMe) G.playerIdx = i;
            colorIdx++;
        });
    } else {
        const me = createKart(mioNome || 'TU', KART_COLORS[0], false, false);
        G.karts.push(me);
        G.playerIdx = 0;
        colorIdx = 1;

        for (let i = 0; i < G.botCount; i++) {
            const name = buildUniqueBotName(i);
            const bot = createKart(
                name,
                KART_COLORS[colorIdx % KART_COLORS.length],
                true,
                false
            );
            G.karts.push(bot);
            colorIdx++;
        }
    }

    placeKartsOnGrid();
    refreshAllNameTags();
    applyKartHighlighting();
    initCameraOnPlayer();
    updatePlacements();
}

function placeKartsOnGrid() {
    const startT = 0.0;
    const p = getTrackPoint(startT);
    const tg = getTrackTangent(startT);
    const n = new THREE.Vector3(-tg.z, 0, tg.x).normalize();

    const perRow = 2;
    const rowSpacing = 4.5;
    const colSpacing = 3.4;

    G.karts.forEach((k, i) => {
        const row = Math.floor(i / perRow);
        const col = i % perRow;

        const sideOffset = (col === 0 ? -1 : 1) * colSpacing * 0.5;
        const backOffset = row * rowSpacing + 2.5;

        const pos = p.clone()
            .sub(tg.clone().multiplyScalar(backOffset))
            .add(n.clone().multiplyScalar(sideOffset));

        k.x = pos.x;
        k.z = pos.z;
        k.y = 0.6;
        k.heading = Math.atan2(tg.x, tg.z);
        k.speed = 0;
        k.lap = 1;
        k.lapProgress = 0;
        k.lapScore = 0;
        k.place = 1;
        k.finished = false;
        k.finishTime = 0;
        k.item = null;
        k.boostTimer = 0;
        k.stunTimer = 0;
        k.lightningTimer = 0;
        k.lastProgress = startT;
        k.crossedStartLock = 1.0;
        k.wrongWay = 0;
        k.shellCooldown = 0;
        k.remoteSpeed = 0;
        k.rx = pos.x;
        k.rz = pos.z;
        k.rheading = k.heading;
        k.__lapStartStamp = 0;
        k.__prevLapForTime = 1;
        k.__lapStartTimes = {};
        k.__bestLap = 0;
        k.__lapAnnounced = new Set();
        k.__cpFlags = { a: false, b: false, c: false };
        k.__lastPlace = undefined;
        k.__rubber = 1.0;

        syncKartMesh(k);
    });
}

function syncKartMesh(k) {
    if (!k?.mesh) return;
    k.mesh.position.set(k.x, k.y, k.z);
    k.mesh.rotation.y = k.heading;
}

function refreshAllNameTags() {
    G.karts.forEach(k => {
        const oldSprite = k.mesh.children.find(c => c.type === 'Sprite');
        if (oldSprite) k.mesh.remove(oldSprite);

        const tag = createNameTag(k.name, k.colorCss);
        tag.position.set(0, 4.7, 0);
        k.mesh.add(tag);
    });
}

function applyKartHighlighting() {
    G.karts.forEach((k, idx) => {
        if (!k.mesh) return;

        if (k.glow) {
            removeSceneObject(k.glow);
            k.glow = null;
        }

        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(1.9, 0.08, 8, 24),
            new THREE.MeshBasicMaterial({
                color: idx === G.playerIdx ? 0xffffff : k.color,
                transparent: true,
                opacity: idx === G.playerIdx ? 0.8 : 0.35
            })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.08;
        k.mesh.add(ring);
        k.glow = ring;
    });
}

function initCameraOnPlayer() {
    const me = getLocalPlayer();
    if (!me) return;

    const dirX = Math.sin(me.heading);
    const dirZ = Math.cos(me.heading);

    G.camPos.set(me.x - dirX * 12, me.y + 7, me.z - dirZ * 12);
    G.camTarget.set(me.x + dirX * 8, me.y + 2, me.z + dirZ * 8);

    G.camera.position.copy(G.camPos);
    G.camera.lookAt(G.camTarget);
}

// ============================================================
// 12. INPUT
// ============================================================

function initInput() {
    addManagedListener(window, 'keydown', e => {
        G.keys[e.code] = true;

        if ((e.code === 'Space' || e.code === 'KeyE') && G.state === 'racing') {
            const me = getLocalPlayer();
            if (me) useItem(me);
        }

        if (G.state === 'countdown' && (e.code === 'ArrowUp' || e.code === 'KeyW')) {
            if (G.__startBoostWindow) G.__startBoostSuccess = true;
        }

        if (e.code === 'KeyR' && G.state === 'racing') {
            const me = getLocalPlayer();
            if (me) rescueKartOnTrack(me);
        }

        if (e.code === 'Backquote') {
            toggleDebugPanel();
        }

        if (e.code === 'Digit1') {
            const me = getLocalPlayer();
            if (me && G.state === 'racing') me.item = 'banana';
        }
        if (e.code === 'Digit2') {
            const me = getLocalPlayer();
            if (me && G.state === 'racing') me.item = 'greenShell';
        }
        if (e.code === 'Digit3') {
            const me = getLocalPlayer();
            if (me && G.state === 'racing') me.item = 'redShell';
        }
        if (e.code === 'Digit4') {
            const me = getLocalPlayer();
            if (me && G.state === 'racing') me.item = 'boost';
        }
        if (e.code === 'Digit5') {
            const me = getLocalPlayer();
            if (me && G.state === 'racing') me.item = 'lightning';
        }

        if (e.code === 'KeyF' && e.altKey && !document.fullscreenElement) {
            document.documentElement.requestFullscreen?.().catch?.(() => {});
        } else if (e.code === 'KeyF' && e.altKey && document.fullscreenElement) {
            document.exitFullscreen?.().catch?.(() => {});
        }
    });

    addManagedListener(window, 'keyup', e => {
        G.keys[e.code] = false;
    });

    addManagedListener(document, 'visibilitychange', () => {
        if (document.hidden) return;
        G.lastTime = performance.now();
        const me = getLocalPlayer();
        if (me && G.state === 'racing') me.speed *= 0.98;
    });
}

function getPlayerInput() {
    return {
        accel: !!(G.keys['ArrowUp'] || G.keys['KeyW']),
        brake: !!(G.keys['ArrowDown'] || G.keys['KeyS']),
        left: !!(G.keys['ArrowLeft'] || G.keys['KeyA']),
        right: !!(G.keys['ArrowRight'] || G.keys['KeyD'])
    };
}

// ============================================================
// 13. PHYSICS KART
// ============================================================

function updateKart(k, dt) {
    if (!k || k.finished) return;

    if (k.boostTimer > 0) k.boostTimer -= dt;
    if (k.stunTimer > 0) k.stunTimer -= dt;
    if (k.lightningTimer > 0) k.lightningTimer -= dt;
    if (k.crossedStartLock > 0) k.crossedStartLock -= dt;
    if (k.shellCooldown > 0) k.shellCooldown -= dt;

    if (k.isRemote) {
        syncKartMesh(k);
        return;
    }

    const track = findClosestTrackInfo(k.x, k.z);
    const onRoad = track.dist <= G.roadW * 0.6;

    let accel = false;
    let brake = false;
    let left = false;
    let right = false;

    if (k.isBot) {
        const ai = getBotControls(k, dt, track);
        accel = ai.accel;
        brake = ai.brake;
        left = ai.left;
        right = ai.right;
    } else {
        const input = getPlayerInput();
        accel = input.accel;
        brake = input.brake;
        left = input.left;
        right = input.right;
    }

    if (k.stunTimer > 0) {
        k.speed *= Math.pow(0.35, dt);
        k.heading += 6 * dt;
        moveKartForward(k, dt);
        updateProgress(k, track);
        syncKartMesh(k);
        return;
    }

    let maxSpd = MAX_SPEED;
    if (!onRoad) maxSpd = OFFROAD_MAX;
    if (k.boostTimer > 0) maxSpd *= BOOST_MULT;
    if (k.lightningTimer > 0) maxSpd *= LIGHTNING_SLOW;
    if (k.isBot) maxSpd *= (k.__rubber || 1.0);

    if (accel) k.speed += ACCELERATION * dt;
    else k.speed *= Math.pow(FRICTION, dt * 60);

    if (brake) k.speed -= BRAKE_FORCE * dt;

    k.speed = clamp(k.speed, -10, maxSpd);

    const prevHeading = k.heading;
    const turnAmount = TURN_SPEED * dt * clamp(Math.abs(k.speed) / 10, 0.25, 1.0);
    if (left) k.heading += turnAmount;
    if (right) k.heading -= turnAmount;

    if (!onRoad) k.speed *= Math.pow(OFFROAD_FRIC, dt * 60);

    if (onRoad && Math.abs(k.speed) > 4) {
        const targetHeading = Math.atan2(track.tangent.x, track.tangent.z);
        const diff = angleDiff(k.heading, targetHeading);
        k.heading += clamp(diff, -0.8 * dt, 0.8 * dt) * 0.18;
    }

    moveKartForward(k, dt);

    const trackAfter = findClosestTrackInfo(k.x, k.z);
    if (trackAfter.dist > G.roadW * 0.85) {
        const px = trackAfter.px + (-trackAfter.tangent.z) * trackAfter.lateral * 0.85;
        const pz = trackAfter.pz + ( trackAfter.tangent.x) * trackAfter.lateral * 0.85;
        k.x = lerp(k.x, px, 0.16);
        k.z = lerp(k.z, pz, 0.16);
        k.speed *= 0.96;
    }

    updateProgress(k, trackAfter);
    k.steer = angleDiff(prevHeading, k.heading);
    syncKartMesh(k);

    if (k.isBot && k.item && Math.random() < dt * 0.35) {
        useItem(k);
    }
}

function moveKartForward(k, dt) {
    const dirX = Math.sin(k.heading);
    const dirZ = Math.cos(k.heading);
    k.x += dirX * k.speed * dt;
    k.z += dirZ * k.speed * dt;
}

function updateProgress(k, trackInfo = null) {
    const tr = trackInfo || findClosestTrackInfo(k.x, k.z);

    const tangentHeading = Math.atan2(tr.tangent.x, tr.tangent.z);
    const diff = Math.abs(angleDiff(k.heading, tangentHeading));
    const goingWrong = diff > Math.PI * 0.65 && Math.abs(k.speed) > 6;

    k.wrongWay = goingWrong ? Math.min(1, k.wrongWay + 0.05) : Math.max(0, k.wrongWay - 0.03);

    const prog = tr.t;
    k.lapProgress = prog;
    k.lapScore = (k.lap - 1) + prog;

    if (k.crossedStartLock <= 0) {
        if (k.lastProgress > 0.82 && prog < 0.18 && !goingWrong && k.speed > 0) {
            k.lap++;
            k.crossedStartLock = 1.0;

            if (k.lap > G.totalLaps) {
                finishKart(k);
            }
        }

        if (k.lastProgress < 0.18 && prog > 0.82 && goingWrong && k.speed > 0 && k.lap > 1) {
            k.lap--;
            k.crossedStartLock = 1.0;
        }
    }

    k.lastProgress = prog;
}

function resolveKartCollisions() {
    for (let i = 0; i < G.karts.length; i++) {
        for (let j = i + 1; j < G.karts.length; j++) {
            const a = G.karts[i];
            const b = G.karts[j];

            if (a.finished && b.finished) continue;

            const dx = b.x - a.x;
            const dz = b.z - a.z;
            const d = Math.sqrt(dx * dx + dz * dz);

            if (d > 0 && d < COLLISION_R * 2) {
                const nx = dx / d;
                const nz = dz / d;
                const push = (COLLISION_R * 2 - d) * 0.5;

                if (!a.isRemote) {
                    a.x -= nx * push;
                    a.z -= nz * push;
                    a.speed *= 0.985;
                }

                if (!b.isRemote) {
                    b.x += nx * push;
                    b.z += nz * push;
                    b.speed *= 0.985;
                }
            }
        }
    }
}

function capExtremeSpeeds() {
    G.karts.forEach(k => {
        const hardCap = MAX_SPEED * 2.2;
        if (k.speed > hardCap) k.speed = hardCap;
        if (k.speed < -15) k.speed = -15;
    });
}

function rescueKartOnTrack(k) {
    if (!k || k.finished) return;

    const tr = findClosestTrackInfo(k.x, k.z);
    k.x = tr.px;
    k.z = tr.pz;
    k.heading = Math.atan2(tr.tangent.x, tr.tangent.z);
    k.speed = 0;
    k.stunTimer = 0.4;
    syncKartMesh(k);
}

function ensurePlayerOnTrack() {
    const me = getLocalPlayer();
    if (!me) return;

    const tr = findClosestTrackInfo(me.x, me.z);
    if (tr.dist > G.roadW * 2.5) {
        me.x = tr.px;
        me.z = tr.pz;
        me.speed = 0;
        syncKartMesh(me);
    }
}

// ============================================================
// 14. BOT AI
// ============================================================

function getBotControls(k, dt, trackInfo) {
    const diffCfg = {
        easy:   { lookAhead: 0.018, brakeAt: 1.20, maxMul: 0.82, itemUse: 0.25 },
        medium: { lookAhead: 0.026, brakeAt: 0.95, maxMul: 0.92, itemUse: 0.40 },
        hard:   { lookAhead: 0.034, brakeAt: 0.72, maxMul: 1.00, itemUse: 0.58 }
    }[G.botDiff || 'medium'];

    const targetT = (trackInfo.t + diffCfg.lookAhead) % 1;
    const targetP = getTrackPoint(targetT);
    const dx = targetP.x - k.x;
    const dz = targetP.z - k.z;
    const desired = Math.atan2(dx, dz);
    const diff = angleDiff(k.heading, desired);

    const left = diff > 0.07;
    const right = diff < -0.07;

    const t1 = getTrackTangent((trackInfo.t + 0.01) % 1);
    const t2 = getTrackTangent((trackInfo.t + 0.04) % 1);
    const curve = Math.abs(angleDiff(Math.atan2(t1.x, t1.z), Math.atan2(t2.x, t2.z)));

    let accel = true;
    let brake = false;

    const desiredTop = MAX_SPEED * diffCfg.maxMul;
    if (Math.abs(diff) > diffCfg.brakeAt || curve > diffCfg.brakeAt * 0.55) {
        brake = k.speed > desiredTop * 0.7;
        accel = !brake;
    }

    if (trackInfo.dist > G.roadW * 0.5) {
        accel = false;
        brake = true;
    }

    if (k.item && Math.random() < dt * diffCfg.itemUse) {
        useItem(k);
    }

    return { accel, brake, left, right };
}

function updateBotRubberband() {
    if (G.state !== 'racing') return;

    const me = getLocalPlayer();
    if (!me) return;

    G.karts.forEach(k => {
        if (!k.isBot || k.finished) return;

        const delta = me.lapScore - k.lapScore;
        if (delta > 0.15) k.__rubber = 1.08;
        else if (delta < -0.10) k.__rubber = 0.96;
        else k.__rubber = 1.0;
    });
}
// ============================================================
// 15. ITEM SYSTEM
// ============================================================

function giveRandomItem(k) {
    const weight = getPositionWeight(k.place, G.karts.length);
    const r = Math.random();

    if (weight > 0.7) {
        if (r < 0.25) k.item = 'lightning';
        else if (r < 0.55) k.item = 'redShell';
        else if (r < 0.78) k.item = 'boost';
        else if (r < 0.90) k.item = 'banana';
        else k.item = 'greenShell';
    } else if (weight > 0.35) {
        if (r < 0.12) k.item = 'lightning';
        else if (r < 0.36) k.item = 'redShell';
        else if (r < 0.64) k.item = 'boost';
        else if (r < 0.82) k.item = 'banana';
        else k.item = 'greenShell';
    } else {
        if (r < 0.10) k.item = 'redShell';
        else if (r < 0.32) k.item = 'boost';
        else if (r < 0.62) k.item = 'banana';
        else k.item = 'greenShell';
    }

    // Fairness: bot leggermente nerfati sugli item più forti
    if (k.isBot) {
        if (k.item === 'lightning' && Math.random() < 0.45) k.item = 'boost';
        if (k.item === 'redShell' && Math.random() < 0.18) k.item = 'greenShell';
    }

    if (!k.isBot && !k.isRemote && k.name === mioNome && k.item) {
        showRacingToast(`Hai ottenuto ${ITEM_EMOJI[k.item]}!`, '#ffffff', '#000');
    }
}

function useItem(k) {
    if (!k || !k.item || k.finished) return;

    const item = k.item;
    k.item = null;

    if (k.name === mioNome && G.state === 'racing') {
        if (item === 'boost') spawnScreenBurst('#f1c40f', 24);
        if (item === 'lightning') spawnScreenBurst('#ffffff', 30);
        if (item === 'redShell') spawnScreenBurst('#e74c3c', 16);
        if (item === 'greenShell') spawnScreenBurst('#2ecc71', 16);
        if (item === 'banana') spawnScreenBurst('#f4d03f', 12);
    }

    if (item === 'boost') {
        k.boostTimer = BOOST_DUR;
        return;
    }

    if (item === 'lightning') {
        G.karts.forEach(o => {
            if (o !== k && !o.finished) {
                o.lightningTimer = LIGHTNING_DUR;
                o.speed *= 0.82;
            }
        });
        flashLightning();
        return;
    }

    if (item === 'banana') {
        spawnBanana(k);
        return;
    }

    if (item === 'greenShell') {
        spawnGreenShell(k);
        return;
    }

    if (item === 'redShell') {
        spawnRedShell(k);
        return;
    }
}

function spawnBanana(owner) {
    const backX = owner.x - Math.sin(owner.heading) * 2.5;
    const backZ = owner.z - Math.cos(owner.heading) * 2.5;

    const mesh = new THREE.Mesh(
        new THREE.ConeGeometry(0.65, 1.1, 10),
        new THREE.MeshPhongMaterial({ color: 0xf1c40f })
    );
    mesh.rotation.x = Math.PI;
    mesh.position.set(backX, 0.6, backZ);
    mesh.castShadow = true;
    G.scene.add(mesh);

    G.items.push({
        type: 'banana',
        owner: owner.name,
        mesh,
        x: backX,
        z: backZ,
        radius: BANANA_R,
        ttl: 18
    });
}

function spawnGreenShell(owner) {
    const sx = owner.x + Math.sin(owner.heading) * 2.8;
    const sz = owner.z + Math.cos(owner.heading) * 2.8;
    const vx = Math.sin(owner.heading) * SHELL_SPEED;
    const vz = Math.cos(owner.heading) * SHELL_SPEED;

    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 12, 12),
        new THREE.MeshPhongMaterial({ color: 0x2ecc71, emissive: 0x114411 })
    );
    mesh.position.set(sx, 0.8, sz);
    mesh.castShadow = true;
    G.scene.add(mesh);

    G.items.push({
        type: 'greenShell',
        owner: owner.name,
        mesh,
        x: sx,
        z: sz,
        vx,
        vz,
        radius: SHELL_R,
        ttl: 8,
        bounces: SHELL_BOUNCES
    });
}

function spawnRedShell(owner) {
    const target = findTargetAhead(owner);
    if (!target) {
        spawnGreenShell(owner);
        return;
    }

    const sx = owner.x + Math.sin(owner.heading) * 2.8;
    const sz = owner.z + Math.cos(owner.heading) * 2.8;

    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.68, 12, 12),
        new THREE.MeshPhongMaterial({ color: 0xe74c3c, emissive: 0x551111 })
    );
    mesh.position.set(sx, 0.8, sz);
    mesh.castShadow = true;
    G.scene.add(mesh);

    G.items.push({
        type: 'redShell',
        owner: owner.name,
        mesh,
        x: sx,
        z: sz,
        vx: 0,
        vz: 0,
        radius: SHELL_R,
        ttl: 8,
        targetName: target.name,
        homing: true
    });
}

function findTargetAhead(owner) {
    const ahead = G.karts
        .filter(k => k !== owner && !k.finished)
        .sort((a, b) => b.lapScore - a.lapScore);

    const myScore = owner.lapScore;
    let target = null;
    let bestScore = Infinity;

    ahead.forEach(k => {
        if (k.lapScore > myScore && k.lapScore < bestScore) {
            bestScore = k.lapScore;
            target = k;
        }
    });

    return target;
}

function updateItemBoxes(dt) {
    G.itemBoxes.forEach((box, i) => {
        if (!box.mesh) return;

        if (box.active) {
            box.mesh.visible = true;
            box.mesh.rotation.x += dt * box.rotSpeed * 0.45;
            box.mesh.rotation.y += dt * box.rotSpeed;
            box.mesh.position.y = box.baseY + Math.sin(G.raceTime * 3 + box.t * 10) * 0.18;

            const glow = 0.85 + Math.sin(G.raceTime * 4 + i) * 0.15;
            box.mesh.scale.set(glow, glow, glow);
        } else {
            box.respawn -= dt;
            box.mesh.visible = false;
            if (box.respawn <= 0) {
                box.active = true;
                box.mesh.visible = true;
            }
        }
    });
}

function handleItemBoxPickup() {
    G.karts.forEach(k => {
        if (k.finished || k.item || k.isRemote) return;

        G.itemBoxes.forEach(box => {
            if (!box.active) return;
            const d = dist2D(k.x, k.z, box.mesh.position.x, box.mesh.position.z);
            if (d < ITEMBOX_R) {
                box.active = false;
                box.respawn = 6 + Math.random() * 3;
                giveRandomItem(k);
            }
        });
    });
}

function updateItems(dt) {
    for (let i = G.items.length - 1; i >= 0; i--) {
        const it = G.items[i];
        if (!it) continue;

        if (it.type === 'checkpointFX') {
            if (it.mesh) {
                it.mesh.rotation.y += dt * 1.5;
                it.mesh.position.y = 2.2 + Math.sin(G.raceTime * 2 + i) * 0.35;
            }
            continue;
        }

        if (it.type === 'boostFX') {
            if (it.mesh?.material) {
                const o = it.pulseBase + Math.sin(G.raceTime * 4 + it.pulsePhase + i) * 0.08;
                it.mesh.material.opacity = Math.max(0.12, o);
            }
            continue;
        }

        if (it.type === 'haze') continue;

        if (it.type === 'boostTrail') {
            it.ttl -= dt;
            if (it.mesh?.material) {
                it.mesh.material.opacity = Math.max(0, (it.ttl / 0.25) * 0.55);
            }
            if (it.ttl <= 0) {
                removeItem(i);
            }
            continue;
        }

        if (it.type === 'gridFX') {
            it.ttl -= dt;
            if (it.mesh?.material) {
                it.mesh.material.opacity = Math.max(0, Math.min(0.06, it.ttl * 0.02));
            }
            if (it.ttl <= 0) {
                removeItem(i);
            }
            continue;
        }

        it.ttl -= dt;

        if (it.type === 'banana') {
            it.mesh.rotation.y += dt * 2;
            checkBananaHit(it, i);
        }

        if (it.type === 'greenShell') {
            it.x += it.vx * dt;
            it.z += it.vz * dt;
            it.mesh.position.set(it.x, 0.8, it.z);
            it.mesh.rotation.y += dt * 12;

            const tr = findClosestTrackInfo(it.x, it.z);
            if (tr.dist > G.roadW * 0.72 && it.bounces > 0) {
                const nx = -tr.tangent.z;
                const nz = tr.tangent.x;
                const sign = Math.sign(tr.lateral) || 1;
                const dot = it.vx * nx * sign + it.vz * nz * sign;
                it.vx -= 2 * dot * nx * sign;
                it.vz -= 2 * dot * nz * sign;
                it.bounces--;
            }

            checkShellHit(it, i);
        }

        if (it.type === 'redShell') {
            const target = G.karts.find(k => k.name === it.targetName && !k.finished);
            if (target) {
                const dx = target.x - it.x;
                const dz = target.z - it.z;
                const len = Math.max(0.001, Math.sqrt(dx * dx + dz * dz));
                const desiredVx = dx / len * SHELL_SPEED * 0.92;
                const desiredVz = dz / len * SHELL_SPEED * 0.92;
                it.vx = lerp(it.vx, desiredVx, dt * 3.6);
                it.vz = lerp(it.vz, desiredVz, dt * 3.6);
            }

            it.x += it.vx * dt;
            it.z += it.vz * dt;
            it.mesh.position.set(it.x, 0.8, it.z);
            it.mesh.rotation.y += dt * 14;
            checkShellHit(it, i);
        }

        if (it.ttl <= 0) {
            removeItem(i);
        }
    }
}

function checkBananaHit(it, idx) {
    for (const k of G.karts) {
        if (k.name === it.owner || k.finished || k.isRemote) continue;
        const d = dist2D(k.x, k.z, it.x, it.z);
        if (d < it.radius + 0.9) {
            stunKart(k);
            removeItem(idx);
            return;
        }
    }
}

function checkShellHit(it, idx) {
    for (const k of G.karts) {
        if (k.name === it.owner || k.finished || k.isRemote) continue;
        const d = dist2D(k.x, k.z, it.x, it.z);
        if (d < it.radius + 1.2) {
            stunKart(k);
            k.speed *= 0.5;
            removeItem(idx);
            return;
        }
    }
}

function stunKart(k) {
    k.stunTimer = STUN_DUR;
}

function removeItem(idx) {
    const it = G.items[idx];
    if (it?.mesh) removeSceneObject(it.mesh);
    G.items.splice(idx, 1);
}

function clearAllItemsAndFx() {
    for (let i = G.items.length - 1; i >= 0; i--) {
        if (G.items[i]?.mesh) removeSceneObject(G.items[i].mesh);
    }
    G.items = [];

    G.itemBoxes.forEach(box => {
        if (box?.mesh) removeSceneObject(box.mesh);
    });
    G.itemBoxes = [];
}

function flashLightning() {
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.inset = '0';
    div.style.background = 'rgba(255,255,255,0.55)';
    div.style.pointerEvents = 'none';
    div.style.zIndex = '9999';
    document.body.appendChild(div);
    setTimeout(() => div.style.opacity = '0', 30);
    setTimeout(() => div.remove(), 180);
}

// ============================================================
// 16. ONLINE REMOTE INTERPOLATION / ITEM ICONS
// ============================================================

function ensureRemoteFields() {
    G.karts.forEach(k => {
        if (k.isRemote && k.rx === undefined) {
            k.rx = k.x;
            k.rz = k.z;
            k.rheading = k.heading;
        }
    });
}

function updateRemoteInterpolation(dt) {
    G.karts.forEach(k => {
        if (!k.isRemote) return;

        if (typeof k.rx === 'number') k.x = lerp(k.x, k.rx, 0.18);
        if (typeof k.rz === 'number') k.z = lerp(k.z, k.rz, 0.18);
        if (typeof k.rheading === 'number') {
            const d = angleDiff(k.heading, k.rheading);
            k.heading += d * 0.18;
        }
        if (typeof k.remoteSpeed === 'number') {
            k.speed = lerp(k.speed, k.remoteSpeed, 0.18);
        }

        syncKartMesh(k);
    });
}

function attachItemIconToKart(k) {
    if (!k || !k.mesh || k.itemIconSprite) return;

    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    ctx.font = '42px Segoe UI Emoji';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 32, 34);

    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(1.3, 1.3, 1);
    sp.position.set(0, 5.8, 0);
    sp.visible = false;

    k.mesh.add(sp);

    k.itemIconCanvas = c;
    k.itemIconCtx = ctx;
    k.itemIconTex = tex;
    k.itemIconSprite = sp;
}

function updateKartItemIcon(k) {
    if (!k || !k.mesh) return;
    attachItemIconToKart(k);

    if (!k.item) {
        k.itemIconSprite.visible = false;
        return;
    }

    const ctx = k.itemIconCtx;
    ctx.clearRect(0, 0, 64, 64);
    ctx.font = '42px Segoe UI Emoji';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ITEM_EMOJI[k.item] || '❔', 32, 34);
    k.itemIconTex.needsUpdate = true;
    k.itemIconSprite.visible = true;
}

// ============================================================
// 17. CAMERA
// ============================================================

function updateCamera(dt) {
    const me = getLocalPlayer();
    if (!me) return;

    const dirX = Math.sin(me.heading);
    const dirZ = Math.cos(me.heading);

    const boostExtra = me.boostTimer > 0 ? 5 : 0;
    const behind = 11 + clamp(Math.abs(me.speed) * 0.18, 0, 6) + boostExtra;
    const height = 6.5 + clamp(Math.abs(me.speed) * 0.05, 0, 2.5);

    const targetCamX = me.x - dirX * behind;
    const targetCamY = me.y + height;
    const targetCamZ = me.z - dirZ * behind;

    G.camPos.x = lerp(G.camPos.x, targetCamX, 0.08);
    G.camPos.y = lerp(G.camPos.y, targetCamY, 0.08);
    G.camPos.z = lerp(G.camPos.z, targetCamZ, 0.08);

    const lookX = me.x + dirX * 8;
    const lookY = me.y + 2.5;
    const lookZ = me.z + dirZ * 8;

    G.camTarget.x = lerp(G.camTarget.x, lookX, 0.1);
    G.camTarget.y = lerp(G.camTarget.y, lookY, 0.1);
    G.camTarget.z = lerp(G.camTarget.z, lookZ, 0.1);

    G.camera.position.copy(G.camPos);
    G.camera.lookAt(G.camTarget);

    const shake = Math.min(0.06, Math.abs(me.speed) * 0.0012);
    if (shake > 0) {
        G.camera.position.x += (Math.random() - 0.5) * shake;
        G.camera.position.y += (Math.random() - 0.5) * shake;
        G.camera.position.z += (Math.random() - 0.5) * shake;
    }

    const targetFov = me.boostTimer > 0 ? 78 : 70;
    G.camFov = lerp(G.camFov, targetFov, 0.08);
    G.camera.fov = G.camFov;
    G.camera.updateProjectionMatrix();
}

function updateCountdownCamera(dt) {
    const me = getLocalPlayer();
    if (!me) {
        updateMenuCamera(dt);
        return;
    }

    const dirX = Math.sin(me.heading);
    const dirZ = Math.cos(me.heading);

    const targetPos = new THREE.Vector3(
        me.x - dirX * 9 + Math.cos(G.raceTime * 0.8) * 1.2,
        me.y + 4.8,
        me.z - dirZ * 9 + Math.sin(G.raceTime * 0.8) * 1.2
    );

    const targetLook = new THREE.Vector3(
        me.x + dirX * 6,
        me.y + 2.1,
        me.z + dirZ * 6
    );

    G.camPos.lerp(targetPos, 0.08);
    G.camTarget.lerp(targetLook, 0.1);

    G.camera.position.copy(G.camPos);
    G.camera.lookAt(G.camTarget);
}

function updateResultsCamera(dt) {
    const winner = [...G.karts].sort((a, b) => a.place - b.place)[0];
    if (!winner) {
        updateMenuCamera(dt);
        return;
    }

    const dirX = Math.sin(winner.heading);
    const dirZ = Math.cos(winner.heading);

    const targetPos = new THREE.Vector3(
        winner.x - dirX * 10 + Math.cos(G.raceTime * 0.5) * 3.5,
        winner.y + 5.5,
        winner.z - dirZ * 10 + Math.sin(G.raceTime * 0.5) * 3.5
    );

    const targetLook = new THREE.Vector3(winner.x, winner.y + 1.8, winner.z);

    G.camPos.lerp(targetPos, 0.06);
    G.camTarget.lerp(targetLook, 0.08);

    G.camera.position.copy(G.camPos);
    G.camera.lookAt(G.camTarget);
}

function updateMenuCamera(dt) {
    const t = performance.now() * 0.00008;
    const r = Math.max(100, G.trackSize * 0.28);
    const x = G.trackCenter.x + Math.cos(t) * r;
    const z = G.trackCenter.z + Math.sin(t) * r;
    G.camera.position.set(x, 58, z);
    G.camera.lookAt(G.trackCenter.x, 0, G.trackCenter.z);
}

function snapCameraIfLost() {
    const me = getLocalPlayer();
    if (!me) return;

    const d = dist2D(G.camera.position.x, G.camera.position.z, me.x, me.z);
    if (d > 120) {
        const dirX = Math.sin(me.heading);
        const dirZ = Math.cos(me.heading);
        G.camPos.set(me.x - dirX * 12, me.y + 6, me.z - dirZ * 12);
        G.camTarget.set(me.x + dirX * 8, me.y + 2, me.z + dirZ * 8);
        G.camera.position.copy(G.camPos);
        G.camera.lookAt(G.camTarget);
    }
}
// ============================================================
// 18. HUD / MINIMAP / DEBUG
// ============================================================

function initTrackCards() {
    const wrap = document.getElementById('track-select');
    if (!wrap) return;

    wrap.innerHTML = '';

    Object.entries(TRACKS).forEach(([id, td]) => {
        const card = document.createElement('div');
        card.className = 'track-card' + (id === G.trackId ? ' selected' : '');
        card.dataset.track = id;
        card.innerHTML = `
            <div style="font-size:2rem">${td.icon}</div>
            <div style="font-weight:bold">${td.name}</div>
            <div class="diff">${td.diff}</div>
        `;
        card.onclick = () => {
            G.trackId = id;
            document.querySelectorAll('.track-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            if (G.state === 'menu') buildTrack(G.trackId);
        };
        wrap.appendChild(card);
    });
}

function updatePlacements() {
    const sorted = [...G.karts].sort((a, b) => {
        if (a.finished && b.finished) return a.finishTime - b.finishTime;
        if (a.finished) return -1;
        if (b.finished) return 1;
        return b.lapScore - a.lapScore;
    });

    sorted.forEach((k, i) => k.place = i + 1);
}

function rebuildFinishOrderFromKarts() {
    G.finishOrder = [...G.karts]
        .filter(k => k.finished)
        .sort((a, b) => (a.finishTime || 999999) - (b.finishTime || 999999));
}

function getLocalPlayer() {
    return G.karts[G.playerIdx];
}

function updateHUD() {
    const me = getLocalPlayer();
    if (!me) return;

    const posEl = document.getElementById('pos-display');
    const lapEl = document.getElementById('lap-display');
    const itemEl = document.getElementById('item-box');
    const speedEl = document.getElementById('speed-display');
    const timerEl = document.getElementById('timer-display');
    const boardEl = document.getElementById('board');
    const wrongEl = document.getElementById('wrong-way');

    if (posEl) posEl.textContent = ordinalIT(me.place);
    if (lapEl) lapEl.textContent = `Giro ${Math.min(me.lap, G.totalLaps)}/${G.totalLaps}`;
    if (itemEl) itemEl.textContent = me.item ? ITEM_EMOJI[me.item] : '';
    if (speedEl) speedEl.textContent = `${Math.max(0, Math.round(Math.abs(me.speed) * 6.2))} km/h`;
    if (timerEl) timerEl.textContent = fmtTime(G.raceTime * 1000);

    if (wrongEl) {
        if (me.wrongWay > 0.7) wrongEl.classList.add('show');
        else wrongEl.classList.remove('show');
    }

    if (boardEl) {
        const sorted = [...G.karts].sort((a, b) => a.place - b.place);
        boardEl.innerHTML = sorted.map(k => `
            <div class="pe ${k === me ? 'me' : ''}">
                <span class="pd" style="background:${k.colorCss}"></span>
                <span>${ordinalIT(k.place)} ${k.name}</span>
            </div>
        `).join('');
    }

    updateHUDAccent(me);
    updatePlaceColor(me);
    drawMinimap();
}

function updateHUDAccent(me) {
    const speed = document.getElementById('speed-display');
    const pos = document.getElementById('pos-display');
    if (!speed || !pos || !me) return;

    if (me.boostTimer > 0) {
        speed.style.color = '#f1c40f';
        speed.style.textShadow = '0 0 12px rgba(241,196,15,0.8), 1px 1px 0 #000';
        pos.style.transform = 'scale(1.05)';
    } else {
        const spd = Math.abs(me.speed);
        let color = '#fff';
        if (spd > 25) color = '#f1c40f';
        else if (spd > 18) color = '#2ecc71';
        else if (spd > 10) color = '#03dac6';

        speed.style.color = color;
        speed.style.textShadow = '1px 1px 0 #000';
        pos.style.transform = 'scale(1)';
    }
}

function updatePlaceColor(me) {
    const posEl = document.getElementById('pos-display');
    if (!me || !posEl) return;

    if (me.place === 1) posEl.style.color = '#f1c40f';
    else if (me.place === 2) posEl.style.color = '#dfe6e9';
    else if (me.place === 3) posEl.style.color = '#e67e22';
    else posEl.style.color = '#ffffff';
}

function drawMinimap() {
    const cvs = document.getElementById('minimap');
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const w = cvs.width;
    const h = cvs.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, w, h);

    const scale = 0.82 * Math.min(w, h) / G.trackSize;
    const ox = w / 2 - G.trackCenter.x * scale;
    const oy = h / 2 - G.trackCenter.z * scale;

    ctx.beginPath();
    G.lookupTable.forEach((p, i) => {
        const x = p.x * scale + ox;
        const y = p.z * scale + oy;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(2, G.roadW * scale);
    ctx.stroke();

    ctx.beginPath();
    G.lookupTable.forEach((p, i) => {
        const x = p.x * scale + ox;
        const y = p.z * scale + oy;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = Math.max(1, G.roadW * scale * 0.65);
    ctx.stroke();

    G.karts.forEach((k, i) => {
        const x = k.x * scale + ox;
        const y = k.z * scale + oy;
        ctx.beginPath();
        ctx.arc(x, y, i === G.playerIdx ? 4.5 : 3.2, 0, Math.PI * 2);
        ctx.fillStyle = k.colorCss;
        ctx.fill();
        if (i === G.playerIdx) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });

    const me = getLocalPlayer();
    if (me) {
        const x = me.x * scale + ox;
        const y = me.z * scale + oy;
        const ang = me.heading;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-ang);
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(5, 6);
        ctx.lineTo(-5, 6);
        ctx.closePath();
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.restore();
    }

    const p = getTrackPoint(0);
    ctx.beginPath();
    ctx.arc(p.x * scale + ox, p.z * scale + oy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
}

// ============================================================
// 19. DEBUG PANEL
// ============================================================

function createDebugPanel() {
    const d = document.createElement('div');
    d.id = 'pig-racing-debug';
    d.style.position = 'fixed';
    d.style.bottom = '10px';
    d.style.right = '10px';
    d.style.background = 'rgba(0,0,0,0.6)';
    d.style.color = '#0f0';
    d.style.fontSize = '11px';
    d.style.fontFamily = 'monospace';
    d.style.padding = '8px 10px';
    d.style.borderRadius = '6px';
    d.style.zIndex = '200';
    d.style.pointerEvents = 'none';
    d.style.display = 'none';
    document.body.appendChild(d);
    return d;
}

function toggleDebugPanel() {
    const panel = document.getElementById('pig-racing-debug');
    if (!panel) return;
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function updateDebugPanel() {
    const panel = document.getElementById('pig-racing-debug');
    if (!panel || panel.style.display === 'none') return;

    const me = getLocalPlayer();
    if (!me) return;

    const tr = findClosestTrackInfo(me.x, me.z);
    panel.innerHTML = [
        `state: ${G.state}`,
        `speed: ${me.speed.toFixed(2)}`,
        `lap: ${me.lap}/${G.totalLaps}`,
        `progress: ${me.lapProgress.toFixed(3)}`,
        `place: ${me.place}`,
        `item: ${me.item || '-'}`,
        `boost: ${me.boostTimer.toFixed(2)}`,
        `stun: ${me.stunTimer.toFixed(2)}`,
        `offroadDist: ${tr.dist.toFixed(2)}`,
        `wrongWay: ${me.wrongWay.toFixed(2)}`
    ].join('<br>');
}

// ============================================================
// 20. LOBBY / MENU / FLOW SOLO
// ============================================================

function showMenu() {
    G.state = 'menu';
    showOverlay('menu-overlay');
    hideHUD();
    hideOverlay('countdown-overlay');
    hideOverlay('results-overlay');
    hideOverlay('lobby-overlay');

    initTrackCards();
    buildTrack(G.trackId);

    const laps = document.getElementById('sel-laps');
    const bots = document.getElementById('sel-bots');
    const diff = document.getElementById('sel-diff');

    if (laps) laps.value = String(G.totalLaps || 3);
    if (bots) bots.value = String(G.botCount || 3);
    if (diff) diff.value = G.botDiff || 'medium';

    document.querySelectorAll('.track-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.track === G.trackId);
    });
}

function startSoloGame() {
    G.isMulti = false;
    G.trackId = document.querySelector('.track-card.selected')?.dataset.track || G.trackId;
    G.totalLaps = parseInt(document.getElementById('sel-laps')?.value || '3');
    G.botCount = parseInt(document.getElementById('sel-bots')?.value || '3');
    G.botDiff = document.getElementById('sel-diff')?.value || 'medium';

    saveLocalRacingPrefs();

    hideOverlay('menu-overlay');
    hideOverlay('results-overlay');
    showHUD();

    buildTrack(G.trackId);
    setupRaceParticipants();
    startCountdown();
}

function startCountdown() {
    G.state = 'countdown';
    G.countdownVal = 3;
    G.flags.introDone = false;
    G.__startBoostWindow = false;
    G.__startBoostSuccess = false;

    const track = TRACKS[G.trackId];
    if (track) {
        showRacingToast(`${track.icon} ${track.name} • ${G.totalLaps} giri`, '#ffffff', '#000');
    }

    const ov = document.getElementById('countdown-overlay');
    showOverlay('countdown-overlay');
    setOverlayText('countdown-overlay', G.countdownVal);

    setTimeout(runIntroFlyIn, 50);

    const tick = setInterval(() => {
        G.countdownVal--;

        if (G.countdownVal > 0) {
            setOverlayText('countdown-overlay', G.countdownVal);
        } else if (G.countdownVal === 0) {
            setOverlayText('countdown-overlay', 'VIA!');
        } else {
            clearInterval(tick);
            hideOverlay('countdown-overlay');
            startRace();
        }
    }, 1000);
}

function startRace() {
    G.state = 'racing';
    G.raceTime = 0;
    G.raceStartTime = performance.now();

    const me = getLocalPlayer();
    if (me && G.__startBoostSuccess) {
        me.boostTimer = 0.8;
        showRacingToast('⭐ Turbo perfetto!', '#f1c40f', '#000');
    }

    G.__startBoostWindow = false;
    G.__startBoostSuccess = false;
}

function runIntroFlyIn() {
    if (G.flags.introDone) return;
    G.flags.introDone = true;

    const start = performance.now();
    const dur = 1200;

    function step(now) {
        const t = clamp((now - start) / dur, 0, 1);
        const e = 1 - Math.pow(1 - t, 3);

        G.camera.position.x = lerp(G.trackCenter.x + 80, G.camPos.x || G.trackCenter.x, e);
        G.camera.position.y = lerp(70, G.camPos.y || 12, e);
        G.camera.position.z = lerp(G.trackCenter.z + 80, G.camPos.z || G.trackCenter.z, e);

        G.camera.lookAt(
            lerp(G.trackCenter.x, G.camTarget.x || G.trackCenter.x, e),
            lerp(0, G.camTarget.y || 2, e),
            lerp(G.trackCenter.z, G.camTarget.z || G.trackCenter.z, e)
        );

        if (t < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
}

// ============================================================
// 21. RISULTATI
// ============================================================

function finishKart(k) {
    if (k.finished) return;

    k.finished = true;
    k.finishTime = G.raceTime;
    G.finishOrder.push(k);

    if (!G.firstFinishTime) G.firstFinishTime = G.raceTime;

    updatePlacements();

    if (!k.isBot && !k.isRemote && k.name === mioNome) {
        setTimeout(() => showPlaceToast(k.place), 200);
        if (G.isMulti) markLocalFinishedOnline();
    }
}

function showPlaceToast(place) {
    if (place === 1) showRacingToast('🏆 Hai vinto!', '#f1c40f', '#000');
    else if (place === 2) showRacingToast('🥈 Secondo posto!', '#dfe6e9', '#000');
    else if (place === 3) showRacingToast('🥉 Terzo posto!', '#e67e22', '#fff');
    else showRacingToast(`🏁 Arrivo: ${ordinalIT(place)}`, '#3498db', '#fff');
}

function checkRaceEnd() {
    const allFinished = G.karts.every(k => k.finished);
    if (allFinished) {
        endRace();
        return;
    }

    if (G.firstFinishTime && G.raceTime - G.firstFinishTime > 30) {
        G.karts.forEach(k => {
            if (!k.finished) {
                k.finished = true;
                k.finishTime = G.raceTime + k.place * 0.01;
                G.finishOrder.push(k);
            }
        });
        endRace();
    }
}

function buildResultSummaryText() {
    const sorted = [...G.karts].sort((a, b) => a.place - b.place);
    return sorted.map(k =>
        `${ordinalIT(k.place)} ${k.name} - ${k.finishTime ? fmtTime(k.finishTime * 1000) : 'DNF'}`
    ).join('\n');
}

function endRace() {
    if (G.state === 'results') return;
    G.state = 'results';

    updatePlacements();
    rebuildFinishOrderFromKarts();

    const sorted = [...G.karts].sort((a, b) => {
        if (a.finishTime && b.finishTime) return a.finishTime - b.finishTime;
        if (a.finishTime) return -1;
        if (b.finishTime) return 1;
        return a.place - b.place;
    });

    const table = document.getElementById('res-table');
    if (table) {
        table.innerHTML = sorted.map((k, i) => `
            <tr>
                <td>${i + 1}.</td>
                <td>${k.name}</td>
                <td>${k.finishTime ? fmtTime(k.finishTime * 1000) : 'DNF'}</td>
            </tr>
        `).join('');
    }

    const me = getLocalPlayer();
    const title = document.getElementById('res-title');
    if (title && me) {
        title.textContent = me.place === 1 ? '🏆 VITTORIA!' : `GARA FINITA - ${ordinalIT(me.place)}`;
    }

    hideHUD();
    showOverlay('results-overlay');

    if (me?.place === 1) {
        fireVictoryConfetti();
        celebrateIfWinner();
    }

    enrichResultsPanel();
    addLapStatsToResults();
    addShareResultsButton();
    addAdvancedStatsButton();
    addColorLegendToResults();
    styleResultButtons();

    saveRacingStats(me);
    saveAdvancedRacingStats();

    if (typeof registraPartita === 'function') {
        registraPartita('racing');
    }

    if (G.isMulti) {
        saveRaceResultOnline();
        saveResultSummaryToMatch(buildResultSummaryText());
    }
}

function endRaceOnline(data) {
    if (G.state === 'results') return;
    G.state = 'results';

    const risultati = data.risultati || [];
    const table = document.getElementById('res-table');
    if (table) {
        table.innerHTML = risultati.map(r => `
            <tr>
                <td>${r.posizione}.</td>
                <td>${r.nome}</td>
                <td>${r.tempo && r.tempo < 999999 ? fmtTime(r.tempo * 1000) : 'DNF'}</td>
            </tr>
        `).join('');
    }

    const mioRis = risultati.find(r => r.nome === mioNome);
    const title = document.getElementById('res-title');
    if (title) {
        title.textContent = mioRis?.posizione === 1
            ? '🏆 VITTORIA!'
            : `GARA FINITA - ${ordinalIT(mioRis?.posizione || 0)}`;
    }

    hideHUD();
    showOverlay('results-overlay');

    if (mioRis?.posizione === 1) {
        fireVictoryConfetti();
        celebrateIfWinner();
    }

    enrichResultsPanel();
    addShareResultsButton();
    addAdvancedStatsButton();
    addColorLegendToResults();
    styleResultButtons();

    if (mioRis) {
        saveRacingStats({ place: mioRis.posizione, finishTime: mioRis.tempo });
        saveAdvancedRacingStats();
    }

    if (typeof registraPartita === 'function') {
        registraPartita('racing');
    }
}

function backToMenu() {
    hideOverlay('results-overlay');
    hideOverlay('countdown-overlay');
    hideHUD();
    cleanupRace();
    showMenu();
}

function cleanupRaceObjectsOnly() {
    G.karts.forEach(k => {
        if (k.mesh) G.scene.remove(k.mesh);
    });
    G.karts = [];

    clearAllItemsAndFx();
}

function cleanupRace() {
    cleanupRaceObjectsOnly();
}

function hardResetToMenu() {
    cleanupRace();
    G.karts = [];
    G.items = [];
    G.itemBoxes = [];
    G.curve = null;
    G.lookupTable = [];
    G.finishOrder = [];
    G.raceTime = 0;
    G.firstFinishTime = 0;
    showMenu();
}
// ============================================================
// 22. EFFETTI GARA / LAP / FEEDBACK
// ============================================================

function celebrateIfWinner() {
    showCenterBanner('🏆 VITTORIA!', 'rgba(241,196,15,0.92)', '#000', 1800);
    spawnScreenBurst('#ffd700', 36);
}

function maybeHandleLapAnnouncements() {
    const me = getLocalPlayer();
    if (!me || G.state !== 'racing') return;

    if (me.__prevLapForTime !== me.lap) {
        const completedLap = me.lap - 1;
        if (completedLap >= 1 && completedLap <= G.totalLaps) {
            const now = G.raceTime;
            const start = me.__lapStartStamp || 0;
            const lapTime = now - start;

            me.__lapStartTimes[completedLap] = lapTime;
            me.__lapStartStamp = now;

            if (!me.__bestLap || lapTime < me.__bestLap) {
                me.__bestLap = lapTime;
                showRacingToast(`⏱️ Miglior giro: ${fmtTime(lapTime * 1000)}`, '#ffffff', '#000');
            } else {
                showRacingToast(`🏁 Giro ${completedLap}: ${fmtTime(lapTime * 1000)}`, '#ffffff', '#000');
            }

            if (completedLap < G.totalLaps) {
                showCenterBanner(`GIRO ${completedLap + 1}/${G.totalLaps}`, 'rgba(0,0,0,0.8)', '#fff', 1000);
            } else {
                showCenterBanner('ULTIMO TRATTO!', 'rgba(231,76,60,0.88)', '#fff', 1000);
            }
        }
        me.__prevLapForTime = me.lap;
    }
}

function maybeAnnouncePlaceChanges() {
    const me = getLocalPlayer();
    if (!me) return;

    if (me.__lastPlace === undefined) {
        me.__lastPlace = me.place;
        return;
    }

    if (me.place !== me.__lastPlace) {
        if (me.place < me.__lastPlace) {
            showRacingToast(`⬆️ Sei ${ordinalIT(me.place)}!`, '#2ecc71', '#000');
        } else {
            showRacingToast(`⬇️ Sei ${ordinalIT(me.place)}`, '#e74c3c', '#fff');
        }
        me.__lastPlace = me.place;
    }
}

function maybeShowFinalLap() {
    const me = getLocalPlayer();
    if (!me || me.__finalLapShown) return;

    if (me.lap === G.totalLaps) {
        me.__finalLapShown = true;
        showCenterBanner('🔥 ULTIMO GIRO!', 'rgba(231,76,60,0.92)', '#fff', 1400);
        spawnScreenBurst('#ff6b35', 28);
    }
}

function updateKartVisualEffects(dt) {
    G.karts.forEach((k, idx) => {
        if (!k.mesh) return;

        const bodyBob = (Math.abs(k.speed) > 2 ? Math.sin(G.raceTime * 12 + idx) * 0.03 : 0);
        k.mesh.position.y = k.y + bodyBob;

        if (k.glow?.material) {
            let op = idx === G.playerIdx ? 0.78 : 0.3;
            if (k.boostTimer > 0) op = 1.0;
            if (k.stunTimer > 0) op = 0.45;
            k.glow.material.opacity = op;
            const sc = k.boostTimer > 0 ? 1.18 : 1.0;
            k.glow.scale.set(sc, sc, sc);
        }

        if (k.shadowDisk) {
            const s = clamp(1.0 - Math.abs(bodyBob) * 2, 0.88, 1.08);
            k.shadowDisk.scale.set(s, s, s);
            k.shadowDisk.material.opacity = 0.18 + Math.abs(bodyBob) * 0.4;
        }

        k.mesh.children.forEach(ch => {
            if (ch.userData?.isWheel) {
                ch.rotation.x += k.speed * dt * 0.7;
            }
            if (ch.userData?.isPigDriver) {
                ch.rotation.z = clamp(-k.steer * 8, -0.18, 0.18);
                ch.position.y = 1.95 + Math.abs(k.speed) * 0.004;
            }
        });

        if (k.lightningTimer > 0) {
            k.mesh.scale.set(0.82, 0.82, 0.82);
        } else {
            k.mesh.scale.set(1, 1, 1);
        }

        if (k.boostTimer > 0 && !k.isRemote) {
            maybeSpawnBoostTrail(k);
        }

        updateKartItemIcon(k);
    });
}

function maybeSpawnBoostTrail(k) {
    if (!k || Math.random() > 0.45) return;

    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 2.0),
        new THREE.MeshBasicMaterial({
            color: 0xf1c40f,
            transparent: true,
            opacity: 0.55,
            side: THREE.DoubleSide
        })
    );

    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = k.heading;
    mesh.position.set(
        k.x - Math.sin(k.heading) * 2.2,
        0.08,
        k.z - Math.cos(k.heading) * 2.2
    );

    G.scene.add(mesh);
    G.items.push({
        type: 'boostTrail',
        mesh,
        ttl: 0.25
    });
}

// ============================================================
// 23. RISULTATI EXTRA / STATS
// ============================================================

function enrichResultsPanel() {
    const wrap = document.getElementById('results-extra');
    if (!wrap) return;

    const me = getLocalPlayer();
    if (!me) {
        wrap.innerHTML = '';
        return;
    }

    const bestLap = me.__bestLap ? fmtTime(me.__bestLap * 1000) : '-';
    wrap.innerHTML = `
        <div class="result-chip">Posizione: <b>${ordinalIT(me.place || 0)}</b></div>
        <div class="result-chip">Tempo: <b>${me.finishTime ? fmtTime(me.finishTime * 1000) : 'DNF'}</b></div>
        <div class="result-chip">Miglior giro: <b>${bestLap}</b></div>
        <div class="result-chip">Pista: <b>${TRACKS[G.trackId]?.name || G.trackId}</b></div>
        <div class="result-chip">Giri: <b>${G.totalLaps}</b></div>
    `;
}

function addLapStatsToResults() {
    const box = document.getElementById('lap-stats');
    if (!box) return;

    const me = getLocalPlayer();
    if (!me) {
        box.innerHTML = '';
        return;
    }

    let html = '<h3>Tempi Giro</h3><div class="lap-stats-grid">';
    for (let i = 1; i <= G.totalLaps; i++) {
        const t = me.__lapStartTimes[i];
        html += `<div class="lap-row">Giro ${i}: <b>${t ? fmtTime(t * 1000) : '-'}</b></div>`;
    }
    html += '</div>';
    box.innerHTML = html;
}

function addShareResultsButton() {
    const host = document.getElementById('results-actions');
    if (!host || host.querySelector('.share-results-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'share-results-btn';
    btn.textContent = 'Copia risultati';
    btn.onclick = async () => {
        const text = buildResultSummaryText();
        try {
            await navigator.clipboard.writeText(text);
            showRacingToast('📋 Risultati copiati');
        } catch {
            showRacingToast('Impossibile copiare', '#e74c3c', '#fff');
        }
    };
    host.appendChild(btn);
}

function addAdvancedStatsButton() {
    const host = document.getElementById('results-actions');
    if (!host || host.querySelector('.advanced-stats-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'advanced-stats-btn';
    btn.textContent = 'Statistiche';
    btn.onclick = () => {
        const stats = loadAdvancedRacingStats();
        showCenterBanner(
            `🏁 Gare: ${stats.races} • 🏆 Vittorie: ${stats.wins}`,
            'rgba(0,0,0,0.85)',
            '#fff',
            1800
        );
    };
    host.appendChild(btn);
}

function addColorLegendToResults() {
    const host = document.getElementById('results-legend');
    if (!host) return;

    const sorted = [...G.karts].sort((a, b) => a.place - b.place);
    host.innerHTML = sorted.map(k => `
        <div class="legend-row">
            <span class="pd" style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${k.colorCss};margin-right:8px"></span>
            ${k.name}
        </div>
    `).join('');
}

function styleResultButtons() {
    document.querySelectorAll('#results-actions button').forEach(b => {
        b.style.margin = '6px';
        b.style.padding = '10px 14px';
        b.style.borderRadius = '10px';
        b.style.border = 'none';
        b.style.cursor = 'pointer';
        b.style.fontWeight = '700';
    });
}

// ============================================================
// 24. PERSISTENZA LOCALE
// ============================================================

function saveLocalRacingPrefs() {
    try {
        localStorage.setItem('pigRacingPrefs', JSON.stringify({
            trackId: G.trackId,
            totalLaps: G.totalLaps,
            botCount: G.botCount,
            botDiff: G.botDiff
        }));
    } catch {}
}

function loadLocalRacingPrefs() {
    if (G.localPrefsLoaded) return;
    G.localPrefsLoaded = true;

    try {
        const raw = localStorage.getItem('pigRacingPrefs');
        if (!raw) return;
        const p = JSON.parse(raw);
        if (p.trackId && TRACKS[p.trackId]) G.trackId = p.trackId;
        if ([1, 3, 5].includes(p.totalLaps)) G.totalLaps = p.totalLaps;
        if (typeof p.botCount === 'number') G.botCount = clamp(p.botCount, 0, 4);
        if (['easy', 'medium', 'hard'].includes(p.botDiff)) G.botDiff = p.botDiff;
    } catch {}
}

function saveRacingStats(me) {
    if (!me) return;
    try {
        const s = JSON.parse(localStorage.getItem('pigRacingStats') || '{}');
        s.races = (s.races || 0) + 1;
        if (me.place === 1) s.wins = (s.wins || 0) + 1;
        if (!s.bestTime || (me.finishTime && me.finishTime < s.bestTime)) s.bestTime = me.finishTime || s.bestTime;
        localStorage.setItem('pigRacingStats', JSON.stringify(s));
    } catch {}
}

function saveAdvancedRacingStats() {
    const me = getLocalPlayer();
    if (!me) return;

    try {
        const s = loadAdvancedRacingStats();
        s.races++;
        if (me.place === 1) s.wins++;
        if (me.itemUses == null) s.itemUses = 0;
        if (!s.bestLap || (me.__bestLap && me.__bestLap < s.bestLap)) s.bestLap = me.__bestLap || s.bestLap;
        localStorage.setItem('pigRacingAdvancedStats', JSON.stringify(s));
    } catch {}
}

function loadAdvancedRacingStats() {
    try {
        return JSON.parse(localStorage.getItem('pigRacingAdvancedStats') || '{"races":0,"wins":0,"itemUses":0,"bestLap":0}');
    } catch {
        return { races: 0, wins: 0, itemUses: 0, bestLap: 0 };
    }
}

// ============================================================
// 25. MULTIPLAYER FIREBASE
// ============================================================

function getMatchRef() {
    if (!matchId || !window.db) return null;
    return window.db.collection('matches').doc(matchId);
}

async function syncLocalPlayerState() {
    if (!G.isMulti || G.state === 'menu' || G.state === 'loading') return;
    const ref = getMatchRef();
    const me = getLocalPlayer();
    if (!ref || !me) return;

    const payload = {};
    payload[`racingState.players.${mioNome}`] = {
        x: me.x,
        z: me.z,
        y: me.y,
        heading: me.heading,
        speed: me.speed,
        lap: me.lap,
        lapProgress: me.lapProgress,
        lapScore: me.lapScore,
        place: me.place,
        finished: me.finished,
        finishTime: me.finishTime || 0,
        item: me.item || null,
        boostTimer: me.boostTimer || 0,
        stunTimer: me.stunTimer || 0,
        lightningTimer: me.lightningTimer || 0,
        trackId: G.trackId,
        totalLaps: G.totalLaps,
        t: Date.now()
    };

    try {
        await ref.set(payload, { merge: true });
    } catch (e) {
        console.warn('syncLocalPlayerState error', e);
    }
}

function applyRemoteSnapshot(data) {
    if (!data) return;
    G.gameData = data;

    const rs = data.racingState || {};
    const players = rs.players || {};

    G.karts.forEach(k => {
        if (!k.isRemote) return;
        const p = players[k.name];
        if (!p) return;

        k.rx = p.x ?? k.rx ?? k.x;
        k.rz = p.z ?? k.rz ?? k.z;
        k.y = p.y ?? k.y;
        k.rheading = p.heading ?? k.rheading ?? k.heading;
        k.remoteSpeed = p.speed ?? k.remoteSpeed ?? k.speed;
        k.lap = p.lap ?? k.lap;
        k.lapProgress = p.lapProgress ?? k.lapProgress;
        k.lapScore = p.lapScore ?? k.lapScore;
        k.place = p.place ?? k.place;
        k.finished = !!p.finished;
        k.finishTime = p.finishTime || 0;
        k.item = p.item ?? null;
        k.boostTimer = p.boostTimer ?? 0;
        k.stunTimer = p.stunTimer ?? 0;
        k.lightningTimer = p.lightningTimer ?? 0;
    });

    if (rs.finished && Array.isArray(rs.risultati)) {
        endRaceOnline(rs);
    }
}

async function startOnlineRaceIfHost() {
    if (!G.isMulti || !isHost) return;
    const ref = getMatchRef();
    if (!ref) return;

    try {
        await ref.set({
            tipo: 'racing',
            stato: 'in_corso',
            racingState: {
                started: true,
                countdownAt: Date.now(),
                trackId: G.trackId,
                totalLaps: G.totalLaps,
                players: {},
                finished: false,
                risultati: []
            }
        }, { merge: true });
    } catch (e) {
        console.warn('startOnlineRaceIfHost error', e);
    }
}

async function markLocalFinishedOnline() {
    if (!G.isMulti) return;
    await syncLocalPlayerState();

    if (!isHost) return;

    const allDone = G.karts.every(k => k.finished);
    if (!allDone) return;

    await saveRaceResultOnline();
}

async function saveRaceResultOnline() {
    if (!G.isMulti || !isHost) return;
    const ref = getMatchRef();
    if (!ref) return;

    const sorted = [...G.karts].sort((a, b) => a.place - b.place);
    const risultati = sorted.map((k, idx) => ({
        nome: k.name,
        posizione: idx + 1,
        tempo: k.finishTime || 999999
    }));

    try {
        await ref.set({
            stato: 'finita',
            racingState: {
                finished: true,
                risultati
            }
        }, { merge: true });
    } catch (e) {
        console.warn('saveRaceResultOnline error', e);
    }
}

async function saveResultSummaryToMatch(summary) {
    if (!G.isMulti || !isHost) return;
    const ref = getMatchRef();
    if (!ref) return;

    try {
        await ref.set({
            riepilogo: summary
        }, { merge: true });
    } catch {}
}

function subscribeToMatch() {
    if (!G.isMulti) return;
    const ref = getMatchRef();
    if (!ref) return;

    if (G.unsubscribe) {
        try { G.unsubscribe(); } catch {}
        G.unsubscribe = null;
    }

    G.unsubscribe = ref.onSnapshot(snap => {
        const data = snap.data();
        if (!data) return;
        G.gameData = data;

        const participants = data.partecipanti || [];
        const lobbyList = document.getElementById('lobby-players');
        if (lobbyList) {
            lobbyList.innerHTML = participants.map(n => `<div>🐷 ${n}</div>`).join('');
        }

        if (G.state === 'lobby' || G.state === 'menu') {
            const rs = data.racingState || {};
            if (rs.trackId && TRACKS[rs.trackId]) G.trackId = rs.trackId;
            if ([1, 3, 5].includes(rs.totalLaps)) G.totalLaps = rs.totalLaps;
        }

        applyRemoteSnapshot(data);

        if ((data.stato === 'in_corso' || data.racingState?.started) && (G.state === 'lobby' || G.state === 'menu')) {
            hideOverlay('lobby-overlay');
            hideOverlay('menu-overlay');
            showHUD();

            G.trackId = data.racingState?.trackId || G.trackId;
            G.totalLaps = data.racingState?.totalLaps || G.totalLaps;

            buildTrack(G.trackId);
            setupRaceParticipants();
            startCountdown();
        }
    });
}

async function createOrJoinLobbyUI() {
    G.state = 'lobby';
    hideOverlay('menu-overlay');
    hideOverlay('results-overlay');
    showOverlay('lobby-overlay');
    hideHUD();

    const title = document.getElementById('lobby-title');
    if (title) title.textContent = `Lobby Racing`;

    subscribeToMatch();
}

async function hostStartMatch() {
    if (!G.isMulti) {
        startSoloGame();
        return;
    }

    G.trackId = document.querySelector('.track-card.selected')?.dataset.track || G.trackId;
    G.totalLaps = parseInt(document.getElementById('sel-laps')?.value || '3');

    const ref = getMatchRef();
    if (!ref) return;

    try {
        await ref.set({
            tipo: 'racing',
            trackId: G.trackId,
            totalLaps: G.totalLaps,
            racingState: {
                trackId: G.trackId,
                totalLaps: G.totalLaps
            }
        }, { merge: true });

        await startOnlineRaceIfHost();
    } catch (e) {
        console.warn('hostStartMatch error', e);
    }
}

// ============================================================
// 26. LOOP PRINCIPALE
// ============================================================

function tick(now) {
    requestAnimationFrame(tick);

    if (!G.lastTime) G.lastTime = now;
    let dt = (now - G.lastTime) / 1000;
    G.lastTime = now;
    dt = clamp(dt, 0, 0.05);

    if (G.state === 'loading') {
        G.renderer?.render(G.scene, G.camera);
        return;
    }

    if (G.state === 'menu') {
        updateMenuCamera(dt);
        animateMenuScene(dt);
        G.renderer.render(G.scene, G.camera);
        return;
    }

    if (G.state === 'lobby') {
        updateMenuCamera(dt);
        animateMenuScene(dt);
        G.renderer.render(G.scene, G.camera);
        return;
    }

    if (G.state === 'countdown') {
        G.raceTime += dt;
        updateRemoteInterpolation(dt);
        updateCountdownCamera(dt);
        updateKartVisualEffects(dt);
        updateItemBoxes(dt);
        G.renderer.render(G.scene, G.camera);
        return;
    }

    if (G.state === 'racing') {
        G.raceTime += dt;

        G.karts.forEach(k => updateKart(k, dt));
        resolveKartCollisions();
        capExtremeSpeeds();
        updatePlacements();
        updateBotRubberband();
        handleItemBoxPickup();
        updateItemBoxes(dt);
        updateItems(dt);
        updateRemoteInterpolation(dt);
        updateKartVisualEffects(dt);
        updateHUD();
        updateCamera(dt);
        maybeHandleLapAnnouncements();
        maybeAnnouncePlaceChanges();
        maybeShowFinalLap();
        ensurePlayerOnTrack();
        snapCameraIfLost();
        updateDebugPanel();
        checkRaceEnd();

        G.syncTimer += dt * 1000;
        if (G.isMulti && G.syncTimer >= FIREBASE_SYNC) {
            G.syncTimer = 0;
            syncLocalPlayerState();
        }
    }

    if (G.state === 'results') {
        G.raceTime += dt;
        updateResultsCamera(dt);
        updateKartVisualEffects(dt);
    }

    animateMenuScene(dt);
    G.renderer.render(G.scene, G.camera);
}

function animateMenuScene(dt) {
    G.itemBoxes.forEach((box, i) => {
        if (!box.mesh) return;
        box.mesh.rotation.x += dt * 0.5;
        box.mesh.rotation.y += dt * 1.2;
        box.mesh.position.y = box.baseY + Math.sin(performance.now() * 0.003 + i) * 0.18;
    });

    G.items.forEach((it, i) => {
        if (it.type === 'checkpointFX' && it.mesh) {
            it.mesh.rotation.y += dt * 1.4;
            it.mesh.position.y = 2.2 + Math.sin(G.raceTime * 2 + i) * 0.3;
        }
    });
}

// ============================================================
// 27. BIND UI
// ============================================================

function bindUI() {
    document.getElementById('btn-start-solo')?.addEventListener('click', startSoloGame);
    document.getElementById('btn-back-menu')?.addEventListener('click', backToMenu);
    document.getElementById('btn-rematch')?.addEventListener('click', () => {
        if (G.isMulti) {
            hostStartMatch();
        } else {
            backToMenu();
            setTimeout(startSoloGame, 100);
        }
    });

    document.getElementById('btn-open-lobby')?.addEventListener('click', createOrJoinLobbyUI);
    document.getElementById('btn-host-start')?.addEventListener('click', hostStartMatch);

    document.getElementById('sel-laps')?.addEventListener('change', e => {
        G.totalLaps = parseInt(e.target.value || '3');
    });
    document.getElementById('sel-bots')?.addEventListener('change', e => {
        G.botCount = parseInt(e.target.value || '3');
    });
    document.getElementById('sel-diff')?.addEventListener('change', e => {
        G.botDiff = e.target.value || 'medium';
    });
}

// ============================================================
// 28. INIZIALIZZAZIONE
// ============================================================

function patchGlobalsFallback() {
    if (typeof window.mioNome === 'undefined') window.mioNome = 'Giocatore';
    if (typeof window.matchId === 'undefined') window.matchId = null;
    if (typeof window.isHost === 'undefined') window.isHost = false;
}

function bootRacing() {
    patchGlobalsFallback();
    loadLocalRacingPrefs();

    initRenderer();
    initInput();
    createDebugPanel();
    bindUI();
    buildTrack(G.trackId);

    if (G.isMulti) {
        createOrJoinLobbyUI();
    } else {
        showMenu();
    }

    G.state = G.isMulti ? 'lobby' : 'menu';
    G.lastTime = performance.now();
    requestAnimationFrame(tick);
}

window.addEventListener('beforeunload', () => {
    clearManagedIntervals();
    clearManagedListeners();
    if (G.unsubscribe) {
        try { G.unsubscribe(); } catch {}
        G.unsubscribe = null;
    }
});

document.addEventListener('DOMContentLoaded', bootRacing);
