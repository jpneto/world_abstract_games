/**
 * PRODUCT - OPTIMIZED HIGH-SPEED AI
 */
const ProductGame = {
    size: 5,
    dirs: [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]],
    coords: [],

    init: () => {
        ProductGame.coords = [];
        for (let q = -4; q <= 4; q++) {
            for (let r = Math.max(-4, -q - 4); r <= Math.min(4, -q + 4); r++) {
                ProductGame.coords.push({ q, r });
            }
        }
    },

    getGroups: (board, color) => {
        let visited = new Uint8Array(board.length);
        let groups = [];
        for (let i = 0; i < board.length; i++) {
            if (board[i] === color && !visited[i]) {
                let size = 0, stack = [i];
                visited[i] = 1;
                while (stack.length > 0) {
                    let currIdx = stack.pop();
                    size++;
                    const curr = ProductGame.coords[currIdx];
                    for (let [dq, dr] of ProductGame.dirs) {
                        // Fast neighbor lookup
                        const nIdx = ProductGame.coords.findIndex(c => c.q === curr.q + dq && c.r === curr.r + dr);
                        if (nIdx !== -1 && board[nIdx] === color && !visited[nIdx]) {
                            visited[nIdx] = 1;
                            stack.push(nIdx);
                        }
                    }
                }
                groups.push(size);
            }
        }
        return groups.sort((a, b) => b - a);
    },

    getMoves: (state) => {
        const board = state.board;
        const occupied = [];
        for (let i = 0; i < board.length; i++) if (board[i] !== 0) occupied.push(i);
        
        // Start in center if empty
        if (occupied.length === 0) return [30]; 

        // Prioritize moves adjacent to existing stones for speed/tactics
        const candidates = new Set();
        for (let idx of occupied) {
            const curr = ProductGame.coords[idx];
            for (let [dq, dr] of ProductGame.dirs) {
                const nIdx = ProductGame.coords.findIndex(c => c.q === curr.q + dq && c.r === curr.r + dr);
                if (nIdx !== -1 && board[nIdx] === 0) candidates.add(nIdx);
            }
        }
        // Return top candidates, fallback to all empty if none adjacent
        return candidates.size > 0 ? Array.from(candidates).slice(0, 12) : 
               board.map((v, i) => v === 0 ? i : -1).filter(i => i !== -1).slice(0, 10);
    },

    makeMove: (state, idx, color) => {
        const nb = [...state.board];
        nb[idx] = color;
        return { board: nb, step: state.step + 1 };
    },

    checkWin: (state) => {
        if (state.board.includes(0)) return 0;
        const gB = ProductGame.getGroups(state.board, 2);
        const gW = ProductGame.getGroups(state.board, 1);
        const sB = (gB[0] || 0) * (gB[1] || 0);
        const sW = (gW[0] || 0) * (gW[1] || 0);
        return sB > sW ? 2 : 1;
    },

    isTerminal: (state) => !state.board.includes(0),

    evaluate: (state) => {
        const gB = ProductGame.getGroups(state.board, 2);
        const gW = ProductGame.getGroups(state.board, 1);
        const scoreB = (gB[0] || 0) * (gB[1] || 0);
        const scoreW = (gW[0] || 0) * (gW[1] || 0);
        // AI is White (Player 2), so we want to maximize scoreW - scoreB
        return scoreW - scoreB;
    }
};

// --- SYSTEM STATE ---
let moveSequence = [], currentStep = 0, isThinking = false;

function getFullWrapper(step) {
    let state = { board: Array(61).fill(0), step: 0 };
    for (let i = 0; i < step; i++) {
        if (!moveSequence[i]) continue;
        const [idx, color] = moveSequence[i].split(':').map(Number);
        state.board[idx] = color;
        state.step++;
    }
    return state;
}

function render() {
    const container = document.getElementById('game-board');
    if (!container) return;
    container.innerHTML = '';
    const state = getFullWrapper(currentStep);
    const winner = ProductGame.checkWin(state);

    ProductGame.coords.forEach((coord, i) => {
        const div = document.createElement('div');
        div.className = 'hex';
        const size = 32;
        div.style.left = `${250 + size * (3/2 * coord.q)}px`;
        div.style.top = `${250 + size * (Math.sqrt(3) * (coord.r + coord.q/2))}px`;

        if (state.board[i] !== 0) {
            const stone = document.createElement('div');
            stone.className = `stone ${state.board[i] === 1 ? 'white' : 'black'}`;
            div.appendChild(stone);
        }
        if (state.board[i] === 0 && !winner) div.onclick = () => handleInput(i);
        container.appendChild(div);
    });
    updateUI(state, winner);
}

function updateUI(state, winner) {
    const gB = ProductGame.getGroups(state.board, 2);
    const gW = ProductGame.getGroups(state.board, 1);
    
    document.getElementById('score-b').innerText = (gB[0]||0) * (gB[1]||0);
    document.getElementById('score-w').innerText = (gW[0]||0) * (gW[1]||0);
    document.getElementById('details-b').innerText = `${gB[0]||0} × ${gB[1]||0}`;
    document.getElementById('details-w').innerText = `${gW[0]||0} × ${gW[1]||0}`;
    document.getElementById('move-stats').innerText = `(Step ${currentStep})`;
    
    // Logic: Black 1, White 2, Black 2, White 2...
    let isP1 = currentStep === 0 || (Math.floor((currentStep - 1) / 2) % 2 !== 0);
    
    document.getElementById('p1-label').classList.toggle('active', isP1 && !winner);
    document.getElementById('p2-label').classList.toggle('active', !isP1 && !winner);
    document.getElementById('game-result').innerText = winner ? `Player ${winner===2?'Black':'White'} Wins!` : "";

    const seqBox = document.getElementById('sequence-display');
    seqBox.innerHTML = moveSequence.map((m, i) => {
        const [idx, col] = m.split(':');
        return `<span class="${i+1===currentStep?'sequence-current':''}" onclick="jumpTo(${i+1})">${idx}${col==2?'B':'W'}</span>`;
    }).join(", ") || "No moves yet";

    if (!winner && !isP1 && document.getElementById('cpu-toggle').checked && !isThinking) {
        executeAI();
    }
}

function handleInput(idx) {
    if (isThinking) return;
    const color = document.querySelector('input[name="stone-color"]:checked').value;
    moveSequence = moveSequence.slice(0, currentStep);
    moveSequence.push(`${idx}:${color}`);
    currentStep++;
    render();
}

function executeAI() {
    isThinking = true;
    document.getElementById('thinking-indicator').style.display = 'inline';
    
    // AI is Player 2 (White)
    setTimeout(() => {
        const state = getFullWrapper(currentStep);
        // Depth 2 is standard, but optimized moves make it faster
        const res = alphaBeta(state, 2, -Infinity, Infinity, true, ProductGame);
        isThinking = false;
        document.getElementById('thinking-indicator').style.display = 'none';
        
        if (res.move !== undefined) {
            // AI chooses its own color (White = 1)
            moveSequence.push(`${res.move}:1`);
            currentStep++;
            render();
        }
    }, 50);
}

// --- SIMULATION LOGIC ---
let simInterval = null;

function toggleSimulation() {
    const btn = document.getElementById('sim-btn');
    if (simInterval) {
        clearInterval(simInterval);
        simInterval = null;
        btn.innerText = "Simulate";
        btn.classList.remove('active');
    } else {
        btn.innerText = "Stop Sim";
        btn.classList.add('active');
        simInterval = setInterval(() => {
            const state = getFullWrapper(currentStep);
            const winner = ProductGame.checkWin(state);
            
            if (winner) {
                clearInterval(simInterval);
                simInterval = null;
                btn.innerText = "Simulate";
                return;
            }

            const moves = ProductGame.getMoves(state);
            if (moves.length > 0) {
                const randomIdx = moves[Math.floor(Math.random() * moves.length)];
                
                // Determine whose turn it is to pick the color for simulation
                // Logic: Step 0 is Black(2). Steps 1,2 are White(1). Steps 3,4 are Black(2).
                let simColor;
                if (currentStep === 0) simColor = 2; // Black starts
                else {
                    const turnGroup = Math.floor((currentStep - 1) / 2);
                    simColor = (turnGroup % 2 === 0) ? 1 : 2; // Alternates White then Black
                }
                
                moveSequence.push(`${randomIdx}:${simColor}`);
                currentStep++;
                render();
            }
        }, 100); // 100ms per stone drop
    }
}

// ASCII and Utilities
function copyBoardASCII() {
    const state = getFullWrapper(currentStep);
    const rowCounts = [5, 6, 7, 8, 9, 8, 7, 6, 5];
    let boardIdx = 0;
    let output = "";

    rowCounts.forEach((count, i) => {
        // Add leading spaces for hex indentation
        let indent = Math.abs(4 - i);
        output += " ".repeat(indent);
        
        for (let j = 0; j < count; j++) {
            const v = state.board[boardIdx++];
            const char = v === 0 ? "." : (v === 1 ? "o" : "x");
            output += char + " ";
        }
        output += "\n";
    });

    navigator.clipboard.writeText(output);
}

function saveToClipboard() {
    navigator.clipboard.writeText(JSON.stringify(moveSequence));
}

async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        moveSequence = JSON.parse(text);
        currentStep = moveSequence.length;
        render();
    } catch(e) {}
}

function undo() { if (currentStep > 0) { currentStep--; render(); } }
function redo() { if (currentStep < moveSequence.length) { currentStep++; render(); } }
function jumpTo(s) { currentStep = s; render(); }

ProductGame.init();
window.onload = render;