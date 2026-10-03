# Basics & Math

## When to use / signals

- Always, before coding: read the constraints and pick the target complexity (see the tables under Complexity).
- "Digits of n", "reverse the number", "sum of digits", "palindrome number", "Armstrong": use the `% 10` / `/ 10` digit loop.
- "GCD / HCF / LCM", "simplify a fraction", "equal groups": use Euclid's algorithm.
- "All divisors", "is n prime", "prime factors" with a single n up to 1e12: check divisors in O(√n) because they come in pairs `(i, n / i)`.
- Many primality queries up to 1e6–1e7: use a sieve instead of repeated √n checks.
- `x^n` with a large n, or `x^n mod m`: use binary exponentiation (O(log n)).

## Templates

### Digit extraction (the core loop)

```java
// Visits the digits right to left: last digit = n % 10, drop it with n /= 10
int countDigits(int n) {
    if (n == 0) return 1;
    long x = Math.abs((long) n);          // Math.abs(Integer.MIN_VALUE) is still negative
    int count = 0;
    while (x > 0) { count++; x /= 10; }
    return count;                         // O(1) alternative for n > 0: (int) Math.log10(n) + 1
}

int sumOfDigits(int n) {
    int sum = 0;
    while (n > 0) { sum += n % 10; n /= 10; }
    return sum;
}
```

### Reverse a number (with overflow guard, LeetCode 7)

```java
public int reverse(int x) {
    int rev = 0;
    while (x != 0) {
        int d = x % 10;                   // negative for negative x, which is fine
        x /= 10;
        if (rev > Integer.MAX_VALUE / 10 || (rev == Integer.MAX_VALUE / 10 && d > 7)) return 0;
        if (rev < Integer.MIN_VALUE / 10 || (rev == Integer.MIN_VALUE / 10 && d < -8)) return 0;
        rev = rev * 10 + d;
    }
    return rev;
}
```

### Palindrome number (reverse only half, no overflow)

```java
public boolean isPalindrome(int x) {
    if (x < 0 || (x % 10 == 0 && x != 0)) return false;   // negatives and 10, 120 ...
    int half = 0;
    while (x > half) {                     // stop once half the digits are reversed
        half = half * 10 + x % 10;
        x /= 10;
    }
    return x == half || x == half / 10;    // odd length: drop the middle digit
}
```

### Armstrong number (sum of digits^k == n, k = digit count)

```java
boolean isArmstrong(int n) {
    int k = String.valueOf(n).length();
    int sum = 0;
    for (int x = n; x > 0; x /= 10) sum += pow(x % 10, k);
    return sum == n;                       // 153 = 1^3 + 5^3 + 3^3
}

int pow(int base, int exp) {               // integer power, avoids Math.pow's double rounding
    int r = 1;
    while (exp-- > 0) r *= base;
    return r;
}
```

### GCD (Euclid) and LCM

```java
// gcd(a, b) = gcd(b, a % b), gcd(a, 0) = a. Each step at least halves the larger number.
long gcd(long a, long b) {
    while (b != 0) { long t = a % b; a = b; b = t; }
    return Math.abs(a);
}

long gcdRec(long a, long b) { return b == 0 ? a : gcdRec(b, a % b); }

long lcm(long a, long b) { return a / gcd(a, b) * b; }   // divide first to avoid overflow
```

### All divisors in O(√n)

```java
List<Integer> divisors(int n) {
    List<Integer> small = new ArrayList<>(), large = new ArrayList<>();
    for (int i = 1; (long) i * i <= n; i++) {   // (long) prevents i * i overflow
        if (n % i == 0) {
            small.add(i);
            if (i != n / i) large.add(n / i);   // pair partner; skip duplicate when i = √n
        }
    }
    Collections.reverse(large);
    small.addAll(large);                        // sorted ascending
    return small;
}
```

### Primality in O(√n)

```java
boolean isPrime(long n) {
    if (n < 2) return false;
    if (n % 2 == 0) return n == 2;
    for (long i = 3; i * i <= n; i += 2)        // only odd candidates up to √n
        if (n % i == 0) return false;
    return true;
}
```

### Prime factorisation in O(√n)

```java
List<Long> primeFactors(long n) {
    List<Long> f = new ArrayList<>();
    for (long p = 2; p * p <= n; p++)
        while (n % p == 0) { f.add(p); n /= p; }   // p is prime when it first divides n
    if (n > 1) f.add(n);                          // leftover is a prime > √(original n)
    return f;
}
```

### Sieve of Eratosthenes (many queries up to N)

```java
boolean[] sieve(int N) {
    boolean[] composite = new boolean[N + 1];
    for (int i = 2; (long) i * i <= N; i++)
        if (!composite[i])
            for (int j = i * i; j <= N; j += i) composite[j] = true;  // start at i*i
    return composite;                           // prime iff i >= 2 && !composite[i]
}
```

### Binary exponentiation

```java
long power(long base, long exp, long mod) {
    long result = 1;
    base %= mod;
    while (exp > 0) {
        if ((exp & 1) == 1) result = result * base % mod;  // use this bit
        base = base * base % mod;                          // square for the next bit
        exp >>= 1;
    }
    return result;
}
```

## Complexity

### Big-O reference

| Complexity | Name | Typical source | n = 1e5 roughly means |
|---|---|---|---|
| O(1) | constant | formula, array index, hash lookup | 1 op |
| O(log n) | logarithmic | binary search, gcd, digit loop, fast power | ~17 ops |
| O(√n) | square root | divisors, primality | ~316 ops |
| O(n) | linear | single pass | 1e5 ops |
| O(n log n) | linearithmic | sorting, heap of n items | ~1.7e6 ops |
| O(n²) | quadratic | two nested loops | 1e10 ops (too slow) |
| O(n³) | cubic | three nested loops, Floyd–Warshall | way too slow |
| O(2ⁿ) | exponential | all subsets | only for n ≤ ~20–25 |
| O(n!) | factorial | all permutations | only for n ≤ ~10–11 |

Rule of thumb: a judge does about **1e8 simple operations per second** (Java is similar once the JIT is warm). Multiply the complexity by the max n and compare with `1e8 × time limit`.

### Constraint to allowed complexity

| Max n | Allowed complexity | Typical approach |
|---|---|---|
| n ≤ 10–11 | O(n!), O(n! · n) | permutations, brute force |
| n ≤ 20–25 | O(2ⁿ · n) | subsets, bitmask, backtracking |
| n ≤ 100–500 | O(n³) | 3 nested loops, interval DP, Floyd–Warshall |
| n ≤ 1e3–5e3 | O(n²) | 2D DP, all pairs |
| n ≤ 1e5–1e6 | O(n log n) | sorting, binary search, heap, segment tree |
| n ≤ 1e7–1e8 | O(n) | single pass, two pointers, sieve |
| n ≥ 1e9 (single value) | O(√n), O(log n), O(1) | math, binary search on answer |

Memory: 256 MB holds about 6e7 `int`s; `int[1e7]` is 40 MB, `long[1e7]` is 80 MB.

### Templates

| Task | Time | Space |
|---|---|---|
| Count / sum / reverse digits, palindrome, Armstrong | O(log₁₀ n) | O(1) |
| GCD / LCM (Euclid) | O(log min(a, b)) | O(1) iterative |
| Divisors, primality, factorisation | O(√n) | O(number of divisors) |
| Sieve up to N | O(N log log N) | O(N) |
| Binary exponentiation | O(log exp) | O(1) |

## Pitfalls

- `i * i <= n` overflows `int` when n is near `Integer.MAX_VALUE`; use `(long) i * i <= n` or `i <= n / i`.
- `Math.abs(Integer.MIN_VALUE)` is negative. Widen to `long` first.
- 0 has 1 digit; loops like `while (n > 0)` return 0 for it.
- Java `%` keeps the sign of the dividend: `-7 % 3 == -1`. Normalise with `((a % m) + m) % m`.
- `Math.pow` returns a `double`; large results lose precision. Use integer multiplication.
- 1 is neither prime nor composite; 2 is the only even prime.
- Compute LCM as `a / gcd * b`, not `a * b / gcd` (overflow).
- Reversing a number can overflow `int`; guard before `rev * 10 + d` or use `long`.
- Divisor loop: when `i == n / i` add it once, not twice.

## Must-know problems

- Count Digits
- Reverse Integer
- Palindrome Number
- Armstrong Number
- Sum of Digits / Add Digits
- GCD of Two Numbers / LCM
- Print All Divisors
- Check for Prime
- Count Primes (Sieve of Eratosthenes)
- Prime Factorisation of a Number
- Pow(x, n)
- Fizz Buzz
- Perfect Number
