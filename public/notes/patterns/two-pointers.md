# Two Pointers

## When to use / signals

- The array is **sorted** (or you can sort it) and you need a pair / triplet / quadruplet with a target sum.
- "In place", "O(1) extra space", "remove / move / compact elements": a slow write pointer and a fast read pointer.
- Palindromes, reversing, comparing from both ends.
- Merging two sorted arrays or lists.
- Area / water between walls: the shorter side limits the answer, so move it.
- Brute force checks all pairs in O(n²), but a monotonic property lets you discard one side at every step.

## Templates

### Opposite ends (converging pointers)

```java
int l = 0, r = n - 1;
while (l < r) {
    if (found(l, r)) { record(l, r); l++; r--; }
    else if (needBigger(l, r)) l++;       // sorted: moving l right increases the value
    else r--;                             // moving r left decreases it
}
```

### Pair with target sum in a sorted array (Two Sum II)

```java
public int[] twoSum(int[] a, int target) {
    int l = 0, r = a.length - 1;
    while (l < r) {
        int sum = a[l] + a[r];
        if (sum == target) return new int[]{l + 1, r + 1};   // 1-indexed on LeetCode
        if (sum < target) l++; else r--;
    }
    return new int[]{-1, -1};
}
```

### Valid palindrome (skip non-alphanumerics)

```java
public boolean isPalindrome(String s) {
    int l = 0, r = s.length() - 1;
    while (l < r) {
        if (!Character.isLetterOrDigit(s.charAt(l))) l++;
        else if (!Character.isLetterOrDigit(s.charAt(r))) r--;
        else if (Character.toLowerCase(s.charAt(l++)) != Character.toLowerCase(s.charAt(r--))) return false;
    }
    return true;
}
```

### Container with most water

```java
public int maxArea(int[] h) {
    int l = 0, r = h.length - 1, best = 0;
    while (l < r) {
        best = Math.max(best, Math.min(h[l], h[r]) * (r - l));
        if (h[l] < h[r]) l++; else r--;   // the shorter wall caps the area; moving the taller can't help
    }
    return best;
}
```

### Trapping rain water

Water above index i = `min(maxLeft, maxRight) - h[i]`. With two pointers, the side with the smaller wall already knows its bound.

```java
public int trap(int[] h) {
    int l = 0, r = h.length - 1, leftMax = 0, rightMax = 0, water = 0;
    while (l < r) {
        if (h[l] < h[r]) {                        // right side has a wall >= h[l]: left is the bottleneck
            leftMax = Math.max(leftMax, h[l]);
            water += leftMax - h[l++];
        } else {
            rightMax = Math.max(rightMax, h[r]);
            water += rightMax - h[r--];
        }
    }
    return water;
}
// Easier to explain first: prefixMax[] and suffixMax[] arrays, O(n) space.
```

### Same direction: read pointer + write pointer

```java
// Remove duplicates from a sorted array, return the new length
public int removeDuplicates(int[] a) {
    if (a.length == 0) return 0;
    int k = 1;                                    // a[0..k-1] is the kept prefix
    for (int i = 1; i < a.length; i++)
        if (a[i] != a[k - 1]) a[k++] = a[i];
    return k;
}
// "Allow at most 2 copies": keep a[i] if k < 2 || a[i] != a[k - 2]

// Move zeroes to the end, keeping the order of non-zeros
public void moveZeroes(int[] a) {
    int k = 0;                                    // next slot for a non-zero
    for (int i = 0; i < a.length; i++)
        if (a[i] != 0) { int t = a[k]; a[k] = a[i]; a[i] = t; k++; }
}

// Merge two sorted arrays into a (which has room at the end): fill from the back
public void merge(int[] a, int m, int[] b, int n) {
    int i = m - 1, j = n - 1, k = m + n - 1;
    while (j >= 0) a[k--] = (i >= 0 && a[i] > b[j]) ? a[i--] : b[j--];
}
```

### Fast / slow on an array (Floyd on index links)

```java
// Find the duplicate in [1..n] values with n + 1 elements: treat i -> nums[i] as a linked list
public int findDuplicate(int[] nums) {
    int slow = nums[0], fast = nums[0];
    do { slow = nums[slow]; fast = nums[nums[fast]]; } while (slow != fast);
    slow = nums[0];
    while (slow != fast) { slow = nums[slow]; fast = nums[fast]; }
    return slow;                                  // cycle entrance = duplicate value
}
```

### 3Sum (sort + fix one + two pointers, skip duplicates)

```java
public List<List<Integer>> threeSum(int[] a) {
    Arrays.sort(a);
    List<List<Integer>> res = new ArrayList<>();
    for (int i = 0; i < a.length - 2; i++) {
        if (i > 0 && a[i] == a[i - 1]) continue;  // skip duplicate anchors
        if (a[i] > 0) break;                      // smallest is positive: no zero sum possible
        int l = i + 1, r = a.length - 1;
        while (l < r) {
            int sum = a[i] + a[l] + a[r];
            if (sum < 0) l++;
            else if (sum > 0) r--;
            else {
                res.add(Arrays.asList(a[i], a[l], a[r]));
                l++; r--;
                while (l < r && a[l] == a[l - 1]) l++;   // skip duplicate second values
                while (l < r && a[r] == a[r + 1]) r--;   // skip duplicate third values
            }
        }
    }
    return res;
}
```

### 4Sum (two fixed loops + two pointers)

```java
public List<List<Integer>> fourSum(int[] a, int target) {
    Arrays.sort(a);
    List<List<Integer>> res = new ArrayList<>();
    int n = a.length;
    for (int i = 0; i < n - 3; i++) {
        if (i > 0 && a[i] == a[i - 1]) continue;
        for (int j = i + 1; j < n - 2; j++) {
            if (j > i + 1 && a[j] == a[j - 1]) continue;  // "j > i + 1", not "j > 0"
            int l = j + 1, r = n - 1;
            while (l < r) {
                long sum = (long) a[i] + a[j] + a[l] + a[r];   // 4 ints can overflow
                if (sum < target) l++;
                else if (sum > target) r--;
                else {
                    res.add(Arrays.asList(a[i], a[j], a[l], a[r]));
                    l++; r--;
                    while (l < r && a[l] == a[l - 1]) l++;
                    while (l < r && a[r] == a[r + 1]) r--;
                }
            }
        }
    }
    return res;
}
// kSum generalises this: k - 2 nested loops, two pointers innermost => O(n^(k-1)).
```

## Complexity

| Problem | Time | Extra space |
|---|---|---|
| Pair sum in a sorted array | O(n) | O(1) |
| Valid palindrome | O(n) | O(1) |
| Container with most water | O(n) | O(1) |
| Trapping rain water (two pointers) | O(n) | O(1) |
| Remove duplicates / move zeroes | O(n) | O(1) |
| Merge sorted arrays | O(m + n) | O(1) |
| Find duplicate (Floyd) | O(n) | O(1) |
| 3Sum | O(n²) (+ O(n log n) sort) | O(1) besides output / sort |
| 4Sum | O(n³) | O(1) besides output / sort |

## Pitfalls

- Opposite-end pointers need sorted input (or another monotonic property). Unsorted Two Sum with required indices: use a hash map, since sorting loses the indices.
- `while (l < r)` for pairs of distinct indices; `l <= r` would pair an element with itself.
- Skip duplicates only after recording a match (or on the anchor loops), not before comparing.
- Duplicate check on inner anchors: `j > i + 1`, otherwise valid combinations are skipped.
- 4Sum sums overflow `int`; cast to `long`.
- Container: move the shorter wall; moving the taller one can never increase the area.
- Trapping water: process the side whose current height is smaller.
- Merge from the back when merging into the array that has spare capacity at the end.

## Must-know problems

- Two Sum II (Input Array Is Sorted)
- Valid Palindrome
- Reverse String
- Remove Duplicates from Sorted Array (I and II)
- Remove Element
- Move Zeroes
- Merge Sorted Array
- Squares of a Sorted Array
- Container With Most Water
- Trapping Rain Water
- 3Sum
- 3Sum Closest
- 4Sum
- Sort Colors
- Find the Duplicate Number
- Boats to Save People
- Is Subsequence
