# Java Basics for DSA

> **TL;DR**: Know your type ranges. `int` tops out around 2.1 x 10^9, so cast to `long` *before* you multiply.
> Compare boxed `Integer`s with `.equals`, never `==`. Use `Math.floorMod` when `%` can see negatives.
> Arrays are objects passed by reference-value, `Arrays.*` does most of the chores, and deep recursion (about 10^4+ frames) can throw `StackOverflowError`.

---

## 1. Primitive types

| Type | Size | Range | Default | Wrapper | Typical DSA use |
|---|---|---|---|---|---|
| `byte` | 8 bit | -128 to 127 | `0` | `Byte` | rarely; memory-tight flags |
| `short` | 16 bit | -32,768 to 32,767 | `0` | `Short` | rarely |
| `int` | 32 bit | -2^31 to 2^31-1 (about ±2.147 x 10^9) | `0` | `Integer` | indices, counts, most values |
| `long` | 64 bit | -2^63 to 2^63-1 (about ±9.22 x 10^18) | `0L` | `Long` | sums, products, mod arithmetic |
| `float` | 32 bit | about ±3.4 x 10^38, ~7 digits | `0.0f` | `Float` | avoid in DSA |
| `double` | 64 bit | about ±1.8 x 10^308, ~15 digits | `0.0d` | `Double` | geometry, averages, binary search on answers |
| `char` | 16 bit | `'\u0000'` to `'￿'` (0 to 65,535, unsigned) | `'\u0000'` | `Character` | string processing |
| `boolean` | JVM-defined | `true` / `false` | `false` | `Boolean` | visited arrays, DP flags |

Defaults apply only to **fields and array elements**. Local variables have no default and must be assigned before use.

```java
int[] a = new int[5];            // {0,0,0,0,0}
boolean[] vis = new boolean[5];  // all false
String[] s = new String[3];      // all null
Integer[] boxed = new Integer[3];// all null (not 0!)  -> NPE when unboxing
```

Rule of thumb for constraints: if `n <= 10^5` and values `<= 10^9`, **sums need `long`**, since 10^5 x 10^9 = 10^14.

---

## 2. Integer overflow

```java
int a = 100_000, b = 100_000;
long wrong = a * b;              // 1410065408: multiplied as int, overflowed, THEN widened
long right = (long) a * b;       // 10000000000: a becomes long first
long alsoRight = 1L * a * b;     // same trick

int mid = (lo + hi) / 2;         // can overflow when lo + hi > 2^31-1
int safeMid = lo + (hi - lo) / 2;// safe
int safeMid2 = (lo + hi) >>> 1;  // also safe for non-negative lo, hi

// Detect overflow explicitly (throws ArithmeticException)
int x = Math.addExact(a, b);
long y = Math.multiplyExact((long) a, (long) b);
int z = Math.toIntExact(someLong);   // throws if it doesn't fit
```

Overflow wraps silently: `Integer.MAX_VALUE + 1 == Integer.MIN_VALUE`. Java never raises an error for it.

### "Infinity" sentinels

```java
int INF = Integer.MAX_VALUE;         // 2147483647
long LINF = Long.MAX_VALUE;          // 9223372036854775807
int NEG = Integer.MIN_VALUE;         // -2147483648

// DANGER: INF + weight overflows to a negative number
if (dist[u] != INF && dist[u] + w < dist[v]) dist[v] = dist[u] + w;   // guard first

// Safer: pick an INF that has headroom
final int INF2 = (int) 1e9;          // 10^9, INF2 + INF2 still fits in int
final long LINF2 = (long) 1e18;      // 10^18, adding two of these still fits in long

// Math.abs(Integer.MIN_VALUE) == Integer.MIN_VALUE  (still negative!)
```

---

## 3. Casting rules

**Widening (implicit, safe):** `byte -> short -> int -> long -> float -> double`, and `char -> int`.

**Narrowing (explicit, may lose data):** it needs a `(type)` cast.

```java
int i = 'a';                 // 97   char widens to int implicitly
long l = i;                  // implicit
double d = l;                // implicit
int back = (int) 3.99;       // 3    truncates toward zero (not rounding)
int neg  = (int) -3.99;      // -3
int big  = (int) 3_000_000_000L; // -1294967296  keeps the low 32 bits
char c   = (char) 98;        // 'b'
long rounded = Math.round(2.5);  // 3  (rounds half up)

// Expression promotion: byte/short/char are promoted to int in arithmetic
char ch = 'a';
// ch = ch + 1;              // compile error: int -> char needs a cast
ch = (char) (ch + 1);        // OK
ch += 1;                     // OK: compound assignment casts implicitly
ch++;                        // OK

// Mixed int/double -> double
double avg = sum / n;        // BUG if sum and n are int: integer division happens first
double avg2 = (double) sum / n;   // correct
```

---

## 4. The Integer cache `==` trap

Java caches `Integer` objects for **-128 to 127**. `==` on boxed values compares **references**.

```java
Integer a = 127, b = 127;
System.out.println(a == b);          // true   (same cached object)

Integer c = 128, d = 128;
System.out.println(c == d);          // false  (two different objects!)
System.out.println(c.equals(d));     // true   correct
System.out.println(c.intValue() == d); // true: unboxing makes it a primitive compare

// The classic bug in DSA
Map<Integer, Integer> m1 = new HashMap<>(), m2 = new HashMap<>();
m1.put(1, 1000); m2.put(1, 1000);
if (m1.get(1) == m2.get(1)) { /* NOT reached: compares references */ }
if (m1.get(1).equals(m2.get(1))) { /* reached */ }
if (Objects.equals(m1.get(1), m2.get(1))) { /* reached, and null-safe */ }

// Same trap with Stack/Deque peeks
Deque<Integer> s1 = new ArrayDeque<>(), s2 = new ArrayDeque<>();
// s1.peek() == s2.peek()  is WRONG for values outside [-128, 127]
```

Also: unboxing `null` throws `NullPointerException`: `int v = map.get(missingKey);` crashes.

---

## 5. Division and modulo

```java
7 / 2      // 3
-7 / 2     // -3   (truncates toward zero, NOT floor)
7 % 3      // 1
-7 % 3     // -1   (sign follows the dividend)
7 % -3     // 1

Math.floorDiv(-7, 2)   // -4   true floor
Math.floorMod(-7, 3)   // 2    always in [0, m) for positive m
((-7 % 3) + 3) % 3     // 2    the manual equivalent

// Ceiling division for positive a, b (no doubles)
int ceil = (a + b - 1) / b;   // e.g. (7 + 2 - 1) / 2 = 4
long ceilL = (a + b - 1L) / b;// avoid overflow when a is near INT_MAX
// Math.ceil((double) a / b) works but floating point can bite on huge values

// Circular index (e.g. rotating array, i may go negative)
int idx = Math.floorMod(i - k, n);
```

Integer division by zero throws `ArithmeticException`. Double division by zero gives `Infinity` or `NaN`.

---

## 6. char arithmetic

`char` is an unsigned 16-bit number. `'a' = 97`, `'A' = 65`, `'0' = 48`.

```java
char c = 'd';
int idx   = c - 'a';              // 3   letter to 0..25 index
char back = (char) ('a' + idx);   // 'd' index to letter
int digit = '7' - '0';            // 7   char digit to int
char dch  = (char) ('0' + 5);     // '5'
char up   = (char) (c - 32);      // 'D' (ASCII trick, lowercase letters only)
char flip = (char) (c ^ 32);      // toggles case for letters

Character.isDigit('5');           // true
Character.isLetter('x');          // true
Character.isLetterOrDigit('_');   // false
Character.isAlphabetic('x');      // true
Character.isUpperCase('A');       // true
Character.isLowerCase('a');       // true
Character.isWhitespace(' ');      // true
Character.toLowerCase('Q');       // 'q'
Character.toUpperCase('q');       // 'Q'
Character.getNumericValue('9');   // 9
(int) 'a';                        // 97

// Iterating the alphabet
for (char ch = 'a'; ch <= 'z'; ch++) { /* ... */ }
```

Note that `"" + c + 1` gives `"d1"` but `c + 1` gives `101` (an int). String concatenation vs numeric addition depends on the left operand.

---

## 7. `Math` cheat sheet

| Call | Returns | Notes |
|---|---|---|
| `Math.abs(x)` | same type | `Math.abs(Integer.MIN_VALUE)` is still negative |
| `Math.max(a,b)`, `Math.min(a,b)` | same type | only two args; nest for three |
| `Math.pow(a,b)` | **double** | `(long) Math.pow(2, 62)` is OK-ish, but precision is lost past 2^53. Use bit shifts or modpow |
| `Math.sqrt(x)` | double | `(int) Math.sqrt(n)` may be off by 1 for huge n; adjust with a while loop |
| `Math.cbrt(x)` | double | cube root |
| `Math.ceil(x)`, `Math.floor(x)` | double | cast after: `(int) Math.ceil(x)` |
| `Math.round(x)` | long (or int for float) | half up |
| `Math.log(x)`, `Math.log10(x)` | double | `log2(n) = Math.log(n) / Math.log(2)` |
| `Math.floorDiv`, `Math.floorMod` | int/long | correct with negatives |
| `Math.addExact`, `multiplyExact` | int/long | throw on overflow |
| `Math.hypot(x,y)` | double | `sqrt(x^2 + y^2)` without overflow |

```java
long p = 1L << 40;                      // exact power of two, better than Math.pow(2, 40)
int  r = (int) Math.sqrt(n);
while ((long) r * r > n) r--;           // fix floating error
while ((long) (r + 1) * (r + 1) <= n) r++;
int max3 = Math.max(a, Math.max(b, c));
int digits = (int) Math.log10(n) + 1;   // for n > 0; String.valueOf(n).length() is safer
```

---

## 8. Arrays

### Declare and initialise

```java
int[] a = new int[5];                 // zeros
int[] b = {5, 3, 8};                  // literal
int[] c = new int[]{1, 2, 3};         // literal in an expression, e.g. return new int[]{i, j};
int n = b.length;                     // a field, not a method (String uses .length())
String[] names = new String[3];       // nulls
char[] cs = "hello".toCharArray();
```

### `java.util.Arrays` helpers

```java
import java.util.*;

int[] a = {5, 2, 9, 1};

Arrays.fill(a, -1);                   // all -1 (memo init)
Arrays.fill(a, 1, 3, 0);              // indices [1, 3) set to 0

Arrays.sort(a);                       // ascending, dual-pivot quicksort, O(n log n)
Arrays.sort(a, 1, 3);                 // sort the range [1, 3)

int[] copy  = Arrays.copyOf(a, a.length);       // full copy
int[] grown = Arrays.copyOf(a, 10);             // pads with 0
int[] part  = Arrays.copyOfRange(a, 1, 3);      // [1, 3)
int[] clone = a.clone();                        // also a full (shallow) copy

boolean same = Arrays.equals(a, copy);          // element-wise (== compares references)
String s = Arrays.toString(a);                  // "[1, 2, 5, 9]"
int pos = Arrays.binarySearch(a, 5);            // needs a sorted array; negative if absent
int sum = Arrays.stream(a).sum();               // quick sum (slower than a loop)
int mx  = Arrays.stream(a).max().getAsInt();

List<String> fixed = Arrays.asList("x", "y", "z");   // fixed-size view: add/remove throw
Integer[] boxed = {3, 1, 2};
List<Integer> view = Arrays.asList(boxed);           // works with object arrays
// Arrays.asList(intArray) gives a List<int[]> of size 1. Not what you want!
```

### 2D and jagged arrays

```java
int[][] grid = new int[3][4];              // 3 rows, 4 cols, zeros
int rows = grid.length, cols = grid[0].length;

int[][] lit = {{1, 2}, {3, 4, 5}};         // rows can differ in length

int[][] jag = new int[3][];                // rows allocated later
for (int i = 0; i < 3; i++) jag[i] = new int[i + 1];

for (int[] row : grid) Arrays.fill(row, -1);   // fill a 2D array (Arrays.fill is 1D only)

int[][] deep = new int[grid.length][];
for (int i = 0; i < grid.length; i++) deep[i] = grid[i].clone();   // deep copy
// grid.clone() is SHALLOW: rows are shared!

System.out.println(Arrays.deepToString(grid));
boolean eq = Arrays.deepEquals(grid, deep);

// 4-directional moves
int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
for (int[] d : dirs) {
    int nr = r + d[0], nc = c + d[1];
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) { /* visit */ }
}
```

### `int[]` vs `Integer[]`

| | `int[]` | `Integer[]` |
|---|---|---|
| Element type | primitive | object (boxed) |
| Default value | `0` | `null` |
| Memory | 4 bytes/element | ~16 bytes + 4-8 byte ref per element |
| `Arrays.sort` | dual-pivot quicksort (not stable, worst case O(n²) is rare) | TimSort (stable, O(n log n)) |
| Custom comparator | **not allowed** | `Arrays.sort(arr, Collections.reverseOrder())` |
| `Arrays.asList` | gives `List<int[]>` (wrong) | gives `List<Integer>` |
| Speed | fast | slower (boxing, cache misses) |

```java
int[] prim = {3, 1, 2};
Integer[] boxed = Arrays.stream(prim).boxed().toArray(Integer[]::new);
Arrays.sort(boxed, Collections.reverseOrder());                     // descending
int[] backToPrim = Arrays.stream(boxed).mapToInt(Integer::intValue).toArray();
```

---

## 9. Pass-by-value (of references)

Java is **always pass-by-value**. For objects and arrays, the *value* passed is the reference. So you can mutate the contents, but reassigning the parameter doesn't affect the caller.

```java
static void mutate(int[] arr) { arr[0] = 99; }          // caller sees 99
static void reassign(int[] arr) { arr = new int[]{7}; } // caller does NOT see this
static void inc(int x) { x++; }                         // caller does NOT see this

static void addTo(List<Integer> list) { list.add(5); }  // caller sees 5

public static void main(String[] args) {
    int[] a = {1, 2};
    mutate(a);    // a = {99, 2}
    reassign(a);  // a still {99, 2}
    int x = 1;
    inc(x);       // x still 1
}
```

**Backtracking consequence**: when you save a path into the results, add a **copy**.

```java
void backtrack(List<Integer> path, List<List<Integer>> res) {
    res.add(new ArrayList<>(path));   // copy! res.add(path) would store the same mutating list
    // ...
}
```

To "return" several values or mutate an int in recursion, use an `int[] box = {0}`, a field, or return an array or record.

```java
int[] count = {0};
dfs(root, count);        // inside: count[0]++;
```

---

## 10. Varargs, enhanced for, labeled break

### Varargs

```java
static int max(int... nums) {          // nums is an int[]
    int m = Integer.MIN_VALUE;
    for (int x : nums) m = Math.max(m, x);
    return m;
}
max(3, 9, 4);          // 9
max(new int[]{1, 2});  // arrays work too
// The varargs parameter must be last: f(String s, int... xs)
```

### Enhanced for loop

```java
for (int x : arr) { x = 0; }          // does NOT modify arr (x is a copy)
for (int i = 0; i < arr.length; i++) arr[i] = 0;   // use an index to modify

for (int[] row : grid) for (int v : row) sum += v;
for (Map.Entry<String, Integer> e : map.entrySet()) { e.getKey(); e.getValue(); }
// Removing from a collection inside for-each throws ConcurrentModificationException
```

### Labeled break / continue

```java
outer:
for (int i = 0; i < n; i++) {
    for (int j = 0; j < m; j++) {
        if (grid[i][j] == target) {
            found = true;
            break outer;          // exits BOTH loops
        }
        if (grid[i][j] < 0) continue outer;   // next i
    }
}
```

---

## 11. Recursion depth and StackOverflowError

Each call uses a stack frame. The default thread stack (usually 512 KB to 1 MB) handles roughly **10^4 to 10^5** frames depending on how many locals each frame holds.

```java
// Recursion on a linked list / skewed tree with n = 10^5 might overflow
int depth(TreeNode node) {
    if (node == null) return 0;                    // ALWAYS have a base case
    return 1 + Math.max(depth(node.left), depth(node.right));
}
```

Fixes:
1. **Convert to iterative** with an explicit `ArrayDeque` stack (the most robust option).
2. **Run on a thread with a bigger stack** (in CP, not on LeetCode):

```java
public static void main(String[] args) throws InterruptedException {
    Thread t = new Thread(null, () -> solve(), "big", 1 << 27);   // 128 MB stack
    t.start();
    t.join();
}
```

3. Locally: `java -Xss256m Main`.
4. Memoise to cut repeated calls (it doesn't reduce depth, though).

`StackOverflowError` is an `Error`, not an `Exception`. Don't catch it as control flow.

---

## 12. Misc essentials

```java
final int N = 100_005;                       // underscores in literals for readability
long big = 10_000_000_000L;                  // L suffix is REQUIRED for long literals > int range
double eps = 1e-9;                           // compare doubles with a tolerance
if (Math.abs(x - y) < eps) { /* equal */ }

int t = cond ? a : b;                        // ternary
var list = new ArrayList<Integer>();         // Java 10+ local type inference

// Swap in an array (Java has no swap(a, b) for primitives)
static void swap(int[] a, int i, int j) { int t = a[i]; a[i] = a[j]; a[j] = t; }

// Records (Java 16+): immutable data carriers with equals/hashCode for free
record Pair(int r, int c) {}
Set<Pair> seen = new HashSet<>();
seen.add(new Pair(1, 2));
seen.contains(new Pair(1, 2));   // true, value-based equality
```

---

## Common pitfalls

- **`int * int` overflow** before being assigned to `long`. Write `(long) a * b`.
- **`(lo + hi) / 2`** overflows. Write `lo + (hi - lo) / 2`.
- **`INF + w`** with `INF = Integer.MAX_VALUE` wraps negative. Guard it, or use `1e9`.
- **`Integer == Integer`** is false for values outside [-128, 127]. Use `.equals`.
- **Unboxing `null`** (`int v = map.get(k)`) throws an NPE. Use `getOrDefault`.
- **`-7 % 3 == -1`** in Java. Use `Math.floorMod` for array indices and hashing.
- **`sum / n` with ints** truncates. Cast to `double` first.
- **`Math.pow` returns double** and loses precision past 2^53. Use `1L << k` or modpow.
- **`Math.abs(Integer.MIN_VALUE)`** is negative.
- **`Arrays.asList(int[])`** gives a list with one element (the array).
- **`Arrays.fill` on 2D** only fills rows (the references). Loop over the rows.
- **`grid.clone()`** is shallow for 2D arrays.
- **`int[]` cannot take a comparator.** Box it to `Integer[]` or sort `int[][]` rows.
- **Adding `path` instead of `new ArrayList<>(path)`** in backtracking fills the results with the same list.
- **Modifying the for-each variable** does not change the array.
- **Missing `L` on a long literal** (`10000000000`) is a compile error.
- **Deep recursion** (10^5 on a skewed tree) throws `StackOverflowError`. Go iterative.
