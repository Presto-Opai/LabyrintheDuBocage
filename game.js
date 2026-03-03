// === GAME.JS — Boucle de jeu, input, audio, UI, flow ===

// --- INPUT ---
let inventoryOpen = false;
let nearArtifact = false;

window.addEventListener('keydown', e => {
    if(e.key==='z'||e.key==='ArrowUp')    keys.w=true;
    if(e.key==='s'||e.key==='ArrowDown')   keys.s=true;
    if(e.key==='d'||e.key==='ArrowRight')  keys.a=true;
    if(e.key==='q'||e.key==='ArrowLeft')   keys.d=true;
    if(e.key===' ' && gameState==='PLAY') {
        if (nearArtifact) {
            pickupArtifact();
        } else if (nearExit) {
            exitLevel();
        } else if (nearHedge) {
            bluePassageTeleport();
        } else if (lassoTargets.length > 0) {
            lassoVisibleMonsters();
        } else {
            inventoryOpen=true; showInventory();
        }
    }
});
window.addEventListener('keyup', e => {
    if(e.key==='z'||e.key==='ArrowUp')    keys.w=false;
    if(e.key==='s'||e.key==='ArrowDown')   keys.s=false;
    if(e.key==='d'||e.key==='ArrowRight')  keys.a=false;
    if(e.key==='q'||e.key==='ArrowLeft')   keys.d=false;
    if(e.key===' ') { inventoryOpen=false; document.getElementById('inventory').style.display='none'; }
});

function pickupArtifact() {
    // Trouver le sprite artifact le plus proche dans un rayon de 1.2
    let nearest = null, bestDist = Infinity;
    for (let s of sprites) {
        if (s.type !== 'artifact') continue;
        let d = Math.hypot(s.x - player.x, s.y - player.y);
        if (d < 1.2 && d < bestDist) { bestDist = d; nearest = s; }
    }
    if (!nearest) return;

    let artId = nearest.artifactId || currentLevelArtifact;
    // Retirer uniquement ce sprite (pas tous les artifacts)
    sprites = sprites.filter(s => s !== nearest);

    if (level === 6 && level6RequiredArtifacts.length > 0) {
        // Niveau 6 : re-collecter un artefact volé
        collectedArtifacts.add(artId);
        applyArtifactPowers();
        if (artId === 'bouclier_de_chene') ironWillShield = true;

        let remaining = level6RequiredArtifacts.filter(id => !collectedArtifacts.has(id));
        let artName = ARTIFACT_TYPES[artId] ? ARTIFACT_TYPES[artId].name : artId;

        let flash = document.getElementById('flash');
        flash.style.opacity = 0.8;
        setTimeout(() => { flash.style.opacity = 0; }, 100);

        if (remaining.length === 0) {
            // Tous retrouvés !
            player.hasArtifact = true;
            showDialogue(ARTIFACT_TYPES[artId].dialogue, true);
            playAudio('epic');
        } else {
            showDialogue(ARTIFACT_TYPES[artId].dialogue, false);
        }

        if (collectedArtifacts.has('couronne_de_vue')) drawCompass();
        if (collectedArtifacts.has('cidre_magique')) drawMinimap();
    } else {
        triggerArtifact(artId);
    }
    nearArtifact = false;
    document.getElementById('pickup-hint').style.display = 'none';
}

function lassoVisibleMonsters() {
    if (lassoTargets.length === 0) return;
    let count = lassoTargets.length;
    for (let id of lassoTargets) {
        monsters = monsters.filter(m => m.id !== id);
        sprites = sprites.filter(s => !(s.type === 'monster' && s.id === id));
    }
    lassoTargets = [];
    screenShake = 0.3;
    if (monsters.length === 0) {
        showDialogue('all_monsters_lassoed');
    } else if (count >= 3) {
        showDialogue('lasso_triple');
    } else if (count === 2) {
        showDialogue('lasso_double');
    } else {
        showDialogue('monster_lassoed');
    }
    if (collectedArtifacts.has('cidre_magique')) drawMinimap();
}

function exitLevel() {
    if (!canPlayerExit()) return;
    level++;
    if (level > 10) { victory(); return; }

    if (level === 6) {
        // Transition corbeau — overlay spécial avant le niveau 6
        gameState = 'CROW';
        let ov = document.getElementById('overlay');
        ov.style.display = 'flex';
        document.getElementById('title').innerText = '';
        document.getElementById('title').style.color = '';
        document.getElementById('instructions').innerHTML =
            "<div style='text-align:center;max-width:500px'>" +
            "<p style='font-size:40px;margin-bottom:20px'>🐦‍⬛</p>" +
            "<p style='font-size:18px;color:#ffcc00;margin-bottom:15px;font-style:italic'>" +
            "Un corbeau noir fond sur vous...</p>" +
            "<p style='font-size:16px;color:#ddd;margin-bottom:10px'>" +
            "Il s'empare de tous vos trésors et les disperse dans le labyrinthe !</p>" +
            "<p style='font-size:14px;color:#aaa;margin-bottom:25px'>" +
            "Retrouvez chaque artefact pour récupérer vos pouvoirs et ouvrir la sortie.</p>" +
            "</div>";
        document.getElementById('start-btn').innerText = 'Continuer';
        document.getElementById('start-btn').style.display = 'inline-block';
        document.getElementById('difficulty-choice').style.display = 'none';

        // Le bouton "Continuer" lance le niveau
        let btn = document.getElementById('start-btn');
        let handler = function(e) {
            e.stopImmediatePropagation(); // empêcher le listener startGame permanent
            btn.removeEventListener('click', handler);
            ov.style.display = 'none';
            gameState = 'PLAY';
            generateMaze();
            showDialogue('crow_stole');
            playAudio('bgm');
        };
        btn.addEventListener('click', handler);
    } else {
        showDialogue('next_level');
        generateMaze();
        playAudio('bgm');
    }
}

function showInventory() {
    let inv = document.getElementById('inventory');
    let items = [...collectedArtifacts];
    let html = `<h2>Niveau ${level}</h2>`;
    if (items.length > 0) {
        html += '<ul class="inv-list">';
        for (let id of items) {
            let art = ARTIFACT_TYPES[id];
            if (art) html += `<li style="color:${art.color}">${art.name}</li>`;
        }
        html += '</ul>';
    } else {
        html += '<p class="inv-empty">Aucun objet pour l\'instant...</p>';
    }
    if (collectedArtifacts.has('lasso_du_vacher')) {
        html += `<p style="color:#ff4444;margin-top:10px;font-size:14px">Vaches en liberté : ${monsters.length}</p>`;
    }
    html += '<p class="inv-hint">Relâchez ESPACE pour fermer</p>';
    inv.innerHTML = html;
    inv.style.display = 'flex';
}

// --- AUDIO ---
function playAudio(track) {
    if (!loadedAudio[track]) return;
    try {
        if (track==='bgm')   { loadedAudio.bgm.play(); loadedAudio.chase.pause(); }
        if (track==='chase') { loadedAudio.chase.play(); loadedAudio.bgm.pause(); }
        if (track==='epic')  {
            let epic = loadedAudio.epic;
            epic.currentTime=0; epic.volume=1; epic.play();
            loadedAudio.bgm.pause(); loadedAudio.chase.pause();
            let epicDuration = 8000;
            let fadeStart = epicDuration - 3000;
            let fadeInterval = setInterval(()=>{
                if(epic.paused || gameState!=='PLAY') { clearInterval(fadeInterval); return; }
                let remaining = (epicDuration/1000) - epic.currentTime;
                if(remaining <= 3) {
                    epic.volume = Math.max(0, remaining / 3);
                }
                if(remaining <= 0.05) {
                    clearInterval(fadeInterval);
                    epic.pause(); epic.volume=1;
                    if(gameState==='PLAY') playAudio(monsterChaseActive?'chase':'bgm');
                }
            }, 50);
        }
    } catch(e) {}
}

// --- UI ---
let dialogueTimeout = null;
function showDialogue(key, isEpic=false, persistent=false) {
    let box=document.getElementById('dialogue-box'), text=document.getElementById('dialogue-text');
    if (dialogueTimeout) { clearTimeout(dialogueTimeout); dialogueTimeout = null; }
    box.style.display='block';
    text.className = isEpic ? 'golden-text' : '';
    text.innerText = dialogueData[key] || "???";
    if (!persistent) {
        let duration = isEpic ? 30000 : 5000;
        dialogueTimeout = setTimeout(()=>{ box.style.display='none'; dialogueTimeout=null; }, duration);
    }
}
function hideDialogue() {
    if (dialogueTimeout) { clearTimeout(dialogueTimeout); dialogueTimeout = null; }
    document.getElementById('dialogue-box').style.display='none';
}

function triggerArtifact(artifactId) {
    player.hasArtifact = true;
    collectedArtifacts.add(artifactId);
    applyArtifactPowers();

    let flash = document.getElementById('flash');
    flash.style.opacity = 0.8;
    setTimeout(()=>{ flash.style.opacity=0; }, 100);

    showDialogue(ARTIFACT_TYPES[artifactId].dialogue, true);
    playAudio('epic');

    if (artifactId==='bouclier_de_chene') ironWillShield = true;
    // Trésor du Bocage → victoire instantanée
    if (artifactId==='tresor_du_bocage') {
        setTimeout(()=>{ victory(); }, 3000);
        return;
    }
    if (collectedArtifacts.has('couronne_de_vue')) drawCompass();
    if (collectedArtifacts.has('cidre_magique')) drawMinimap();
}

// --- UPDATE ---
function update(dt) {
    if (gameState!=='PLAY') return;

    if (ironWillGrace>0) ironWillGrace-=dt;

    if (collectedArtifacts.has('cloche_du_bocage')) {
        tremorTimer+=dt;
        if(tremorTimer>=15){
            tremorTimer=0; screenShake=0.5;
            for(let m of monsters){m.stunTimer=3;m.state='stunned';m.targetX=null;m.targetY=null;}
        }
    }
    if(screenShake>0) screenShake-=dt;

    // --- Épouvantail ---
    if (scarecrowCooldown > 0) {
        scarecrowCooldown -= dt;
        if (scarecrowCooldown <= 0) {
            scarecrowCooldown = 0;
            showDialogue('scarecrow_ready');
        }
    }
    if (collectedArtifacts.has('epouvantail') && monsterChaseActive && !scarecrowEntity && scarecrowCooldown <= 0) {
        if (scarecrowChaseTimer <= 0) scarecrowChaseTimer = 3;
    }
    if (scarecrowChaseTimer > 0 && !scarecrowEntity) {
        scarecrowChaseTimer -= dt;
        if (scarecrowChaseTimer <= 0) {
            scarecrowChaseTimer = 0;
            let dest = findRandomEmptyCell(player, 5);
            scarecrowEntity = { x:player.x, y:player.y, targetX:dest.x, targetY:dest.y, pathTarget:null };
            sprites.push({ type:'scarecrow', x:player.x, y:player.y });
            showDialogue('scarecrow_deployed');
            // Monstres en chasse ciblent l'épouvantail → chasse s'arrête pour le joueur
            for (let m of monsters) {
                if (m.state === 'chase') { m.state = 'chase_scarecrow'; m.huntTimer = 0; }
            }
            monsterChaseActive = false;
            playAudio('bgm');
        }
    }
    // Déplacement de l'épouvantail
    if (scarecrowEntity) {
        let sc = scarecrowEntity;
        let dx = sc.targetX - sc.x, dy = sc.targetY - sc.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.5) {
            // Arrivé — nouvelle destination
            let dest = findRandomEmptyCell({x:sc.x,y:sc.y}, 3);
            sc.targetX = dest.x; sc.targetY = dest.y;
        } else {
            // Pathfinding vers la destination (réutilise findPath de monsters.js)
            if (!sc.pathTarget || Math.hypot(sc.pathTarget.x-sc.x,sc.pathTarget.y-sc.y)<0.3) {
                let next = findPath(sc.x, sc.y, sc.targetX, sc.targetY);
                sc.pathTarget = next;
            }
            if (sc.pathTarget) {
                let pdx = sc.pathTarget.x - sc.x, pdy = sc.pathTarget.y - sc.y;
                let pd = Math.hypot(pdx, pdy);
                if (pd > 0.05) {
                    let spd = 1.5 * dt;
                    sc.x += (pdx/pd) * spd;
                    sc.y += (pdy/pd) * spd;
                }
            }
        }
        // Mettre à jour le sprite
        let scSprite = sprites.find(s => s.type === 'scarecrow');
        if (scSprite) { scSprite.x = sc.x; scSprite.y = sc.y; }
    }

    let moveStep=player.moveSpeed*dt, rotStep=player.rotSpeed*dt;

    if(keys.w){
        let nextX = player.x + player.dirX * 0.5;
        let nextY = player.y + player.dirY * 0.5;
        let slopeFactor = getSlopeSpeedFactor(player.x, player.y, nextX, nextY);
        let slopeStep = moveStep * Math.max(0.5, Math.min(1.4, slopeFactor));
        if(isPassable(map[Math.floor(player.y)][Math.floor(player.x+player.dirX*slopeStep)])) player.x+=player.dirX*slopeStep;
        if(isPassable(map[Math.floor(player.y+player.dirY*slopeStep)][Math.floor(player.x)])) player.y+=player.dirY*slopeStep;
        let tX=Math.floor(player.x), tY=Math.floor(player.y);
        let fX=player.x-tX, fY=player.y-tY;
        if(tX+1<mapWidth  && !isPassable(map[tY][tX+1]) && fX>1-WALL_BUFFER) player.x=tX+1-WALL_BUFFER;
        if(tX>0           && !isPassable(map[tY][tX-1]) && fX<WALL_BUFFER)   player.x=tX+WALL_BUFFER;
        if(tY+1<mapHeight && !isPassable(map[tY+1][tX]) && fY>1-WALL_BUFFER) player.y=tY+1-WALL_BUFFER;
        if(tY>0           && !isPassable(map[tY-1][tX]) && fY<WALL_BUFFER)   player.y=tY+WALL_BUFFER;
    }
    if(keys.s){
        let backX = player.x - player.dirX * 0.5;
        let backY = player.y - player.dirY * 0.5;
        let slopeFactorBack = getSlopeSpeedFactor(player.x, player.y, backX, backY);
        let slopeStepBack = moveStep * Math.max(0.5, Math.min(1.4, slopeFactorBack));
        if(isPassable(map[Math.floor(player.y)][Math.floor(player.x-player.dirX*slopeStepBack)])) player.x-=player.dirX*slopeStepBack;
        if(isPassable(map[Math.floor(player.y-player.dirY*slopeStepBack)][Math.floor(player.x)])) player.y-=player.dirY*slopeStepBack;
    }
    if(keys.d){
        let od=player.dirX;
        player.dirX=player.dirX*Math.cos(-rotStep)-player.dirY*Math.sin(-rotStep);
        player.dirY=od*Math.sin(-rotStep)+player.dirY*Math.cos(-rotStep);
        let op=player.planeX;
        player.planeX=player.planeX*Math.cos(-rotStep)-player.planeY*Math.sin(-rotStep);
        player.planeY=op*Math.sin(-rotStep)+player.planeY*Math.cos(-rotStep);
    }
    if(keys.a){
        let od=player.dirX;
        player.dirX=player.dirX*Math.cos(rotStep)-player.dirY*Math.sin(rotStep);
        player.dirY=od*Math.sin(rotStep)+player.dirY*Math.cos(rotStep);
        let op=player.planeX;
        player.planeX=player.planeX*Math.cos(rotStep)-player.planeY*Math.sin(rotStep);
        player.planeY=op*Math.sin(rotStep)+player.planeY*Math.cos(rotStep);
    }

    updateMonsters(dt);

    // Détection de proximité avec l'artefact (le plus proche parmi tous)
    let pickupHint = document.getElementById('pickup-hint');
    nearArtifact = false;
    nearHedge = false;
    nearExit = false;
    lassoTargets = [];

    {
        let bestArtDist = Infinity;
        for (let s of sprites) {
            if (s.type !== 'artifact') continue;
            let d = Math.hypot(player.x - s.x, player.y - s.y);
            if (d < 1.2 && d < bestArtDist) { bestArtDist = d; nearArtifact = true; }
        }
        // Au niveau 6, on peut ramasser même si player.hasArtifact n'est pas encore vrai
        if (nearArtifact && level !== 6 && player.hasArtifact) nearArtifact = false;
    }

    // Détection haie trouée — proximité depuis une case adjacente
    nearHedgeTile = null;
    if (!nearArtifact) {
        let ptX = Math.floor(player.x), ptY = Math.floor(player.y);
        let fX = player.x - ptX, fY = player.y - ptY;
        let HEDGE_DIST = 0.45;
        // Vérifier les 4 cases adjacentes
        if (fX > 1 - HEDGE_DIST && ptX+1 < mapWidth && map[ptY][ptX+1] === TILE_SAFE) {
            let sx = ptX+1, sy = ptY;
            let leftOpen = map[sy][sx-1] !== TILE_WALL, rightOpen = sx+1 < mapWidth && map[sy][sx+1] !== TILE_WALL;
            if (leftOpen && rightOpen) { nearHedge = true; nearHedgeTile = {sx, sy, axis:'h'}; }
        }
        if (!nearHedge && fX < HEDGE_DIST && ptX-1 >= 0 && map[ptY][ptX-1] === TILE_SAFE) {
            let sx = ptX-1, sy = ptY;
            let leftOpen = sx-1 >= 0 && map[sy][sx-1] !== TILE_WALL, rightOpen = map[sy][sx+1] !== TILE_WALL;
            if (leftOpen && rightOpen) { nearHedge = true; nearHedgeTile = {sx, sy, axis:'h'}; }
        }
        if (!nearHedge && fY > 1 - HEDGE_DIST && ptY+1 < mapHeight && map[ptY+1][ptX] === TILE_SAFE) {
            let sx = ptX, sy = ptY+1;
            let upOpen = map[sy-1][sx] !== TILE_WALL, downOpen = sy+1 < mapHeight && map[sy+1][sx] !== TILE_WALL;
            if (upOpen && downOpen) { nearHedge = true; nearHedgeTile = {sx, sy, axis:'v'}; }
        }
        if (!nearHedge && fY < HEDGE_DIST && ptY-1 >= 0 && map[ptY-1][ptX] === TILE_SAFE) {
            let sx = ptX, sy = ptY-1;
            let upOpen = sy-1 >= 0 && map[sy-1][sx] !== TILE_WALL, downOpen = map[sy+1][sx] !== TILE_WALL;
            if (upOpen && downOpen) { nearHedge = true; nearHedgeTile = {sx, sy, axis:'v'}; }
        }
    }

    // Détection lasso — vaches visibles à portée ET non occultées par un mur
    if (!nearArtifact && collectedArtifacts.has('lasso_du_vacher')) {
        const LASSO_RANGE = 5;
        for (let m of monsters) {
            let dist = Math.hypot(m.x - player.x, m.y - player.y);
            if (dist > LASSO_RANGE) continue;
            let sx = m.x - player.x, sy = m.y - player.y;
            let inv = 1 / (player.planeX * player.dirY - player.dirX * player.planeY);
            let ltx = inv * (player.dirY * sx - player.dirX * sy);
            let lty = inv * (-player.planeY * sx + player.planeX * sy);
            if (lty <= 0.1) continue;
            let screenX = Math.floor((W / 2) * (1 + ltx / lty));
            // Calculer la largeur du sprite à l'écran
            let sz = Math.abs(Math.floor(H / lty));
            let sprDsX = Math.floor(-sz / 2 + screenX);
            let sprDeX = Math.floor(sz / 2 + screenX);
            let csX = Math.max(0, sprDsX);
            let ceX = Math.min(W, sprDeX);
            if (csX >= ceX) continue; // entièrement hors écran
            // Vérifier qu'au moins une colonne du sprite est devant le mur (visible)
            let anyVisible = false;
            for (let stripe = csX; stripe < ceX; stripe++) {
                if (lty < ZBuffer[stripe]) { anyVisible = true; break; }
            }
            if (anyVisible) {
                lassoTargets.push(m.id);
            }
        }
    }

    // Détection proximité sortie
    if (!nearArtifact) {
        let ptX = Math.floor(player.x), ptY = Math.floor(player.y);
        let fX = player.x - ptX, fY = player.y - ptY;
        let EXIT_DIST = 0.45;
        // Vérifier les 4 directions adjacentes pour TILE_EXIT
        if (fX > 1 - EXIT_DIST && ptX+1 < mapWidth && map[ptY] && map[ptY][ptX+1] === TILE_EXIT) nearExit = true;
        if (!nearExit && fX < EXIT_DIST && ptX-1 >= 0 && map[ptY] && map[ptY][ptX-1] === TILE_EXIT) nearExit = true;
        if (!nearExit && fY > 1 - EXIT_DIST && ptY+1 < mapHeight && map[ptY+1] && map[ptY+1][ptX] === TILE_EXIT) nearExit = true;
        if (!nearExit && fY < EXIT_DIST && ptY-1 >= 0 && map[ptY-1] && map[ptY-1][ptX] === TILE_EXIT) nearExit = true;
    }

    // Affichage du hint selon la priorité
    if (nearArtifact) {
        pickupHint.innerText = 'ESPACE — Ramasser';
        pickupHint.style.display = 'block';
    } else if (nearExit && canPlayerExit()) {
        pickupHint.innerText = 'ESPACE — Sortir !';
        pickupHint.style.display = 'block';
    } else if (nearExit && level === 6 && level6RequiredArtifacts.length > 0 && !canPlayerExit()) {
        let remaining = level6RequiredArtifacts.filter(id => !collectedArtifacts.has(id));
        pickupHint.innerText = `Il manque ${remaining.length} trésor${remaining.length > 1 ? 's' : ''} !`;
        pickupHint.style.display = 'block';
    } else if (nearExit && !player.hasArtifact) {
        pickupHint.innerText = 'Porte scellée — trouvez l\'artefact';
        pickupHint.style.display = 'block';
    } else if (nearExit && collectedArtifacts.has('lasso_du_vacher') && monsters.length > 0) {
        pickupHint.innerText = 'Il reste des vaches en liberté !';
        pickupHint.style.display = 'block';
    } else if (nearHedge) {
        pickupHint.innerText = 'ESPACE — Passer la haie';
        pickupHint.style.display = 'block';
    } else if (lassoTargets.length > 0) {
        pickupHint.innerText = 'ESPACE — Lasso !';
        pickupHint.style.display = 'block';
    } else {
        pickupHint.style.display = 'none';
    }

    if(collectedArtifacts.has('couronne_de_vue')) drawCompass();
    if(collectedArtifacts.has('cidre_magique')) drawMinimap();
}

// --- GAME LOOP ---
function gameLoop(ts) {
    if(!lastTime) lastTime=ts;
    let dt=(ts-lastTime)/1000;
    lastTime=ts;
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

// --- FLOW ---
function startGame() {
    document.getElementById('overlay').style.display='none';
    document.getElementById('title').style.color='';
    document.getElementById('title').innerText='Le Labyrinthe de Suisse normande';
    stopVictoryCrossfade();
    for(let k in loadedAudio) { loadedAudio[k].pause(); loadedAudio[k].volume = 1; }
    gameState='PLAY';
    generateMaze();
    showDialogue('start');
    playAudio('bgm');
}

function victory() {
    gameState='VICTORY';
    let ov=document.getElementById('overlay');
    ov.style.display='flex';
    document.getElementById('title').innerText="VICTOIRE !";
    document.getElementById('title').style.color="gold";
    let artList = [...collectedArtifacts].map(id=>{
        let a = ARTIFACT_TYPES[id];
        return a ? a.name : id;
    }).join(', ');
    document.getElementById('instructions').innerHTML =
        "<b style='color:gold;font-size:20px'>Vous avez conquis le Bocage !</b><br><br>" +
        "Les trésors sont à vous pour toujours.<br><br>" +
        "<span style='color:#aaa;font-size:14px'>" + artList + "</span>";
    document.getElementById('start-btn').style.display='none';
    document.getElementById('difficulty-choice').style.display='';
    document.getElementById('compass-container').style.display='none';
    document.getElementById('minimap-container').style.display='none';
    level=1; collectedArtifacts.clear(); level6RequiredArtifacts=[]; player.moveSpeed=5;
    monsterChaseActive=false;
    for(let k in loadedAudio) loadedAudio[k].pause();
    if(loadedAudio.victory){
        let vic = loadedAudio.victory;
        vic.loop = false; // on gère le loop manuellement pour le crossfade
        vic.currentTime = 0;
        vic.volume = 1;
        vic.play();
        startVictoryCrossfade(vic);
    }
}

let _victoryCrossfadeInterval = null;
let _victoryCrossfadeNext = null; // piste en cours de fade in

function stopVictoryCrossfade() {
    if (_victoryCrossfadeInterval) { clearInterval(_victoryCrossfadeInterval); _victoryCrossfadeInterval = null; }
    if (_victoryCrossfadeNext) { _victoryCrossfadeNext.pause(); _victoryCrossfadeNext = null; }
}

function startVictoryCrossfade(audio) {
    stopVictoryCrossfade();
    const FADE = 5;
    _victoryCrossfadeInterval = setInterval(() => {
        if (gameState !== 'VICTORY' || audio.paused) {
            stopVictoryCrossfade();
            return;
        }
        let remaining = audio.duration - audio.currentTime;
        if (remaining > FADE) return; // pas encore dans la zone de crossfade

        // t va de 0 (début du crossfade) à 1 (fin de la piste)
        let t = Math.max(0, Math.min(1, 1 - remaining / FADE));
        audio.volume = 1 - t;

        // Lancer la piste suivante si pas encore fait
        if (!_victoryCrossfadeNext) {
            _victoryCrossfadeNext = new Audio(audio.src);
            _victoryCrossfadeNext.loop = false;
            _victoryCrossfadeNext.volume = 0;
            _victoryCrossfadeNext.currentTime = 0;
            _victoryCrossfadeNext.play().catch(() => {});
        }
        _victoryCrossfadeNext.volume = t;
    }, 50);

    // Quand la piste courante finit, la suivante prend le relais
    audio.addEventListener('ended', () => {
        let next = _victoryCrossfadeNext;
        _victoryCrossfadeNext = null;
        if (_victoryCrossfadeInterval) { clearInterval(_victoryCrossfadeInterval); _victoryCrossfadeInterval = null; }
        if (next && gameState === 'VICTORY') {
            next.volume = 1;
            startVictoryCrossfade(next);
        }
    }, { once: true });
}

function gameOver() {
    gameState='GAMEOVER';
    let ov=document.getElementById('overlay');
    ov.style.display='flex';
    document.getElementById('title').innerText="LA VACHE VOUS A ATTRAPÉ !";
    document.getElementById('title').style.color="red";
    document.getElementById('start-btn').style.display='inline-block';
    document.getElementById('difficulty-choice').style.display='none';
    monsterChaseActive=false;
    for(let k in loadedAudio) loadedAudio[k].pause();
    if (difficulty==='easy') {
        document.getElementById('instructions').innerText="La vache vous a eu... mais vous reprenez courage et réessayez.";
        document.getElementById('start-btn').innerText="Réessayer Niveau " + level;
    } else {
        document.getElementById('instructions').innerText="La vache vous a terrassé.";
        document.getElementById('start-btn').innerText="Réessayer";
        level=1; collectedArtifacts.clear(); level6RequiredArtifacts=[]; player.moveSpeed=5;
    }
}

// --- INIT ---
document.getElementById('btn-easy').addEventListener('click', ()=>{
    difficulty='easy'; loadAssets();
    document.getElementById('difficulty-choice').style.display='none';
    startGame();
});
document.getElementById('btn-hard').addEventListener('click', ()=>{
    difficulty='hard'; loadAssets();
    document.getElementById('difficulty-choice').style.display='none';
    startGame();
});
document.getElementById('start-btn').addEventListener('click', ()=>{
    startGame();
});
requestAnimationFrame(gameLoop);
