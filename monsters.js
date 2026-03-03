// === MONSTERS.JS — IA des vaches, pathfinding BFS ===

function bfsPath(fromX,fromY, toX,toY) {
    let mx=Math.floor(fromX), my=Math.floor(fromY);
    let px=Math.floor(toX),   py=Math.floor(toY);
    let queue=[[mx,my]], cameFrom={};
    cameFrom[`${mx},${my}`]=null;
    let found=false;
    while(queue.length>0) {
        let curr=queue.shift();
        if(curr[0]===px && curr[1]===py) { found=true; break; }
        for (let d of [[0,-1],[0,1],[-1,0],[1,0]]) {
            let nx=curr[0]+d[0], ny=curr[1]+d[1], key=`${nx},${ny}`;
            if(nx>0&&nx<mapWidth&&ny>0&&ny<mapHeight&&map[ny][nx]===TILE_EMPTY&&!cameFrom.hasOwnProperty(key)) {
                cameFrom[key]=curr; queue.push([nx,ny]);
            }
        }
    }
    if(found) {
        let curr=[px,py], path=[];
        while(curr) { path.push(curr); curr=cameFrom[`${curr[0]},${curr[1]}`]; }
        path.reverse();
        if(path.length>1) return { x:path[1][0]+0.5, y:path[1][1]+0.5 };
    }
    return null;
}

// Alias pour usage extérieur (épouvantail)
function findPath(fromX,fromY, toX,toY) { return bfsPath(fromX,fromY, toX,toY); }

function teleportMonsterAway(m) {
    for (let i=0;i<200;i++) {
        let rx=Math.floor(Math.random()*(mapWidth-2))+1, ry=Math.floor(Math.random()*(mapHeight-2))+1;
        if(map[ry][rx]===TILE_EMPTY && Math.hypot(rx+0.5-player.x,ry+0.5-player.y)>8) {
            m.x=rx+0.5; m.y=ry+0.5; m.state='patrol'; m.targetX=null; m.targetY=null;
            pickPatrolPoints(m); return;
        }
    }
    m.x=mapWidth-2.5; m.y=2.5; m.state='patrol'; m.targetX=null; m.targetY=null;
    pickPatrolPoints(m);
}

function updateMonsters(dt) {
    let detectRadius = collectedArtifacts.has('cape_de_brume') ? 5 : 8;
    let loseRadius   = collectedArtifacts.has('cape_de_brume') ? 7 : 10;
    let anyChasing = false;

    for (let m of monsters) {
        m.prevX = m.x;
        m.prevY = m.y;

        if (m.stunTimer > 0) {
            m.stunTimer -= dt;
            if (m.stunTimer<=0) { m.stunTimer=0; m.state='patrol'; pickPatrolPoints(m); }
            let s=sprites.find(sp=>sp.type==='monster'&&sp.id===m.id);
            if(s){s.x=m.x;s.y=m.y;} continue;
        }
        if (m.fleeTimer > 0) {
            m.fleeTimer -= dt;
            if (m.fleeTimer<=0) { m.fleeTimer=0; m.state='patrol'; pickPatrolPoints(m); }
        }

        let dist = Math.hypot(player.x-m.x, player.y-m.y);

        if (dist < 0.8 && ironWillGrace <= 0) {
            if (ironWillShield) {
                ironWillShield=false; ironWillGrace=5;
                showDialogue('iron_will_save');
                teleportMonsterAway(m);
                let s=sprites.find(sp=>sp.type==='monster'&&sp.id===m.id);
                if(s){s.x=m.x;s.y=m.y;} continue;
            } else { gameOver(); return; }
        }

        if (m.state !== 'flee' && m.state !== 'chase_scarecrow') {
            let currentLoseRadius = m.state === 'chase' ? loseRadius + 3 : loseRadius;
            if (dist < detectRadius && m.state !== 'chase') m.state='chase';
            else if (dist >= currentLoseRadius && m.state === 'chase') { m.state='patrol'; pickPatrolPoints(m); }
        }
        if (m.state==='chase') anyChasing=true;

        m.huntTimer -= dt;
        if (m.huntTimer <= 0) {
            m.huntTimer = 0.5;
            let mx=Math.floor(m.x), my=Math.floor(m.y);

            if (m.state==='chase_scarecrow' && scarecrowEntity) {
                // Poursuivre l'épouvantail
                let next = bfsPath(m.x,m.y, scarecrowEntity.x, scarecrowEntity.y);
                if(next){m.targetX=next.x; m.targetY=next.y;}
            } else if (m.state==='chase_scarecrow' && !scarecrowEntity) {
                // Épouvantail détruit — retour en patrouille
                m.state='patrol'; pickPatrolPoints(m);
            } else if (m.state==='chase') {
                let target = { x:player.x, y:player.y };
                let next = bfsPath(m.x,m.y, target.x,target.y);
                if(next){m.targetX=next.x; m.targetY=next.y;}
            } else if (m.state==='flee') {
                let bestD=-1, bestT=null;
                for(let d of [[0,-1],[0,1],[-1,0],[1,0]]) {
                    let nx=mx+d[0], ny=my+d[1];
                    if(nx>0&&nx<mapWidth&&ny>0&&ny<mapHeight&&map[ny][nx]===TILE_EMPTY) {
                        let dd=Math.hypot(nx+0.5-player.x,ny+0.5-player.y);
                        if(dd>bestD){bestD=dd;bestT={x:nx+0.5,y:ny+0.5};}
                    }
                }
                if(bestT){m.targetX=bestT.x;m.targetY=bestT.y;}
            } else if (m.state==='patrol') {
                let pp = m.patrolPoints[m.patrolIndex];
                if (pp) {
                    let dpp = Math.hypot(m.x-pp.x, m.y-pp.y);
                    if (dpp < 1.0) {
                        m.patrolIndex = (m.patrolIndex+1) % m.patrolPoints.length;
                        pp = m.patrolPoints[m.patrolIndex];
                    }
                    let next = bfsPath(m.x,m.y, pp.x,pp.y);
                    if(next){m.targetX=next.x; m.targetY=next.y;}
                }
            }
        }

        let spd = (m.state==='chase' || m.state==='chase_scarecrow') ? m.speed : m.state==='flee' ? m.speed*1.2 : m.speed*0.5;
        if (m.targetX!==null) {
            let slopeFactor = getSlopeSpeedFactor(m.x, m.y, m.targetX, m.targetY);
            spd *= Math.max(0.5, Math.min(1.4, slopeFactor));
            let dx=m.targetX-m.x, dy=m.targetY-m.y, d=Math.hypot(dx,dy);
            if(d>0.1){ m.x+=(dx/d)*spd*dt; m.y+=(dy/d)*spd*dt; }
        }

        // Épouvantail : destruction quand un monstre l'atteint
        if (scarecrowEntity && Math.hypot(m.x-scarecrowEntity.x, m.y-scarecrowEntity.y)<0.8) {
            scarecrowEntity = null;
            sprites = sprites.filter(s => s.type !== 'scarecrow');
            scarecrowCooldown = 180;
            showDialogue('scarecrow_destroyed');
            m.state = 'patrol'; pickPatrolPoints(m);
        }

        let s=sprites.find(sp=>sp.type==='monster'&&sp.id===m.id);
        if(s){s.x=m.x;s.y=m.y;}
    }

    if (anyChasing && !monsterChaseActive) {
        monsterChaseActive=true; showDialogue('monster_spotted', false, true); playAudio('chase');
    } else if (!anyChasing && monsterChaseActive) {
        monsterChaseActive=false; hideDialogue(); playAudio('bgm');
    }
}
