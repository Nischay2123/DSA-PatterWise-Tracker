# Comparable, Comparator & Lambdas

> **TL;DR**: `Comparable` is a class's one built-in "natural order" (`compareTo`). A `Comparator` is any external order you pass to `sort`, `PriorityQueue` or `TreeMap`.
> In DSA you'll mostly write lambdas like `(a, b) -> Integer.compare(a[0], b[0])` or chain `Comparator.comparing(...).thenComparing(...)`.
> `int[]` can't take a comparator: box it to `Integer[]`, or sort `int[][]` rows. Avoid streams in hot loops.

---

## 1. The comparison contract

A comparison returns an `int`:

| Return value | Meaning |
|---|---|
| negative | `a` comes **before** `b` |
| `0` | equal (in a `TreeSet`/`TreeMap`, treated as the **same** element) |
| positive | `a` comes **after** `b` |

Rules: it must be consistent (`sgn(compare(a,b)) == -sgn(compare(b,a))`) and transitive. Breaking them can make `Arrays.sort` throw `IllegalArgumentException: Comparison method violates its general contract!`

Mnemonic: **`compare(a, b)` gives ascending, `compare(b, a)` gives descending.**

---

## 2. Comparable vs Comparator

| | `Comparable<T>` | `Comparator<T>` |
|---|---|---|
| Package | `java.lang` | `java.util` |
| Method | `int compareTo(T other)` | `int compare(T a, T b)` |
| Where it lives | inside the class being sorted | a separate object or lambda |
| How many orders | one ("natural order") | as many as you like |
| Used by | `Collections.sort(list)`, `Arrays.sort(objArr)`, `TreeSet<>()`, `PriorityQueue<>()` with no args | `sort(list, cmp)`, `new PriorityQueue<>(cmp)`, `new TreeMap<>(cmp)` |
| Modifies the class? | yes, the class must `implements Comparable` | no, works on classes you don't own |
| Built-in examples | `Integer`, `String`, `Long`, `Character`, records you write yourself | `Comparator.reverseOrder()`, `String.CASE_INSENSITIVE_ORDER` |

```java
import java.util.*;

// Comparable: the class defines its own natural order
class Student implements Comparable<Student> {
    String name; int marks; int age;
    Student(String n, int m, int a) { name = n; marks = m; age = a; }

    @Override
    public int compareTo(Student o) {
        return Integer.compare(this.marks, o.marks);    // natural order: by marks ascending
    }
    @Override public String toString() { return name + "(" + marks + "," + age + ")"; }
}

List<Student> list = new ArrayList<>(List.of(
        new Student("Asha", 90, 20), new Student("Ravi", 85, 22), new Student("Zoya", 90, 19)));

Collections.sort(list);                        // uses compareTo: Ravi, Asha, Zoya (stable)

// Comparator: an external order, no change to the class
Comparator<Student> byName = new Comparator<Student>() {       // old anonymous-class style
    @Override public int compare(Student a, Student b) { return a.name.compareTo(b.name); }
};
Comparator<Student> byAge = (a, b) -> Integer.compare(a.age, b.age);   // lambda style
Comparator<Student> byAgeRef = Comparator.comparingInt(s -> s.age);   // helper style

list.sort(byName);
list.sort(byAge.reversed());
```

---

## 3. Sorting `int[][]` (intervals, pairs, points)

```java
int[][] intervals = {{5, 8}, {1, 3}, {2, 6}, {1, 2}};

// By start ascending
Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]));

// By start, then end ascending (tie-break)
Arrays.sort(intervals, (a, b) -> a[0] != b[0] ? Integer.compare(a[0], b[0])
                                              : Integer.compare(a[1], b[1]));

// By end ascending (activity selection / Non-overlapping Intervals)
Arrays.sort(intervals, (a, b) -> Integer.compare(a[1], b[1]));

// With Comparator helpers (the <int[]> hint is needed for the chain to infer the type)
Arrays.sort(intervals, Comparator.<int[]>comparingInt(a -> a[0]).thenComparingInt(a -> a[1]));

// Start asc, end DESC (Remove Covered Intervals, Russian Doll Envelopes)
Arrays.sort(intervals, (a, b) -> a[0] != b[0] ? Integer.compare(a[0], b[0])
                                              : Integer.compare(b[1], a[1]));

// Merge Intervals
int[][] merge(int[][] iv) {
    Arrays.sort(iv, (a, b) -> Integer.compare(a[0], b[0]));
    List<int[]> res = new ArrayList<>();
    for (int[] cur : iv) {
        if (res.isEmpty() || res.get(res.size() - 1)[1] < cur[0]) res.add(cur);
        else res.get(res.size() - 1)[1] = Math.max(res.get(res.size() - 1)[1], cur[1]);
    }
    return res.toArray(new int[0][]);
}

// Points by distance from the origin (K Closest Points), with long to avoid overflow
int[][] pts = {{3, 3}, {-2, 4}, {1, 1}};
Arrays.sort(pts, (p, q) -> Long.compare((long) p[0] * p[0] + (long) p[1] * p[1],
                                        (long) q[0] * q[0] + (long) q[1] * q[1]));
```

### Why `Integer.compare` and not `a[0] - b[0]`

```java
int[][] bad = {{Integer.MIN_VALUE, 0}, {1, 0}};
// (a, b) -> a[0] - b[0] computes MIN_VALUE - 1, which overflows to MAX_VALUE: says MIN > 1 (WRONG)
Arrays.sort(bad, (a, b) -> Integer.compare(a[0], b[0]));    // always correct
```

Subtraction is safe only when both values are known to be small (for example, both in [0, 10^9]). `Integer.compare` costs the same, so just always use it.

---

## 4. Multi-key sorting with `Comparator` combinators

| Method | What it does |
|---|---|
| `Comparator.comparing(keyFn)` | sort by a `Comparable` key (`String`, `Integer`, ...) |
| `Comparator.comparing(keyFn, keyCmp)` | sort by a key using a custom key order |
| `comparingInt / comparingLong / comparingDouble(fn)` | primitive key, no boxing |
| `.thenComparing(keyFn)` / `.thenComparingInt(fn)` | tie-breaker |
| `.reversed()` | reverse the **whole chain so far** |
| `Comparator.naturalOrder()` / `reverseOrder()` | natural ascending / descending |
| `Comparator.nullsFirst(cmp)` / `nullsLast(cmp)` | handle `null`s |
| `Collections.reverseOrder()` / `Collections.reverseOrder(cmp)` | descending |

```java
record Emp(String name, String dept, int salary, int age) {}

List<Emp> emps = new ArrayList<>(List.of(
        new Emp("Ana", "Eng", 120, 30), new Emp("Bob", "Eng", 120, 25),
        new Emp("Cy", "Ops", 90, 40),   new Emp("Di", "Eng", 150, 35)));

// dept asc, then salary DESC, then name asc
emps.sort(Comparator.comparing(Emp::dept)
        .thenComparing(Emp::salary, Comparator.reverseOrder())
        .thenComparing(Emp::name));

// salary desc, age asc: use reversed() carefully
emps.sort(Comparator.comparingInt(Emp::salary).reversed()     // reversed() applies to salary only here
        .thenComparingInt(Emp::age));

// .reversed() at the END reverses EVERYTHING before it
emps.sort(Comparator.comparingInt(Emp::salary)
        .thenComparingInt(Emp::age)
        .reversed());                                          // salary desc AND age desc

// Strings: by length, then lexicographically
List<String> words = new ArrayList<>(List.of("pear", "fig", "apple", "kiwi"));
words.sort(Comparator.comparingInt(String::length).thenComparing(Comparator.naturalOrder()));
// [fig, kiwi, pear, apple]
```

### The lambda type-inference gotcha

```java
// Compile error: with a lambda key, Java can't infer T before .reversed() / .thenComparing
// emps.sort(Comparator.comparing(e -> e.salary()).reversed());

// Fixes:
emps.sort(Comparator.comparing(Emp::salary).reversed());                 // 1. method reference
emps.sort(Comparator.comparing((Emp e) -> e.salary()).reversed());       // 2. typed lambda parameter
emps.sort(Comparator.<Emp, Integer>comparing(e -> e.salary()).reversed()); // 3. explicit type witness
```

---

## 5. Sorting objects and records

```java
// Record with a natural order
record Pair(int first, int second) implements Comparable<Pair> {
    @Override
    public int compareTo(Pair o) {
        return first != o.first ? Integer.compare(first, o.first) : Integer.compare(second, o.second);
    }
}

List<Pair> ps = new ArrayList<>(List.of(new Pair(2, 1), new Pair(1, 5), new Pair(1, 2)));
Collections.sort(ps);                       // [Pair[first=1, second=2], Pair[first=1, second=5], Pair[first=2, second=1]]
TreeSet<Pair> tsp = new TreeSet<>(ps);      // works because Pair is Comparable
PriorityQueue<Pair> pq = new PriorityQueue<>(ps);

// Object arrays
Pair[] arr = ps.toArray(new Pair[0]);
Arrays.sort(arr, Comparator.comparingInt(Pair::second));

// Sort indices by value (argsort): common for "sort but remember the original positions"
int[] nums = {30, 10, 20};
Integer[] idx = {0, 1, 2};
Arrays.sort(idx, (i, j) -> Integer.compare(nums[i], nums[j]));   // idx = [1, 2, 0]

// Or sort pairs {value, index}
int[][] vi = new int[nums.length][];
for (int i = 0; i < nums.length; i++) vi[i] = new int[]{nums[i], i};
Arrays.sort(vi, (a, b) -> Integer.compare(a[0], b[0]));
```

Sorting objects is **stable** (TimSort): equal elements keep their relative order. That lets you sort by the secondary key first and then by the primary key, though a comparator chain is clearer.

---

## 6. Sorting descending, and why `int[]` can't take a comparator

`Arrays.sort(T[] a, Comparator<? super T> c)` is generic, and generics only work with **objects**. `int` is a primitive, so there is no `Arrays.sort(int[], Comparator)` overload.

```java
int[] a = {5, 2, 9, 1};

// Option 1: box to Integer[] (easy; O(n) extra memory, slower)
Integer[] boxed = Arrays.stream(a).boxed().toArray(Integer[]::new);
Arrays.sort(boxed, Collections.reverseOrder());          // [9, 5, 2, 1]
// or Arrays.sort(boxed, (x, y) -> Integer.compare(y, x));

// Option 2: sort ascending, then reverse in place (fastest, no boxing)
Arrays.sort(a);
for (int i = 0, j = a.length - 1; i < j; i++, j--) { int t = a[i]; a[i] = a[j]; a[j] = t; }

// Option 3: negate, sort, negate back (careful: -Integer.MIN_VALUE overflows)
for (int i = 0; i < a.length; i++) a[i] = -a[i];
Arrays.sort(a);
for (int i = 0; i < a.length; i++) a[i] = -a[i];

// Option 4: stream one-liner (fine outside hot paths)
int[] desc = Arrays.stream(a).boxed().sorted(Collections.reverseOrder()).mapToInt(Integer::intValue).toArray();

// Lists are already boxed
List<Integer> list = new ArrayList<>(List.of(5, 2, 9));
list.sort(Collections.reverseOrder());
Collections.sort(list, Collections.reverseOrder());

// char[] descending: same story. Sort, then reverse
char[] cs = "hello".toCharArray();
Arrays.sort(cs);
String descStr = new StringBuilder(new String(cs)).reverse().toString();   // "ollhe"
```

| Array type | `Arrays.sort` algorithm | Stable? | Comparator? |
|---|---|---|---|
| `int[]`, `long[]`, `char[]`, `double[]` | dual-pivot quicksort | no (doesn't matter for primitives) | no |
| `Integer[]`, `String[]`, `int[][]`, objects | TimSort (merge-based) | yes | yes |

Anti-quicksort tests: on Codeforces, adversarial inputs can push `Arrays.sort(int[])` towards O(n²). The fix is to shuffle first, or sort an `Integer[]` / `List`.

```java
static void safeSort(int[] a) {
    Random r = new Random();
    for (int i = a.length - 1; i > 0; i--) { int j = r.nextInt(i + 1); int t = a[i]; a[i] = a[j]; a[j] = t; }
    Arrays.sort(a);
}
```

---

## 7. Lambda syntax

A lambda is shorthand for implementing a **functional interface** (an interface with exactly one abstract method).

```java
// Full form
Comparator<Integer> c1 = (Integer a, Integer b) -> { return Integer.compare(a, b); };
// Types inferred
Comparator<Integer> c2 = (a, b) -> { return Integer.compare(a, b); };
// Expression body: no braces, no return
Comparator<Integer> c3 = (a, b) -> Integer.compare(a, b);
// One parameter: parentheses optional
java.util.function.Function<Integer, Integer> sq = x -> x * x;
// No parameters
Runnable r = () -> System.out.println("hi");
```

Captured local variables must be **effectively final**:

```java
int k = 3;
// k++;                                            // uncommenting this breaks the lambda below
Comparator<Integer> byDist = (a, b) -> Integer.compare(Math.abs(a - k), Math.abs(b - k));

// Need a mutable counter inside a lambda? Use an array or a field
int[] count = {0};
list.forEach(x -> count[0]++);
```

### Common functional interfaces (`java.util.function`)

| Interface | Method | Shape | Example |
|---|---|---|---|
| `Function<T,R>` | `apply` | T to R | `s -> s.length()` |
| `BiFunction<T,U,R>` | `apply` | (T, U) to R | `(a, b) -> a + b` (used by `merge`) |
| `Predicate<T>` | `test` | T to boolean | `x -> x > 0` (used by `removeIf`, `filter`) |
| `Consumer<T>` | `accept` | T to void | `x -> System.out.println(x)` (used by `forEach`) |
| `Supplier<T>` | `get` | () to T | `() -> new ArrayList<>()` |
| `UnaryOperator<T>` | `apply` | T to T | `x -> x * 2` (used by `replaceAll`) |
| `BinaryOperator<T>` | `apply` | (T, T) to T | `Integer::sum` |
| `Comparator<T>` | `compare` | (T, T) to int | `(a, b) -> Integer.compare(a, b)` |
| `IntPredicate`, `IntUnaryOperator`, ... | | primitive versions, no boxing | `IntStream.filter(x -> x % 2 == 0)` |

### Method references

| Kind | Syntax | Lambda equivalent |
|---|---|---|
| Static method | `Integer::parseInt` | `s -> Integer.parseInt(s)` |
| Static, two args | `Integer::sum`, `Math::max` | `(a, b) -> Integer.sum(a, b)` |
| Instance method of an arbitrary object | `String::length` | `s -> s.length()` |
| Instance method, two args | `String::compareTo` | `(a, b) -> a.compareTo(b)` |
| Instance method of a specific object | `System.out::println` | `x -> System.out.println(x)` |
| Constructor | `ArrayList::new` | `() -> new ArrayList<>()` |
| Array constructor | `int[][]::new`, `String[]::new` | `n -> new String[n]` |

```java
map.computeIfAbsent(key, k -> new ArrayList<>()).add(v);   // k -> ... must take the key argument
map.merge(word, 1, Integer::sum);
list.replaceAll(x -> x * 2);
list.removeIf(x -> x < 0);
list.forEach(System.out::println);
String[] arr = list.stream().map(String::valueOf).toArray(String[]::new);
```

Note: `map.computeIfAbsent(k, ArrayList::new)` compiles, but it calls `new ArrayList<>(k)`, treating an `Integer` key as the **initial capacity**. That's wasteful for big keys and throws for negative ones. Use `k -> new ArrayList<>()`.

---

## 8. Streams quick reference

```java
import java.util.stream.*;

int[] nums = {3, 1, 4, 1, 5, 9, 2, 6};
List<String> words = List.of("apple", "bob", "cat", "apple", "dog");

// Numeric (IntStream: no boxing)
int sum     = Arrays.stream(nums).sum();
int max     = Arrays.stream(nums).max().getAsInt();       // OptionalInt
double avg  = Arrays.stream(nums).average().orElse(0);
long evens  = Arrays.stream(nums).filter(x -> x % 2 == 0).count();
int[] sq    = Arrays.stream(nums).map(x -> x * x).toArray();
int[] uniqSorted = Arrays.stream(nums).distinct().sorted().toArray();
int[] range = IntStream.range(0, 5).toArray();            // [0, 1, 2, 3, 4]
int[] rangeC = IntStream.rangeClosed(1, 5).toArray();     // [1, 2, 3, 4, 5]
long big    = Arrays.stream(nums).asLongStream().sum();   // avoid int overflow in sums

// Boxing and conversions
List<Integer> boxed = Arrays.stream(nums).boxed().collect(Collectors.toList());
int[] back = boxed.stream().mapToInt(Integer::intValue).toArray();

// Object streams: map / filter / collect
List<Integer> lens = words.stream().map(String::length).collect(Collectors.toList());
List<String> longOnes = words.stream().filter(w -> w.length() > 3).toList();   // immutable, Java 16+
Set<String> uniq = words.stream().collect(Collectors.toSet());
String joined = words.stream().collect(Collectors.joining(", ", "[", "]"));   // "[apple, bob, ...]"
List<String> sorted = words.stream().sorted(Comparator.reverseOrder()).toList();
boolean anyA = words.stream().anyMatch(w -> w.startsWith("a"));
boolean allShort = words.stream().allMatch(w -> w.length() < 10);
Optional<String> first = words.stream().filter(w -> w.length() == 3).findFirst();

// groupingBy / counting: frequency map in one line
Map<String, Long> freq = words.stream()
        .collect(Collectors.groupingBy(w -> w, Collectors.counting()));      // {apple=2, bob=1, ...}
Map<Integer, List<String>> byLen = words.stream()
        .collect(Collectors.groupingBy(String::length));                     // {3=[bob, cat, dog], 5=[apple, apple]}
Map<Character, Long> charFreq = "banana".chars().mapToObj(c -> (char) c)
        .collect(Collectors.groupingBy(c -> c, Collectors.counting()));
Map<Boolean, List<Integer>> parts = Arrays.stream(nums).boxed()
        .collect(Collectors.partitioningBy(x -> x > 3));

// toMap (merge function required when keys can repeat)
Map<String, Integer> lenMap = words.stream()
        .collect(Collectors.toMap(w -> w, String::length, (a, b) -> a));

// reduce
int product = Arrays.stream(nums).reduce(1, (a, b) -> a * b);

// 2D
int total = Arrays.stream(grid).flatMapToInt(Arrays::stream).sum();
int[][] copy = Arrays.stream(grid).map(int[]::clone).toArray(int[][]::new);
```

| Operation | Type | Notes |
|---|---|---|
| `map`, `filter`, `sorted`, `distinct`, `limit`, `skip`, `boxed`, `mapToInt`, `flatMap` | intermediate (lazy) | nothing runs until a terminal op |
| `sum`, `count`, `max`, `min`, `average`, `collect`, `toList`, `toArray`, `forEach`, `reduce`, `anyMatch`, `findFirst` | terminal | consumes the stream, which can't be reused |

### Warning: streams in DSA

- Streams have real overhead (object allocation, boxing, lambda dispatch). In a loop that runs 10^5 to 10^6 times, they can be **5 to 10x slower** than a plain `for` loop and cause TLE.
- `Collectors.groupingBy(..., counting())` returns `Long` values, not `Integer`.
- Interviewers usually prefer explicit loops: they show the algorithm and make the complexity obvious.
- **Rule:** use streams for one-off setup or output formatting (converting `int[]` to a `List`, joining output). Use loops in the algorithm's core.

```java
// BAD in a hot loop
for (int i = 0; i < n; i++) {
    int s = Arrays.stream(window).sum();         // O(k) plus allocation every iteration
}
// GOOD
int s = 0;
for (int x : window) s += x;                     // or maintain a running sum in O(1)
```

---

## Common pitfalls

- **`(a, b) -> a - b`** overflows for large or opposite-sign values. Use `Integer.compare(a, b)` or `Long.compare`.
- **Comparing `Integer` objects with `==` inside a comparator** (`a == b ? 0 : ...`) fails outside [-128, 127]. Use `Integer.compare` or `.equals`.
- **`.reversed()` reverses the whole chain before it**, not just the last key. Place it deliberately, or pass `Comparator.reverseOrder()` to `thenComparing`.
- **Lambda keys plus `.reversed()`** fail to compile (type inference). Use method refs, `(Type x) ->`, or `Comparator.<T>comparing`.
- **`Arrays.sort(int[], comparator)`** doesn't exist. Box to `Integer[]`, or sort then reverse.
- **A comparator returning 0 for distinct elements** in a `TreeSet`/`TreeMap` drops "duplicates". Add a tie-breaker (e.g. an index or id).
- **Inconsistent comparators** (e.g. random, or violating transitivity) cause `IllegalArgumentException: Comparison method violates its general contract!`.
- **Mutating a field used by a PQ/TreeSet comparator** while the element is inside corrupts the structure. Remove it, update it, then re-insert.
- **Capturing a non-effectively-final local** in a lambda is a compile error. Use a one-element array or a field.
- **`computeIfAbsent(k, ArrayList::new)`** with an `Integer` key passes the key as the capacity.
- **Streams in hot loops** can cause TLE. **`groupingBy` + `counting()`** gives `Long`, not `Integer`.
- **`stream().toList()`** is immutable. Use `collect(Collectors.toList())` or wrap it in `new ArrayList<>(...)` if you need to modify it.
- **Reusing a consumed stream** throws `IllegalStateException`.
