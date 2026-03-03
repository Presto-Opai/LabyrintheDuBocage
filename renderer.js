// === RENDERER.JS — Raycasting, sprites, minimap ===

function isMonsterMovingAway(monsterId) {
    let m = monsters.find(mon => mon.id === monsterId);
    if (!m) return false;
    let moveX = m.x - m.prevX;
    let moveY = m.y - m.prevY;
    let toMonsterX = m.x - player.x;
    let toMonsterY = m.y - player.y;
    let dot = moveX * toMonsterX + moveY * toMonsterY;
    let moveMag = Math.hypot(moveX, moveY);
    return moveMag > 0.001 && dot > 0;
}

const HORIZON = Math.floor(H * 0.65);

// Échelle d'élévation pour le mode Collines — hauteur visuelle des rampes
const HILLS_ELEV_SCALE = 3.0;    // multiplicateur wall/sprite/floor
const HILLS_HORIZON_SHIFT = 160; // pixels de décalage horizon pour hauteur absolue
const HILLS_SLOPE_SHIFT = 100;   // pixels de décalage horizon pour pente locale (regard vers la rampe)

// --- SOL TEXTURÉ (drawImage, pas de getImageData → pas de CORS) ---
const _GROUND_H = H - HORIZON;
const FLOOR_RES = 48;
const FLOOR_BANDS = 20;
let _floorCanvas = null;
let _floorCanvasReady = false;

function _fHash(x, y) {
    let h = (x * 374761393 + y * 668265263 + 1274126177) | 0;
    h = ((h ^ (h >> 13)) * 1103515245) | 0;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function _floorNoise(fx, fy) {
    let ix = Math.floor(fx), iy = Math.floor(fy);
    let sx = fx - ix, sy = fy - iy;
    sx = sx * sx * (3 - 2 * sx);
    sy = sy * sy * (3 - 2 * sy);
    let v00 = _fHash(ix, iy), v10 = _fHash(ix+1, iy);
    let v01 = _fHash(ix, iy+1), v11 = _fHash(ix+1, iy+1);
    return (v00*(1-sx) + v10*sx) * (1-sy) + (v01*(1-sx) + v11*sx) * sy;
}

function generateFloorCanvas() {
    let s1 = loadedImages.sol1, s2 = loadedImages.sol2;
    if (!s1 || !s1.complete || !s1.naturalWidth) return false;
    if (!s2 || !s2.complete || !s2.naturalWidth) return false;

    let w = mapWidth * FLOOR_RES, h = mapHeight * FLOOR_RES;
    if (!_floorCanvas) _floorCanvas = document.createElement('canvas');
    _floorCanvas.width = w;
    _floorCanvas.height = h;
    let fc = _floorCanvas.getContext('2d');

    // Couche de base : sol1 partout
    for (let ty = 0; ty < mapHeight; ty++)
        for (let tx = 0; tx < mapWidth; tx++)
            fc.drawImage(s1, tx * FLOOR_RES, ty * FLOOR_RES, FLOOR_RES, FLOOR_RES);

    // Overlay : sol2 avec alpha graduel basé sur le bruit
    for (let ty = 0; ty < mapHeight; ty++) {
        for (let tx = 0; tx < mapWidth; tx++) {
            let n = _floorNoise((tx + 0.5) * 0.6, (ty + 0.5) * 0.6);
            if (n > 0.05) {
                fc.globalAlpha = n;
                fc.drawImage(s2, tx * FLOOR_RES, ty * FLOOR_RES, FLOOR_RES, FLOOR_RES);
            }
        }
    }
    fc.globalAlpha = 1;

    // Teinte d'altitude sur le sol
    for (let ty = 0; ty < mapHeight; ty++) {
        for (let tx = 0; tx < mapWidth; tx++) {
            let h = heightMap[ty] ? heightMap[ty][tx] : 0.5;
            if (h < 0.45) {
                // Vallée : vert foncé humide
                let intensity = (0.45 - h) * 0.8;
                fc.fillStyle = `rgba(10, 45, 10, ${Math.min(0.4, intensity)})`;
            } else if (h > 0.55) {
                // Colline : brun clair sec
                let intensity = (h - 0.55) * 0.9;
                fc.fillStyle = `rgba(190, 170, 110, ${Math.min(0.4, intensity)})`;
            } else {
                continue;
            }
            fc.fillRect(tx * FLOOR_RES, ty * FLOOR_RES, FLOOR_RES, FLOOR_RES);
        }
    }

    _floorCanvasReady = true;
    return true;
}

function drawFloor() {
    if (!_floorCanvasReady && !generateFloorCanvas()) return;
    drawFloorHills();
}

// === SOL COLLINES — itération par distance, hauteur par bord ===
function drawFloorHills() {
    let playerH = getHeightAt(player.x, player.y);
    let lDx = player.dirX - player.planeX, lDy = player.dirY - player.planeY;
    let rDx = player.dirX + player.planeX, rDy = player.dirY + player.planeY;
    let S = FLOOR_RES;
    let dirX = player.dirX, dirY = player.dirY;

    let BANDS = 140;
    let MAX_DIST = 28;
    let MIN_DIST = 0.3;

    // Suivi de la couverture écran pour éviter les trous
    let lastBottom = 0; // bord bas de la dernière bande dessinée

    // Itérer de loin vers proche — les bandes proches recouvrent les lointaines
    for (let i = 0; i < BANDS; i++) {
        // Distribution quadratique : plus de détail près du joueur
        let t_far  = 1.0 - i / BANDS;
        let t_near = 1.0 - (i + 1) / BANDS;
        let d_far  = MIN_DIST + t_far  * t_far  * (MAX_DIST - MIN_DIST);
        let d_near = MIN_DIST + t_near * t_near * (MAX_DIST - MIN_DIST);

        // Hauteur du sol à chaque bord de la bande
        let floorH_far  = getHeightAt(player.x + d_far  * dirX, player.y + d_far  * dirY);
        let floorH_near = getHeightAt(player.x + d_near * dirX, player.y + d_near * dirY);

        // Distance verticale oeil→sol pour chaque bord
        let vDist_far  = 0.5 + (playerH - floorH_far)  * HILLS_ELEV_SCALE;
        let vDist_near = 0.5 + (playerH - floorH_near) * HILLS_ELEV_SCALE;

        // Position écran : Y = horizon + vDist * H / distance
        let y1 = currentHorizon + vDist_far  * H / d_far;
        let y2 = currentHorizon + vDist_near * H / d_near;

        // Ne pas dessiner de sol au-dessus de l'horizon (sinon artefact visuel :
        // le sol apparaît dans la zone du ciel, devant les murs pas encore dessinés)
        if (y1 < currentHorizon) y1 = currentHorizon;
        if (y2 <= y1 || y1 >= H || y2 <= 0) continue;

        // Étendre y1 vers le haut pour combler un éventuel trou avec la bande précédente
        if (lastBottom > 0 && y1 > lastBottom) {
            y1 = lastBottom;
        }

        let dh = y2 - y1;
        if (dh < 1) { dh = 1; y2 = y1 + 1; } // au moins 1 pixel

        let clipY1 = Math.max(0, Math.floor(y1));
        let clipY2 = Math.min(H, Math.ceil(y2));
        if (clipY2 <= clipY1) continue;

        lastBottom = clipY2;

        // Coordonnées texture du sol aux distances far/near
        let fXL1 = (player.x + d_far * lDx) * S;
        let fYL1 = (player.y + d_far * lDy) * S;
        let fXR1 = (player.x + d_far * rDx) * S;
        let fYR1 = (player.y + d_far * rDy) * S;
        let fXL2 = (player.x + d_near * lDx) * S;
        let fYL2 = (player.y + d_near * lDy) * S;

        let dxR = fXR1 - fXL1, dyR = fYR1 - fYL1;
        let dxD = fXL2 - fXL1, dyD = fYL2 - fYL1;
        let D = dxR * dyD - dyR * dxD;
        if (Math.abs(D) < 0.001) continue;

        let a =  W * dyD / D, c = -W * dxD / D;
        let b = -dh * dyR / D, dv = dh * dxR / D;
        let e = -a * fXL1 - c * fYL1;
        let f = y1 - b * fXL1 - dv * fYL1;

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, clipY1, W, clipY2 - clipY1);
        ctx.clip();
        ctx.setTransform(a, b, c, dv, e, f);
        ctx.drawImage(_floorCanvas, 0, 0);
        ctx.restore();
    }

    // Brouillard de distance — le sol se fond dans la brume à l'horizon
    let fogTop = Math.max(0, Math.floor(currentHorizon));
    let fogBottom = H;
    if (fogBottom > fogTop) {
        let grad = ctx.createLinearGradient(0, fogTop, 0, fogBottom);
        grad.addColorStop(0, 'rgba(180,195,210,1)');
        grad.addColorStop(0.15, 'rgba(180,195,210,0.8)');
        grad.addColorStop(0.35, 'rgba(180,195,210,0.45)');
        grad.addColorStop(0.6, 'rgba(180,195,210,0.1)');
        grad.addColorStop(1, 'rgba(180,195,210,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, fogTop, W, fogBottom - fogTop);
    }
}

// --- CIEL PANORAMIQUE CYLINDRIQUE (ne réagit qu'à la rotation, pas à la position) ---
const SKY_PANO_W = 1024;
const SKY_PANO_H = 256;
let _skyPanoCanvas = null;
let _skyPanoReady = false;

function _skyNoise(x, y, octaves) {
    let val = 0, amp = 1, freq = 1, total = 0;
    for (let o = 0; o < octaves; o++) {
        val += _floorNoise(x * freq + o * 31.7, y * freq + o * 17.3) * amp;
        total += amp;
        amp *= 0.5;
        freq *= 2;
    }
    return val / total;
}

function generateSkyPanorama() {
    if (!_skyPanoCanvas) _skyPanoCanvas = document.createElement('canvas');
    _skyPanoCanvas.width = SKY_PANO_W;
    _skyPanoCanvas.height = SKY_PANO_H;
    let sc = _skyPanoCanvas.getContext('2d');

    // Couleurs issues de ciel1.png : gris-bleu couvert normand
    // Zénith (haut) plus sombre, horizon (bas) plus clair
    let zenR = 120, zenG = 135, zenB = 155;
    let horR = 194, horG = 203, horB = 212;

    for (let y = 0; y < SKY_PANO_H; y++) {
        let t = y / SKY_PANO_H; // 0 = zénith, 1 = horizon
        // Gradient de base
        let bR = zenR + (horR - zenR) * t;
        let bG = zenG + (horG - zenG) * t;
        let bB = zenB + (horB - zenB) * t;

        for (let x = 0; x < SKY_PANO_W; x++) {
            // Coordonnées circulaires pour wrap seamless horizontal
            let angle = (x / SKY_PANO_W) * Math.PI * 2;
            let cx = Math.cos(angle) * 3;
            let cy = Math.sin(angle) * 3;

            // Nuages multi-octaves
            let n = _skyNoise(cx + 5, cy + y * 0.02 + 5, 5);
            // Accentuer les nuages près de l'horizon
            let cloudIntensity = 0.3 + t * 0.25;
            let cloud = Math.max(0, (n - 0.35) * 3) * cloudIntensity;

            // Mélange : nuages blancs/gris clair sur le gradient
            let cloudR = 230, cloudG = 235, cloudB = 240;
            let r = bR + (cloudR - bR) * cloud;
            let g = bG + (cloudG - bG) * cloud;
            let b = bB + (cloudB - bB) * cloud;

            sc.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
            sc.fillRect(x, y, 1, 1);
        }
    }
    _skyPanoReady = true;
}

function drawSky() {
    if (!_skyPanoReady) generateSkyPanorama();

    // Angle de vue du joueur (direction centrale)
    let centerAngle = Math.atan2(player.dirY, player.dirX);
    // FOV horizontal ≈ 2 * atan(planeLength / dirLength) — on utilise la largeur du plan
    let fov = 2 * Math.atan2(Math.hypot(player.planeX, player.planeY), Math.hypot(player.dirX, player.dirY));

    // Colonne par colonne : chaque colonne a son angle de rayon
    let startAngle = centerAngle - fov / 2;
    let angleStep = fov / W;

    for (let x = 0; x < W; x++) {
        let rayAngle = startAngle + x * angleStep;
        // Normaliser dans [0, 2π]
        let normAngle = ((rayAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        // Position dans le panorama (floor + modulo pour éviter la couture)
        let srcX = Math.floor((normAngle / (Math.PI * 2)) * SKY_PANO_W) % SKY_PANO_W;

        // Dessiner la colonne de ciel (du haut à l'horizon)
        ctx.drawImage(_skyPanoCanvas, srcX, 0, 1, SKY_PANO_H, x, 0, 1, currentHorizon);
    }

    // Brume à l'horizon côté ciel — raccord avec le brouillard au sol
    let fogH = Math.max(0, Math.floor(currentHorizon));
    if (fogH > 0) {
        let grad = ctx.createLinearGradient(0, 0, 0, fogH);
        grad.addColorStop(0, 'rgba(180,195,210,0)');
        grad.addColorStop(0.5, 'rgba(180,195,210,0.1)');
        grad.addColorStop(1, 'rgba(180,195,210,0.85)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, fogH);
    }
}

function draw() {
    currentHorizon = HORIZON;
    if (gameState !== 'PLAY') {
        ctx.fillStyle = "#5dadec";
        ctx.fillRect(0, 0, W, HORIZON);
        ctx.fillStyle = "#6B4226";
        ctx.fillRect(0, HORIZON, W, H - HORIZON);
        return;
    }

    let playerHeight = getHeightAt(player.x, player.y);
    currentHorizon = HORIZON + (playerHeight - 0.5) * HILLS_HORIZON_SHIFT;
    let slopeDist = 3;
    let aheadH = getHeightAt(player.x + player.dirX * slopeDist, player.y + player.dirY * slopeDist);
    let slope = (aheadH - playerHeight) / slopeDist;
    currentHorizon -= slope * HILLS_SLOPE_SHIFT;
    currentHorizon = Math.max(30, Math.min(H - 30, currentHorizon));

    ctx.fillStyle = "#5dadec";
    ctx.fillRect(0,0,W,currentHorizon);
    ctx.fillStyle = "#6B4226";
    ctx.fillRect(0,currentHorizon,W,H-currentHorizon);

    drawSky();
    drawFloor();

    let shaking = screenShake>0;
    if(shaking){
        ctx.save();
        ctx.translate((Math.random()-0.5)*8, (Math.random()-0.5)*8);
    }

    // Raycasting des murs
    for(let x=0;x<W;x++){
        let cameraX=2*x/W-1;
        let rayDirX=player.dirX+player.planeX*cameraX;
        let rayDirY=player.dirY+player.planeY*cameraX;
        let mapX=Math.floor(player.x), mapY=Math.floor(player.y);
        let deltaDistX=Math.abs(1/rayDirX), deltaDistY=Math.abs(1/rayDirY);
        let sideDistX,sideDistY,stepX,stepY,hit=0,side=0,hitType=0,perpWallDist;

        if(rayDirX<0){stepX=-1;sideDistX=(player.x-mapX)*deltaDistX;}
        else{stepX=1;sideDistX=(mapX+1-player.x)*deltaDistX;}
        if(rayDirY<0){stepY=-1;sideDistY=(player.y-mapY)*deltaDistY;}
        else{stepY=1;sideDistY=(mapY+1-player.y)*deltaDistY;}

        while(!hit){
            if(sideDistX<sideDistY){sideDistX+=deltaDistX;mapX+=stepX;side=0;}
            else{sideDistY+=deltaDistY;mapY+=stepY;side=1;}
            if(mapY<0||mapY>=mapHeight||mapX<0||mapX>=mapWidth){hit=1;hitType=TILE_WALL;break;}
            if(map[mapY][mapX]>0){hit=1;hitType=map[mapY][mapX];}
        }

        perpWallDist = side===0 ? (sideDistX-deltaDistX) : (sideDistY-deltaDistY);
        if(perpWallDist<0.001) perpWallDist=0.001;
        ZBuffer[x]=perpWallDist;

        let lineHeight=H/perpWallDist;

        let wallX;
        if(side===0) wallX=player.y+perpWallDist*rayDirY;
        else wallX=player.x+perpWallDist*rayDirX;
        let wallXFull = wallX; // position monde complète pour le bruit
        wallX-=Math.floor(wallX);

        // Hauteur irrégulière du sommet de la haie
        let hedgeNoise = _floorNoise(wallXFull * 4.5, (side===0 ? mapY : mapX) * 2.3 + 77);
        let topOffset = (hedgeNoise - 0.5) * lineHeight * 0.12;

        let drawStart=-lineHeight/2+currentHorizon + topOffset;
        let drawEnd=lineHeight/2+currentHorizon;

        let gapFillStart = -1, gapFillEnd = -1;
        let gapWallX = wallX; // position texture monde pour le talus
        {
            let wallH = getHeightAt(mapX + 0.5, mapY + 0.5);
            let playerH = getHeightAt(player.x, player.y);
            let wallElevOffset = (wallH - playerH) * lineHeight * HILLS_ELEV_SCALE;
            let baseEnd = drawEnd;
            drawStart -= wallElevOffset;
            drawEnd -= wallElevOffset;
            if (drawEnd < baseEnd) {
                gapFillStart = Math.max(0, Math.floor(drawEnd));
                gapFillEnd = Math.min(H, Math.ceil(baseEnd));
            }
        }

        let cs=Math.max(0,Math.floor(drawStart)), ce=Math.min(H,Math.ceil(drawEnd));

        // Talus texturé sous un mur surélevé
        if (gapFillStart >= 0 && gapFillEnd > gapFillStart && _floorCanvasReady) {
            let S = FLOOR_RES;
            let footWorldX, footWorldY;
            if (side === 0) {
                footWorldX = mapX + (stepX > 0 ? 0 : 1);
                footWorldY = player.y + perpWallDist * rayDirY;
            } else {
                footWorldX = player.x + perpWallDist * rayDirX;
                footWorldY = mapY + (stepY > 0 ? 0 : 1);
            }
            let srcX = Math.floor(footWorldX * S) % _floorCanvas.width;
            let srcY = Math.floor(footWorldY * S) % _floorCanvas.height;
            if (srcX < 0) srcX += _floorCanvas.width;
            if (srcY < 0) srcY += _floorCanvas.height;
            let gfs = Math.max(0, Math.floor(gapFillStart));
            let gfe = Math.min(H, Math.ceil(gapFillEnd));
            ctx.drawImage(_floorCanvas, srcX, srcY, 1, 1, x, gfs, 1, gfe - gfs);
            let opacity = side === 1 ? 0.6 : 0.45;
            ctx.fillStyle = `rgba(139,112,87,${opacity})`;
            ctx.fillRect(x, gfs, 1, gfe - gfs);
        } else if (gapFillStart >= 0 && gapFillEnd > gapFillStart) {
            ctx.fillStyle = side===1 ? '#2a3a1a' : '#3a4a2a';
            ctx.fillRect(x, gapFillStart, 1, gapFillEnd - gapFillStart);
        }

        let tex;
        if(hitType===TILE_SAFE) tex=loadedImages.safe_wall;
        else tex=loadedImages.wall;

        if(tex&&tex.complete&&tex.naturalWidth!==0){
            let texX=Math.floor(wallX*tex.naturalWidth);
            if(side===0&&rayDirX>0) texX=tex.naturalWidth-texX-1;
            if(side===1&&rayDirY<0) texX=tex.naturalWidth-texX-1;
            let tys=(cs-drawStart)/lineHeight*tex.naturalHeight;
            let tyh=(ce-cs)/lineHeight*tex.naturalHeight;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(tex,texX,tys,1,tyh, x,cs,1,ce-cs);
            ctx.imageSmoothingEnabled = true;
            if(side===1){ctx.fillStyle="rgba(0,0,0,0.35)";ctx.fillRect(x,cs,1,ce-cs);}
        } else {
            if(hitType===TILE_SAFE) ctx.fillStyle=side===1?'#0044aa':'#0066ff';
            else ctx.fillStyle=side===1?'#555':'#777';
            ctx.fillRect(x,cs,1,ce-cs);
        }

        if(hitType===TILE_EXIT){
            // Sortie : bord droit sans distorsion de haie
            let exitStart = -lineHeight/2 + currentHorizon;
            let exitEnd = lineHeight/2 + currentHorizon;
            let ecs = Math.max(0, Math.floor(exitStart)), ece = Math.min(H, Math.ceil(exitEnd));
            let exitTex=loadedImages.exit;
            if(exitTex&&exitTex.complete&&exitTex.naturalWidth!==0){
                let texX=Math.floor(wallX*exitTex.naturalWidth);
                if(side===0&&rayDirX>0) texX=exitTex.naturalWidth-texX-1;
                if(side===1&&rayDirY<0) texX=exitTex.naturalWidth-texX-1;
                let tys=(ecs-exitStart)/lineHeight*exitTex.naturalHeight;
                let tyh=(ece-ecs)/lineHeight*exitTex.naturalHeight;
                ctx.drawImage(exitTex,texX,tys,1,tyh, x,ecs,1,ece-ecs);
                if(side===1){ctx.fillStyle="rgba(0,0,0,0.35)";ctx.fillRect(x,ecs,1,ece-ecs);}
            } else {
                ctx.fillStyle=side===1?'#660066':'#990099';
                ctx.fillRect(x,ecs,1,ece-ecs);
            }
        }

    }

    // Sprites
    sprites.forEach(s=>s.dist=Math.pow(player.x-s.x,2)+Math.pow(player.y-s.y,2));
    sprites.sort((a,b)=>b.dist-a.dist);

    for(let i=0;i<sprites.length;i++){
        let sprite=sprites[i];
        // Épouvantail invisible quand on partage la même case
        if (sprite.type === 'scarecrow' && Math.floor(sprite.x) === Math.floor(player.x) && Math.floor(sprite.y) === Math.floor(player.y)) continue;
        let sx=sprite.x-player.x, sy=sprite.y-player.y;
        let inv=1/(player.planeX*player.dirY-player.dirX*player.planeY);
        let tx=inv*(player.dirY*sx-player.dirX*sy);
        let ty=inv*(-player.planeY*sx+player.planeX*sy);
        if(ty<=0.001) continue;

        let scX=Math.floor((W/2)*(1+tx/ty));
        let sz=Math.abs(Math.floor(H/ty));
        let dsY=-sz/2+currentHorizon, deY=sz/2+currentHorizon;

        {
            let spriteH = getHeightAt(sprite.x, sprite.y);
            let playerH = getHeightAt(player.x, player.y);
            let spriteElevOffset = (spriteH - playerH) * sz * HILLS_ELEV_SCALE;
            dsY -= spriteElevOffset;
            deY -= spriteElevOffset;
        }
        let csY=Math.max(0,Math.floor(dsY)), ceY=Math.min(H,Math.ceil(deY));
        let dsX=Math.floor(-sz/2+scX), deX=Math.floor(sz/2+scX);
        let csX=Math.max(0,dsX), ceX=Math.min(W,deX);

        let img;
        if (sprite.type === 'monster') {
            let movingAway = isMonsterMovingAway(sprite.id);
            let backImg = loadedImages.monster_back;
            if (movingAway && backImg && backImg.complete && backImg.naturalWidth !== 0) {
                img = backImg;
            } else {
                img = loadedImages.monster;
            }
        } else if (sprite.type === 'artifact') {
            let artType = ARTIFACT_TYPES[sprite.artifactId];
            if (artType) img = loadedImages[artType.sprite];
            if (!img || !img.complete) img = loadedImages.artifact_couronne;
        } else if (sprite.type === 'scarecrow') {
            img = loadedImages.artifact_epouvantail;
        } else {
            img = loadedImages[sprite.type];
        }

        if(img&&img.complete&&img.naturalWidth!==0){
            ctx.save();
            ctx.beginPath();
            for(let stripe=csX;stripe<ceX;stripe++){
                if(ty<ZBuffer[stripe]) ctx.rect(stripe, csY, 1, ceY-csY);
            }
            ctx.clip();
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, dsX, dsY, deX-dsX, deY-dsY);
            ctx.restore();
        } else {
            for(let stripe=csX;stripe<ceX;stripe++){
                if(ty<ZBuffer[stripe]){
                    ctx.fillStyle = sprite.type==='monster' ? 'red' :
                        sprite.type==='artifact' ? (ARTIFACT_TYPES[sprite.artifactId]||{}).color||'gold' : 'purple';
                    ctx.fillRect(stripe,csY,1,ceY-csY);
                }
            }
        }
    }

    if(shaking) ctx.restore();
}

// --- MINIMAP (Cidre Fermier — carte + joueur uniquement) ---
function drawMinimap() {
    let mc=document.getElementById('minimap'), mx=mc.getContext('2d');
    let sc=mc.width/mapWidth;
    mx.clearRect(0,0,mc.width,mc.height);

    for(let y=0;y<mapHeight;y++){
        for(let x=0;x<mapWidth;x++){
            if(map[y][x]===TILE_WALL) mx.fillStyle='#3a5a2a';
            else if(map[y][x]===TILE_SAFE) mx.fillStyle='#00aaff';
            else if(map[y][x]===TILE_EXIT) mx.fillStyle='#8B6914';
            else {
                let h = heightMap[y] ? heightMap[y][x] : 0.5;
                let r = Math.floor(55 + h * 100);
                let g = Math.floor(35 + h * 50);
                let b = Math.floor(15 + h * 30);
                mx.fillStyle = `rgb(${r},${g},${b})`;
            }
            mx.fillRect(x*sc,y*sc,sc,sc);
        }
    }

    mx.fillStyle='lime';
    mx.beginPath(); mx.arc(player.x*sc,player.y*sc,sc/2,0,Math.PI*2); mx.fill();
    mx.strokeStyle='white'; mx.beginPath();
    mx.moveTo(player.x*sc,player.y*sc);
    mx.lineTo((player.x+player.dirX)*sc,(player.y+player.dirY)*sc);
    mx.stroke();
}

// --- BOUSSOLE (Couronne de Vue + Lanterne) ---
function drawCompass() {
    let cc = document.getElementById('compass');
    let cx = cc.getContext('2d');
    let w = cc.width, h = cc.height;
    let mid = w / 2;
    let R = mid - 8; // rayon du cercle principal

    cx.clearRect(0, 0, w, h);

    // Fond semi-transparent
    cx.fillStyle = 'rgba(0,0,0,0.5)';
    cx.beginPath();
    cx.arc(mid, mid, R + 4, 0, Math.PI * 2);
    cx.fill();

    // Cercle extérieur
    cx.strokeStyle = 'rgba(255,215,0,0.6)';
    cx.lineWidth = 2;
    cx.beginPath();
    cx.arc(mid, mid, R, 0, Math.PI * 2);
    cx.stroke();

    // Angle de la direction du joueur (0 = Est, sens horaire)
    // Convention map : X+ = Est, Y+ = Sud
    let playerAngle = Math.atan2(player.dirY, player.dirX);

    // Lettres cardinales — positionnées relativement à la direction du joueur
    // Nord = angle -π/2 dans l'espace monde (Y négatif)
    let cardinals = [
        { label:'N', worldAngle: -Math.PI/2, color:'#ff4444' },
        { label:'S', worldAngle:  Math.PI/2, color:'#aaaaaa' },
        { label:'E', worldAngle:  0,          color:'#aaaaaa' },
        { label:'O', worldAngle:  Math.PI,    color:'#aaaaaa' }
    ];

    cx.font = 'bold 14px Courier New';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';

    for (let c of cardinals) {
        // Angle relatif au joueur — le haut de la boussole = direction du regard
        let relAngle = c.worldAngle - playerAngle;
        let lx = mid + Math.sin(relAngle) * (R - 14);
        let ly = mid - Math.cos(relAngle) * (R - 14);
        cx.fillStyle = c.color;
        cx.fillText(c.label, lx, ly);
    }

    // Petit trait indiquant le "devant" (haut de la boussole)
    cx.strokeStyle = '#ffffff';
    cx.lineWidth = 2;
    cx.beginPath();
    cx.moveTo(mid, mid - R + 2);
    cx.lineTo(mid, mid - R + 8);
    cx.stroke();

    // --- Flèche vache la plus proche (rouge) ---
    if (monsters.length > 0) {
        let nearest = null, bestDist = Infinity;
        for (let m of monsters) {
            let d = Math.hypot(m.x - player.x, m.y - player.y);
            if (d < bestDist) { bestDist = d; nearest = m; }
        }
        if (nearest) {
            let cowAngle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
            let relCow = cowAngle - playerAngle;
            let arrowR = R - 30;
            let ax = mid + Math.sin(relCow) * arrowR;
            let ay = mid - Math.cos(relCow) * arrowR;

            // Flèche
            cx.strokeStyle = '#ff3333';
            cx.lineWidth = 3;
            cx.beginPath();
            cx.moveTo(mid, mid);
            cx.lineTo(ax, ay);
            cx.stroke();

            // Pointe de flèche
            let tipAngle = Math.atan2(ay - mid, ax - mid);
            cx.beginPath();
            cx.moveTo(ax, ay);
            cx.lineTo(ax - Math.cos(tipAngle - 0.4) * 8, ay - Math.sin(tipAngle - 0.4) * 8);
            cx.moveTo(ax, ay);
            cx.lineTo(ax - Math.cos(tipAngle + 0.4) * 8, ay - Math.sin(tipAngle + 0.4) * 8);
            cx.stroke();

            // Symbole vache (petit cercle + cornes)
            let symR = arrowR + 10;
            let sx = mid + Math.sin(relCow) * symR;
            let sy = mid - Math.cos(relCow) * symR;
            cx.fillStyle = '#ff3333';
            cx.beginPath();
            cx.arc(sx, sy, 4, 0, Math.PI * 2);
            cx.fill();
            // Cornes
            let hornAngle = Math.atan2(sy - mid, sx - mid);
            cx.strokeStyle = '#ff3333';
            cx.lineWidth = 2;
            cx.beginPath();
            cx.moveTo(sx + Math.cos(hornAngle - 1.2) * 3, sy + Math.sin(hornAngle - 1.2) * 3);
            cx.lineTo(sx + Math.cos(hornAngle - 0.6) * 7, sy + Math.sin(hornAngle - 0.6) * 7);
            cx.moveTo(sx + Math.cos(hornAngle + 1.2) * 3, sy + Math.sin(hornAngle + 1.2) * 3);
            cx.lineTo(sx + Math.cos(hornAngle + 0.6) * 7, sy + Math.sin(hornAngle + 0.6) * 7);
            cx.stroke();
        }
    }

    // --- Flèche artefact (dorée, Lanterne du Bocage) ---
    if (collectedArtifacts.has('lanterne_du_bocage')) {
        let artSprites = sprites.filter(s => s.type === 'artifact');
        let artSprite = null, bestArtDist = Infinity;
        for (let a of artSprites) {
            let d = Math.hypot(a.x - player.x, a.y - player.y);
            if (d < bestArtDist) { bestArtDist = d; artSprite = a; }
        }
        if (artSprite) {
            let artAngle = Math.atan2(artSprite.y - player.y, artSprite.x - player.x);
            let relArt = artAngle - playerAngle;
            let arrowR = R - 30;
            let ax = mid + Math.sin(relArt) * arrowR;
            let ay = mid - Math.cos(relArt) * arrowR;

            cx.strokeStyle = 'gold';
            cx.lineWidth = 3;
            cx.beginPath();
            cx.moveTo(mid, mid);
            cx.lineTo(ax, ay);
            cx.stroke();

            // Pointe dorée
            let tipAngle = Math.atan2(ay - mid, ax - mid);
            cx.beginPath();
            cx.moveTo(ax, ay);
            cx.lineTo(ax - Math.cos(tipAngle - 0.4) * 8, ay - Math.sin(tipAngle - 0.4) * 8);
            cx.moveTo(ax, ay);
            cx.lineTo(ax - Math.cos(tipAngle + 0.4) * 8, ay - Math.sin(tipAngle + 0.4) * 8);
            cx.stroke();

            // Symbole étoile
            let symR = arrowR + 10;
            let sx = mid + Math.sin(relArt) * symR;
            let sy = mid - Math.cos(relArt) * symR;
            cx.fillStyle = 'gold';
            cx.font = '12px Courier New';
            cx.fillText('\u2605', sx, sy);
        }
    }

    // Point central
    cx.fillStyle = '#ffffff';
    cx.beginPath();
    cx.arc(mid, mid, 3, 0, Math.PI * 2);
    cx.fill();
}
