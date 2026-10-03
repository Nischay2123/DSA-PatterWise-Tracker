// Folds puneetkhatri99/DSA_Tracker's roadmap (roadmaps/dsa.json) into data/questions.json.
// Run: node scripts/merge-roadmap.mjs   (after scripts/convert.py, which regenerates the A2Z list)
//
// The A2Z sheet stays the spine: its ids, titles and patterns are never touched, because
// progress, idRegistry.json, lists.json and gfgLinks.json are all keyed by those ids.
// From his roadmap it takes:
//   - for questions both have: source tags, video, article, extra practice links, premium,
//     and the topics the question "needs"
//   - questions tagged with any non-A2Z list (NeetCode, Blind 75, LC Top 150, LC 75) that the
//     sheet lacks, each placed into one of the sheet's own patterns (PLACE below)
//   - topic prerequisites and pattern-note links
// A2Z-only questions the sheet lacks are skipped. Idempotent: re-running on its own output
// matches the already-added questions and changes nothing.

import fs from 'fs';

const QUESTIONS = 'data/questions.json';
const LISTS = 'data/lists.json';
const his = JSON.parse(fs.readFileSync('roadmaps/dsa.json', 'utf8'));
const data = JSON.parse(fs.readFileSync(QUESTIONS, 'utf8'));
const gfg = JSON.parse(fs.readFileSync('data/gfgLinks.json', 'utf8'));

// His topic -> the sheet topic it lives in.
const TOPIC = {
  basics: 'fundamentals', patterns: 'fundamentals', hashing: 'fundamentals',
  'recursion-basics': 'recursion', sorting: 'sorting', arrays: 'arrays', 'two-pointers': 'arrays',
  'sliding-window': 'arrays', 'binary-search': 'binary-search', strings: 'strings',
  'linked-list': 'linked-list', recursion: 'backtracking', bits: 'bit-manipulation', math: 'bit-manipulation',
  greedy: 'greedy', 'stack-queue': 'stack-queue', 'binary-trees': 'trees', bst: 'bst', heaps: 'heaps',
  graphs: 'graphs', dp: 'dp', tries: 'tries', 'strings-advanced': 'advanced-strings',
};

// His prerequisite graph, translated onto the sheet's topics and topic order.
const PREREQS = {
  fundamentals: [], recursion: ['fundamentals'], sorting: ['recursion'], arrays: ['sorting'],
  'binary-search': ['arrays'], strings: ['arrays'], 'linked-list': ['arrays'],
  'bit-manipulation': ['fundamentals'], backtracking: ['recursion', 'arrays'], 'stack-queue': ['linked-list'],
  heaps: ['arrays'], greedy: ['sorting', 'arrays'], trees: ['recursion', 'stack-queue'],
  bst: ['trees', 'binary-search'], graphs: ['trees', 'heaps'], dp: ['recursion'],
  tries: ['strings', 'trees'], 'advanced-strings': ['strings'],
};

// Hand-checked renames: his id -> sheet id. Wins over every automatic match.
const ALIAS = {
  'missing-number': 'arrays__hashing__find-missing-number',
  'coin-change-ii': 'dp__knapsack__coin-change-2-dp-22',
  'kth-largest-element-in-an-array': 'heaps__top-k-elements__k-th-largest-element-in-an-array',
  'largest-bst-subtree': 'bst__advanced-bst__largest-bst-in-binary-tree',
  'last-stone-weight-ii': 'dp__subset-dp__partition-a-set-into-two-subsets-with-minimum-absolute-sum-difference',
  subsets: 'backtracking__subsets__power-set',
  'binary-tree-inorder-traversal': 'trees__dfs-traversals__inorder-traversal-of-binary-tree',
  // The sheet's "House robber" row is LC 213 (the circular one); LC 198 is "Maximum sum of non adjacent elements".
  'house-robber': 'dp__house-robber-pattern__maximum-sum-of-non-adjacent-elements',
  'house-robber-ii': 'dp__house-robber-pattern__house-robber',
};

// Automatic matches that are a different problem. Left unmatched (and so skipped, or added if non-A2Z).
const NOT_SAME = {
  'frequency-of-the-most-frequent-element': 'fundamentals__basic-hashing__highest-occurring-element-in-an-array',
  'minimum-add-to-make-parentheses-valid': 'stack-queue__expression-problems__minimum-number-of-bracket-reversals-to-make-an-expression-balanced',
  'delete-node-in-a-linked-list': 'linked-list__traversal__deletion-of-the-head-of-ll',
  'binary-search-tree-iterator': 'bst__advanced-bst__merge-2-bst-s',
  'maximum-number-of-non-overlapping-substrings': 'graphs__strongly-connected-components__kosaraju-s-algorithm',
  'parsing-a-boolean-expression': 'dp__partition-dp__different-ways-to-evaluate-a-boolean-expression',
};

// Where each added question goes. Every non-A2Z question the sheet lacks must be listed here.
const PLACE = {
  'arrays__hashing': ['contains-duplicate', 'design-hashset', 'design-hashmap', 'find-the-difference-of-two-arrays',
    'unique-number-of-occurrences', 'insert-delete-getrandom-o1', 'first-missing-positive',
    'verifying-an-alien-dictionary', 'detect-squares', 'max-points-on-a-line'],
  'arrays__simulation-traversal': ['concatenation-of-array', 'kids-with-the-greatest-number-of-candies', 'h-index', 'plus-one'],
  'arrays__two-pointers': ['remove-element', 'reverse-vowels-of-a-string', 'remove-duplicates-from-sorted-array-ii',
    'string-compression', 'reverse-string', 'merge-strings-alternately', 'is-subsequence',
    'two-sum-ii-input-array-is-sorted', 'container-with-most-water', 'boats-to-save-people', 'max-number-of-k-sum-pairs'],
  'arrays__prefix-sum': ['find-the-highest-altitude', 'find-pivot-index', 'product-of-array-except-self',
    'range-sum-query-2d-immutable', 'maximum-sum-circular-subarray', 'car-pooling'],
  'arrays__sliding-window': ['contains-duplicate-ii', 'maximum-average-subarray-i', 'permutation-in-string',
    'minimum-size-subarray-sum', 'find-k-closest-elements', 'maximum-number-of-vowels-in-a-substring-of-given-length',
    'longest-subarray-of-1s-after-deleting-one-element', 'substring-with-concatenation-of-all-words', 'longest-turbulent-subarray'],
  'arrays__intervals': ['meeting-rooms', 'summary-ranges', 'partition-labels'],
  'arrays__matrix': ['valid-sudoku', 'game-of-life', 'equal-row-and-column-pairs', 'transpose-matrix'],
  'sorting__divide-conquer-applications': ['sort-an-array'],
  'strings__basic-string-ops': ['length-of-last-word', 'find-the-index-of-the-first-occurrence-in-a-string', 'greatest-common-divisor-of-strings'],
  'strings__anagram-frequency': ['ransom-note', 'word-pattern', 'group-anagrams', 'determine-if-two-strings-are-close'],
  'strings__string-parsing': ['encode-and-decode-strings', 'integer-to-roman', 'zigzag-conversion', 'text-justification', 'multiply-strings'],
  'strings__palindrome-patterns': ['valid-palindrome-ii'],
  'binary-search__classic-search': ['guess-number-higher-or-lower'],
  'binary-search__lower-bound': ['successful-pairs-of-spells-and-potions'],
  'binary-search__upper-bound': ['time-based-key-value-store'],
  'binary-search__search-space-reduction': ['find-in-mountain-array'],
  'linked-list__traversal': ['remove-duplicates-from-sorted-list-ii', 'partition-list', 'insert-greatest-common-divisors-in-linked-list'],
  'linked-list__reverse': ['reverse-linked-list-ii'],
  'linked-list__middle-node': ['maximum-twin-sum-of-a-linked-list'],
  'linked-list__fast-slow': ['reorder-list'],
  'linked-list__cycle': ['find-the-duplicate-number'],
  'linked-list__merge': ['merge-two-sorted-lists'],
  'bit-manipulation__bit-basics': ['counting-bits', 'reverse-bits', 'add-binary', 'sum-of-two-integers',
    'bitwise-and-of-numbers-range', 'minimum-array-end', 'minimum-flips-to-make-a-or-b-equal-to-c'],
  'bit-manipulation__xor-properties': ['single-number-ii'],
  'bit-manipulation__advanced-maths': ['happy-number', 'excel-sheet-column-title', 'factorial-trailing-zeroes'],
  'backtracking__subsets': ['sum-of-all-subset-xor-totals'],
  'backtracking__combinations': ['combinations'],
  'backtracking__permutations': ['permutations', 'permutations-ii'],
  'backtracking__constraint-problems': ['matchsticks-to-square', 'partition-to-k-equal-sum-subsets', 'word-break-ii'],
  'backtracking__n-queens': ['n-queens-ii'],
  'stack-queue__basic-stack': ['baseball-game', 'simplify-path', 'decode-string', 'removing-stars-from-a-string', 'maximum-frequency-stack'],
  'stack-queue__basic-queue': ['design-circular-queue', 'dota2-senate', 'number-of-recent-calls'],
  'stack-queue__expression-problems': ['evaluate-reverse-polish-notation', 'basic-calculator'],
  'stack-queue__monotonic-stack': ['car-fleet'],
  'stack-queue__next-greater-pattern': ['daily-temperatures'],
  'heaps__heap-basics': ['last-stone-weight', 'smallest-number-in-infinite-set'],
  'heaps__top-k-elements': ['k-closest-points-to-origin', 'find-k-pairs-with-smallest-sums'],
  'heaps__two-heaps': ['total-cost-to-hire-k-workers', 'ipo'],
  'heaps__heap-with-greedy': ['single-threaded-cpu', 'reorganize-string', 'longest-happy-string', 'maximum-subsequence-score',
    'minimum-interval-to-include-each-query', 'meeting-rooms-iii'],
  'greedy__basic-greedy': ['can-place-flowers', 'increasing-triplet-subsequence', 'gas-station', 'merge-triplets-to-form-target-triplet'],
  'greedy__activity-selection': ['meeting-rooms-ii', 'minimum-number-of-arrows-to-burst-balloons'],
  'greedy__jump-game-pattern': ['jump-game-vii'],
  'trees__dfs-traversals': ['leaf-similar-trees', 'delete-leaves-with-a-given-value'],
  'trees__bfs-traversals': ['average-of-levels-in-binary-tree', 'populating-next-right-pointers-in-each-node-ii', 'maximum-level-sum-of-a-binary-tree'],
  'trees__tree-properties': ['invert-binary-tree', 'subtree-of-another-tree', 'longest-zigzag-path-in-a-binary-tree'],
  'trees__root-to-leaf-problems': ['path-sum', 'count-good-nodes-in-binary-tree', 'sum-root-to-leaf-numbers', 'path-sum-iii'],
  'trees__construction': ['construct-quad-tree'],
  'trees__advanced-trees': ['house-robber-iii'],
  'bst__order-statistics': ['minimum-absolute-difference-in-bst'],
  'bst__construction': ['convert-sorted-array-to-binary-search-tree'],
  'bst__advanced-bst': ['binary-search-tree-iterator'],
  'graphs__representation': ['find-the-town-judge'],
  'graphs__bfs': ['walls-and-gates', 'open-the-lock', 'snakes-and-ladders', 'minimum-genetic-mutation', 'nearest-exit-from-entrance-in-maze'],
  'graphs__dfs': ['island-perimeter', 'clone-graph', 'pacific-atlantic-water-flow', 'evaluate-division', 'keys-and-rooms',
    'reorder-routes-to-make-all-paths-lead-to-the-city-zero', 'reconstruct-itinerary'],
  'graphs__connected-components': ['max-area-of-island'],
  'graphs__topological-sort': ['course-schedule-iv', 'minimum-height-trees', 'build-a-matrix-with-conditions'],
  'graphs__minimum-spanning-tree': ['min-cost-to-connect-all-points', 'find-critical-and-pseudo-critical-edges-in-minimum-spanning-tree'],
  'graphs__union-find': ['redundant-connection', 'graph-valid-tree', 'greatest-common-divisor-traversal'],
  'dp__1d-dp': ['decode-ways', 'integer-break', 'stone-game-ii', 'stone-game-iii'],
  'dp__fibonacci-pattern': ['min-cost-climbing-stairs', 'n-th-tribonacci-number', 'domino-and-tromino-tiling'],
  'dp__knapsack': ['combination-sum-iv', 'perfect-squares'],
  'dp__grid-dp': ['minimum-path-sum', 'maximal-square', 'longest-increasing-path-in-a-matrix'],
  'dp__string-dp': ['palindromic-substrings', 'interleaving-string', 'regular-expression-matching'],
  'dp__partition-dp': ['stone-game'],
  'tries__trie-string-applications': ['design-add-and-search-words-data-structure', 'extra-characters-in-a-string',
    'search-suggestions-system', 'word-search-ii'],
};
// Patterns the sheet has no slot for. Created on first run, after the topic's last pattern.
const NEW_PATTERNS = { 'backtracking__permutations': { topic: 'backtracking', name: 'Permutations' } };

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
const norm = s => s.toLowerCase().replace(/\(.*?\)|\|.*$/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const lc = u => (u || '').match(/leetcode\.com\/problems\/([^/?#]+)/)?.[1];
const gf = u => (u || '').match(/geeksforgeeks\.org\/problems\/([^/?#]+)/)?.[1];
const SITES = { 'leetcode.com': 'LC', 'geeksforgeeks.org': 'GFG', 'takeuforward.org': 'TUF', 'lintcode.com': 'LintCode' };
const site = url => Object.entries(SITES).find(([host]) => url.includes(host))?.[1] || 'Link';
const DIFF = { E: 'Easy', M: 'Medium', H: 'Hard' };
const MINUTES = { E: '20', M: '35', H: '50' };

for (const [id, { topic, name }] of Object.entries(NEW_PATTERNS)) {
  const t = data.topics.find(t => t.id === topic);
  if (!t.patterns.some(p => p.id === id)) t.patterns.push({ id, name, problems: [] });
}
const patternById = new Map(data.topics.flatMap(t => t.patterns.map(p => [p.id, { p, t }])));
const mine = data.topics.flatMap(t => t.patterns.flatMap(p => p.problems.map(q => ({ q, t }))));
const mineById = new Map(mine.map(x => [x.q.id, x]));
const by = { lc: new Map(), gfg: new Map(), title: new Map() };
for (const { q } of mine) {
  if (lc(q.link)) by.lc.set(lc(q.link), q);
  if (gf(gfg[q.id] || q.link)) by.gfg.set(gf(gfg[q.id] || q.link), q);
  by.title.set(norm(q.question), q);
}

// One-to-one matching, strongest evidence first: alias, exact title, LeetCode slug, GFG slug.
const H = his.topics.flatMap(t => t.questions.map(h => ({ h, t })));
const links = h => [h.url, ...Object.values(h.alt || {})];
const tiers = [
  ({ h }) => [ALIAS[h.id] && mineById.get(ALIAS[h.id])?.q],
  ({ h }) => [by.title.get(norm(h.title))],
  ({ h }) => links(h).map(lc).filter(Boolean).map(s => by.lc.get(s)),
  ({ h }) => links(h).map(gf).filter(Boolean).map(s => by.gfg.get(s)),
];
const pick = new Map(), taken = new Set();
for (const tier of tiers) for (const x of H) {
  if (pick.has(x.h.id)) continue;
  const m = tier(x).find(q => q && !taken.has(q.id) && NOT_SAME[x.h.id] !== q.id);
  if (m) { pick.set(x.h.id, m); taken.add(m.id); }
}
for (const [hid, sid] of Object.entries(NOT_SAME))
  if (!mineById.has(sid)) throw new Error(`NOT_SAME ${hid} names unknown id ${sid}`);
for (const [hid, sid] of Object.entries(ALIAS))
  if (pick.get(hid)?.id !== sid) throw new Error(`alias ${hid} -> ${sid} did not resolve`);

const placeOf = new Map(Object.entries(PLACE).flatMap(([pid, ids]) => ids.map(id => [id, pid])));
const needsFor = (h, ownTopic) =>
  [...new Set(h.needs.map(n => TOPIC[n]))].filter(n => n && n !== ownTopic);

// Extras from his entry, minus links the row already shows.
function extras(h, q) {
  const shown = new Set([q.link, gfg[q.id]].filter(Boolean));
  const alt = { ...(q.alt || {}) };
  for (const u of links(h)) {
    if (shown.has(u) || Object.values(alt).includes(u)) continue;
    let k = site(u);
    for (let i = 2; alt[k]; i++) k = `${site(u)} ${i}`;
    alt[k] = u;
  }
  return {
    sources: [...new Set([...(q.sources || []), ...h.src])],
    ...(Object.keys(alt).length && { alt }),
    ...(h.video && { video: h.video }),
    ...(h.article && { article: h.article }),
    ...(h.premium && { premium: true }),
  };
}

let added = 0, enriched = 0;
const skipped = [], resolved = new Map(); // his id -> final id
for (const { h, t } of H) {
  const m = pick.get(h.id);
  if (m) {
    const { t: own } = mineById.get(m.id);
    const needs = needsFor(h, own.id);
    Object.assign(m, extras(h, m), needs.length ? { needs } : {});
    resolved.set(h.id, m.id);
    enriched++;
    continue;
  }
  if (!h.src.some(s => s !== 'A2Z')) { skipped.push(h.id); continue; }
  const pid = placeOf.get(h.id);
  if (!pid) throw new Error(`no PLACE entry for new question ${h.id} (${t.id} / ${h.group})`);
  const { p, t: own } = patternById.get(pid) ?? (() => { throw new Error(`unknown pattern ${pid}`); })();
  const id = `${pid}__${slugify(h.title)}`;
  if (mineById.has(id)) throw new Error(`id collision ${id}`);
  const freq = h.src.includes('B75') ? 'Very High' : h.src.some(s => s === 'NC150' || s === 'LC150') ? 'High' : 'Medium';
  const q = {
    id,
    subpattern: p.name,
    question: h.title,
    platform: lc(h.url) ? 'LeetCode' : site(h.url),
    link: h.url,
    difficulty: DIFF[h.diff],
    originalStep: '',
    estMinutes: MINUTES[h.diff],
    importance: freq === 'Medium' ? 'Medium' : 'High',
    interviewFreq: freq,
  };
  const needs = needsFor(h, own.id);
  Object.assign(q, extras(h, q), needs.length ? { needs } : {});
  p.problems.push(q);
  mineById.set(id, { q, t: own });
  resolved.set(h.id, id);
  added++;
}
for (const id of placeOf.keys()) if (!H.some(x => x.h.id === id)) throw new Error(`PLACE names unknown question ${id}`);

// Every sheet question (idRegistry.json is exactly the sheet's ids) is from Striver A2Z, matched or not.
const sheet = JSON.parse(fs.readFileSync('data/idRegistry.json', 'utf8'));
for (const { q } of mine) if (q.id in sheet && !q.sources?.includes('A2Z')) q.sources = ['A2Z', ...(q.sources || [])];

const NOTES = {
  fundamentals: ['basics', 'patterns', 'hashing', 'math'], recursion: ['recursion-basics'], sorting: ['sorting'],
  arrays: ['arrays', 'two-pointers', 'sliding-window'], 'binary-search': ['binary-search'], strings: ['strings'],
  'linked-list': ['linked-list'], 'bit-manipulation': ['bits', 'math'], backtracking: ['recursion'],
  'stack-queue': ['stack-queue'], heaps: ['heaps'], greedy: ['greedy'], trees: ['binary-trees'], bst: ['bst'],
  graphs: ['graphs'], dp: ['dp'], tries: ['tries'], 'advanced-strings': ['strings-advanced'],
};
for (const t of data.topics) {
  if (!PREREQS[t.id] || !NOTES[t.id]) throw new Error(`no PREREQS/NOTES entry for topic ${t.id}`);
  t.prereqs = PREREQS[t.id];
  t.notes = NOTES[t.id];
}

fs.writeFileSync(QUESTIONS, JSON.stringify(data, null, 1) + '\n');

// Blind 75: the sheet covered 51; the added questions fill in what it lacked.
const lists = JSON.parse(fs.readFileSync(LISTS, 'utf8'));
const b75 = lists.blind75;
const all = data.topics.flatMap(t => t.patterns.flatMap(p => p.problems));
// His B75 tags, except where the sheet has two rows for one problem and the list already holds the
// other, and his "Combination Sum" (LC 39): Blind's entry of that name links LC 377, Combination Sum IV.
const B75_SKIP = new Set([
  'linked-list__reverse__reverse-a-ll', 'graphs__topological-sort__course-schedule-i',
  'dp__lis-pattern__longest-increasing-subsequence-dp-43', 'backtracking__combination-sum__combination-sum',
]);
const covers = (q, title) => norm(q.question).includes(norm(title));
const fromAbsent = b75.absent.flatMap(title => all.filter(q => norm(q.question) === norm(title)).map(q => q.id));
b75.ids = [...new Set([...b75.ids, ...all.filter(q => q.sources?.includes('B75') && !B75_SKIP.has(q.id)).map(q => q.id), ...fromAbsent])];
const hisByTitle = H.filter(x => x.h.src.includes('B75')).map(x => [norm(x.h.title), x.h.id]);
b75.absent = b75.absent.filter(title => {
  const hid = hisByTitle.find(([n]) => n.includes(norm(title)))?.[1];
  return !(hid && b75.ids.includes(resolved.get(hid))) && !b75.ids.some(id => covers(mineById.get(id).q, title));
});
b75.note = `The canonical Blind 75. ${b75.ids.length} of the 75 are in this tracker` +
  (b75.absent.length ? `; the other ${b75.absent.length} are listed in \`absent\`.` : '.') +
  ' Ids are never invented to pad the list.';

// Goal lists, one per source. `a2z` is exactly the sheet (not his A2Z tags), so the default revision
// scope counts the same problems it did before the merge.
const SOURCE_LISTS = {
  a2z: ['Striver A2Z', 'The original Striver A2Z sheet this tracker was built from.', q => q.id in sheet],
  nc150: ['NeetCode 150', 'Every NeetCode 150 problem.', q => q.sources?.includes('NC150')],
  nc250: ['NeetCode 250', 'Every NeetCode 250 problem.', q => q.sources?.includes('NC250')],
  lc150: ['LeetCode Top 150', 'Every LeetCode Top Interview 150 problem.', q => q.sources?.includes('LC150')],
  lc75: ['LeetCode 75', 'Every LeetCode 75 problem.', q => q.sources?.includes('LC75')],
};
for (const [id, [label, note, has]] of Object.entries(SOURCE_LISTS)) {
  const ids = all.filter(has).map(q => q.id);
  lists[id] = { label, note, total: ids.length, ids, absent: [] };
}
fs.writeFileSync(LISTS, JSON.stringify(lists, null, 2) + '\n');

console.log(`enriched ${enriched}, added ${added}, skipped ${skipped.length} A2Z-only: ${skipped.join(', ')}`);
console.log(`total ${all.length} questions; blind75 ${b75.ids.length}/75, absent: ${JSON.stringify(b75.absent)}`);
