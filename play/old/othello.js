/**
 * OTHELLO RULES & POSITIONAL AI
 */
const OthelloGame = {
    size: 8,
    letters: "ABCDEFGH",

    indexToCoord: (idx) => {
        const r = Math.floor(idx / 8);
        const c = idx % 8;
        return OthelloGame.letters[c] + (r + 1);
    },

    coordToIndex: (coord) => {
        const c = OthelloGame.letters.indexOf(coord[0]);
        const r = parseInt(coord.substring(1)) - 1;
        return r * 8 + c;
    },

    getFlips: (state, idx, player) => {
        if (state[idx] !== 0) return [];
        const opponent = player === 1 ? 2 : 1;
        const r = Math.floor(idx / 8), c = idx % 8;
        const dirs = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
        let totalFlips = [];

        for (let [dr, dc] of dirs) {
            let tempFlips = [];
            let nr = r + dr, nc = c + dc;
            while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && state[nr * 8 + nc] === opponent) {
                tempFlips.push(nr * 8 + nc);
                nr += dr; nc += dc;
            }
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && state[nr * 8 + nc] === player) {
                totalFlips = totalFlips.concat(tempFlips);
            }
        }
        return totalFlips;
    },

    getMoves: (state) => {
        const player = state.filter(x => x !== 0).length % 2 === 0 ? 1 : 2;
        const moves = [];
        for (let i = 0; i < 64; i++) {
            if (OthelloGame.getFlips(state, i, player).length > 0) moves.push(i);
        }
        return moves;
    },

    heuristicSort: (state, moves) => {
        // Priority: Corners > Edges > Center
        const weights = [
            100, 10, 20, 20, 20, 20, 10, 100,
            10,   1,  5,  5,  5,  5,  1, 10,
            20,   5, 10, 10, 10, 10,  5, 20,
            20,   5, 10, 10, 10, 10,  5, 20,
            20,   5, 10, 10, 10, 10,  5, 20,
            20,   5, 10, 10, 10, 10,  5, 20,
            10,   1,  5,  5,  5,  5,  1, 10,
            100, 10, 20, 20, 20, 20, 10, 100
        ];
        return moves.sort((a, b) => weights[b] - weights[a]);
    },

    makeMove: (state, idx) => {
        const player = state.filter(x => x !== 0).length % 2 === 0 ? 1 : 2;
        const flips = OthelloGame.getFlips(state, idx, player);
        const nextBoard = [...state];
        nextBoard[idx] = player;
        flips.forEach(f => nextBoard[f] = player);
        return nextBoard;
    },

    isTerminal: (state) => {
        const p1HasMoves = OthelloGame.getMovesForPlayer(state, 1).length > 0;
        const p2HasMoves = OthelloGame.getMovesForPlayer(state, 2).length > 0;
        return (!p1HasMoves && !p2HasMoves) || state.every(x => x !== 0);
    },

    getMovesForPlayer: (state, p) => {
        const moves = [];
        for (let i = 0; i < 64; i++) if (OthelloGame.getFlips(state, i, p).length > 0) moves.push(i);
        return moves;
    },

    evaluate: (state) => {
        const weights = [
            100, -20,  10,   5,   5,  10, -20, 100,
            -20, -50,  -2,  -2,  -2,  -2, -50, -20,
             10,  -2,   5,   1,   1,   5,  -2,  10,
              5,  -2,   1,   0,   0,   1,  -2,   5,
              5,  -2,   1,   0,   0,   1,  -2,   5,
             10,  -2,   5,   1,   1,   5,  -2,  10,
            -20, -50,  -2,  -2,  -2,  -2, -50, -20,
            100, -20,  10,   5,   5,  10, -20, 100
        ];
        let score = 0;
        state.forEach((p, i) => {
            if (p === 1) score -= weights[i];
            if (p === 2) score += weights[i];
        });
        return score;
    }
};

// --- ENGINE STATE ---
let moveSequence = [], currentStep = 0, isThinking = false, isSimulating = false, isNavigating = false;

function getInitialBoard() {
    const b = Array(64).fill(0);
    b[27] = 2; b[28] = 1; b[35] = 1; b[36] = 2; // D4, E4, D5, E5
    return b;
}

function getBoardAtStep(step) {
    let board = getInitialBoard();
    for (let i = 0; i < step; i++) {
        if (moveSequence[i] === "PASS") continue;
        board = OthelloGame.makeMove(board, OthelloGame.coordToIndex(moveSequence[i]));
    }
    return board;
}

function render() {
    const board = getBoardAtStep(currentStep);
    const cells = document.querySelectorAll('.cell');
    let lastIdx = (currentStep > 0 && moveSequence[currentStep-1] !== "PASS") ? OthelloGame.coordToIndex(moveSequence[currentStep-1]) : -1;

    cells.forEach((cell, i) => {
        cell.setAttribute('data-value', board[i]);
        cell.classList.toggle('last-move', i === lastIdx);
    });

    // Score & Turn
    const p1Count = board.filter(x => x === 1).length;
    const p2Count = board.filter(x => x === 2).length;
    const isP1 = currentStep % 2 === 0;
    const winner = OthelloGame.isTerminal(board) ? (p1Count > p2Count ? 1 : 2) : 0;

    document.getElementById('p1-label').innerHTML = `Black: ${p1Count}`;
    document.getElementById('p2-label').innerHTML = `White: ${p2Count}`;
    document.getElementById('p1-label').className = (isP1 && !winner) ? 'active' : '';
    document.getElementById('p2-label').className = (!isP1 && !winner) ? 'active' : '';
    document.getElementById('move-stats').innerText = `(Step ${currentStep})`;

    const res = document.getElementById('game-result');
    res.innerText = winner ? (p1Count === p2Count ? "Draw!" : (winner === 1 ? "Black Wins!" : "White Wins!")) : "";

    // Auto-Pass Logic
    const moves = OthelloGame.getMoves(board);
    if (moves.length === 0 && !OthelloGame.isTerminal(board) && !isNavigating) {
        moveSequence.push("PASS"); currentStep++; 
        setTimeout(render, 600); return;
    }

    const displayEl = document.getElementById('sequence-display');
    displayEl.innerHTML = moveSequence.map((c, i) => `<span class="${i+1===currentStep?'sequence-current':(i+1>currentStep?'sequence-past':'')}" onclick="jumpTo(${i+1})">${c}</span>`).join(", ");

    if (!isSimulating && !isP1 && document.getElementById('cpu-toggle').checked && !isThinking && !winner && !isNavigating && currentStep === moveSequence.length) {
        executeAIMove();
    }
}

function handleUserInput(idx) {
    const board = getBoardAtStep(currentStep);
    if (isThinking || isSimulating || OthelloGame.isTerminal(board) || OthelloGame.getFlips(board, idx, (currentStep%2===0?1:2)).length === 0) return;
    isNavigating = false; executeMoveLogic(idx);
}

function executeMoveLogic(idx) {
    if (currentStep < moveSequence.length) moveSequence = moveSequence.slice(0, currentStep);
    moveSequence.push(OthelloGame.indexToCoord(idx));
    currentStep++; render();
}

function executeAIMove() {
    isThinking = true; document.getElementById('thinking-indicator').style.display = 'inline';
    setTimeout(() => {
        const result = alphaBeta(getBoardAtStep(currentStep), parseInt(document.getElementById('ai-depth').value), -Infinity, Infinity, true, OthelloGame);
        document.getElementById('thinking-indicator').style.display = 'none';
        isThinking = false;
        if (result.move !== undefined) executeMoveLogic(result.move);
    }, 50);
}

// Controls
function undo() { if (currentStep > 0) { isNavigating = true; currentStep--; render(); } }
function redo() { if (currentStep < moveSequence.length) { currentStep++; if(currentStep===moveSequence.length) isNavigating=false; render(); } }
function jumpTo(s) { isNavigating = (s < moveSequence.length); currentStep = s; render(); }
function resumeFromHere() { isNavigating = false; render(); }

async function saveToClipboard() { await navigator.clipboard.writeText(moveSequence.join(",")); const i = document.querySelector('[onclick="saveToClipboard()"]'); i.style.color="#28a745"; setTimeout(()=>i.style.color="", 1000); }
async function saveASCII() {
    const b = getBoardAtStep(currentStep); let a = "";
    for(let r=0; r<8; r++) { let row = ""; for(let c=0; c<8; c++) row += (b[r*8+c]===1?"x ":(b[r*8+c]===2?"o ":". ")); a += row.trim()+"\n"; }
    await navigator.clipboard.writeText(a.trim()); const i = document.querySelector('[onclick="saveASCII()"]'); i.style.color="#28a745"; setTimeout(()=>i.style.color="", 1000);
}
async function loadFromClipboard() {
    const d = await navigator.clipboard.readText(); if(!d) return;
    moveSequence = d.split(",").filter(x => x.trim() !== ""); currentStep = moveSequence.length; isNavigating = false; render();
}

async function toggleSimulation() {
    isSimulating = !isSimulating; document.getElementById('sim-btn').innerText = isSimulating ? "Stop" : "Simulate";
    while (isSimulating && !OthelloGame.isTerminal(getBoardAtStep(currentStep))) {
        const result = alphaBeta(getBoardAtStep(currentStep), 2, -Infinity, Infinity, currentStep%2!==0, OthelloGame);
        if (result.move !== undefined) { executeMoveLogic(result.move); await new Promise(r => setTimeout(r, 400)); }
        else break;
    }
    isSimulating = false; document.getElementById('sim-btn').innerText = "Simulate";
}

function init() {
    const b = document.getElementById('game-board'); b.innerHTML = '';
    b.appendChild(document.createElement('div'));
    for (let i = 0; i < 8; i++) { const l = document.createElement('div'); l.className = 'coord'; l.innerText = OthelloGame.letters[i]; b.appendChild(l); }
    for (let r = 0; r < 8; r++) {
        const l = document.createElement('div'); l.className = 'coord'; l.innerText = r + 1; b.appendChild(l);
        for (let c = 0; c < 8; c++) {
            const cell = document.createElement('div'); cell.className = 'cell';
            const idx = r * 8 + c; cell.onclick = () => handleUserInput(idx); b.appendChild(cell);
        }
    }
    render();
}
init();