/**
 * SLIMETRAIL - FINAL INTEGRATED VERSION
 */
const SlimetrailGame = {
    size: 11,
    goals: { 1: 10, 2: 110 }, // Acute Corners
    letters: "ABCDEFGHIJK",
    hexPath: "M23,2 L44,14 L44,38 L23,50 L2,38 L2,14 Z",

    indexToCoord: (idx) => {
        const r = Math.floor(idx / 11);
        const c = idx % 11;
        return SlimetrailGame.letters[c] + (r + 1);
    },

    coordToIndex: (coord) => {
        if (!coord) return -1;
        const c = SlimetrailGame.letters.indexOf(coord[0]);
        const r = parseInt(coord.substring(1)) - 1;
        return r * 11 + c;
    },

    getNeighbors: (idx) => {
        const r = Math.floor(idx / 11), c = idx % 11;
        const neighbors = [];
        const dirs = [[0,-1], [0,1], [-1,0], [1,0], [-1,1], [1,-1]];
        for (let [dr, dc] of dirs) {
            let nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < 11 && nc >= 0 && nc < 11) neighbors.push(nr * 11 + nc);
        }
        return neighbors;
    },

    getMoves: (state) => {
        const whiteIdx = state.indexOf('W');
        if (whiteIdx === -1) return [];
        return SlimetrailGame.getNeighbors(whiteIdx).filter(n => state[n] !== 'B');
    },

    // Move sorting for Alpha-Beta efficiency
    heuristicSort: (state, moves) => {
        const turn = state.filter(x => x === 'B').length % 2 === 0 ? 1 : 2;
        const goalIdx = SlimetrailGame.goals[turn];
        const gr = Math.floor(goalIdx/11), gc = goalIdx%11;
        return moves.sort((a,b) => {
            const da = Math.abs(Math.floor(a/11)-gr) + Math.abs((a%11)-gc);
            const db = Math.abs(Math.floor(b/11)-gr) + Math.abs((b%11)-gc);
            return da - db;
        });
    },

    makeMove: (state, nextIdx) => {
        const nextState = [...state];
        const prevIdx = state.indexOf('W');
        if (prevIdx !== -1) nextState[prevIdx] = 'B'; 
        nextState[nextIdx] = 'W';
        return nextState;
    },

    isTerminal: (state) => SlimetrailGame.checkWin(state) !== 0,

    checkWin: (state) => {
        const whiteIdx = state.indexOf('W');
        if (whiteIdx === SlimetrailGame.goals[1]) return 1;
        if (whiteIdx === SlimetrailGame.goals[2]) return 2;
        const moves = SlimetrailGame.getMoves(state);
        if (moves.length === 0 && whiteIdx !== -1) {
            const turn = state.filter(x => x === 'B').length % 2 === 0 ? 1 : 2;
            return turn === 1 ? 2 : 1; 
        }
        return 0;
    },

    evaluate: (state) => {
        const win = SlimetrailGame.checkWin(state);
        if (win === 2) return 1000000;
        if (win === 1) return -1000000;
        const wIdx = state.indexOf('W');
        const r = Math.floor(wIdx/11), c = wIdx%11;
        // P2 (AI) wants to get to (10, 0). P1 wants (0, 10).
        const d1 = Math.abs(r-0) + Math.abs(c-10);
        const d2 = Math.abs(r-10) + Math.abs(c-0);
        return (d1 - d2) * 100;
    }
};

let moveSequence = [], currentStep = 0, isThinking = false, isSimulating = false, isNavigating = false;

function getInitialBoard() {
    const b = Array(121).fill(0);
    b[60] = 'W'; 
    return b;
}

function getBoardAtStep(step) {
    let board = getInitialBoard();
    for (let i = 0; i < step; i++) {
        const idx = SlimetrailGame.coordToIndex(moveSequence[i]);
        if (idx !== -1) board = SlimetrailGame.makeMove(board, idx);
    }
    return board;
}

function render() {
    const board = getBoardAtStep(currentStep);
    const container = document.getElementById('game-board');
    if (!container) return;
    container.innerHTML = '';
    
    const winner = SlimetrailGame.checkWin(board);
    const validMoves = winner ? [] : SlimetrailGame.getMoves(board);

    for (let r = 0; r < 11; r++) {
        const row = document.createElement('div');
        row.className = 'row-wrapper';
        row.style.marginLeft = (r * 22) + "px"; 
        
        for (let c = 0; c < 11; c++) {
            const idx = r * 11 + c;
            const isValid = validMoves.includes(idx);
            
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("viewBox", "0 0 46 52");
            svg.setAttribute("class", `hex-svg ${isValid ? 'valid-move' : ''}`);
            
            if (board[idx] === 'B') svg.setAttribute("data-value", "black");
            if (idx === SlimetrailGame.goals[1]) svg.setAttribute("data-goal", "1");
            if (idx === SlimetrailGame.goals[2]) svg.setAttribute("data-goal", "2");

            let inner = `<path class="hex-shape" d="${SlimetrailGame.hexPath}" />`;
            if (board[idx] === 'W') {
                inner += `
                    <circle class="ball-main" cx="23" cy="26" r="14" fill="white" stroke="#7f8c8d" />
                    <circle class="ball-highlight" cx="18" cy="21" r="5" fill="rgba(255,255,255,0.6)" />
                `;
            }
            svg.innerHTML = inner;

            if (isValid) svg.onclick = () => handleUserInput(idx);
            row.appendChild(svg);
        }
        container.appendChild(row);
    }
    updateUI(winner);
}

function updateUI(winner) {
    const isP1 = currentStep % 2 === 0;
    const cpuEnabled = document.getElementById('cpu-toggle').checked;

    document.getElementById('p1-label').classList.toggle('active', isP1 && !winner);
    document.getElementById('p2-label').classList.toggle('active', !isP1 && !winner);
    document.getElementById('move-stats').innerText = `(Step ${currentStep})`;
    document.getElementById('game-result').innerText = winner ? (winner === 1 ? "Red Wins!" : "Blue Wins!") : "";
    document.getElementById('resume-btn').style.display = (currentStep < moveSequence.length) ? "inline-block" : "none";

    const displayEl = document.getElementById('sequence-display');
    displayEl.innerHTML = moveSequence.length ? moveSequence.map((coord, i) => 
        `<span class="${i+1 === currentStep ? 'sequence-current' : (i+1 > currentStep ? 'sequence-past' : '')}" onclick="jumpTo(${i+1})">${coord}</span>`
    ).join(", ") : '<span class="placeholder">Waiting for first move...</span>';

    // TRIGGER AI PLAYER
    if (!winner && !isP1 && cpuEnabled && !isThinking && !isSimulating && !isNavigating && currentStep === moveSequence.length) {
        console.log("AI Turn Triggered...");
        executeAIMove();
    }
}

function handleUserInput(idx) {
    if (isThinking || isSimulating) return;
    isNavigating = false;
    if (currentStep < moveSequence.length) moveSequence = moveSequence.slice(0, currentStep);
    moveSequence.push(SlimetrailGame.indexToCoord(idx));
    currentStep++; 
    render();
}

function executeAIMove() {
    isThinking = true;
    const indicator = document.getElementById('thinking-indicator');
    if (indicator) indicator.style.display = 'inline';
    
    setTimeout(() => {
        const depth = parseInt(document.getElementById('ai-depth').value) || 3;
        // AI always plays as the maximizing player in our AlphaBeta setup
        const res = alphaBeta(getBoardAtStep(currentStep), depth, -Infinity, Infinity, true, SlimetrailGame);
        isThinking = false;
        if (indicator) indicator.style.display = 'none';
        if (res.move !== undefined) {
            handleUserInput(res.move);
        } else {
            console.error("AI could not find a valid move.");
        }
    }, 100);
}

// NAVIGATION & BUTTONS
function undo() { if (currentStep > 0) { isNavigating = true; currentStep--; render(); } }
function redo() { if (currentStep < moveSequence.length) { currentStep++; if(currentStep === moveSequence.length) isNavigating = false; render(); } }
function jumpTo(s) { isNavigating = (s < moveSequence.length); currentStep = s; render(); }
function resumeFromHere() { isNavigating = false; render(); }

async function saveToClipboard() { await navigator.clipboard.writeText(moveSequence.join(",")); }
async function loadFromClipboard() {
    const d = await navigator.clipboard.readText();
    if (!d) return;
    moveSequence = d.split(",").map(s => s.trim()).filter(x => x !== "");
    currentStep = moveSequence.length; isNavigating = false; render();
}
async function saveASCII() {
    const board = getBoardAtStep(currentStep); let ascii = "";
    for (let r = 0; r < 11; r++) {
        ascii += " ".repeat(r);
        for (let c = 0; c < 11; c++) {
            const val = board[r * 11 + c];
            ascii += (val === 'W' ? "W " : (val === 'B' ? "B " : ". "));
        }
        ascii += "\n";
    }
    await navigator.clipboard.writeText(ascii);
}
async function toggleSimulation() {
    isSimulating = !isSimulating;
    document.getElementById('sim-btn').innerText = isSimulating ? "Stop" : "Simulate";
    while (isSimulating && !SlimetrailGame.isTerminal(getBoardAtStep(currentStep))) {
        const res = alphaBeta(getBoardAtStep(currentStep), 3, -Infinity, Infinity, currentStep % 2 !== 0, SlimetrailGame);
        if (res.move !== undefined) { 
            handleUserInput(res.move); 
            await new Promise(r => setTimeout(r, 450)); 
        } else break;
    }
    isSimulating = false; document.getElementById('sim-btn').innerText = "Simulate";
}

// Boot
window.onload = () => { render(); };