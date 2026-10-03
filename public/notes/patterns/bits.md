# Bit Manipulation

## When to use / signals

- "Every element appears twice (or thrice) except one": XOR, or count each bit position.
- `n <= 20` (sometimes up to 25): enumerate all subsets as bitmasks (2^20 is about 10^6).
- "Without using `*`, `/` or `%`": shifts plus subtraction.
- Parity, powers of two, toggling flags, packing many booleans into one `int`/`long` (bitmask DP, visited sets).
- XOR of a range, of all pairs, or of prefixes (prefix XOR works exactly like prefix sums).

## Templates

### Operators

| Operator | Meaning | Example with `a = 5 (101)`, `b = 3 (011)` |
|---|---|---|
| `a & b` | AND: 1 only if both bits are 1 | `001` = 1 |
| `a \| b` | OR: 1 if either bit is 1 | `111` = 7 |
| `a ^ b` | XOR: 1 if bits differ | `110` = 6 |
| `~a` | NOT (flip all 32 bits), equals `-a - 1` | `-6` |
| `a << k` | left shift, equals `a * 2^k` (if no overflow) | `5 << 1` = 10 |
| `a >> k` | arithmetic right shift, keeps the sign, `floor(a / 2^k)` | `-8 >> 1` = -4 |
| `a >>> k` | logical right shift, fills with 0 | `-8 >>> 28` = 15 |

Negative numbers are stored in two's complement: `-x == ~x + 1`.

### Single-bit tricks

```java
boolean isSet(int n, int i)  { return ((n >> i) & 1) == 1; }   // or (n & (1 << i)) != 0
int setBit(int n, int i)     { return n | (1 << i); }
int clearBit(int n, int i)   { return n & ~(1 << i); }
int toggleBit(int n, int i)  { return n ^ (1 << i); }
int dropLowest(int n)        { return n & (n - 1); }          // clear the rightmost set bit
int lowestBit(int n)         { return n & -n; }               // isolate the rightmost set bit
boolean isOdd(int n)         { return (n & 1) == 1; }         // works for negatives too
int clearLowBits(int n, int i) { return n & (~0 << (i + 1)); } // clear bits 0..i
```

### Count set bits (Brian Kernighan)

```java
int countSetBits(int n) {
    int count = 0;
    while (n != 0) {        // loops once per set bit; negatives terminate too (<= 32 rounds)
        n &= n - 1;         // removes the lowest set bit
        count++;
    }
    return count;
}
// Library: Integer.bitCount(n), Long.bitCount(x), Integer.numberOfTrailingZeros(n)

int[] countBits(int n) {    // set bits for every 0..n in O(n)
    int[] ans = new int[n + 1];
    for (int i = 1; i <= n; i++) ans[i] = ans[i >> 1] + (i & 1);
    return ans;
}
```

### Power of two

```java
boolean isPowerOfTwo(int n) { return n > 0 && (n & (n - 1)) == 0; }  // exactly one set bit
boolean isPowerOfFour(int n) { return isPowerOfTwo(n) && (n & 0x55555555) != 0; } // bit at even position
```

### XOR properties

- `a ^ a = 0`, `a ^ 0 = a`, commutative and associative, so pairs cancel in any order.
- `a ^ b = c` implies `a ^ c = b` (undo an XOR by applying it again).
- Swap without a temp: `a ^= b; b ^= a; a ^= b;` (breaks if `a` and `b` are the same variable).

```java
int singleNumber(int[] nums) {          // every other number appears twice
    int x = 0;
    for (int v : nums) x ^= v;          // duplicates cancel
    return x;
}

int singleNumberII(int[] nums) {        // every other number appears three times
    int ones = 0, twos = 0;             // bits seen once / twice (mod 3)
    for (int v : nums) {
        ones = (ones ^ v) & ~twos;
        twos = (twos ^ v) & ~ones;
    }
    return ones;
}
// Alternative for "k times": for each bit b count set bits over nums; if count % k != 0 set bit b.

int[] singleNumberIII(int[] nums) {     // two numbers appear once, the rest twice
    int xor = 0;
    for (int v : nums) xor ^= v;        // xor = a ^ b, non-zero because a != b
    int diff = xor & -xor;              // rightmost bit where a and b differ
    int a = 0, b = 0;
    for (int v : nums) {
        if ((v & diff) != 0) a ^= v;    // bucket with the bit set: contains a (plus pairs)
        else b ^= v;                    // bucket without it: contains b (plus pairs)
    }
    return new int[]{a, b};
}

int missingNumber(int[] nums) {         // 0..n with one missing
    int x = nums.length;
    for (int i = 0; i < nums.length; i++) x ^= i ^ nums[i];
    return x;
}
```

### XOR of 1..n and of a range

```java
int xorUpTo(int n) {                    // 1 ^ 2 ^ ... ^ n, pattern repeats every 4
    switch (n % 4) {
        case 0:  return n;
        case 1:  return 1;
        case 2:  return n + 1;
        default: return 0;
    }
}
int xorRange(int l, int r) { return xorUpTo(l - 1) ^ xorUpTo(r); }   // like prefix sums
```

### Subsets via bitmask

```java
List<List<Integer>> subsets(int[] nums) {
    int n = nums.length;
    List<List<Integer>> res = new ArrayList<>();
    for (int mask = 0; mask < (1 << n); mask++) {        // each mask is one subset
        List<Integer> cur = new ArrayList<>();
        for (int i = 0; i < n; i++)
            if ((mask & (1 << i)) != 0) cur.add(nums[i]);
        res.add(cur);
    }
    return res;
}

// Enumerate all non-empty submasks of mask (total over all masks is 3^n)
for (int sub = mask; sub > 0; sub = (sub - 1) & mask) { /* use sub */ }
```

### Divide two integers without `*`, `/`, `%`

```java
int divide(int dividend, int divisor) {
    if (dividend == Integer.MIN_VALUE && divisor == -1) return Integer.MAX_VALUE; // only overflow case
    boolean negative = (dividend < 0) ^ (divisor < 0);
    long a = Math.abs((long) dividend), b = Math.abs((long) divisor);  // long: abs(MIN_VALUE) overflows int
    long q = 0;
    while (a >= b) {
        int shift = 0;
        while (a >= (b << (shift + 1))) shift++;   // largest b * 2^shift that fits in a
        a -= b << shift;
        q += 1L << shift;
    }
    return (int) (negative ? -q : q);
}
```

## Complexity

| Pattern | Time | Space |
|---|---|---|
| Check / set / clear / toggle a bit | O(1) | O(1) |
| Kernighan set-bit count | O(number of set bits), at most 32 | O(1) |
| `countBits` for 0..n | O(n) | O(n) |
| Single Number I / II / III | O(n) | O(1) |
| XOR of 1..n or of a range | O(1) | O(1) |
| All subsets via bitmask | O(n * 2^n) | O(n * 2^n) output |
| Submask enumeration over all masks | O(3^n) | O(1) |
| Divide with shifts | O(log^2 n) | O(1) |

## Pitfalls

- `1 << 31` is `Integer.MIN_VALUE` and `1 << 32 == 1` (shift distance is taken mod 32). Use `1L << k` for bit 31 and above.
- `>>` keeps the sign, `>>>` does not: `-1 >> 1 == -1`, `-1 >>> 1 == Integer.MAX_VALUE`.
- Always parenthesise: `(n & 1) == 0`. In Java `n & 1 == 0` does not even compile; in C it silently computes `n & (1 == 0)`.
- `Math.abs(Integer.MIN_VALUE)` is still negative. Widen to `long` before `abs` or negation.
- The power-of-two check must exclude `n <= 0` (`0 & -1 == 0`).
- `x & -x` on `Integer.MIN_VALUE` returns `MIN_VALUE`, which is still the correct lowest bit.
- Bitmask enumeration is only viable for small `n` (about 20); for larger `n` use backtracking or DP.

## Must-know problems

- Check if the i-th bit is set / set / clear / toggle
- Count set bits (Number of 1 Bits), Counting Bits
- Power of Two, Power of Four
- Minimum Bit Flips to Convert Number (`bitCount(start ^ goal)`)
- Single Number, Single Number II, Single Number III
- Missing Number
- Subsets (bitmask), Print all subsets
- XOR of numbers in a range L..R
- Divide Two Integers
- Reverse Bits
- Sum of Two Integers (without `+`)
- Gray Code
- Maximum XOR of Two Numbers in an Array (see Tries)
