# Math & Bit Tricks in Java

> **TL;DR**: Keep everything in `long` when you're working mod `1e9+7`: `(a * b) % MOD` needs both operands `< MOD` and a `long` product. Subtraction needs `+ MOD`.
> gcd, fast power, sieve and O(sqrt n) divisor loops are 5-line templates worth memorising.
> For bits, remember `x & (x - 1)` (drop the lowest set bit), `x & -x` (keep the lowest set bit), `1L << k` for big shifts, and parentheses around every `&`/`|` comparison.

---

## 1. GCD and LCM

```java
// Euclid: gcd(a, b) = gcd(b, a % b), O(log min(a, b))
static long gcd(long a, long b) {
    while (b != 0) { long t = a % b; a = b; b = t; }
    return Math.abs(a);            // handles negative inputs; gcd(0, 0) = 0
}

// Recursive one-liner
static int gcdR(int a, int b) { return b == 0 ? a : gcdR(b, a % b); }

// LCM: divide BEFORE multiplying to reduce overflow risk
static long lcm(long a, long b) {
    if (a == 0 || b == 0) return 0;
    return a / gcd(a, b) * b;      // NOT a * b / gcd(a, b): a * b may overflow first
}

// Overflow-checked LCM (throws ArithmeticException if the result exceeds long)
static long lcmExact(long a, long b) { return Math.multiplyExact(a / gcd(a, b), b); }

// gcd of an array
static int gcdAll(int[] arr) {
    int g = 0;
    for (int x : arr) g = gcdR(g, x);   // gcd(0, x) = x
    return g;
}

// BigInteger has it built in
java.math.BigInteger g = java.math.BigInteger.valueOf(48).gcd(java.math.BigInteger.valueOf(18)); // 6
```

Facts: `gcd(a, b) * lcm(a, b) = a * b`. Two numbers are coprime iff `gcd == 1`. The extended Euclid algorithm gives `x, y` with `ax + by = gcd(a, b)`:

```java
// returns {g, x, y} with a*x + b*y = g
static long[] extGcd(long a, long b) {
    if (b == 0) return new long[]{a, 1, 0};
    long[] r = extGcd(b, a % b);
    return new long[]{r[0], r[2], r[1] - (a / b) * r[2]};
}
```

---

## 2. Modular arithmetic with `1e9+7`

`MOD = 1_000_000_007` is prime and fits in an `int`. The product of two values `< MOD` is below about 1.0e18. That fits in a `long` (max about 9.22e18) but **not** in an `int`.

```java
static final int MOD = 1_000_000_007;       // (int) 1e9 + 7 also works

// ADD: both operands in [0, MOD)
long add = (a + b) % MOD;

// SUB: the result of % can be negative in Java, so add MOD back
long sub = ((a - b) % MOD + MOD) % MOD;
long sub2 = Math.floorMod(a - b, MOD);      // equivalent

// MUL: widen to long BEFORE multiplying
long mul = (a % MOD) * (b % MOD) % MOD;     // a, b are long
int  mulInt = (int) ((long) x * y % MOD);   // x, y are int

// Reduce a possibly-negative input first
long norm = ((v % MOD) + MOD) % MOD;

// Accumulate in a loop: reduce EVERY step
long sum = 0;
for (int x : arr) sum = (sum + x) % MOD;
long prod = 1;
for (int x : arr) prod = prod * x % MOD;
```

| Operation | Safe pattern | Why |
|---|---|---|
| `a + b` | `(a + b) % MOD` | two values `< MOD` sum to `< 2^31`, but use `long` anyway |
| `a - b` | `((a - b) % MOD + MOD) % MOD` | `%` keeps the dividend's sign |
| `a * b` | `(long) a * b % MOD` | the product can reach about 1e18 |
| `a / b` | `a * modInverse(b) % MOD` | no direct division under a modulus |
| `a ^ e` | `modPow(a, e, MOD)` | never use `Math.pow` (double) |
| compare answers | reduce both first | `5` and `5 + MOD` are equal mod MOD |

Another common modulus is `998244353` (prime and NTT-friendly). If the modulus is up to 1e18, `a * b` overflows even a `long`. Use `Math.multiplyHigh` or `BigInteger`, or a mulmod by doubling.

---

## 3. Fast modular exponentiation

Computes `base^exp % mod` in O(log exp) by squaring.

```java
static long modPow(long base, long exp, long mod) {
    long result = 1 % mod;         // handles mod == 1
    base %= mod;
    if (base < 0) base += mod;
    while (exp > 0) {
        if ((exp & 1) == 1) result = result * base % mod;   // this bit is set: multiply it in
        base = base * base % mod;                           // square for the next bit
        exp >>= 1;
    }
    return result;
}

// Recursive version
static long powR(long b, long e, long m) {
    if (e == 0) return 1 % m;
    long half = powR(b, e / 2, m);
    long r = half * half % m;
    return (e % 2 == 1) ? r * (b % m) % m : r;
}

// Plain (non-mod) power of an integer: watch for overflow
static long ipow(long b, int e) {
    long r = 1;
    while (e > 0) { if ((e & 1) == 1) r *= b; b *= b; e >>= 1; }
    return r;
}

// Built-in for big numbers
java.math.BigInteger r = java.math.BigInteger.valueOf(2).modPow(
        java.math.BigInteger.valueOf(100), java.math.BigInteger.valueOf(1_000_000_007));
```

Trace for `3^13` (13 = `1101` in binary): 3^1 x 3^4 x 3^8 = 3 x 81 x 6561 = 1,594,323.

---

## 4. Modular inverse (Fermat)

If `p` is **prime** and `a % p != 0`, then `a^(p-1) = 1 (mod p)`, so `a^(-1) = a^(p-2) (mod p)`.

```java
static long modInverse(long a, long p) { return modPow(a, p - 2, p); }   // p must be prime

// Division under mod: (a / b) % MOD
long div = a % MOD * modInverse(b, MOD) % MOD;

// Non-prime modulus: use extended Euclid (it needs gcd(a, m) == 1)
static long modInverseGeneral(long a, long m) {
    long[] r = extGcd(a, m);
    if (r[0] != 1) throw new ArithmeticException("no inverse");
    return ((r[1] % m) + m) % m;
}
```

### nCr mod p with precomputed factorials (O(n) setup, O(1) per query)

```java
static long[] fact, invFact;

static void precompute(int n) {
    fact = new long[n + 1];
    invFact = new long[n + 1];
    fact[0] = 1;
    for (int i = 1; i <= n; i++) fact[i] = fact[i - 1] * i % MOD;
    invFact[n] = modPow(fact[n], MOD - 2, MOD);
    for (int i = n; i > 0; i--) invFact[i - 1] = invFact[i] * i % MOD;
}

static long nCr(int n, int r) {
    if (r < 0 || r > n) return 0;
    return fact[n] * invFact[r] % MOD * invFact[n - r] % MOD;
}

// Small n (<= ~1000) with no modulus or a non-prime one: Pascal's triangle
long[][] C = new long[n + 1][n + 1];
for (int i = 0; i <= n; i++) {
    C[i][0] = 1;
    for (int j = 1; j <= i; j++) C[i][j] = (C[i - 1][j - 1] + C[i - 1][j]) % MOD;
}
```

---

## 5. Primes

### Primality test in O(sqrt n)

```java
static boolean isPrime(long n) {
    if (n < 2) return false;
    if (n % 2 == 0) return n == 2;
    for (long i = 3; i * i <= n; i += 2)      // i * i <= n avoids sqrt precision issues
        if (n % i == 0) return false;
    return true;
}
```

### Sieve of Eratosthenes: all primes up to n in O(n log log n)

```java
static boolean[] sieve(int n) {
    boolean[] isPrime = new boolean[n + 1];
    Arrays.fill(isPrime, true);
    if (n >= 0) isPrime[0] = false;
    if (n >= 1) isPrime[1] = false;
    for (int i = 2; (long) i * i <= n; i++) {           // only up to sqrt(n)
        if (!isPrime[i]) continue;
        for (int j = i * i; j <= n; j += i)             // start at i*i: smaller multiples are done
            isPrime[j] = false;
    }
    return isPrime;
}

// Collect them
boolean[] p = sieve(100);
List<Integer> primes = new ArrayList<>();
for (int i = 2; i <= 100; i++) if (p[i]) primes.add(i);   // 25 primes below 100
```

Memory: `boolean[1e7]` is about 10 MB, which is fine. For `n` up to 1e7 the sieve runs in well under a second.

### Smallest-prime-factor (SPF) sieve: factorise many numbers in O(log n) each

```java
static int[] spfSieve(int n) {
    int[] spf = new int[n + 1];
    for (int i = 2; i <= n; i++) {
        if (spf[i] == 0) {                               // i is prime
            for (int j = i; j <= n; j += i)
                if (spf[j] == 0) spf[j] = i;
        }
    }
    return spf;
}

static List<Integer> factorWithSpf(int x, int[] spf) {
    List<Integer> f = new ArrayList<>();
    while (x > 1) { f.add(spf[x]); x /= spf[x]; }
    return f;                                            // e.g. 60 -> [2, 2, 3, 5]
}
```

### Prime factorisation by trial division, O(sqrt n)

```java
// Returns prime -> exponent, e.g. 360 -> {2=3, 3=2, 5=1}
static Map<Long, Integer> primeFactors(long n) {
    Map<Long, Integer> f = new TreeMap<>();
    for (long p = 2; p * p <= n; p++) {
        while (n % p == 0) {
            f.merge(p, 1, Integer::sum);
            n /= p;
        }
    }
    if (n > 1) f.merge(n, 1, Integer::sum);             // leftover prime > sqrt(original n)
    return f;
}

// Number of divisors from the factorisation: product of (exponent + 1)
// 360 = 2^3 * 3^2 * 5^1  ->  (3+1)(2+1)(1+1) = 24 divisors
```

---

## 6. Divisors in O(sqrt n)

Divisors come in pairs `(i, n / i)` with `i <= sqrt(n)`.

```java
static List<Long> divisors(long n) {
    List<Long> small = new ArrayList<>(), large = new ArrayList<>();
    for (long i = 1; i * i <= n; i++) {
        if (n % i == 0) {
            small.add(i);
            if (i != n / i) large.add(n / i);            // avoid a double-count for perfect squares
        }
    }
    Collections.reverse(large);
    small.addAll(large);
    return small;                                        // sorted: 36 -> [1, 2, 3, 4, 6, 9, 12, 18, 36]
}

static int countDivisors(int n) {
    int c = 0;
    for (int i = 1; (long) i * i <= n; i++)
        if (n % i == 0) c += (i == n / i) ? 1 : 2;
    return c;
}

static long sumDivisors(long n) {
    long s = 0;
    for (long i = 1; i * i <= n; i++)
        if (n % i == 0) { s += i; if (i != n / i) s += n / i; }
    return s;
}

// Divisor lists for ALL numbers up to N: harmonic sum, O(N log N)
List<List<Integer>> divs = new ArrayList<>();
for (int i = 0; i <= N; i++) divs.add(new ArrayList<>());
for (int d = 1; d <= N; d++)
    for (int m = d; m <= N; m += d) divs.get(m).add(d);
```

Only perfect squares have an odd number of divisors (Bulb Switcher: the answer is `(int) Math.sqrt(n)`).

---

## 7. Digit extraction

```java
int n = 9075;

// Digits from right to left
int m = n;
while (m > 0) {
    int d = m % 10;          // 5, 7, 0, 9
    m /= 10;
}

static int digitSum(long n) { int s = 0; n = Math.abs(n); while (n > 0) { s += n % 10; n /= 10; } return s; }

static int countDigits(long n) { return n == 0 ? 1 : (int) Math.log10(Math.abs(n)) + 1; }
// String.valueOf(Math.abs(n)).length() is simpler and exact

// Reverse a number with overflow detection (LeetCode 7)
static int reverse(int x) {
    long r = 0;
    while (x != 0) {
        r = r * 10 + x % 10;             // x % 10 is negative for negative x: sign is preserved
        x /= 10;
        if (r > Integer.MAX_VALUE || r < Integer.MIN_VALUE) return 0;
    }
    return (int) r;
}

// Palindrome number without converting to a string
static boolean isPalin(int x) {
    if (x < 0 || (x % 10 == 0 && x != 0)) return false;
    int rev = 0;
    while (x > rev) { rev = rev * 10 + x % 10; x /= 10; }
    return x == rev || x == rev / 10;    // even or odd length
}

// Digits into an array (left to right)
int[] digits = String.valueOf(n).chars().map(c -> c - '0').toArray();   // [9, 0, 7, 5]

// Build a number from digits
int built = 0;
for (int d : digits) built = built * 10 + d;

// k-th digit from the right (0-indexed)
int kth = (int) (n / (long) Math.pow(10, 2) % 10);                       // 0 (the hundreds digit)

// Digital root (repeated digit sum until one digit), for n > 0
int root = 1 + (n - 1) % 9;
```

---

## 8. Other handy math

```java
// Sum 1..n: use long
long s = (long) n * (n + 1) / 2;

// Exact integer sqrt
static long isqrt(long n) {
    long r = (long) Math.sqrt((double) n);
    while (r * r > n) r--;
    while ((r + 1) * (r + 1) <= n) r++;
    return r;
}

// Perfect square check
boolean perfect = isqrt(n) * isqrt(n) == n;

// Ceil division for positive a, b
long ceilDiv = (a + b - 1) / b;         // or Math.ceilDiv(a, b) on Java 18+

// Floating point comparisons
final double EPS = 1e-9;
boolean eq = Math.abs(x - y) < EPS;

// Big numbers beyond long
java.math.BigInteger f = java.math.BigInteger.ONE;
for (int i = 2; i <= 50; i++) f = f.multiply(java.math.BigInteger.valueOf(i));   // 50!
```

---

## 9. Bit operators

| Operator | Name | Example (`a = 5` is `0101`, `b = 3` is `0011`) | Result |
|---|---|---|---|
| `&` | AND | `a & b` | `1` (`0001`) |
| `\|` | OR | `a \| b` | `7` (`0111`) |
| `^` | XOR | `a ^ b` | `6` (`0110`) |
| `~` | NOT (flips all 32 bits) | `~a` | `-6` (`~x == -x - 1`) |
| `<<` | left shift (fills with 0) | `a << 1` | `10` (multiply by 2) |
| `>>` | arithmetic right shift (copies the sign bit) | `a >> 1` | `2` (floor divide by 2) |
| `>>>` | logical right shift (fills with 0) | `a >>> 1` | `2` (same for non-negative) |

Integers are **two's complement**: `-x == ~x + 1`. `int` has 32 bits and `long` has 64. Shift distances are taken **mod 32** for `int` (mod 64 for `long`): `1 << 32 == 1` and `1 << 31 == Integer.MIN_VALUE`.

### `>>` vs `>>>` on negatives

```java
int x = -8;                                   // 11111111 11111111 11111111 11111000
System.out.println(x >> 1);                   // -4          sign bit copied in
System.out.println(x >>> 1);                  // 2147483644  zero filled: becomes huge positive
System.out.println(-1 >>> 28);                // 15          top 4 bits
System.out.println(-7 >> 1);                  // -4          floor(-3.5), whereas -7 / 2 == -3

// >>> is how you treat an int as unsigned, and how (lo + hi) >>> 1 avoids overflow
int mid = (lo + hi) >>> 1;                    // correct even if lo + hi overflows (non-negative lo, hi)
```

### Precedence trap

`==` binds tighter than `&`, `^` and `|`. **Always parenthesise.**

```java
// if (x & 1 == 0)        // compile error: parsed as x & (1 == 0)
if ((x & 1) == 0) { }     // x is even
if ((mask & (1 << i)) != 0) { }
int y = a + b << 1;       // (a + b) << 1: shifts are lower precedence than +
```

---

## 10. Bit tricks

| Task | Code | Example |
|---|---|---|
| Is the i-th bit set? | `(x >> i & 1) == 1` or `(x & (1 << i)) != 0` | `x=5, i=2` gives true |
| Set the i-th bit | `x \| (1 << i)` | `5 \| (1<<1)` = `7` |
| Clear the i-th bit | `x & ~(1 << i)` | `7 & ~(1<<1)` = `5` |
| Toggle the i-th bit | `x ^ (1 << i)` | `5 ^ (1<<0)` = `4` |
| Clear the lowest set bit | `x & (x - 1)` | `12 (1100)` gives `8 (1000)` |
| Isolate the lowest set bit | `x & -x` | `12 (1100)` gives `4 (0100)` |
| Is x a power of two? | `x > 0 && (x & (x - 1)) == 0` | `16` true, `0` false |
| Count set bits | `Integer.bitCount(x)`, `Long.bitCount(x)` | `bitCount(7)` = `3` |
| Binary string | `Integer.toBinaryString(x)` | `toBinaryString(10)` = `"1010"` |
| Parse binary | `Integer.parseInt("1010", 2)` | `10` |
| Trailing zeros | `Integer.numberOfTrailingZeros(x)`, `Long.numberOfTrailingZeros(x)` | `ntz(8)` = `3` (64 for `0L`) |
| Leading zeros | `Integer.numberOfLeadingZeros(x)` | `nlz(1)` = `31` |
| floor(log2 x) | `31 - Integer.numberOfLeadingZeros(x)` | `x=10` gives `3` |
| Highest set bit value | `Integer.highestOneBit(x)` | `10` gives `8` |
| Lowest set bit value | `Integer.lowestOneBit(x)` | `12` gives `4` |
| Mask of the lowest k bits | `(1 << k) - 1` | `k=3` gives `7` |
| Odd check | `(x & 1) == 1` | works for negatives, unlike `x % 2 == 1` |
| Multiply / divide by 2^k | `x << k`, `x >> k` | `>>` floors for negatives |
| Opposite signs? | `(a ^ b) < 0` | `-3, 4` gives true |
| XOR swap | `a ^= b; b ^= a; a ^= b;` | breaks if `a` and `b` are the same memory slot |
| Flip every bit up to the highest | `x ^ (Integer.highestOneBit(x) * 2 - 1)` | `5 (101)` gives `2 (010)` |

```java
int x = 0b1011_0100;                          // binary literal: 180

boolean bit2 = ((x >> 2) & 1) == 1;           // true
x |= (1 << 0);                                // set bit 0: 181
x &= ~(1 << 7);                               // clear bit 7: 53
x ^= (1 << 3);                                // toggle bit 3

// Count set bits by hand (Brian Kernighan): O(number of set bits)
static int popcount(int n) { int c = 0; while (n != 0) { n &= n - 1; c++; } return c; }

// Counting Bits (LC 338): dp[i] = dp[i >> 1] + (i & 1)
int[] bits = new int[n + 1];
for (int i = 1; i <= n; i++) bits[i] = bits[i >> 1] + (i & 1);

// Zero-padded binary string
String padded = String.format("%8s", Integer.toBinaryString(5)).replace(' ', '0');   // "00000101"
String neg = Integer.toBinaryString(-1);      // 32 ones: negatives show all 32 bits

// Use 1L for bits >= 31 in longs
long big = 1L << 40;                          // correct
long wrong = 1 << 40;                         // 256: int shift, 40 mod 32 = 8
```

### XOR properties (Single Number family)

`a ^ a = 0`, `a ^ 0 = a`, and XOR is commutative and associative.

```java
// Every element appears twice except one
static int singleNumber(int[] nums) { int r = 0; for (int x : nums) r ^= x; return r; }

// Missing number in 0..n
static int missing(int[] nums) {
    int r = nums.length;
    for (int i = 0; i < nums.length; i++) r ^= i ^ nums[i];
    return r;
}

// Two numbers appear once, the rest twice: split by the lowest differing bit
static int[] singleNumberIII(int[] nums) {
    int xor = 0;
    for (int x : nums) xor ^= x;
    int low = xor & -xor;
    int a = 0;
    for (int x : nums) if ((x & low) != 0) a ^= x;
    return new int[]{a, xor ^ a};
}
```

---

## 11. Subsets via bitmask

Each integer `mask` in `[0, 2^n)` is a subset: bit `i` set means `nums[i]` is included. O(n * 2^n), practical for `n <= 20`.

```java
static List<List<Integer>> subsets(int[] nums) {
    int n = nums.length;
    List<List<Integer>> res = new ArrayList<>();
    for (int mask = 0; mask < (1 << n); mask++) {
        List<Integer> sub = new ArrayList<>();
        for (int i = 0; i < n; i++)
            if ((mask & (1 << i)) != 0) sub.add(nums[i]);
        res.add(sub);
    }
    return res;                    // [1,2,3] gives 8 subsets
}

// Iterate all submasks of a mask (bitmask DP), O(3^n) over all masks
for (int sub = mask; sub > 0; sub = (sub - 1) & mask) {
    // process sub (the empty submask 0 isn't visited; handle it separately if needed)
}

// Iterate only the set bits of a mask
for (int m = mask; m != 0; m &= m - 1) {
    int i = Integer.numberOfTrailingZeros(m);   // index of the current set bit
}

// Visited-set as a bitmask (TSP / shortest path visiting all nodes, n <= ~16)
int full = (1 << n) - 1;
int[][] dp = new int[1 << n][n];               // dp[mask][last]
boolean allVisited = (mask == full);
int withNode = mask | (1 << v);

// Letters present in a word as a 26-bit mask (Maximum Product of Word Lengths)
int wordMask = 0;
for (char c : "hello".toCharArray()) wordMask |= 1 << (c - 'a');
boolean shareLetters = (wordMask & otherMask) != 0;
```

---

## Common pitfalls

- **`a * b % MOD` with `int`s** overflows before the `%`. Write `(long) a * b % MOD`.
- **Negative results of `%`**: `(a - b) % MOD` can be negative. Add `MOD` and take `%` again, or use `Math.floorMod`.
- **Forgetting to reduce mod at every step** in loops or DP makes values explode past `long`.
- **`Math.pow` for modular or integer powers** gives a `double` and loses precision. Use `modPow` or `1L << k`.
- **`lcm = a * b / gcd`** overflows. Divide first: `a / gcd * b`.
- **Fermat's inverse needs a prime modulus** and `a % p != 0`. Otherwise use extended Euclid.
- **Sieve inner loop `j = i * i`** overflows `int` when `i` exceeds about 46341. Guard with `(long) i * i <= n`.
- **Loop condition `i <= Math.sqrt(n)`** is recomputed each iteration and has precision issues. Use `i * i <= n` with `long i`.
- **Double-counting the square-root divisor** of a perfect square. Check `i != n / i`.
- **`x & 1 == 0`** doesn't compile. Write `(x & 1) == 0`. Same for `|` and `^` with comparisons.
- **`1 << 40`** is an `int` shift (distance mod 32) and gives 256. Use `1L << 40`.
- **`1 << 31`** is negative (`Integer.MIN_VALUE`).
- **`>>` on negatives** keeps the sign. `>>>` treats the value as unsigned. `-7 >> 1 == -4` but `-7 / 2 == -3`.
- **`x % 2 == 1`** is false for negative odd numbers. Use `(x & 1) == 1` or `x % 2 != 0`.
- **XOR swap on the same element** (`a[i] ^= a[j]` with `i == j`) zeroes it. Just use a temp variable.
- **`Integer.toBinaryString(negative)`** prints all 32 bits (two's complement), with no minus sign.
- **Bitmask over n > 30** needs `long` masks and `1L << i`. Over n > 20, 2^n subsets is too slow anyway.
