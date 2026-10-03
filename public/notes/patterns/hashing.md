# Hashing

## When to use / signals

- "Count the frequency", "most / least frequent", "first unique / first repeating element".
- "Have I seen this before?": duplicates, complements (`target - x`), cycle detection by state.
- "Two elements that sum to K" in an unsorted array.
- "Number of subarrays / longest subarray with sum (or XOR) = K": prefix value + hash map.
- Anagrams, grouping by a signature, isomorphic mappings.
- Brute force is O(n²) because of an inner search: replace the inner search with an O(1) lookup.

## Templates

### Array hashing (small, known key range)

```java
int[] freq = new int[26];                  // lowercase letters only
for (char c : s.toCharArray()) freq[c - 'a']++;

int[] freq256 = new int[256];              // any extended ASCII character
for (char c : s.toCharArray()) freq256[c]++;

// Integers in [0, maxVal]: precompute once, answer each query in O(1)
int[] hash = new int[maxVal + 1];
for (int x : arr) hash[x]++;
int countOf7 = hash[7];
```

Use an array when keys are small non-negative ints (up to ~1e7). It is faster than `HashMap` and has no boxing.

### HashMap / HashSet (large, negative or sparse keys)

```java
Map<Integer, Integer> freq = new HashMap<>();
for (int x : arr) freq.merge(x, 1, Integer::sum);     // same as put(x, getOrDefault(x, 0) + 1)

int c = freq.getOrDefault(key, 0);                     // never unbox a possible null

// Highest / lowest frequency element
int best = -1, bestCount = 0;
for (Map.Entry<Integer, Integer> e : freq.entrySet())
    if (e.getValue() > bestCount) { bestCount = e.getValue(); best = e.getKey(); }

Set<Integer> seen = new HashSet<>();
for (int x : arr) if (!seen.add(x)) System.out.println("duplicate " + x);  // add() returns false if present
```

### The counting pattern: query first, then insert

For each element: (1) look up what you need in the map, (2) update the answer, (3) record the current element. Querying before inserting avoids pairing an element with itself.

```java
public int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> seen = new HashMap<>();        // value -> index
    for (int i = 0; i < nums.length; i++) {
        Integer j = seen.get(target - nums[i]);           // 1. query the complement
        if (j != null) return new int[]{j, i};            // 2. answer
        seen.put(nums[i], i);                             // 3. insert current
    }
    return new int[]{-1, -1};
}
```

### Prefix hashing: prefix sum + map

A subarray `(j, i]` has sum `k` exactly when `prefix[i] - prefix[j] == k`, i.e. `prefix[j] == prefix[i] - k`. Store how often (or where first) each prefix value occurred.

```java
// Count subarrays with sum == k (works with negatives)
public int subarraySum(int[] nums, int k) {
    Map<Integer, Integer> count = new HashMap<>();
    count.put(0, 1);                                      // the empty prefix
    int prefix = 0, ans = 0;
    for (int x : nums) {
        prefix += x;
        ans += count.getOrDefault(prefix - k, 0);         // earlier prefixes that complete sum k
        count.merge(prefix, 1, Integer::sum);
    }
    return ans;
}

// Longest subarray with sum == k: store the FIRST index of each prefix
int longestSubarrayWithSumK(int[] a, long k) {
    Map<Long, Integer> first = new HashMap<>();
    first.put(0L, -1);
    long prefix = 0;
    int best = 0;
    for (int i = 0; i < a.length; i++) {
        prefix += a[i];
        Integer j = first.get(prefix - k);
        if (j != null) best = Math.max(best, i - j);
        first.putIfAbsent(prefix, i);                     // keep earliest => longest window
    }
    return best;
}
// XOR version: replace "+" with "^" and "prefix - k" with "prefix ^ k".
```

### Signature hashing (group by a canonical key)

```java
public List<List<String>> groupAnagrams(String[] strs) {
    Map<String, List<String>> groups = new HashMap<>();
    for (String s : strs) {
        int[] f = new int[26];
        for (char c : s.toCharArray()) f[c - 'a']++;
        String key = Arrays.toString(f);                  // or: sort the chars
        groups.computeIfAbsent(key, x -> new ArrayList<>()).add(s);
    }
    return new ArrayList<>(groups.values());
}
```

### Set membership: longest consecutive sequence

```java
public int longestConsecutive(int[] nums) {
    Set<Integer> set = new HashSet<>();
    for (int x : nums) set.add(x);
    int best = 0;
    for (int x : set) {
        if (set.contains(x - 1)) continue;                // only start at a sequence head
        int len = 1;
        while (set.contains(x + len)) len++;
        best = Math.max(best, len);
    }
    return best;                                          // O(n): each number visited twice max
}
```

### String prefix hash (rolling hash, O(1) substring compare)

```java
long MOD = 1_000_000_007L, B = 131;
long[] h = new long[n + 1], pw = new long[n + 1];
pw[0] = 1;
for (int i = 0; i < n; i++) {
    h[i + 1] = (h[i] * B + s.charAt(i)) % MOD;
    pw[i + 1] = pw[i] * B % MOD;
}
// hash of s[l..r) :
long sub = ((h[r] - h[l] * pw[r - l]) % MOD + MOD) % MOD;
```

### How Java's HashMap works (interview talking points)

- `index = hash(key) & (capacity - 1)`; collisions are chained in a bucket.
- Since Java 8, a bucket with more than 8 entries turns into a red-black tree (if keys are `Comparable`).
- Load factor 0.75: when `size > 0.75 × capacity`, the table doubles and rehashes (amortised O(1)).
- Keys must implement `equals` and `hashCode` consistently; never mutate a key after inserting it.

## Complexity

| Operation | Array hash | HashMap / HashSet (average) | HashMap worst case | TreeMap |
|---|---|---|---|---|
| Insert / update | O(1) | O(1) amortised | O(n) chain, O(log n) treeified bucket | O(log n) |
| Lookup | O(1) | O(1) | O(n) / O(log n) | O(log n) |
| Iterate in key order | O(range) | not ordered | not ordered | O(n) |
| Space | O(range) | O(distinct keys) | O(distinct keys) | O(distinct keys) |

| Template | Time | Space |
|---|---|---|
| Frequency count | O(n) | O(k) distinct |
| Two Sum with map | O(n) | O(n) |
| Subarray sum / XOR = K count | O(n) | O(n) |
| Group anagrams | O(n · L) | O(n · L) |
| Longest consecutive sequence | O(n) | O(n) |

Worst case happens when many keys collide (adversarial inputs, bad `hashCode`). On LeetCode assume O(1); on Codeforces hacks, consider shuffling or a custom hash.

## Pitfalls

- `Integer` objects compared with `==` only work in the cache range -128..127. Use `.equals()` or unbox to `int`.
- `map.get(k)` returns `null` for missing keys; `int x = map.get(k)` then throws `NullPointerException`.
- Forgetting `count.put(0, 1)` (or `first.put(0, -1)`) misses subarrays that start at index 0.
- Prefix sums overflow `int` for large inputs; use `long` keys.
- For "longest", store the first index with `putIfAbsent`; for "count", store frequencies.
- `c - 'a'` assumes lowercase letters; mixed input needs `int[128]` or `int[256]`.
- `HashMap` has no order; use `LinkedHashMap` for insertion order or `TreeMap` for sorted keys.
- Modifying a map while iterating over it throws `ConcurrentModificationException`.
- `freq.merge(x, -1, Integer::sum)` leaves keys with value 0; remove them if you rely on `size()`.

## Must-know problems

- Count Frequency of Each Element
- Highest / Lowest Frequency Element
- Two Sum
- Contains Duplicate
- Valid Anagram
- Group Anagrams
- First Unique Character in a String
- Isomorphic Strings
- Longest Consecutive Sequence
- Majority Element
- Top K Frequent Elements
- Subarray Sum Equals K
- Longest Subarray with Sum K (with negatives)
- Largest Subarray with 0 Sum
- Count Subarrays with XOR K
- Sort Characters by Frequency
