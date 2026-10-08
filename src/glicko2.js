/**
 * Glicko-2 Rating System Implementation
 * Based on Mark E. Glickman's specification (Boston University).
 */

export const GLICKO_DEFAULTS = {
  RATING: 1500,
  RD: 350,
  VOLATILITY: 0.06,
  TAU: 0.5, // System constant constraining volatility change over time
  MIN_RD: 30,
  MAX_RD: 350,
  PROVISIONAL_RD_THRESHOLD: 110
};

const SCALE = 173.7178;

function g(phi) {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function E(mu, muj, phij) {
  return 1 / (1 + Math.exp(-g(phij) * (mu - muj)));
}

/**
 * Calculates updated Glicko-2 ratings for a two-player match.
 * 
 * @param {Object} player1 - { rating, rd, vol }
 * @param {Object} player2 - { rating, rd, vol }
 * @param {number} outcome - 1 if player1 wins, 0 if player2 wins, 0.5 if draw
 * @returns {Object} Updated player ratings, RDs, volatilities, and deltas
 */
export function calculateGlicko2Match(player1, player2, outcome) {
  const p1 = updatePlayerGlicko2(player1, player2, outcome);
  const p2 = updatePlayerGlicko2(player2, player1, 1 - outcome);

  return {
    player1: p1,
    player2: p2
  };
}

/**
 * Computes updated stats for a single player against an opponent.
 */
function updatePlayerGlicko2(player, opponent, score) {
  const r = Number(player.rating ?? player.elo) || GLICKO_DEFAULTS.RATING;
  const rd = Math.min(GLICKO_DEFAULTS.MAX_RD, Math.max(GLICKO_DEFAULTS.MIN_RD, Number(player.rd) || GLICKO_DEFAULTS.RD));
  const sigma = Number(player.vol) || GLICKO_DEFAULTS.VOLATILITY;

  const oppR = Number(opponent.rating ?? opponent.elo) || GLICKO_DEFAULTS.RATING;
  const oppRd = Math.min(GLICKO_DEFAULTS.MAX_RD, Math.max(GLICKO_DEFAULTS.MIN_RD, Number(opponent.rd) || GLICKO_DEFAULTS.RD));

  // Step 2: Convert to Glicko-2 scale
  const mu = (r - GLICKO_DEFAULTS.RATING) / SCALE;
  const phi = rd / SCALE;

  const muj = (oppR - GLICKO_DEFAULTS.RATING) / SCALE;
  const phij = oppRd / SCALE;

  // Step 3: Compute variance v
  const g_phij = g(phij);
  const expScore = E(mu, muj, phij);
  const v = 1 / (g_phij * g_phij * expScore * (1 - expScore));

  // Step 4: Compute quantity delta
  const delta = v * g_phij * (score - expScore);

  // Step 5: Determine new volatility sigma' using Illinois algorithm
  const a = Math.log(sigma * sigma);
  const tau = GLICKO_DEFAULTS.TAU;

  function f(x) {
    const e_x = Math.exp(x);
    const num = e_x * (delta * delta - phi * phi - v - e_x);
    const denom = 2 * Math.pow(phi * phi + v + e_x, 2);
    return (num / denom) - ((x - a) / (tau * tau));
  }

  // Bracket the root
  let A = a;
  let B;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) {
      k++;
    }
    B = a - k * tau;
  }

  let fA = f(A);
  let fB = f(B);

  // Illinois method to solve f(A) = 0
  const EPSILON = 0.000001;
  let iterations = 0;
  while (Math.abs(B - A) > EPSILON && iterations < 100) {
    iterations++;
    const C = A + (A - B) * fA / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }

  const newSigma = Math.exp(B / 2);

  // Step 6: Update rating deviation to new rating period
  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);

  // Step 7: Update rating and RD
  const newPhi = 1 / Math.sqrt((1 / (phiStar * phiStar)) + (1 / v));
  const newMu = mu + newPhi * newPhi * g_phij * (score - expScore);

  // Step 8: Convert back to original scale
  const newRating = Math.round(newMu * SCALE + GLICKO_DEFAULTS.RATING);
  const newRd = Math.round(Math.min(GLICKO_DEFAULTS.MAX_RD, Math.max(GLICKO_DEFAULTS.MIN_RD, newPhi * SCALE)));
  const ratingDelta = newRating - Math.round(r);

  return {
    rating: Math.max(100, newRating),
    rd: newRd,
    vol: Number(newSigma.toFixed(5)),
    delta: ratingDelta,
    prevRating: Math.round(r),
    prevRd: Math.round(rd),
    isProvisional: newRd > GLICKO_DEFAULTS.PROVISIONAL_RD_THRESHOLD
  };
}
