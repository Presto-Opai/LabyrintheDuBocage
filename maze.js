// === MAZE.JS — Génération du labyrinthe, helpers ===

function bluePassageTeleport() {
    if (!nearHedgeTile) return;
    let sx = nearHedgeTile.sx, sy = nearHedgeTile.sy;
    let px = Math.floor(player.x), py = Math.floor(player.y);
    if (nearHedgeTile.axis === 'h') {
        // Passage horizontal : joueur à gauche ou droite de la haie
        if (px < sx) player.x = sx + 1 + WALL_BUFFER; // à gauche → téléport à droite
        else         player.x = sx - WALL_BUFFER;      // à droite → téléport à gauche
    } else {
        // Passage vertical : joueur au-dessus ou en-dessous
        if (py < sy) player.y = sy + 1 + WALL_BUFFER;  // au-dessus → téléport en-dessous
        else         player.y = sy - WALL_BUFFER;       // en-dessous → téléport au-dessus
    }
}

function findRandomEmptyCell(minDistFrom, minDist) {
    for (let i = 0; i < 200; i++) {
        let rx = Math.floor(Math.random()*(mapWidth-2))+1;
        let ry = Math.floor(Math.random()*(mapHeight-2))+1;
        if (map[ry][rx] === TILE_EMPTY) {
            if (!minDistFrom || Math.hypot(rx+0.5-minDistFrom.x, ry+0.5-minDistFrom.y) > (minDist||5)) {
                return { x:rx+0.5, y:ry+0.5 };
            }
        }
    }
    return { x:Math.floor(mapWidth/2)+0.5, y:Math.floor(mapHeight/2)+0.5 };
}


function findRandomEmptyCellInZone(minX, minY, maxX, maxY, minDistFrom, minDist) {
    for (let i = 0; i < 200; i++) {
        let rx = Math.floor(Math.random() * (maxX - minX)) + minX;
        let ry = Math.floor(Math.random() * (maxY - minY)) + minY;
        if (rx < 1 || ry < 1 || rx >= mapWidth - 1 || ry >= mapHeight - 1) continue;
        if (map[ry][rx] === TILE_EMPTY) {
            if (!minDistFrom || Math.hypot(rx + 0.5 - minDistFrom.x, ry + 0.5 - minDistFrom.y) > (minDist || 5)) {
                return { x: rx + 0.5, y: ry + 0.5 };
            }
        }
    }
    // Fallback : centre de la zone
    return { x: Math.floor((minX + maxX) / 2) + 0.5, y: Math.floor((minY + maxY) / 2) + 0.5 };
}

function ensurePath(ax,ay, bx,by) {
    let sx=Math.floor(ax), sy=Math.floor(ay), gx=Math.floor(bx), gy=Math.floor(by);
    let queue=[[sx,sy]], visited=new Set(); visited.add(`${sx},${sy}`);
    let found=false;
    while(queue.length>0){
        let [cx,cy]=queue.shift();
        if(cx===gx&&cy===gy){found=true;break;}
        for(let[dx,dy]of[[0,-1],[0,1],[-1,0],[1,0]]){
            let nx=cx+dx,ny=cy+dy,k=`${nx},${ny}`;
            if(nx>0&&nx<mapWidth-1&&ny>0&&ny<mapHeight-1&&map[ny][nx]===TILE_EMPTY&&!visited.has(k)){
                visited.add(k);queue.push([nx,ny]);
            }
        }
    }
    if(found) return;
    let cx=sx,cy=sy;
    while(cx!==gx||cy!==gy){
        if(Math.abs(gx-cx)>=Math.abs(gy-cy)){ cx+=cx<gx?1:-1; }
        else{ cy+=cy<gy?1:-1; }
        if(cx>0&&cx<mapWidth-1&&cy>0&&cy<mapHeight-1) map[cy][cx]=TILE_EMPTY;
    }
}

function pickPatrolPoints(m) {
    let cx=Math.floor(mapWidth/2), cy=Math.floor(mapHeight/2);
    m.patrolPoints = [{ x:cx+0.5, y:cy+0.5 }];
    for(let i=0;i<3;i++){
        let pt = findRandomEmptyCell({x:m.x,y:m.y}, 3);
        m.patrolPoints.push(pt);
    }
    m.patrolIndex = 0;
}

function generateMaze() {
    _floorCanvasReady = false;
    let maxGrowLevel = 5;
    let growLevel = Math.min(level, maxGrowLevel);
    mapWidth  = 21 + (growLevel-1)*2;
    mapHeight = 21 + (growLevel-1)*2;
    // Niveau 10 : double taille
    if (level === 10) { mapWidth *= 2; mapHeight *= 2; }

    map = Array.from({length:mapHeight}, ()=> Array(mapWidth).fill(TILE_WALL));

    let stack = [[1,1]];
    map[1][1] = TILE_EMPTY;
    let dirs = [[0,-2],[0,2],[-2,0],[2,0]];
    while(stack.length > 0) {
        let [cx,cy] = stack[stack.length-1];
        let unvisited = [];
        for (let d of dirs) {
            let nx=cx+d[0], ny=cy+d[1];
            if (nx>0 && nx<mapWidth-1 && ny>0 && ny<mapHeight-1 && map[ny][nx]===TILE_WALL) unvisited.push(d);
        }
        if (unvisited.length > 0) {
            let dir = unvisited[Math.floor(Math.random()*unvisited.length)];
            map[cy+dir[1]/2][cx+dir[0]/2] = TILE_EMPTY;
            map[cy+dir[1]][cx+dir[0]] = TILE_EMPTY;
            stack.push([cx+dir[0], cy+dir[1]]);
        } else { stack.pop(); }
    }

    for(let i=0; i<(mapWidth*mapHeight)/10; i++) {
        let rx=Math.floor(Math.random()*(mapWidth-2))+1, ry=Math.floor(Math.random()*(mapHeight-2))+1;
        map[ry][rx] = TILE_EMPTY;
    }

    let numSafe = Math.floor(15 + level*2);
    let placed = 0;
    for(let i=0; i<numSafe*20 && placed<numSafe; i++) {
        let rx=Math.floor(Math.random()*(mapWidth-4))+2, ry=Math.floor(Math.random()*(mapHeight-4))+2;
        if (map[ry][rx]===TILE_WALL) {
            let connectsH = map[ry][rx-1]===TILE_EMPTY && map[ry][rx+1]===TILE_EMPTY;
            let connectsV = map[ry-1][rx]===TILE_EMPTY && map[ry+1][rx]===TILE_EMPTY;
            if (connectsH || connectsV) {
                map[ry][rx] = TILE_SAFE;
                placed++;
            }
        }
    }

    let cx = Math.floor(mapWidth/2), cy = Math.floor(mapHeight/2);
    map[cy][cx]=TILE_EMPTY; map[cy-1][cx]=TILE_EMPTY; map[cy+1][cx]=TILE_EMPTY;
    map[cy][cx-1]=TILE_EMPTY; map[cy][cx+1]=TILE_EMPTY;

    // Pas de sortie au niveau 10 (Trésor du Bocage = victoire instantanée)
    if (level < 10) {
        map[mapHeight-2][mapWidth-2] = TILE_EMPTY;
        map[mapHeight-2][mapWidth-1] = TILE_EXIT;
        exitPos = { x:mapWidth-0.5, y:mapHeight-1.5 };
    } else {
        exitPos = { x:-1, y:-1 };
    }

    let huntingMode = collectedArtifacts.has('lasso_du_vacher');
    let monsterCount = level === 10 ? 15 : level >= 7 ? (level - 4) : (level >= 5 ? 2 : 1);
    let baseSpeed = 1.5 + level * 0.2;
    monsters = [];
    let fixedSpawns = [
        { x:mapWidth-2.5, y:2.5 },
        { x:2.5, y:mapHeight-2.5 }
    ];
    for (let i=0; i<monsterCount; i++) {
        let sp;
        if (i < fixedSpawns.length) {
            sp = fixedSpawns[i];
        } else {
            sp = findRandomEmptyCell({x:1.5,y:1.5}, 8);
        }
        map[Math.floor(sp.y)][Math.floor(sp.x)] = TILE_EMPTY;
        ensurePath(sp.x, sp.y, cx+0.5, cy+0.5);
        let m = { x:sp.x, y:sp.y, speed:baseSpeed, state:'patrol', huntTimer:0,
                   targetX:null, targetY:null, stunTimer:0, fleeTimer:0, id:i,
                   patrolPoints:[], patrolIndex:0, prevX:sp.x, prevY:sp.y };
        pickPatrolPoints(m);
        monsters.push(m);
    }

    let artIdx = (level-1) % ARTIFACT_SCHEDULE.length;
    currentLevelArtifact = ARTIFACT_SCHEDULE[artIdx];

    sprites = [];
    for (let m of monsters) sprites.push({ type:'monster', id:m.id, x:m.x, y:m.y });

    if (level === 6) {
        if (level6RequiredArtifacts.length === 0) {
            // Première entrée au niveau 6 : le corbeau vole tout
            let stolen = [...collectedArtifacts];
            collectedArtifacts.clear();
            level6RequiredArtifacts = [...stolen, currentLevelArtifact];
        }
        // Appliquer les pouvoirs (ceux déjà re-collectés restent actifs)
        applyArtifactPowers();
        // Placer uniquement les artefacts pas encore re-collectés
        let missing = level6RequiredArtifacts.filter(id => !collectedArtifacts.has(id));
        for (let artId of missing) {
            let pos = findRandomEmptyCell({x:1.5,y:1.5}, 3);
            sprites.unshift({ type:'artifact', artifactId:artId, x:pos.x, y:pos.y });
        }
    } else {
        level6RequiredArtifacts = [];
        if (!collectedArtifacts.has(currentLevelArtifact)) {
            if (currentLevelArtifact === 'couronne_de_vue') {
                artifactPos = { x:cx+0.5, y:cy+0.5 };
            } else if (level === 10) {
                artifactPos = findRandomEmptyCellInZone(
                    Math.floor(mapWidth / 2), Math.floor(mapHeight / 2),
                    mapWidth - 2, mapHeight - 2,
                    {x:1.5, y:1.5}, 5
                );
            } else {
                artifactPos = findRandomEmptyCell({x:1.5,y:1.5}, 5);
            }
            sprites.unshift({ type:'artifact', artifactId:currentLevelArtifact, x:artifactPos.x, y:artifactPos.y });
        }
    }

    player.x=1.5; player.y=1.5;
    // Orienter le joueur face à un couloir ouvert
    let openDirs = [];
    if (map[1][2] === TILE_EMPTY) openDirs.push({ dx:1, dy:0 });
    if (map[1][0] === TILE_EMPTY) openDirs.push({ dx:-1, dy:0 });
    if (map[2] && map[2][1] === TILE_EMPTY) openDirs.push({ dx:0, dy:1 });
    if (map[0] && map[0][1] === TILE_EMPTY) openDirs.push({ dx:0, dy:-1 });
    let facing = openDirs.length > 0 ? openDirs[0] : { dx:1, dy:0 };
    player.dirX = facing.dx; player.dirY = facing.dy;
    player.planeX = -facing.dy * 0.66; player.planeY = facing.dx * 0.66;
    if (level === 6 && level6RequiredArtifacts.length > 0) {
        player.hasArtifact = level6RequiredArtifacts.every(id => collectedArtifacts.has(id));
    } else {
        player.hasArtifact = collectedArtifacts.has(currentLevelArtifact);
    }

    ironWillShield = collectedArtifacts.has('bouclier_de_chene');
    ironWillGrace = 0;
    tremorTimer = 0;
    screenShake = 0;
    monsterChaseActive = false;

    scarecrowEntity = null;
    scarecrowChaseTimer = 0;

    // Générer le relief — collines et vallées de Suisse normande
    // 2 sommets et 2 vallées par niveau, pentes douces et progressives (rampes)
    heightMap = Array.from({length: mapHeight}, () => Array(mapWidth).fill(0.5));
    let controlPoints = [];
    let rng = function(i) { return _fHash(level * 7 + i, level * 13 + i * 3); };
    // 2 sommets (hauteur 0.9-1.0) — rayons moyens pour rampes visibles
    for (let i = 0; i < 2; i++) {
        let cpx = 2 + rng(i * 4) * (mapWidth - 4);
        let cpy = 2 + rng(i * 4 + 1) * (mapHeight - 4);
        let h = 0.9 + rng(i * 4 + 2) * 0.1;
        let radius = 5 + rng(i * 4 + 3) * 5; // rayon 5-10 cases
        controlPoints.push({x: cpx, y: cpy, h: h, r: radius});
    }
    // 2 vallées (hauteur 0.0-0.1)
    for (let i = 0; i < 2; i++) {
        let cpx = 2 + rng(i * 4 + 10) * (mapWidth - 4);
        let cpy = 2 + rng(i * 4 + 11) * (mapHeight - 4);
        let h = rng(i * 4 + 12) * 0.1;
        let radius = 5 + rng(i * 4 + 13) * 5;
        controlPoints.push({x: cpx, y: cpy, h: h, r: radius});
    }
    for (let hy = 0; hy < mapHeight; hy++) {
        for (let hx = 0; hx < mapWidth; hx++) {
            let h = 0.5;
            // Influence de chaque point de contrôle (interpolation gaussienne)
            for (let cp of controlPoints) {
                let dx = hx - cp.x, dy = hy - cp.y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                let influence = Math.exp(-(dist * dist) / (2 * cp.r * cp.r));
                h += (cp.h - 0.5) * influence;
            }
            // Léger bruit pour texture naturelle
            let noise = (_floorNoise(hx * 0.3 + level * 50, hy * 0.3 + level * 50) - 0.5) * 0.06;
            heightMap[hy][hx] = Math.max(0, Math.min(1, h + noise));
        }
    }

    applyArtifactPowers();
}

function applyArtifactPowers() {
    let speed = 5;
    if (collectedArtifacts.has('sabots_de_vitesse')) speed += 1;
    player.moveSpeed = speed;
    document.getElementById('compass-container').style.display =
        collectedArtifacts.has('couronne_de_vue') ? 'block' : 'none';
    document.getElementById('minimap-container').style.display =
        collectedArtifacts.has('cidre_magique') ? 'block' : 'none';
}
