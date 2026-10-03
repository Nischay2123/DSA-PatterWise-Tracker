# Greedy & Intervals

## When to use / signals

- "Maximum number of ...", "minimum number of ... to cover / remove / schedule" with a natural sort order.
- Intervals, meetings, trains, deadlines, events on a timeline.
- A local rule is obviously safe: "take the item with the best ratio", "finish earliest", "reach farthest".
- Constraints up to 10^5 or 10^6 that rule out O(n^2) DP, and there is a sort key.
- If you can build a small counterexample to the local rule, it is DP, not greedy.

## Templates

### Is greedy correct? (greedy choice property)

A greedy algorithm works when (1) some optimal solution contains the locally best choice (greedy choice property) and (2) after making it, what remains is a smaller instance of the same problem (optimal substructure). Ways to justify it in an interview:

- **Exchange argument**: take any optimal solution; if it does not use the greedy choice, swap one of its choices for the greedy one and show the result is no worse.
- **Greedy stays ahead**: show that after every step the greedy partial solution is at least as good as any other (e.g. greedy's k-th meeting ends no later than the optimal's k-th meeting).
- **Try to break it**: test tiny inputs. Coins `{1, 3, 4}`, amount 6: greedy picks `4 + 1 + 1` (3 coins), optimal is `3 + 3` (2 coins), so coin change needs DP. 0/1 knapsack also breaks greedy; fractional knapsack does not.

### Sort by start vs sort by end

| Goal | Sort by | Why |
|---|---|---|
| Merge overlaps, insert, union, total covered length | start | overlapping intervals become adjacent; compare only with the last merged one |
| Max non-overlapping set, min removals, min arrows to burst balloons | end | finishing earliest leaves the most room for the rest (exchange argument) |
| Max concurrent / min rooms or platforms | starts and ends separately (sweep), or start + min-heap of ends | count how many are active at once |
| Job deadlines with profits | profit (desc), then fill latest free slot | the most valuable job gets the latest slot it can use |

### Assign cookies

```java
int findContentChildren(int[] greed, int[] size) {
    Arrays.sort(greed);
    Arrays.sort(size);
    int child = 0;
    for (int c = 0; c < size.length && child < greed.length; c++)
        if (size[c] >= greed[child]) child++;         // smallest cookie that satisfies the least greedy child
    return child;
}
```

### Fractional knapsack

```java
double fractionalKnapsack(int[] val, int[] wt, int cap) {
    int n = val.length;
    Integer[] idx = new Integer[n];
    for (int i = 0; i < n; i++) idx[i] = i;
    // value/weight descending, compared by cross-multiplication (no floating point)
    Arrays.sort(idx, (a, b) -> Long.compare((long) val[b] * wt[a], (long) val[a] * wt[b]));
    double total = 0;
    for (int i : idx) {
        if (cap == 0) break;
        int take = Math.min(cap, wt[i]);              // whole item, or the fraction that fits
        total += (double) val[i] * take / wt[i];
        cap -= take;
    }
    return total;
}
```

### Jump game I and II

```java
boolean canJump(int[] nums) {
    int reach = 0;                                    // farthest index reachable so far
    for (int i = 0; i < nums.length; i++) {
        if (i > reach) return false;                  // stuck before i
        reach = Math.max(reach, i + nums[i]);
    }
    return true;
}

int jump(int[] nums) {                                // min jumps, implicit BFS by levels
    int jumps = 0, curEnd = 0, farthest = 0;
    for (int i = 0; i < nums.length - 1; i++) {       // stop before the last index
        farthest = Math.max(farthest, i + nums[i]);
        if (i == curEnd) {                            // current level exhausted: jump
            jumps++;
            curEnd = farthest;
        }
    }
    return jumps;
}
```

### Activity selection / N meetings in one room (sort by end)

```java
int maxMeetings(int[] start, int[] end) {
    int n = start.length;
    int[][] m = new int[n][];
    for (int i = 0; i < n; i++) m[i] = new int[]{start[i], end[i]};
    Arrays.sort(m, (a, b) -> Integer.compare(a[1], b[1]));   // earliest finish first
    int count = 0, lastEnd = Integer.MIN_VALUE;
    for (int[] x : m) {
        if (x[0] > lastEnd) {                         // strict: the GfG version forbids touching
            count++;
            lastEnd = x[1];
        }
    }
    return count;
}
```

### Merge intervals (sort by start)

```java
int[][] merge(int[][] intervals) {
    Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]));
    List<int[]> res = new ArrayList<>();
    for (int[] cur : intervals) {
        if (res.isEmpty() || res.get(res.size() - 1)[1] < cur[0]) res.add(cur);   // gap: new block
        else {
            int[] last = res.get(res.size() - 1);
            last[1] = Math.max(last[1], cur[1]);      // overlap: extend
        }
    }
    return res.toArray(new int[0][]);
}
```

### Insert interval (input already sorted, three phases)

```java
int[][] insert(int[][] intervals, int[] newInterval) {
    List<int[]> res = new ArrayList<>();
    int i = 0, n = intervals.length;
    int s = newInterval[0], e = newInterval[1];
    while (i < n && intervals[i][1] < s) res.add(intervals[i++]);   // 1) entirely to the left
    while (i < n && intervals[i][0] <= e) {                          // 2) overlapping: absorb
        s = Math.min(s, intervals[i][0]);
        e = Math.max(e, intervals[i][1]);
        i++;
    }
    res.add(new int[]{s, e});
    while (i < n) res.add(intervals[i++]);                           // 3) entirely to the right
    return res.toArray(new int[0][]);
}
```

### Non-overlapping intervals (min removals, sort by end)

```java
int eraseOverlapIntervals(int[][] intervals) {
    Arrays.sort(intervals, (a, b) -> Integer.compare(a[1], b[1]));
    int keep = 0;
    long lastEnd = Long.MIN_VALUE;
    for (int[] x : intervals) {
        if (x[0] >= lastEnd) {                        // touching [1,2],[2,3] is allowed here
            keep++;
            lastEnd = x[1];
        }
    }
    return intervals.length - keep;                   // remove everything we could not keep
}
// Min arrows to burst balloons: same loop with x[0] > lastEnd, answer = keep.
```

### Minimum platforms (sweep over sorted starts and ends)

```java
int findPlatform(int[] arr, int[] dep) {
    Arrays.sort(arr);
    Arrays.sort(dep);
    int plat = 0, best = 0, i = 0, j = 0;
    while (i < arr.length) {
        if (arr[i] <= dep[j]) { plat++; i++; }        // arrival before (or at) the next departure
        else { plat--; j++; }                         // a train leaves first
        best = Math.max(best, plat);
    }
    return best;
}
// Meeting Rooms II is the same sweep (use < instead of <= if a room frees up exactly at its end time).
```

### Job sequencing (profit desc, latest free slot)

```java
int[] jobScheduling(int[][] jobs) {                  // jobs[i] = {id, deadline, profit}
    Arrays.sort(jobs, (a, b) -> Integer.compare(b[2], a[2]));   // most profitable first
    int maxD = 0;
    for (int[] j : jobs) maxD = Math.max(maxD, j[1]);
    boolean[] used = new boolean[maxD + 1];           // time slots 1..maxD
    int count = 0, profit = 0;
    for (int[] j : jobs) {
        for (int t = j[1]; t > 0; t--) {              // latest free slot on or before the deadline
            if (!used[t]) { used[t] = true; count++; profit += j[2]; break; }
        }
    }
    return new int[]{count, profit};
}
// ponytail: O(n * maxDeadline) slot scan; a DSU "next free slot" makes it O(n log n) if deadlines are huge.
```

### Candy (two passes)

```java
int candy(int[] ratings) {
    int n = ratings.length;
    int[] c = new int[n];
    Arrays.fill(c, 1);
    for (int i = 1; i < n; i++)                       // satisfy left neighbours
        if (ratings[i] > ratings[i - 1]) c[i] = c[i - 1] + 1;
    for (int i = n - 2; i >= 0; i--)                  // satisfy right neighbours, keep the left result
        if (ratings[i] > ratings[i + 1]) c[i] = Math.max(c[i], c[i + 1] + 1);
    int sum = 0;
    for (int x : c) sum += x;
    return sum;
}
```

### Gas station

```java
int canCompleteCircuit(int[] gas, int[] cost) {
    int total = 0, tank = 0, start = 0;
    for (int i = 0; i < gas.length; i++) {
        int diff = gas[i] - cost[i];
        total += diff;
        tank += diff;
        if (tank < 0) {                               // no station in [start, i] can reach i + 1
            start = i + 1;
            tank = 0;
        }
    }
    return total >= 0 ? start : -1;                   // enough gas overall means start works
}
```

## Complexity

| Problem | Time | Space |
|---|---|---|
| Assign cookies | O(n log n + m log m) | O(1) |
| Fractional knapsack | O(n log n) | O(n) |
| Jump game I / II | O(n) | O(1) |
| N meetings / activity selection | O(n log n) | O(n) |
| Merge / non-overlapping intervals | O(n log n) | O(n) |
| Insert interval | O(n) | O(n) |
| Minimum platforms | O(n log n) | O(1) |
| Job sequencing | O(n log n + n * maxDeadline) | O(maxDeadline) |
| Candy | O(n) | O(n) |
| Gas station | O(n) | O(1) |

## Pitfalls

- Comparator overflow: `(a, b) -> a[0] - b[0]` breaks for large or negative values. Use `Integer.compare`.
- Touching intervals: decide per problem whether `[1,2]` and `[2,3]` overlap (`<` vs `<=`). Read the statement.
- Sorting by the wrong key: max non-overlapping by start fails on `[1,10], [2,3], [4,5]`.
- Greedy on 0/1 knapsack or arbitrary coin systems is wrong; switch to DP.
- `lastEnd` initialised to `0` breaks when intervals start at negative values; use `Long.MIN_VALUE` or the first interval.
- Jump game II: looping to `n - 1` inclusive adds an extra jump when `curEnd` lands exactly on the last index.
- Merge intervals: `res.toArray(new int[0][])`, not `(int[][]) res.toArray()`.
- Floating point ratios: compare by cross-multiplying in `long`.

## Must-know problems

- Assign Cookies
- Lemonade Change
- Valid Parenthesis String
- Fractional Knapsack
- Jump Game, Jump Game II
- N Meetings in One Room / Activity Selection
- Merge Intervals
- Insert Interval
- Non-overlapping Intervals
- Minimum Number of Arrows to Burst Balloons
- Minimum Platforms / Meeting Rooms II
- Job Sequencing Problem
- Shortest Job First (CPU scheduling)
- Candy
- Gas Station
- Partition Labels
- Minimum Coins (canonical coin system)
