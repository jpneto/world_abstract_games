/**
 * GOMOKU RULES & STRATEGIC AI
 */
const GomokuGame = {
    size: 15,
    letters: "ABCDEFGHIJKLMNO",

    indexToCoord: (idx) => {
        const r = Math.floor(idx / 15);
        const c = idx % 15;
        return GomokuGame.letters[c] + (15 - r);
    },

    coordToIndex: (coord) => {
        const c = GomokuGame.letters.indexOf(coord[0]);
        const r = 15 - parseInt(coord.substring(1));
        return r * 15 + c;
    },

    getMoves: (state) => {
        const moves = [];
        let hasStone = false;
        for (let i = 0; i < 225; i++) {
            if (state[i] === 0) {
                let nearPiece = false;
                const r = Math.floor(i / 15), c = i % 15;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && state[nr * 15 + nc] !== 0) {
                            nearPiece = true; break;
                        }
                    }
                    if (nearPiece) break;
                }
                if (nearPiece) moves.push(i);
            } else { hasStone = true; }
        }
        return (!hasStone) ? [112] : moves;
    },

    // OPTIMIZATION: Move Sorting (Prunes tree faster)
    heuristicSort: (state, moves) => {
        return moves.map(move => {
            let priority = 0;
            const r = Math.floor(move / 15), c = move % 15;
            priority += (7 - Math.abs(7 - r)) + (7 - Math.abs(7 - c)); // Center bias
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && state[nr * 15 + nc] !== 0) {
                        priority += 10; // Neighbor density
                    }
                }
            }
            return { move, priority };
        })
        .sort((a, b) => b.priority - a.priority)
        .map(obj => obj.move);
    },

    makeMove: (state, idx) => {
        const nextBoard = [...state];
        const player = state.filter(x => x !== 0).length % 2 === 0 ? 1 : 2;
        nextBoard[idx] = player;
        return nextBoard;
    },

    isTerminal: (state) => GomokuGame.checkWin(state) !== 0 || state.every(x => x !== 0),

    checkWin: (state) => {
        const dirs = [[1,0], [0,1], [1,1], [1,-1]];
        for (let i = 0; i < 225; i++) {
            if (state[i] === 0) continue;
            const p = state[i], r = Math.floor(i / 15), c = i % 15;
            for (let [dr, dc] of dirs) {
                let count = 1;
                for (let step = 1; step < 5; step++) {
                    let nr = r + dr * step, nc = c + dc * step;
                    if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && state[nr * 15 + nc] === p) count++;
                    else break;
                }
                if (count === 5) return p;
            }
        }
        return 0;
    },

    // ASYMMETRIC EVALUATION (Defensive Bias)
    evaluate: (state) => {
        const winner = GomokuGame.checkWin(state);
        if (winner === 2) return 1000000;
        if (winner === 1) return -1000000;

        let score = 0;
        const size = 15;
        const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
        const weights = { 5: 100000, 4: 10000, 3: 1000, 2: 100, 'blocked4': 1000, 'blocked3': 100 };

        for (let i = 0; i < 225; i++) {
            const p = state[i];
            if (p === 0) continue;
            const r = Math.floor(i / size), c = i % size;
            for (let [dr, dc] of dirs) {
                const prevR = r - dr, prevC = c - dc;
                if (prevR >= 0 && prevR < 15 && prevC >= 0 && prevC < 15 && state[prevR * size + prevC] === p) continue;

                let count = 1;
                for (let step = 1; step < 5; step++) {
                    let nr = r + dr * step, nc = c + dc * step;
                    if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && state[nr * size + nc] === p) count++;
                    else break;
                }

                let openEnds = 0;
                let fr = r + dr * count, fc = c + dc * count;
                if (fr >= 0 && fr < 15 && fc >= 0 && fc < 15 && state[fr * size + fc] === 0) openEnds++;
                let br = r - dr, bc = c - dc;
                if (br >= 0 && br < 15 && bc >= 0 && bc < 15 && state[br * size + bc] === 0) openEnds++;

                let patternScore = 0;
                if (count >= 5) patternScore = weights[5];
                else if (count === 4) patternScore = (openEnds === 2) ? weights[4] : weights['blocked4'];
                else if (count === 3) patternScore = (openEnds === 2) ? weights[3] : weights['blocked3'];
                else if (count === 2) patternScore = (openEnds === 2) ? weights[2] : 10;

                score += (p === 2) ? patternScore : -(patternScore * 1.25); // 1.25x Defensive Bias
            }
        }
        return score;
    }
};

// --- SYSTEM STATE ---
let moveSequence = [], currentStep = 0, isThinking = false, isSimulating = false, isNavigating = false;

function getBoardAtStep(step) {
    let board = Array(225).fill(0);
    for (let i = 0; i < step; i++) board = GomokuGame.makeMove(board, GomokuGame.coordToIndex(moveSequence[i]));
    return board;
}

function render() {
    const board = getBoardAtStep(currentStep);
    const cells = document.querySelectorAll('.cell');
    
    // 1. Handle Visual Markers (Last Move Dot)
    let lastMoveIdx = -1;
    if (currentStep > 0 && moveSequence[currentStep - 1]) {
        lastMoveIdx = GomokuGame.coordToIndex(moveSequence[currentStep - 1]);
    }

    cells.forEach((cell, i) => {
        cell.setAttribute('data-value', board[i]);
        cell.classList.toggle('last-move', i === lastMoveIdx);
    });

    // 2. Handle Game Results & Messages
    const res = document.getElementById('game-result');
    res.innerText = ''; 
    res.className = 'result-message';
    const winner = GomokuGame.checkWin(board);
    const isFull = board.every(x => x !== 0);

    if (winner) {
        res.innerText = (winner === 1 ? "Black" : "White") + " Wins!";
        res.classList.add(winner === 1 ? 'result-red' : 'result-yellow');
    } else if (isFull) {
        res.innerText = "It's a Draw!";
    }

    // 3. Update Turn Indicators & Stats
    const isP1 = currentStep % 2 === 0;
    document.getElementById('p1-label').className = (isP1 && !winner && !isFull) ? 'active' : '';
    document.getElementById('p2-label').className = (!isP1 && !winner && !isFull) ? 'active' : '';
    
    // RELOCATED STEP DISPLAY: Now sits inside the header parenthesis
    const statsEl = document.getElementById('move-stats');
    if (statsEl) {
        statsEl.innerText = `(Step ${currentStep})`;
        // Optional: Color it orange if we are viewing history instead of the live turn
        statsEl.style.color = (currentStep < moveSequence.length) ? "#f39c12" : "#8e8e93";
    }

    // 4. Update Resume Button & Navigation State
    const resumeBtn = document.getElementById('resume-btn');
    if (resumeBtn) {
        resumeBtn.style.display = (currentStep < moveSequence.length) ? "flex" : "none";
    }

    // 5. Update Move Sequence History Box
    const displayEl = document.getElementById('sequence-display');
    displayEl.innerHTML = moveSequence.length === 0 ? '<span class="placeholder">Waiting...</span>' : 
        moveSequence.map((coord, i) => {
            const mIdx = i + 1;
            const cls = mIdx === currentStep ? "sequence-current" : (mIdx > currentStep ? "sequence-past" : "");
            return `<span class="${cls}" onclick="jumpTo(${mIdx})">${coord}</span>`;
        }).join(", ");

    // 6. AI Auto-Triggering Logic
    const isCPUEnabled = document.getElementById('cpu-toggle').checked;
    const isAITurn = !isP1; // White is AI
    
    if (!isSimulating && isAITurn && isCPUEnabled && !isThinking && !winner && !isFull && !isNavigating && currentStep === moveSequence.length) {
        executeAIMove();
    }
}

function handleUserInput(idx) {
    if (isThinking || isSimulating || GomokuGame.checkWin(getBoardAtStep(currentStep)) || getBoardAtStep(currentStep)[idx] !== 0) return;
    isNavigating = false; executeMoveLogic(idx);
}

function executeMoveLogic(idx) {
    const coord = GomokuGame.indexToCoord(idx);
    if (currentStep < moveSequence.length) moveSequence = moveSequence.slice(0, currentStep);
    moveSequence.push(coord);
    currentStep++;
    render();
}

function executeAIMove() {
    isThinking = true;
    const indicator = document.getElementById('thinking-indicator');
    if (indicator) indicator.style.display = 'inline';

    setTimeout(() => {
        const depth = parseInt(document.getElementById('ai-depth').value);
        const result = alphaBeta(getBoardAtStep(currentStep), depth, -Infinity, Infinity, true, GomokuGame);
        if (indicator) indicator.style.display = 'none';
        isThinking = false;
        if (result.move !== undefined) executeMoveLogic(result.move);
    }, 50);
}

// --- CONTROLS ---
function undo() { if (currentStep > 0) { isNavigating = true; currentStep--; render(); } }
function redo() { if (currentStep < moveSequence.length) { currentStep++; if (currentStep === moveSequence.length) isNavigating = false; render(); } }
function jumpTo(step) { isNavigating = (step < moveSequence.length); currentStep = step; render(); }
function resumeFromHere() { isNavigating = false; render(); }

async function saveToClipboard() { 
    await navigator.clipboard.writeText(moveSequence.join(",")); 
    const icon = document.querySelector('[onclick="saveToClipboard()"]');
    icon.style.color = "#28a745"; // Flash green
    setTimeout(() => icon.style.color = "", 1000);
}

async function loadFromClipboard() {
    try {
        const d = await navigator.clipboard.readText();
        moveSequence = d.split(",").filter(x => x.trim() !== "");
        currentStep = moveSequence.length; isNavigating = false; render();
    } catch(e) { console.error("Load failed"); }
}

async function toggleSimulation() {
    isSimulating = !isSimulating;
    document.getElementById('sim-btn').innerText = isSimulating ? "Stop" : "Simulate";
    while (isSimulating && !GomokuGame.isTerminal(getBoardAtStep(currentStep))) {
        const result = alphaBeta(getBoardAtStep(currentStep), 2, -Infinity, Infinity, currentStep % 2 !== 0, GomokuGame);
        if (result.move !== undefined) { executeMoveLogic(result.move); await new Promise(r => setTimeout(r, 250)); }
        else break;
    }
    isSimulating = false; document.getElementById('sim-btn').innerText = "Simulate";
}

async function saveASCII() {
    const board = getBoardAtStep(currentStep);
    let ascii = "";
    
    for (let r = 0; r < 15; r++) {
        let row = "";
        for (let c = 0; c < 15; c++) {
            const val = board[r * 15 + c];
            if (val === 1) row += "x ";
            else if (val === 2) row += "o ";
            else row += ". ";
        }
        ascii += row.trim() + "\n";
    }

    try {
        await navigator.clipboard.writeText(ascii.trim());
        // Flash the grid icon green for feedback
        const icon = document.querySelector('[onclick="saveASCII()"]');
        icon.style.color = "#28a745";
        setTimeout(() => icon.style.color = "", 1000);
    } catch (err) {
        console.error('Failed to copy ASCII: ', err);
    }
}

function init() {
    const b = document.getElementById('game-board'); b.innerHTML = '';
    b.appendChild(document.createElement('div'));
    for (let i = 0; i < 15; i++) {
        const l = document.createElement('div'); l.className = 'coord'; l.innerText = GomokuGame.letters[i]; b.appendChild(l);
    }
    for (let r = 0; r < 15; r++) {
        const l = document.createElement('div'); l.className = 'coord'; l.innerText = 15 - r; b.appendChild(l);
        for (let c = 0; c < 15; c++) {
            const cell = document.createElement('div'); cell.className = 'cell';
            const idx = r * 15 + c;
            cell.onclick = () => handleUserInput(idx);
            b.appendChild(cell);
        }
    }
    render();
}
init();