/**
 * CONNECT 4 RULES & EXPERT AI
 */
const Connect4Game = {
    cols: 7, rows: 6,
    letters: "ABCDEFG",

    indexToCoord: (idx) => {
        const c = idx % 7; const r = Math.floor(idx / 7);
        return Connect4Game.letters[c] + (6 - r);
    },

    coordToIndex: (coord) => {
        const c = Connect4Game.letters.indexOf(coord[0]);
        const r = 6 - parseInt(coord.substring(1));
        return r * 7 + c;
    },

    getLowestEmptyRow: (state, col) => {
        for (let r = 5; r >= 0; r--) { if (state[r * 7 + col] === 0) return r; }
        return -1;
    },

    getMoves: (state) => {
        const moves = [];
        for (let c = 0; c < 7; c++) {
            const r = Connect4Game.getLowestEmptyRow(state, c);
            if (r !== -1) moves.push(r * 7 + c);
        }
        return moves;
    },

    heuristicSort: (state, moves) => {
        const centerBias = [3, 2, 1, 0, 1, 2, 3]; 
        return moves.sort((a, b) => centerBias[a % 7] - centerBias[b % 7]);
    },

    makeMove: (state, idx) => {
        const nextBoard = [...state];
        const player = state.filter(x => x !== 0).length % 2 === 0 ? 1 : 2;
        nextBoard[idx] = player;
        return nextBoard;
    },

    isTerminal: (state) => Connect4Game.checkWin(state) !== 0 || state.every(x => x !== 0),

    checkWin: (state) => {
        const dirs = [[1,0], [0,1], [1,1], [1,-1]];
        for (let i = 0; i < 42; i++) {
            if (state[i] === 0) continue;
            const p = state[i], r = Math.floor(i / 7), c = i % 7;
            for (let [dr, dc] of dirs) {
                let count = 1;
                for (let step = 1; step < 4; step++) {
                    let nr = r + dr * step, nc = c + dc * step;
                    if (nr >= 0 && nr < 6 && nc >= 0 && nc < 7 && state[nr * 7 + nc] === p) count++;
                    else break;
                }
                if (count === 4) return p;
            }
        }
        return 0;
    },

    // --- EXPERT EVALUATION ---
    evaluate: (state) => {
        const win = Connect4Game.checkWin(state);
        if (win === 2) return 1000000;
        if (win === 1) return -1000000;

        let score = 0;
        // Center Column Weight
        for (let r = 0; r < 6; r++) {
            if (state[r * 7 + 3] === 2) score += 40;
            if (state[r * 7 + 3] === 1) score -= 40;
        }
        score += Connect4Game.countWindows(state, 2); 
        score -= Connect4Game.countWindows(state, 1) * 1.5; // Defensive bias
        return score;
    },

    countWindows: (state, p) => {
        let s = 0;
        const scan = (win) => {
            const count = win.filter(x => x === p).length;
            const empty = win.filter(x => x === 0).length;
            if (count === 4) return 10000;
            if (count === 3 && empty === 1) return 500;
            if (count === 2 && empty === 2) return 50;
            return 0;
        };
        // Horizontal
        for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) s += scan([state[r*7+c], state[r*7+c+1], state[r*7+c+2], state[r*7+c+3]]);
        // Vertical
        for (let c = 0; c < 7; c++) for (let r = 0; r < 3; r++) s += scan([state[r*7+c], state[(r+1)*7+c], state[(r+2)*7+c], state[(r+3)*7+c]]);
        // Diagonals
        for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) s += scan([state[r*7+c], state[(r+1)*7+c+1], state[(r+2)*7+c+2], state[(r+3)*7+c+3]]);
        for (let r = 3; r < 6; r++) for (let c = 0; c < 4; c++) s += scan([state[r*7+c], state[(r-1)*7+c+1], state[(r-2)*7+c+2], state[(r-3)*7+c+3]]);
        return s;
    }
};

// --- SYSTEM STATE & CONTROLS ---
let moveSequence = [], currentStep = 0, isThinking = false, isSimulating = false, isNavigating = false;

function getBoardAtStep(step) {
    let board = Array(42).fill(0);
    for (let i = 0; i < step; i++) board = Connect4Game.makeMove(board, Connect4Game.coordToIndex(moveSequence[i]));
    return board;
}

function render() {
    const board = getBoardAtStep(currentStep);
    const cells = document.querySelectorAll('.cell');
    let lastIdx = (currentStep > 0) ? Connect4Game.coordToIndex(moveSequence[currentStep-1]) : -1;

    cells.forEach((cell, i) => {
        cell.setAttribute('data-value', board[i]);
        cell.classList.toggle('last-move', i === lastIdx);
    });

    const isP1 = currentStep % 2 === 0;
    const winner = Connect4Game.checkWin(board);
    
    document.getElementById('p1-label').className = (isP1 && !winner) ? 'active' : '';
    document.getElementById('p2-label').className = (!isP1 && !winner) ? 'active' : '';
    document.getElementById('move-stats').innerText = `(Step ${currentStep})`;
    document.getElementById('game-result').innerText = winner ? (winner === 1 ? "Red Wins!" : "Yellow Wins!") : "";
    document.getElementById('resume-btn').style.display = (currentStep < moveSequence.length) ? "flex" : "none";

    const displayEl = document.getElementById('sequence-display');
    displayEl.innerHTML = moveSequence.map((c, i) => `<span class="${i+1===currentStep?'sequence-current':(i+1>currentStep?'sequence-past':'')}" onclick="jumpTo(${i+1})">${c}</span>`).join(", ");

    if (!isSimulating && !isP1 && document.getElementById('cpu-toggle').checked && !isThinking && !winner && !isNavigating && currentStep === moveSequence.length) {
        executeAIMove();
    }
}

function handleUserInput(idx) {
    const col = idx % 7;
    const row = Connect4Game.getLowestEmptyRow(getBoardAtStep(currentStep), col);
    if (isThinking || isSimulating || row === -1 || Connect4Game.checkWin(getBoardAtStep(currentStep))) return;
    isNavigating = false; executeMoveLogic(row * 7 + col);
}

function executeMoveLogic(idx) {
    if (currentStep < moveSequence.length) moveSequence = moveSequence.slice(0, currentStep);
    moveSequence.push(Connect4Game.indexToCoord(idx));
    currentStep++; render();
}

function executeAIMove() {
    isThinking = true; document.getElementById('thinking-indicator').style.display = 'inline';
    setTimeout(() => {
        const res = alphaBeta(getBoardAtStep(currentStep), parseInt(document.getElementById('ai-depth').value), -Infinity, Infinity, true, Connect4Game);
        document.getElementById('thinking-indicator').style.display = 'none';
        isThinking = false; if (res.move !== undefined) executeMoveLogic(res.move);
    }, 50);
}

function undo() { if (currentStep > 0) { isNavigating = true; currentStep--; render(); } }
function redo() { if (currentStep < moveSequence.length) { currentStep++; if(currentStep===moveSequence.length) isNavigating=false; render(); } }
function jumpTo(s) { isNavigating = (s < moveSequence.length); currentStep = s; render(); }
function resumeFromHere() { isNavigating = false; render(); }

async function saveToClipboard() { 
    await navigator.clipboard.writeText(moveSequence.join(",")); 
    const i = document.querySelector('[onclick="saveToClipboard()"]');
    i.style.color = "#28a745"; setTimeout(() => i.style.color = "", 1000);
}

async function saveASCII() {
    const b = getBoardAtStep(currentStep); let a = "";
    for(let r=0; r<6; r++) { let row = ""; for(let c=0; c<7; c++) row += (b[r*7+c]===1?"x ":(b[r*7+c]===2?"o ":". ")); a += row.trim()+"\n"; }
    await navigator.clipboard.writeText(a.trim());
    const i = document.querySelector('[onclick="saveASCII()"]');
    i.style.color = "#28a745"; setTimeout(() => i.style.color = "", 1000);
}

async function loadFromClipboard() {
    const d = await navigator.clipboard.readText();
    moveSequence = d.split(",").filter(x => x.trim() !== "");
    currentStep = moveSequence.length; isNavigating = false; render();
}

async function toggleSimulation() {
    isSimulating = !isSimulating; document.getElementById('sim-btn').innerText = isSimulating ? "Stop" : "Simulate";
    while (isSimulating && !Connect4Game.isTerminal(getBoardAtStep(currentStep))) {
        const res = alphaBeta(getBoardAtStep(currentStep), 4, -Infinity, Infinity, currentStep%2!==0, Connect4Game);
        if (res.move !== undefined) { executeMoveLogic(res.move); await new Promise(r => setTimeout(r, 400)); }
        else break;
    }
    isSimulating = false; document.getElementById('sim-btn').innerText = "Simulate";
}

function init() {
    const b = document.getElementById('game-board'); b.innerHTML = '';
    b.appendChild(document.createElement('div'));
    for (let i = 0; i < 7; i++) { const l = document.createElement('div'); l.className = 'coord'; l.innerText = Connect4Game.letters[i]; b.appendChild(l); }
    for (let r = 0; r < 6; r++) {
        const l = document.createElement('div'); l.className = 'coord'; l.innerText = 6 - r; b.appendChild(l);
        for (let c = 0; c < 7; c++) {
            const cell = document.createElement('div'); cell.className = 'cell';
            const idx = r * 7 + c; cell.onclick = () => handleUserInput(idx); b.appendChild(cell);
        }
    }
    render();
}
init();