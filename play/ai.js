/**
 * GENERIC ALPHA-BETA ENGINE with Move Sorting
 */
function alphaBeta(state, depth, alpha, beta, isMaximizing, game) {
    if (depth === 0 || game.isTerminal(state)) {
        return { score: game.evaluate(state) };
    }

    let moves = game.getMoves(state);
    
    // OPTIMIZATION: Move Sorting
    // We sort moves based on a quick "closeness" or "threat" check
    if (game.heuristicSort) {
        moves = game.heuristicSort(state, moves);
    }

    if (isMaximizing) {
        let maxEval = -Infinity;
        let bestMove;
        for (let move of moves) {
            let evaluation = alphaBeta(game.makeMove(state, move), depth - 1, alpha, beta, false, game).score;
            if (evaluation > maxEval) {
                maxEval = evaluation;
                bestMove = move;
            }
            alpha = Math.max(alpha, evaluation);
            if (beta <= alpha) break; // Beta cut-off
        }
        return { score: maxEval, move: bestMove };
    } else {
        let minEval = Infinity;
        let bestMove;
        for (let move of moves) {
            let evaluation = alphaBeta(game.makeMove(state, move), depth - 1, alpha, beta, true, game).score;
            if (evaluation < minEval) {
                minEval = evaluation;
                bestMove = move;
            }
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) break; // Alpha cut-off
        }
        return { score: minEval, move: bestMove };
    }
}