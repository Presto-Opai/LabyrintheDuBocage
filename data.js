// === DATA.JS — Constantes, assets, artefacts, dialogues ===

const ASSETS = {
    sprites: {
        monster: 'monster.png',
        monster_back: 'monster_back.png',
        exit: 'exit.png',
        wall: 'wall.png',
        safe_wall: 'safe_wall.png',
        artifact_couronne: 'artifact_couronne.png',
        artifact_sabots: 'artifact_sabots.png',
        artifact_cape: 'artifact_cape.png',
        artifact_lanterne: 'artifact_lanterne.png',
        artifact_bouclier: 'artifact_bouclier.png',
        artifact_tresor: 'artifact_tresor.png',
        artifact_cloche: 'artifact_cloche.png',
        artifact_epouvantail: 'artifact_epouvantail.png',
        artifact_lasso: 'artifact_lasso.png',
        artifact_cidre: 'artifact_cidre.png',

        sol1: 'sol1.png',
        sol2: 'sol2.png'
    },
    audio: {
        bgm: 'bgm.mp3',
        chase: 'chase.mp3',
        epic: 'artifact_get.mp3',
        victory: 'artifact_get_long.mp3'
    },
    data: { dialogue: 'dialogue.json' }
};

let dialogueData = {
    "start": "Vous pénétrez dans le bocage. Ses trésors vous appellent...",
    "artifact_couronne_de_vue": "COURONNE DE VUE OBTENUE ! Une boussole mystique apparaît, révélant les directions et la présence des bêtes !",
    "artifact_sabots_de_vitesse": "SABOTS DE VITESSE OBTENUS ! Vos pieds sont plus légers... vous avancez à une vitesse surnaturelle !",
    "artifact_cape_de_brume": "CAPE DE BRUME OBTENUE ! Les sens de la vache s'émoussent...",
    "artifact_bouclier_de_chene": "BOUCLIER DE CHÊNE OBTENU ! Vous pouvez encaisser un coup de la bête !",
    "artifact_tresor_du_bocage": "TRÉSOR DU BOCAGE OBTENU ! L'or ancien brille entre vos mains — VICTOIRE !",
    "artifact_cloche_du_bocage": "CLOCHE DU BOCAGE OBTENUE ! Son carillon ancien résonne... les vaches sont étourdies !",
    "artifact_epouvantail": "ÉPOUVANTAIL OBTENU ! Un leurre se déploiera automatiquement quand les bêtes vous chassent !",
    "artifact_lanterne_du_bocage": "LANTERNE DU BOCAGE OBTENUE ! La boussole révèle maintenant la direction du trésor !",
    "artifact_lasso_du_vacher": "LASSO DU VACHER OBTENU ! Faites face aux vaches et appuyez sur ESPACE pour les attraper au lasso !",
    "artifact_cidre_magique": "CIDRE FERMIER OBTENU ! La carte du bocage se révèle à vous !",
    "scarecrow_deployed": "L'épouvantail se déploie !",
    "scarecrow_destroyed": "Épouvantail détruit !",
    "scarecrow_ready": "Épouvantail disponible à nouveau.",
    "monster_spotted": "Elle a senti votre odeur. FUYEZ !",
    "monster_lassoed": "Une vache attrapée ! Continuez !",
    "lasso_double": "DOUBLE LASSO ! Deux vaches d'un coup !",
    "lasso_triple": "LASSO LÉGENDAIRE ! Trois vaches ou plus en un seul geste !",
    "all_monsters_lassoed": "Toutes les vaches attrapées ! Trouvez la sortie !",
    "exit_ready": "La sortie est là ! Appuyez sur ESPACE pour quitter le bocage.",
    "exit_no_artifact": "La porte est scellée... Il vous faut l'artefact du niveau.",
    "exit_need_cows": "Il reste des vaches en liberté ! Attrapez-les toutes au lasso.",
    "next_level": "Vous avancez plus profondément dans le bocage...",
    "iron_will_save": "Le Bouclier de Chêne absorbe le coup ! La vache recule !",
    "victory": "Vous avez conquis le Bocage ! Les trésors sont à vous pour toujours.",
    "crow_stole": "Un corbeau noir fond sur vous et s'empare de vos trésors ! Il les disperse dans le labyrinthe... Retrouvez-les tous !",
    "exit_need_all_artifacts": "La porte est scellée... Il manque des trésors !"
};

const TILE_EMPTY = 0, TILE_WALL = 1, TILE_SAFE = 2, TILE_EXIT = 3;

const ARTIFACT_TYPES = {
    couronne_de_vue:      { name:'Couronne de Vue',         color:'gold',    dialogue:'artifact_couronne_de_vue',       sprite:'artifact_couronne' },
    sabots_de_vitesse:    { name:'Sabots de Vitesse',       color:'#00ff88', dialogue:'artifact_sabots_de_vitesse',     sprite:'artifact_sabots' },
    cape_de_brume:        { name:'Cape de Brume',           color:'#8800ff', dialogue:'artifact_cape_de_brume',         sprite:'artifact_cape' },
    bouclier_de_chene:    { name:'Bouclier de Chêne',       color:'#ffffff', dialogue:'artifact_bouclier_de_chene',     sprite:'artifact_bouclier' },
    tresor_du_bocage:     { name:'Trésor du Bocage',         color:'#ff0044', dialogue:'artifact_tresor_du_bocage',      sprite:'artifact_tresor' },
    cloche_du_bocage:     { name:'Cloche du Bocage',         color:'#ff8800', dialogue:'artifact_cloche_du_bocage',     sprite:'artifact_cloche' },
    epouvantail:          { name:'Épouvantail',             color:'#00ffff', dialogue:'artifact_epouvantail',           sprite:'artifact_epouvantail' },

    lanterne_du_bocage:   { name:'Lanterne du Bocage',      color:'#ffaa00', dialogue:'artifact_lanterne_du_bocage',    sprite:'artifact_lanterne' },
    lasso_du_vacher:      { name:'Lasso du Vacher',          color:'#ff4444', dialogue:'artifact_lasso_du_vacher',      sprite:'artifact_lasso' },
    cidre_magique:        { name:'Cidre Fermier',           color:'#ffe600', dialogue:'artifact_cidre_magique',         sprite:'artifact_cidre' }
};

const ARTIFACT_SCHEDULE = [
    'couronne_de_vue','cape_de_brume','lanterne_du_bocage',
    'bouclier_de_chene','cloche_du_bocage','epouvantail',
    'sabots_de_vitesse','cidre_magique','lasso_du_vacher','tresor_du_bocage'
];

// --- GAME STATE (globals) ---
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

let map = [];
let heightMap = [];
let mapWidth = 21, mapHeight = 21;
let level = 1;

let player = { x:1.5, y:1.5, dirX:1, dirY:0, planeX:0, planeY:0.66, moveSpeed:5, rotSpeed:5, hasArtifact:false };
const WALL_BUFFER = 0.2;
let collectedArtifacts = new Set();
let keys = { w:false, a:false, s:false, d:false };
let sprites = [];

let currentLevelArtifact = null;
let level6RequiredArtifacts = [];
let monsters = [];
let artifactPos = { x:0, y:0 };
let exitPos = { x:0, y:0 };

let ironWillShield = false;
let ironWillGrace = 0;
let tremorTimer = 0;
let screenShake = 0;
let monsterChaseActive = false;
let scarecrowEntity = null;
let scarecrowCooldown = 0;
let scarecrowChaseTimer = 0;
let nearHedge = false;
let nearExit = false;
let lassoTargets = [];

let lastTime = 0;
let gameState = 'MENU';
let difficulty = 'hard';
let ZBuffer = new Float64Array(W);

const loadedImages = {};
const loadedAudio = {};

function loadAssets() {
    for (let key in ASSETS.sprites) {
        let img = new Image();
        img.src = ASSETS.sprites[key];
        loadedImages[key] = img;
    }
    for (let key in ASSETS.audio) {
        let aud = new Audio(ASSETS.audio[key]);
        aud.loop = (key !== 'epic');
        loadedAudio[key] = aud;
    }
}

function canPlayerExit() {
    let huntingMode = collectedArtifacts.has('lasso_du_vacher');
    if (level === 6 && level6RequiredArtifacts.length > 0) {
        return level6RequiredArtifacts.every(id => collectedArtifacts.has(id))
            && (!huntingMode || monsters.length === 0);
    }
    return player.hasArtifact && (!huntingMode || monsters.length === 0);
}

function isPassable(t) { return t === TILE_EMPTY; }

let nearHedgeTile = null; // {sx, sy, axis} — la case TILE_SAFE proche et son axe

function getHeightAt(x, y) {
    if (!heightMap.length) return 0.5;
    let ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    if (ix < 0 || iy < 0 || ix >= mapWidth-1 || iy >= mapHeight-1) return 0.5;
    let h00 = heightMap[iy][ix], h10 = heightMap[iy][ix+1];
    let h01 = heightMap[iy+1][ix], h11 = heightMap[iy+1][ix+1];
    return (h00*(1-fx) + h10*fx) * (1-fy) + (h01*(1-fx) + h11*fx) * fy;
}

function getSlopeSpeedFactor(fromX, fromY, toX, toY) {
    let hFrom = getHeightAt(fromX, fromY);
    let hTo = getHeightAt(toX, toY);
    let dh = hTo - hFrom;
    return 1 - dh * 6;
}

let terrainMode = 'hills';
let currentHorizon = 0;
