// ============================================================
// 🐷 PIG RACING - Complete 3D Kart Racing Game
// ============================================================

// ============================================================
// 1. CONSTANTS & CONFIGURATION
// ============================================================
const KART_COLORS = [0xe74c3c,0x3498db,0x2ecc71,0xf1c40f,0x9b59b6,0xe67e22,0x1abc9c,0xff69b4];
const KART_COLORS_HEX = ['#e74c3c','#3498db','#2ecc71','#f1c40f','#9b59b6','#e67e22','#1abc9c','#ff69b4'];
const BOT_NAMES = ['Porky','Hamlet','Bacon','Truffle','Peppa','Oinker','Waddle','Snout'];
const ITEMS = {banana:'🍌',greenShell:'🟢',redShell:'🔴',boost:'⭐',lightning:'⚡'};
const PHYSICS = {
    maxSpeed:32, accel:20, brake:28, friction:10,
    turnSpeed:2.2, driftFactor:0.97, offRoadMult:0.45,
    boostMult:1.6, boostDuration:2, stunDuration:1.5,
    lightningDuration:3, collisionRadius:1.8
};
const SYNC_RATE = 200; // ms between Firebase syncs

// ============================================================
// 2. TRACK DEFINITIONS
// ============================================================
const TRACKS = {
    porcile: {
        name:'Circuito Porcile 🏖️', difficulty:'Facile', roadWidth:16,
        theme:{ground:0x4a7c23,road:0x666666,edge:0xcc0000,barrier:0x8B4513,sky:0x87CEEB,fog:0x87CEEB},
        points:[
            [0,0],[55,12],[115,5],[165,-25],[195,-70],
            [195,-130],[170,-175],[120,-200],[60,-195],
            [10,-170],[-20,-130],[-35,-75],[-25,-30]
        ],
        itemPositions:[0.1,0.2,0.35,0.5,0.6,0.75,0.85,0.95],
        decorations:'farm'
    },
    prosciutto: {
        name:'Monte Prosciutto 🏔️', difficulty:'Medio', roadWidth:14,
        theme:{ground:0x6B4226,road:0x555555,edge:0xf1c40f,barrier:0x777777,sky:0x6ca6cd,fog:0x6ca6cd},
        points:[
            [0,0],[50,18],[105,5],[145,-35],[120,-75],
            [70,-65],[20,-80],[-15,-120],[-5,-165],
            [40,-185],[95,-170],[135,-130],[110,-90],
            [55,-78],[-10,-45],[-30,-15]
        ],
        itemPositions:[0.08,0.18,0.28,0.38,0.5,0.6,0.72,0.82,0.92],
        decorations:'mountain'
    },
    pancetta: {
        name:'Vulcano Pancetta 🌋', difficulty:'Difficile', roadWidth:12,
        theme:{ground:0x2c2c2c,road:0x444444,edge:0xff4500,barrier:0x555555,sky:0x1a0a00,fog:0x1a0a00},
        points:[
            [0,0],[25,10],[60,-12],[90,-40],[70,-70],
            [40,-55],[25,-80],[50,-115],[90,-125],
            [125,-100],[115,-65],[140,-40],[165,-55],
            [155,-90],[120,-130],[65,-150],[10,-140],
            [-20,-105],[-30,-60],[-20,-25]
        ],
        itemPositions:[0.06,0.14,0.22,0.32,0.42,0.52,0.62,0.72,0.82,0.9,0.96],
        decorations:'volcano'
    }
};

// ============================================================
// 3. GAME STATE
// ============================================================
const Game = {
    state:'menu', // menu, lobby, countdown, racing, results
    trackId:'porcile', totalLaps:3, botCount:3, botDifficulty:'medium',
    karts:[], playerIndex:0, items:[], itemBoxes:[],
    raceTime:0, countdownValue:3,
    trackCurve:null, trackBounds:null, finishOrder:[],
    scene:null, camera:null, renderer:null,
    lastTime:0, syncTimer:0,
    unsubscribe:null, multiplayerKarts:{},
    isMultiplayer:!!matchId
};

// ============================================================
// 4. THREE.JS SETUP
// ============================================================
function initThreeJS(){
    Game.scene=new THREE.Scene();
    Game.camera=new THREE.PerspectiveCamera(70,window.innerWidth/window.innerHeight,0.5,800);
    Game.camera.position.set(0,30,-30);
    Game.renderer=new THREE.WebGLRenderer({canvas:document.getElementById('rc'),antialias:true});
    Game.renderer.setSize(window.innerWidth,window.innerHeight);
    Game.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    Game.renderer.shadowMap.enabled=true;
    Game.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    Game.renderer.toneMapping=THREE.ACESFilmicToneMapping;

    // Lights
    const ambient=new THREE.AmbientLight(0x404040,0.6);
    Game.scene.add(ambient);
    const hemi=new THREE.HemisphereLight(0x87ceeb,0x556b2f,0.5);
    Game.scene.add(hemi);
    const dir=new THREE.DirectionalLight(0xffffff,1.0);
    dir.position.set(80,120,60);
    dir.castShadow=true;
    dir.shadow.mapSize.set(2048,2048);
    dir.shadow.camera.left=-150;dir.shadow.camera.right=150;
    dir.shadow.camera.top=150;dir.shadow.camera.bottom=-150;
    dir.shadow.camera.far=400;
    Game.scene.add(dir);

    window.addEventListener('resize',()=>{
        Game.camera.aspect=window.innerWidth/window.innerHeight;
        Game.camera.updateProjectionMatrix();
        Game.renderer.setSize(window.innerWidth,window.innerHeight);
    });
}

// ============================================================
// 5. TRACK GENERATION
// ============================================================
function loadTrack(trackId){
    // Clear previous
    while(Game.scene.children.length>3) Game.scene.remove(Game.scene.children[3]);
    Game.items=[];Game.itemBoxes=[];

    const td=TRACKS[trackId];
    Game.scene.background=new THREE.Color(td.theme.sky);
    Game.scene.fog=new THREE.Fog(td.theme.fog,200,500);

    // Create curve
    const pts=td.points.map(p=>new THREE.Vector3(p[0],0,p[1]));
    Game.trackCurve=new THREE.CatmullRomCurve3(pts,true,'catmullrom',0.5);

    // Compute bounds
    const samples=200;
    let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
    for(let i=0;i<samples;i++){
        const p=Game.trackCurve.getPoint(i/samples);
        minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);
        minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);
    }
    const pad=50;
    Game.trackBounds={minX:minX-pad,maxX:maxX+pad,minZ:minZ-pad,maxZ:maxZ+pad,
        width:maxX-minX+pad*2,height:maxZ-minZ+pad*2};

    // Ground
    const gSize=Math.max(Game.trackBounds.width,Game.trackBounds.height)*2;
    const ground=new THREE.Mesh(
        new THREE.PlaneGeometry(gSize,gSize),
        new THREE.MeshPhongMaterial({color:td.theme.ground})
    );
    ground.rotation.x=-Math.PI/2;
    ground.position.set((minX+maxX)/2,-0.1,(minZ+maxZ)/2);
    ground.receiveShadow=true;
    Game.scene.add(ground);

    // Road mesh
    createRoadMesh(Game.trackCurve,td.roadWidth,td.theme);

    // Barriers
    createBarriers(Game.trackCurve,td.roadWidth,td.theme);

    // Start/finish line
    createStartLine(Game.trackCurve,td.roadWidth);

    // Item boxes
    td.itemPositions.forEach((t,i)=>{
        createItemBox(Game.trackCurve,t,td.roadWidth,i);
    });

    // Decorations
    createDecorations(Game.trackCurve,td);
}

function createRoadMesh(curve,width,theme){
    const segs=300;
    const verts=[],indices=[],uvs=[];
    for(let i=0;i<=segs;i++){
        const t=i/segs;
        const p=curve.getPoint(t);
        const tang=curve.getTangent(t);
        const norm=new THREE.Vector3(-tang.z,0,tang.x).normalize();
        const l=p.clone().add(norm.clone().multiplyScalar(width/2));
        const r=p.clone().add(norm.clone().multiplyScalar(-width/2));
        verts.push(l.x,0.02,l.z, r.x,0.02,r.z);
        uvs.push(0,t*20, 1,t*20);
        if(i<segs){
            const idx=i*2;
            indices.push(idx,idx+1,idx+2, idx+1,idx+3,idx+2);
        }
    }
    const geom=new THREE.BufferGeometry();
    geom.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
    geom.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    const roadMat=new THREE.MeshPhongMaterial({color:theme.road});
    const road=new THREE.Mesh(geom,roadMat);
    road.receiveShadow=true;
    Game.scene.add(road);

    // Center line (dashed)
    const lineVerts=[];
    for(let i=0;i<segs;i+=3){
        const t1=i/segs,t2=(i+1.5)/segs;
        const p1=curve.getPoint(t1),p2=curve.getPoint(Math.min(t2,1));
        lineVerts.push(p1.x,0.04,p1.z, p2.x,0.04,p2.z);
    }
    if(lineVerts.length>0){
        const lineGeom=new THREE.BufferGeometry();
        lineGeom.setAttribute('position',new THREE.Float32BufferAttribute(lineVerts,3));
        const line=new THREE.LineSegments(lineGeom,new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0.4}));
        Game.scene.add(line);
    }

    // Edge markings (curbs)
    [1,-1].forEach(side=>{
        const cVerts=[],cIdx=[],cUvs=[];
        const cw=0.8;
        for(let i=0;i<=segs;i++){
            const t=i/segs;
            const p=curve.getPoint(t);
            const tang=curve.getTangent(t);
            const norm=new THREE.Vector3(-tang.z,0,tang.x).normalize().multiplyScalar(side);
            const inner=p.clone().add(norm.clone().multiplyScalar(width/2-cw));
            const outer=p.clone().add(norm.clone().multiplyScalar(width/2));
            cVerts.push(inner.x,0.03,inner.z, outer.x,0.03,outer.z);
            cUvs.push(0,t*40, 1,t*40);
            if(i<segs){
                const idx=i*2;
                cIdx.push(idx,idx+1,idx+2, idx+1,idx+3,idx+2);
            }
        }
        const cGeom=new THREE.BufferGeometry();
        cGeom.setAttribute('position',new THREE.Float32BufferAttribute(cVerts,3));
        cGeom.setAttribute('uv',new THREE.Float32BufferAttribute(cUvs,2));
        cGeom.setIndex(cIdx);
        cGeom.computeVertexNormals();

        // Alternating red/white curb texture
        const cCanvas=document.createElement('canvas');
        cCanvas.width=64;cCanvas.height=64;
        const ctx=cCanvas.getContext('2d');
        for(let y=0;y<64;y+=8){
            ctx.fillStyle=(Math.floor(y/8)%2===0)?'#cc0000':'#ffffff';
            ctx.fillRect(0,y,64,8);
        }
        const cTex=new THREE.CanvasTexture(cCanvas);
        cTex.wrapS=cTex.wrapT=THREE.RepeatWrapping;
        const cMat=new THREE.MeshPhongMaterial({map:cTex});
        const curb=new THREE.Mesh(cGeom,cMat);
        Game.scene.add(curb);
    });
}

function createBarriers(curve,width,theme){
    const segs=150;
    const h=1.5;
    [1,-1].forEach(side=>{
        const verts=[],idx=[];
        const dist=width/2+1.5;
        for(let i=0;i<=segs;i++){
            const t=i/segs;
            const p=curve.getPoint(t);
            const tang=curve.getTangent(t);
            const norm=new THREE.Vector3(-tang.z,0,tang.x).normalize().multiplyScalar(side*dist);
            const base=p.clone().add(norm);
            verts.push(base.x,0,base.z, base.x,h,base.z);
            if(i<segs){
                const vi=i*2;
                idx.push(vi,vi+1,vi+2, vi+1,vi+3,vi+2);
            }
        }
        const geom=new THREE.BufferGeometry();
        geom.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
        geom.setIndex(idx);
        geom.computeVertexNormals();
        const mat=new THREE.MeshPhongMaterial({color:theme.barrier,side:THREE.DoubleSide});
        const wall=new THREE.Mesh(geom,mat);
        wall.castShadow=true;
        Game.scene.add(wall);
    });
}

function createStartLine(curve,width){
    const p=curve.getPoint(0);
    const t=curve.getTangent(0);
    const n=new THREE.Vector3(-t.z,0,t.x).normalize();
    const l=p.clone().add(n.clone().multiplyScalar(width/2));
    const r=p.clone().add(n
