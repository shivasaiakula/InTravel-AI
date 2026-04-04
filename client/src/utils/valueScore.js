export const BEST_VALUE_WEIGHTS = {
    price: 0.5,
    quality: 0.35,
    convenience: 0.15,
};

export const BEST_VALUE_FORMULA_HINT = '50% price + 35% quality + 15% convenience';
export const BEST_VALUE_FORMULA_TOOLTIP = 'Best value score = 50% price + 35% quality + 15% convenience. Quality maps to reliability for transport and rating for hotels.';

export function getMinMax(values) {
    if (!Array.isArray(values) || values.length === 0) {
        return { min: 0, max: 0 };
    }

    return {
        min: Math.min(...values),
        max: Math.max(...values),
    };
}

export function normalize(value, min, max) {
    if (max === min) return 1;
    return (value - min) / (max - min);
}

export function scoreHigherBetter(value, min, max) {
    return normalize(value, min, max) * 100;
}

export function scoreLowerBetter(value, min, max) {
    return 100 - (normalize(value, min, max) * 100);
}

export function weightedScore(parts) {
    return Math.round(parts.reduce((total, part) => total + (part.score * part.weight), 0));
}
