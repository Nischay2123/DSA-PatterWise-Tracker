# Math & Geometry

## When to use / signals

- "Count primes up to n", "prime factors of many numbers": sieve / smallest-prime-factor sieve.
- "Return the answer modulo 10^9 + 7": modular arithmetic, `long` intermediates, modular inverse.
- `x^n` or huge exponents: fast (binary) exponentiation in O(log n).
- Matrix manipulation in place: rotate, spiral, set zeroes (use the first row / column as storage).
- Big numbers as strings or digit arrays: simulate grade-school arithmetic with a carry.
- Any product, sum or negation near `Integer.MAX_VALUE`: think about overflow first.

## Templates

### Sieve of Eratosthenes and SPF sieve

```java
boolean[] sieve(int n) {                          // isPrime[0..n]
    boolean[] isPrime = new boolean[n + 1];
    Arrays.fill(isPrime, true);
    isPrime[0] = false;
    if (n >= 1) isPrime[1] = false;
    for (int i = 2; (long) i * i <= n; i++)
        if (isPrime[i])
            for (int j = i * i; j <= n; j += i) isPrime[j] = false;   // smaller multiples already crossed
    return isPrime;
}

int[] spfSieve(int n) {                           // spf[x] = smallest prime factor of x
    int[] spf = new int[n + 1];
    for (int i = 2; i <= n; i++) {
        if (spf[i] != 0) continue;                // composite: already has a factor
        for (int j = i; j <= n; j += i)
            if (spf[j] == 0) spf[j] = i;
    }
    return spf;
}

List<Integer> factorize(int x, int[] spf) {      // O(log x) per query after the sieve
    List<Integer> f = new ArrayList<>();
    while (x > 1) { f.add(spf[x]); x /= spf[x]; }
    return f;
}

List<Integer> primeFactors(int n) {               // single query: trial division, O(sqrt n)
    List<Integer> f = new ArrayList<>();
    for (int p = 2; (long) p * p <= n; p++)
        while (n % p == 0) { f.add(p); n /= p; }
    if (n > 1) f.add(n);                          // leftover prime bigger than sqrt
    return f;
}

long gcd(long a, long b) { return b == 0 ? a : gcd(b, a % b); }
long lcm(long a, long b) { return a / gcd(a, b) * b; }   // divide first to avoid overflow
// Divisors: loop i while i * i <= n; add i and n / i (once if equal).
```

### Fast power

```java
double myPow(double x, int n) {
    long e = n;                                   // long: -Integer.MIN_VALUE overflows int
    if (e < 0) { x = 1 / x; e = -e; }
    double res = 1;
    while (e > 0) {
        if ((e & 1) == 1) res *= x;               // this bit of the exponent is set
        x *= x;                                   // x, x^2, x^4, x^8, ...
        e >>= 1;
    }
    return res;
}

long modPow(long base, long exp, long mod) {
    long res = 1;
    base %= mod;
    while (exp > 0) {
        if ((exp & 1) == 1) res = res * base % mod;
        base = base * base % mod;                 // both < mod, product fits in long for mod ~1e9
        exp >>= 1;
    }
    return res;
}
```

### Modular arithmetic

| Operation | Safe Java form |
|---|---|
| Add | `(a + b) % MOD` |
| Subtract | `((a - b) % MOD + MOD) % MOD` (Java `%` keeps the sign of `a`) |
| Multiply | `a % MOD * (b % MOD) % MOD` with `long` |
| Divide by b | `a * modPow(b, MOD - 2, MOD) % MOD` (Fermat, only when MOD is prime and b is not a multiple of MOD) |
| Normalise a negative | `Math.floorMod(a, MOD)` |

```java
static final int MOD = 1_000_000_007;
long[] fact, invFact;

void precompute(int n) {                          // nCr in O(1) after O(n) setup
    fact = new long[n + 1];
    invFact = new long[n + 1];
    fact[0] = 1;
    for (int i = 1; i <= n; i++) fact[i] = fact[i - 1] * i % MOD;
    invFact[n] = modPow(fact[n], MOD - 2, MOD);
    for (int i = n; i > 0; i--) invFact[i - 1] = invFact[i] * i % MOD;
}
long nCr(int n, int r) {
    if (r < 0 || r > n) return 0;
    return fact[n] * invFact[r] % MOD * invFact[n - r] % MOD;
}
```

### Matrix: rotate and spiral

```java
void rotate(int[][] m) {                          // 90 degrees clockwise, in place
    int n = m.length;
    for (int i = 0; i < n; i++)                   // 1) transpose
        for (int j = i + 1; j < n; j++) { int t = m[i][j]; m[i][j] = m[j][i]; m[j][i] = t; }
    for (int[] row : m)                           // 2) reverse each row
        for (int l = 0, r = n - 1; l < r; l++, r--) { int t = row[l]; row[l] = row[r]; row[r] = t; }
}
// Counter-clockwise: transpose, then reverse the order of the rows.

List<Integer> spiralOrder(int[][] m) {
    List<Integer> res = new ArrayList<>();
    int top = 0, bottom = m.length - 1, left = 0, right = m[0].length - 1;
    while (top <= bottom && left <= right) {
        for (int c = left; c <= right; c++) res.add(m[top][c]);
        top++;
        for (int r = top; r <= bottom; r++) res.add(m[r][right]);
        right--;
        if (top <= bottom) {                      // a row is still left to walk back along
            for (int c = right; c >= left; c--) res.add(m[bottom][c]);
            bottom--;
        }
        if (left <= right) {                      // a column is still left to walk up
            for (int r = bottom; r >= top; r--) res.add(m[r][left]);
            left++;
        }
    }
    return res;
}
```

### Set matrix zeroes (O(1) extra space)

```java
void setZeroes(int[][] m) {
    int R = m.length, C = m[0].length;
    boolean col0 = false;                         // column 0 needs its own flag (m[0][0] is taken by row 0)
    for (int r = 0; r < R; r++) {
        if (m[r][0] == 0) col0 = true;
        for (int c = 1; c < C; c++)
            if (m[r][c] == 0) { m[r][0] = 0; m[0][c] = 0; }   // markers in first row / column
    }
    for (int r = R - 1; r >= 0; r--) {            // bottom-up so row 0 markers are read before being cleared
        for (int c = C - 1; c >= 1; c--)
            if (m[r][0] == 0 || m[0][c] == 0) m[r][c] = 0;
        if (col0) m[r][0] = 0;
    }
}
```

### Happy number, plus one, multiply strings

```java
boolean isHappy(int n) {                          // Floyd's cycle detection on the digit-square sequence
    int slow = n, fast = next(n);
    while (fast != 1 && slow != fast) {
        slow = next(slow);
        fast = next(next(fast));
    }
    return fast == 1;
}
int next(int n) {
    int s = 0;
    for (; n > 0; n /= 10) s += (n % 10) * (n % 10);
    return s;
}

int[] plusOne(int[] d) {
    for (int i = d.length - 1; i >= 0; i--) {
        if (d[i] < 9) { d[i]++; return d; }       // no carry: done
        d[i] = 0;                                 // 9 becomes 0, carry continues
    }
    int[] res = new int[d.length + 1];            // all nines: 999 -> 1000
    res[0] = 1;
    return res;
}

String multiply(String a, String b) {
    int n = a.length(), m = b.length();
    int[] pos = new int[n + m];                   // a[i] * b[j] lands on pos[i + j] and pos[i + j + 1]
    for (int i = n - 1; i >= 0; i--)
        for (int j = m - 1; j >= 0; j--) {
            int sum = (a.charAt(i) - '0') * (b.charAt(j) - '0') + pos[i + j + 1];
            pos[i + j + 1] = sum % 10;
            pos[i + j] += sum / 10;               // carry
        }
    StringBuilder sb = new StringBuilder();
    for (int d : pos) if (sb.length() > 0 || d != 0) sb.append(d);   // skip leading zeros
    return sb.length() == 0 ? "0" : sb.toString();
}
```

### Detect squares (axis-aligned)

```java
class DetectSquares {
    private final int[][] cnt = new int[1001][1001];   // coordinates are 0..1000
    private final List<int[]> pts = new ArrayList<>(); // every added point, duplicates included

    public void add(int[] p) {
        cnt[p[0]][p[1]]++;
        pts.add(p);
    }
    public int count(int[] q) {
        int x = q[0], y = q[1], res = 0;
        for (int[] d : pts) {                          // treat d as the diagonal corner
            if (d[0] == x || Math.abs(d[0] - x) != Math.abs(d[1] - y)) continue;   // positive area square
            res += cnt[x][d[1]] * cnt[d[0]][y];        // the other two corners
        }
        return res;
    }
}
```

### Integer overflow handling

```java
int mid = lo + (hi - lo) / 2;                     // not (lo + hi) / 2
long prod = (long) a * b;                         // cast BEFORE multiplying; (long) (a * b) is too late
int safe = Math.addExact(a, b);                   // throws ArithmeticException on overflow (also multiplyExact)
// Math.abs(Integer.MIN_VALUE) == Integer.MIN_VALUE, and -Integer.MIN_VALUE == Integer.MIN_VALUE

int reverse(int x) {                              // Reverse Integer: return 0 on overflow
    int r = 0;
    while (x != 0) {
        int d = x % 10;                           // negative for negative x, so the sign is free
        if (r > Integer.MAX_VALUE / 10 || r < Integer.MIN_VALUE / 10) return 0;   // check before * 10
        r = r * 10 + d;
        x /= 10;
    }
    return r;
}
```

## Complexity

| Algorithm / problem | Time | Space |
|---|---|---|
| Sieve of Eratosthenes | O(n log log n) | O(n) |
| SPF sieve / factorise one number with it | O(n log log n) / O(log x) | O(n) |
| Trial-division factorisation, divisors | O(sqrt n) | O(1) |
| GCD (Euclid) | O(log min(a, b)) | O(1) |
| Fast power, modPow, modular inverse | O(log n) | O(1) |
| nCr with precomputed factorials | O(n) setup, O(1) query | O(n) |
| Rotate matrix, spiral, set zeroes | O(R * C) | O(1) extra |
| Happy number | O(log n) per step, short cycle | O(1) |
| Plus one | O(n) | O(1) (O(n) when all nines) |
| Multiply strings | O(n * m) | O(n + m) |
| Detect squares `count` | O(number of added points) | O(1001^2) |

## Pitfalls

- `int * int` overflows before it is widened: write `(long) a * b`, not `(long) (a * b)`.
- Loop bounds like `i * i <= n` overflow for large `n`; use `(long) i * i <= n` or `i <= n / i`.
- `pow(x, n)` with `n = Integer.MIN_VALUE`: `-n` overflows; convert to `long` first.
- Java `%` of a negative number is negative; normalise with `Math.floorMod` or `+ MOD`.
- Take `% MOD` after every multiplication, not only at the end.
- Fermat's inverse only works for a prime modulus.
- Floating point: never compare doubles with `==`; for geometry prefer integer cross products.
- Spiral order: the two inner `if` checks prevent re-visiting a single remaining row or column.
- Set matrix zeroes: processing row 0 / column 0 too early destroys the markers.
- Rotating by building a new matrix is O(n^2) extra space; interviews expect in-place.

## Must-know problems

- Count Primes (sieve), Prime Factorisation using SPF
- Print all Divisors, GCD / LCM
- Pow(x, n), Modular Exponentiation, nCr mod p
- Rotate Image, Spiral Matrix, Set Matrix Zeroes
- Happy Number
- Plus One, Add Binary, Add Strings, Multiply Strings
- Detect Squares
- Reverse Integer, String to Integer (atoi)
- Excel Sheet Column Number / Title
- Pascal's Triangle
- Max Points on a Line
