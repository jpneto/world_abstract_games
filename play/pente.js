const PenteGame = {
    size: 19,
    hoshi: [60, 66, 72, 174, 180, 186, 288, 294, 300], 
    letters: "ABCDEFGHJKLMNOPQRST",

    getMoves: (wrapper) => {
        const board = wrapper.board;
        const occupied = [];
        for (let i = 0; i < 361; i++) if (board[i] !== 0) occupied.push(i);
        if (occupied.length === 0) return [180];

        const candidates = new Map();
        for (let idx of occupied) {
            const r = Math.floor(idx / 19), c = idx % 19;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < 19 && nc >= 0 && nc < 19 && board[nr * 19 + nc] === 0) {
                        const nIdx = nr * 19 + nc;
                        candidates.set(nIdx, (candidates.get(nIdx) || 0) + 1);
                    }
                }
            }
        }
        return [...candidates.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 12);
    },

    makeMove: (wrapper, idx, turn) => {
        const nextBoard = [...wrapper.board];
        nextBoard[idx] = turn;
        const nextCaptures = { ...wrapper.caps };
        const opponent = turn === 1 ? 2 : 1;
        const r = Math.floor(idx / 19), c = idx % 19;
        const dirs = [[0,1],[1,0],[1,1],[1,-1],[0,-1],[-1,0],[-1,-1],[-1,1]];

        for (let [dr, dc] of dirs) {
            const r3 = r + 3*dr, c3 = c + 3*dc;
            if (r3 >= 0 && r3 < 19 && c3 >= 0 && c3 < 19) {
                const i1 = (r+dr)*19+(c+dc), i2 = (r+2*dr)*19+(c+2*dc), i3 = r3*19+c3;
                if (nextBoard[i1] === opponent && nextBoard[i2] === opponent && nextBoard[i3] === turn) {
                    nextBoard[i1] = 0; nextBoard[i2] = 0;
                    nextCaptures[turn]++;
                }
            }
        }
        return { board: nextBoard, caps: nextCaptures };
    },

    checkWin: (wrapper) => {
        const { board, caps } = wrapper;
        if (caps[1] >= 5) return 1;
        if (caps[2] >= 5) return 2;
        for (let i = 0; i < 361; i++) {
            if (board[i] === 0) continue;
            const turn = board[i], r = Math.floor(i/19), c = i%19;
            for (let [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
                let count = 1;
                for (let s = 1; s < 5; s++) {
                    const nr = r+dr*s, nc = c+dc*s;
                    if (nr >= 0 && nr < 19 && nc >= 0 && nc < 19 && board[nr*19+nc] === turn) count++;
                    else break;
                }
                if (count >= 5) return turn;
            }
        }
        return 0;
    },

    isTerminal: (wrapper) => PenteGame.checkWin(wrapper) !== 0,

    evaluate: (wrapper) => {
        const win = PenteGame.checkWin(wrapper);
        if (win === 2) return 1000000;
        if (win === 1) return -1000000;
        return (wrapper.caps[2] * 5000) - (wrapper.caps[1] * 5200);
    }
};

let moveSequence = [], currentStep = 0, isThinking = false;

function getFullWrapper(step) {
    let wrapper = { board: Array(361).fill(0), caps: { 1: 0, 2: 0 } };
    for (let i = 0; i < step; i++) {
        const turn = (i % 2 === 0) ? 1 : 2;
        const coord = moveSequence[i];
        if (!coord) continue;
        const c = PenteGame.letters.indexOf(coord[0]);
        const r = parseInt(coord.substring(1)) - 1;
        wrapper = PenteGame.makeMove(wrapper, r * 19 + c, turn);
    }
    return wrapper;
}

function render() {
    const container = document.getElementById('game-board');
    if (!container) return;
    
    const wrapper = getFullWrapper(currentStep);
    container.innerHTML = '';
    const winner = PenteGame.checkWin(wrapper);

    for (let i = 0; i < 361; i++) {
        const div = document.createElement('div');
        div.className = 'cell';
        
        if (PenteGame.hoshi.includes(i)) {
            const hoshi = document.createElement('div');
            hoshi.className = 'hoshi-dot';
            div.appendChild(hoshi);
        }

        const cellValue = wrapper.board[i];
        if (cellValue !== 0) {
            const stone = document.createElement('div');
            stone.className = `stone ${cellValue === 1 ? 'white' : 'black'}`;
            div.appendChild(stone);
        }

        if (cellValue === 0 && !winner) {
            div.onclick = () => handleUserInput(i);
        }
        container.appendChild(div);
    }
    updateUI(winner, wrapper.caps);
}

function updateUI(winner, caps) {
    const isP1 = currentStep % 2 === 0;
    const cpuEl = document.getElementById('cpu-toggle');
    
    document.getElementById('p1-label').classList.toggle('active', isP1 && !winner);
    document.getElementById('p2-label').classList.toggle('active', !isP1 && !winner);
    document.getElementById('cap-w').innerText = caps[1];
    document.getElementById('cap-b').innerText = caps[2];
    document.getElementById('game-result').innerText = winner ? `Player ${winner === 1 ? 'White' : 'Black'} Wins!` : "";

    const displayEl = document.getElementById('sequence-display');
    if (displayEl) {
        displayEl.innerHTML = moveSequence.map((coord, i) => 
            `<span class="${i+1 === currentStep ? 'sequence-current' : ''}" onclick="jumpTo(${i+1})">${coord}</span>`
        ).join(", ") || '<span class="placeholder">Waiting for move...</span>';
    }

    if (!winner && !isP1 && cpuEl && cpuEl.checked && !isThinking) {
        executeAI();
    }
}

function handleUserInput(idx) {
    if (isThinking) return;
    const r = Math.floor(idx / 19), c = idx % 19;
    moveSequence = moveSequence.slice(0, currentStep);
    moveSequence.push(PenteGame.letters[c] + (r + 1));
    currentStep++;
    render();
}

function executeAI() {
    isThinking = true;
    const indicator = document.getElementById('thinking-indicator');
    if (indicator) indicator.style.display = 'inline';
    
    setTimeout(() => {
        const wrapper = getFullWrapper(currentStep);
        const res = alphaBeta(wrapper, 2, -Infinity, Infinity, true, PenteGame);
        isThinking = false;
        if (indicator) indicator.style.display = 'none';
        if (res.move !== undefined) handleUserInput(res.move);
    }, 50);
}

function jumpTo(s) { currentStep = s; render(); }
function undo() { if (currentStep > 0) { currentStep--; render(); } }
function redo() { if (currentStep < moveSequence.length) { currentStep++; render(); } }

window.onload = () => { render(); };