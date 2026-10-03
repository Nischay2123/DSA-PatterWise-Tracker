# Arrays

## When to use / signals

- "Sum of range l..r", many range queries: **prefix sum**.
- "Maximum sum contiguous subarray": **Kadane**.
- Only values 0, 1, 2 (or 3 categories): **Dutch national flag**.
- "Element appearing more than n/2 (n/3) times" in O(1) space: **Moore's voting**.
- "Next lexicographically greater arrangement": **next permutation**.
- "Rotate by k in O(1) space": **reversal algorithm**.
- "Greater than everything to its right": **scan from the right** (leaders).
- "Count subarrays with sum k" and negatives are allowed: **prefix sum + hash map**.
- Overlapping ranges: **sort by start, then merge**.
- Matrix transforms (rotate, spiral, zero rows/cols): **index tricks and boundary pointers**.

## Templates

```java
static void swap(int[] a, int i, int j) { int t = a[i]; a[i] = a[j]; a[j] = t; }
static void reverse(int[] a, int l, int r) { while (l < r) swap(a, l++, r--); }
```

### Prefix sum

```java
long[] pre = new long[n + 1];                  // pre[i] = a[0] + ... + a[i-1]
for (int i = 0; i < n; i++) pre[i + 1] = pre[i] + a[i];
long rangeSum = pre[r + 1] - pre[l];           // sum of a[l..r] inclusive, O(1)
```

### Kadane (max subarray sum, and printing the subarray)

```java
int[] maxSubarray(int[] a) {                   // returns the best subarray itself
    int cur = 0, best = a[0], start = 0, bestL = 0, bestR = 0;
    for (int i = 0; i < a.length; i++) {
        if (cur <= 0) { cur = a[i]; start = i; }   // a non-positive prefix only hurts: restart
        else cur += a[i];
        if (cur > best) { best = cur; bestL = start; bestR = i; }
    }
    return Arrays.copyOfRange(a, bestL, bestR + 1); // sum = best
}
```

### Dutch national flag (sort 0s, 1s, 2s in one pass)

```java
public void sortColors(int[] a) {
    int low = 0, mid = 0, high = a.length - 1;
    // [0, low) = 0s | [low, mid) = 1s | [mid, high] = unknown | (high, n-1] = 2s
    while (mid <= high) {
        if (a[mid] == 0) swap(a, low++, mid++);
        else if (a[mid] == 1) mid++;
        else swap(a, mid, high--);             // do NOT advance mid: new a[mid] is unchecked
    }
}
```

### Moore's voting (majority > n/2 and > n/3)

```java
public int majorityElement(int[] a) {          // > n/2 (guaranteed to exist on LeetCode)
    int cand = 0, cnt = 0;
    for (int x : a) {
        if (cnt == 0) cand = x;
        cnt += (x == cand) ? 1 : -1;           // pair off different values
    }
    return cand;                               // verify with a count if not guaranteed
}

public List<Integer> majorityElementII(int[] a) {   // > n/3: at most 2 answers
    int c1 = 0, c2 = 0, n1 = 0, n2 = 0;
    for (int x : a) {
        if (x == c1) n1++;
        else if (x == c2) n2++;
        else if (n1 == 0) { c1 = x; n1 = 1; }
        else if (n2 == 0) { c2 = x; n2 = 1; }
        else { n1--; n2--; }                   // x cancels one of each candidate
    }
    n1 = n2 = 0;                               // second pass: verify
    for (int x : a) { if (x == c1) n1++; else if (x == c2) n2++; }
    List<Integer> res = new ArrayList<>();
    if (n1 > a.length / 3) res.add(c1);
    if (n2 > a.length / 3) res.add(c2);
    return res;
}
```

### Next permutation

```java
public void nextPermutation(int[] a) {
    int n = a.length, i = n - 2;
    while (i >= 0 && a[i] >= a[i + 1]) i--;    // 1. rightmost "dip" a[i] < a[i+1]
    if (i >= 0) {
        int j = n - 1;
        while (a[j] <= a[i]) j--;              // 2. rightmost element bigger than a[i]
        swap(a, i, j);
    }
    reverse(a, i + 1, n - 1);                  // 3. suffix was descending: make it ascending
}                                              // (i = -1 => last permutation wraps to first)
```

### Rotate by k (reversal algorithm)

```java
public void rotateRight(int[] a, int k) {
    int n = a.length;
    k %= n;                                    // k may exceed n
    reverse(a, 0, n - 1);                      // [1,2,3,4,5], k=2 -> [5,4,3,2,1]
    reverse(a, 0, k - 1);                      //                 -> [4,5,3,2,1]
    reverse(a, k, n - 1);                      //                 -> [4,5,1,2,3]
}
// Left rotate by k: reverse(0, k-1), reverse(k, n-1), reverse(0, n-1).
```

### Leaders (greater than every element to the right)

```java
List<Integer> leaders(int[] a) {
    List<Integer> res = new ArrayList<>();
    int maxRight = Integer.MIN_VALUE;
    for (int i = a.length - 1; i >= 0; i--)
        if (a[i] > maxRight) { res.add(a[i]); maxRight = a[i]; }   // ">=" if ties count
    Collections.reverse(res);                  // restore left-to-right order
    return res;
}
```

### Count subarrays with sum k (prefix sum + hash map)

```java
public int subarraySum(int[] nums, int k) {
    Map<Integer, Integer> seen = new HashMap<>();
    seen.put(0, 1);                            // empty prefix
    int prefix = 0, count = 0;
    for (int x : nums) {
        prefix += x;
        count += seen.getOrDefault(prefix - k, 0);   // subarrays ending here with sum k
        seen.merge(prefix, 1, Integer::sum);
    }
    return count;
}
// Only non-negative numbers and "longest subarray with sum k"? A sliding window is O(1) space.
```

### Merge intervals (preview)

```java
public int[][] merge(int[][] intervals) {
    Arrays.sort(intervals, (x, y) -> Integer.compare(x[0], y[0]));
    List<int[]> res = new ArrayList<>();
    for (int[] cur : intervals) {
        if (res.isEmpty() || res.get(res.size() - 1)[1] < cur[0]) res.add(cur);  // gap: new block
        else res.get(res.size() - 1)[1] = Math.max(res.get(res.size() - 1)[1], cur[1]);
    }
    return res.toArray(new int[0][]);
}
```

### 2D matrix tricks

```java
// Rotate 90 degrees clockwise in place: transpose, then reverse each row
public void rotate(int[][] m) {
    int n = m.length;
    for (int i = 0; i < n; i++)
        for (int j = i + 1; j < n; j++) { int t = m[i][j]; m[i][j] = m[j][i]; m[j][i] = t; }
    for (int[] row : m) reverse(row, 0, n - 1);
}   // Anticlockwise: transpose, then reverse each column (or reverse the row order).

// Spiral order: shrink four boundaries
public List<Integer> spiralOrder(int[][] m) {
    List<Integer> res = new ArrayList<>();
    int top = 0, bottom = m.length - 1, left = 0, right = m[0].length - 1;
    while (top <= bottom && left <= right) {
        for (int j = left; j <= right; j++) res.add(m[top][j]);
        top++;
        for (int i = top; i <= bottom; i++) res.add(m[i][right]);
        right--;
        if (top <= bottom) { for (int j = right; j >= left; j--) res.add(m[bottom][j]); bottom--; }
        if (left <= right) { for (int i = bottom; i >= top; i--) res.add(m[i][left]); left++; }
    }
    return res;
}

// Set matrix zeroes in O(1) space: row 0 / column 0 act as marker arrays
public void setZeroes(int[][] m) {
    int rows = m.length, cols = m[0].length;
    boolean firstColZero = false;
    for (int i = 0; i < rows; i++) {
        if (m[i][0] == 0) firstColZero = true;
        for (int j = 1; j < cols; j++)
            if (m[i][j] == 0) { m[i][0] = 0; m[0][j] = 0; }
    }
    for (int i = rows - 1; i >= 0; i--) {      // bottom-up so row 0 markers are read last
        for (int j = cols - 1; j >= 1; j--)
            if (m[i][0] == 0 || m[0][j] == 0) m[i][j] = 0;
        if (firstColZero) m[i][0] = 0;
    }
}   // Simpler O(m + n) version: boolean[] zeroRow, zeroCol.
```

## Complexity

| Pattern | Time | Extra space |
|---|---|---|
| Prefix sum build / query | O(n) / O(1) | O(n) |
| Kadane (with indices) | O(n) | O(1) |
| Dutch national flag | O(n), one pass | O(1) |
| Moore's voting n/2, n/3 | O(n) | O(1) |
| Next permutation | O(n) | O(1) |
| Rotate by k (reversal) | O(n) | O(1) |
| Leaders | O(n) | O(1) besides output |
| Subarray sum = k (map) | O(n) average | O(n) |
| Merge intervals | O(n log n) | O(n) |
| Rotate matrix n × n | O(n²) | O(1) |
| Spiral order m × n | O(m · n) | O(1) besides output |
| Set matrix zeroes | O(m · n) | O(1) |

## Pitfalls

- Rotation: always `k %= n`, and guard `n == 0`.
- Kadane: do not initialise `best = 0`; an all-negative array must return its largest element.
- Moore's voting only finds a candidate; verify it when a majority is not guaranteed.
- DNF: after swapping with `high`, keep `mid` where it is.
- Next permutation: use `>=` / `<=` in the scans so duplicates work.
- Prefix sums overflow `int` quickly; use `long`.
- Subarray sum with negatives: a sliding window is wrong, use the hash map.
- Spiral: the two `if` checks stop a single remaining row or column from being printed twice.
- Set zeroes: marking cells to 0 during the first scan corrupts later reads; use markers.
- `Arrays.asList(int[])` gives a `List<int[]>` of size 1, not a list of ints.

## Must-know problems

- Largest Element / Second Largest Element
- Check if Array Is Sorted and Rotated
- Remove Duplicates from Sorted Array
- Rotate Array (left by one, by k)
- Move Zeroes
- Union of Two Sorted Arrays
- Missing Number
- Max Consecutive Ones
- Single Number
- Longest Subarray with Sum K (positives / with negatives)
- Two Sum
- Sort Colors
- Majority Element I and II
- Maximum Subarray (Kadane, print the subarray)
- Best Time to Buy and Sell Stock
- Rearrange Array Elements by Sign
- Next Permutation
- Leaders in an Array
- Longest Consecutive Sequence
- Set Matrix Zeroes
- Rotate Image
- Spiral Matrix
- Subarray Sum Equals K
- Pascal's Triangle
- Count Subarrays with XOR K
- Merge Intervals
- Merge Two Sorted Arrays Without Extra Space
- Find the Repeating and Missing Number
- Maximum Product Subarray
