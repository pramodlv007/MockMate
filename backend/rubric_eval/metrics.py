"""Pure-python metrics for the judge comparison. Inputs are flat lists of booleans."""
import math, random


def kappa(a, b):
    """Cohen's kappa for two binary label lists; nan when undefined (no label variance)."""
    n = len(a)
    po = sum(x == y for x, y in zip(a, b)) / n
    pa, pb = sum(a) / n, sum(b) / n
    pe = pa * pb + (1 - pa) * (1 - pb)
    return float("nan") if pe == 1 else (po - pe) / (1 - pe)


def f1(true, pred):
    tp = sum(t and p for t, p in zip(true, pred))
    fp = sum((not t) and p for t, p in zip(true, pred))
    fn = sum(t and (not p) for t, p in zip(true, pred))
    return 2 * tp / (2 * tp + fp + fn) if tp else 0.0


def bootstrap_ci(stat, answers, n=1000, seed=0):
    """95% CI. `answers` is a list of (true_list, pred_list), one per answer: resampling whole
    answers (not points) keeps the correlation between points of the same answer."""
    rng = random.Random(seed)
    vals = []
    for _ in range(n):
        s = [rng.choice(answers) for _ in answers]
        v = stat([x for t, _ in s for x in t], [x for _, p in s for x in p])
        if not math.isnan(v):
            vals.append(v)
    vals.sort()
    return (vals[int(0.025 * len(vals))], vals[int(0.975 * len(vals)) - 1]) if vals else (float("nan"),) * 2


def percentile(xs, q):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(q * len(xs)))]
