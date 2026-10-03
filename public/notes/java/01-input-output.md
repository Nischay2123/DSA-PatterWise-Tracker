# Java Input / Output for DSA

> **TL;DR**: Use `Scanner` while you are learning and on small inputs. Switch to `BufferedReader` + `StringTokenizer` (or a `FastReader`) once input goes past about 10^5 tokens.
> Collect output in a `StringBuilder` or `PrintWriter` and print it once at the end. Don't call `System.out.println` inside big loops.
> On LeetCode you never parse input: you only fill in a method inside `class Solution`.

---

## 1. Scanner basics: every primitive type

```java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);

        int     a  = sc.nextInt();            // 42
        long    b  = sc.nextLong();           // 10000000000
        double  d  = sc.nextDouble();         // 3.14
        float   f  = sc.nextFloat();          // 2.5
        boolean ok = sc.nextBoolean();        // true / false (case-insensitive)
        char    c  = sc.next().charAt(0);     // there is no nextChar(): read a token, take its first char
        String  w  = sc.next();               // a single word (stops at whitespace)
        sc.nextLine();                        // consume the leftover '\n' (see pitfall below)
        String  line = sc.nextLine();         // the full line including spaces

        System.out.println(a + " " + b + " " + d + " " + f + " " + ok + " " + c + " " + w + " | " + line);
        sc.close();
    }
}
```

| Method | Reads | Stops at |
|---|---|---|
| `nextInt()` / `nextLong()` / `nextDouble()` | one numeric token | whitespace (the `\n` is NOT consumed) |
| `next()` | one word | whitespace |
| `nextLine()` | the rest of the current line | `\n` (consumed and discarded) |
| `hasNext()` / `hasNextInt()` / `hasNextLine()` | a peek, returns boolean | used for EOF loops |

### The `nextInt()` then `nextLine()` pitfall

Input:
```
3
hello world
```

```java
Scanner sc = new Scanner(System.in);
int n = sc.nextInt();        // reads "3", the cursor stays BEFORE '\n'
String s = sc.nextLine();    // BUG: returns "" (the rest of line 1)

// FIX 1: throw away the rest of the line first
int n2 = sc.nextInt();
sc.nextLine();               // eats the '\n'
String s2 = sc.nextLine();   // "hello world"

// FIX 2: read every line with nextLine and parse it yourself
int n3 = Integer.parseInt(sc.nextLine().trim());
String s3 = sc.nextLine();
```

---

## 2. Arrays and matrices

### Array of n ints

Input:
```
5
4 2 9 1 7
```

```java
int n = sc.nextInt();
int[] arr = new int[n];
for (int i = 0; i < n; i++) arr[i] = sc.nextInt();
```

### Array of longs, 1-indexed (handy for prefix sums)

```java
long[] a = new long[n + 1];
for (int i = 1; i <= n; i++) a[i] = sc.nextLong();
```

### 2D matrix n x m

Input:
```
2 3
1 2 3
4 5 6
```

```java
int n = sc.nextInt(), m = sc.nextInt();
int[][] mat = new int[n][m];
for (int i = 0; i < n; i++)
    for (int j = 0; j < m; j++)
        mat[i][j] = sc.nextInt();
```

### Jagged input (each row has its own length)

Input: 3 rows, and each row starts with its size.
```
3
2 10 20
4 1 2 3 4
1 99
```

```java
int rows = sc.nextInt();
int[][] jag = new int[rows][];
for (int i = 0; i < rows; i++) {
    int k = sc.nextInt();
    jag[i] = new int[k];
    for (int j = 0; j < k; j++) jag[i][j] = sc.nextInt();
}
```

### Array of strings (words)

```java
int n = sc.nextInt();
String[] words = new String[n];
for (int i = 0; i < n; i++) words[i] = sc.next();
```

### Char grid (rows of strings into char[][])

Input:
```
3 4
#..#
.##.
....
```

```java
int n = sc.nextInt(), m = sc.nextInt();
char[][] grid = new char[n][];
for (int i = 0; i < n; i++) grid[i] = sc.next().toCharArray();   // each row is one token
// grid[i][j] == '#'
```

If a row can contain spaces, read it with `nextLine()` after consuming the leftover newline.

---

## 3. Multiple test cases, EOF, and delimited lines

### T test cases

Input:
```
2
3
1 2 3
2
5 6
```

```java
int T = sc.nextInt();
StringBuilder out = new StringBuilder();
while (T-- > 0) {
    int n = sc.nextInt();
    long sum = 0;
    for (int i = 0; i < n; i++) sum += sc.nextInt();
    out.append(sum).append('\n');
}
System.out.print(out);
```

### Read until EOF (no count given)

```java
// Scanner
while (sc.hasNextInt()) {
    int x = sc.nextInt();
    // process x
}

// BufferedReader: readLine() returns null at EOF
BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
String line;
while ((line = br.readLine()) != null) {
    if (line.isEmpty()) continue;
    // process line
}
```

When you run locally, EOF is `Ctrl+D` on macOS/Linux and `Ctrl+Z` then Enter on Windows.

### Comma- or space-separated line

Input: `1,2, 3 ,4` or `1 2   3 4`

```java
String line = sc.nextLine().trim();

// comma separated, with optional spaces around the commas
String[] parts = line.split("\\s*,\\s*");
// whitespace separated, any amount of spaces
String[] parts2 = line.split("\\s+");

int[] nums = new int[parts.length];
for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i].trim());

// one-liner (slower, fine outside hot loops)
int[] nums2 = Arrays.stream(line.split("\\s+")).mapToInt(Integer::parseInt).toArray();
```

`split` takes a regex, so to split on `.`, `|` or `+` you need `split("\\.")`, `split("\\|")` and so on.

---

## 4. Graphs and trees

### Graph: edge list into an adjacency list

Input: n nodes, m edges (1-indexed, undirected)
```
4 4
1 2
2 3
3 4
4 1
```

```java
int n = sc.nextInt(), m = sc.nextInt();
List<List<Integer>> adj = new ArrayList<>();
for (int i = 0; i <= n; i++) adj.add(new ArrayList<>());   // size n+1 for 1-indexed nodes
for (int i = 0; i < m; i++) {
    int u = sc.nextInt(), v = sc.nextInt();
    adj.get(u).add(v);
    adj.get(v).add(u);          // drop this line for a directed graph
}
```

Weighted graph (`u v w`): store `int[]{v, w}`.

```java
List<List<int[]>> g = new ArrayList<>();
for (int i = 0; i <= n; i++) g.add(new ArrayList<>());
for (int i = 0; i < m; i++) {
    int u = sc.nextInt(), v = sc.nextInt(), w = sc.nextInt();
    g.get(u).add(new int[]{v, w});
    g.get(v).add(new int[]{u, w});
}
```

### Tree as a parent array

Input: n, then `parent[i]` for i = 0..n-1, where `-1` marks the root
```
5
-1 0 0 1 1
```

```java
int n = sc.nextInt();
List<List<Integer>> children = new ArrayList<>();
for (int i = 0; i < n; i++) children.add(new ArrayList<>());
int root = -1;
for (int i = 0; i < n; i++) {
    int p = sc.nextInt();
    if (p == -1) root = i;
    else children.get(p).add(i);
}
```

### Tree as n-1 edges (most common on CF/CodeChef)

It is the same as the undirected graph above with `m = n - 1`. Run DFS from node 1 and pass the parent along to avoid walking back up.

---

## 5. BufferedReader + StringTokenizer

`Scanner` parses with regex, so it is slow (roughly 10x slower on 10^6 numbers). `BufferedReader` reads raw lines and `StringTokenizer` splits them cheaply.

```java
import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));

        int n = Integer.parseInt(br.readLine().trim());      // single number on a line

        StringTokenizer st = new StringTokenizer(br.readLine());
        int[] arr = new int[n];
        for (int i = 0; i < n; i++) arr[i] = Integer.parseInt(st.nextToken());

        st = new StringTokenizer(br.readLine());             // "n m" on one line
        int r = Integer.parseInt(st.nextToken());
        int c = Integer.parseInt(st.nextToken());

        String fullLine = br.readLine();                      // a full line with spaces, no pitfall
    }
}
```

Numbers may wrap across lines unpredictably, so you need a tokenizer that refills itself. That is the `FastReader` below.

---

## 6. FastReader template (copy-paste)

```java
import java.io.*;
import java.util.*;

class FastReader {
    private final BufferedReader br;
    private StringTokenizer st;

    FastReader() { br = new BufferedReader(new InputStreamReader(System.in)); }
    FastReader(InputStream in) { br = new BufferedReader(new InputStreamReader(in)); }

    String next() {
        while (st == null || !st.hasMoreTokens()) {
            try {
                String line = br.readLine();
                if (line == null) return null;          // EOF
                st = new StringTokenizer(line);
            } catch (IOException e) { throw new UncheckedIOException(e); }
        }
        return st.nextToken();
    }

    int nextInt()       { return Integer.parseInt(next()); }
    long nextLong()     { return Long.parseLong(next()); }
    double nextDouble() { return Double.parseDouble(next()); }
    char nextChar()     { return next().charAt(0); }

    String nextLine() {                                // rest of the current line
        try {
            if (st != null && st.hasMoreTokens()) {
                StringBuilder sb = new StringBuilder(st.nextToken());
                while (st.hasMoreTokens()) sb.append(' ').append(st.nextToken());
                return sb.toString();                  // note: collapses runs of spaces
            }
            return br.readLine();
        } catch (IOException e) { throw new UncheckedIOException(e); }
    }

    int[] nextIntArray(int n) {
        int[] a = new int[n];
        for (int i = 0; i < n; i++) a[i] = nextInt();
        return a;
    }

    long[] nextLongArray(int n) {
        long[] a = new long[n];
        for (int i = 0; i < n; i++) a[i] = nextLong();
        return a;
    }
}
```

Usage:

```java
FastReader in = new FastReader();
int n = in.nextInt();
int[] a = in.nextIntArray(n);
```

---

## 7. Fast output

`System.out.println` flushes and synchronises on every call. With 10^5 lines that alone can cause a TLE.

### StringBuilder: build once, print once

```java
StringBuilder sb = new StringBuilder();
for (int i = 0; i < n; i++) sb.append(arr[i]).append(' ');
sb.append('\n');
System.out.print(sb);
```

### PrintWriter: buffered, printf-friendly

```java
PrintWriter out = new PrintWriter(new BufferedWriter(new OutputStreamWriter(System.out)));
out.println(42);
out.printf("%.6f%n", 3.14159265);
out.print("a b c\n");
out.flush();          // MUST flush (or close) at the end, otherwise nothing is printed
```

### Printing arrays for debugging

```java
int[] a = {3, 1, 2};
int[][] g = {{1, 2}, {3, 4}};
List<Integer> list = List.of(1, 2, 3);

System.out.println(a);                        // [I@1b6d3586  (a memory reference, useless)
System.out.println(Arrays.toString(a));       // [3, 1, 2]
System.out.println(Arrays.deepToString(g));   // [[1, 2], [3, 4]]
System.out.println(list);                     // [1, 2, 3]  (collections print fine)

// space-separated, the format judges expect
StringBuilder sb = new StringBuilder();
for (int x : a) sb.append(x).append(' ');
System.out.println(sb.toString().trim());

// with streams (fine for one-off output)
System.out.println(Arrays.stream(a).mapToObj(String::valueOf).collect(java.util.stream.Collectors.joining(" ")));
```

Send debug prints to `System.err`. Most judges ignore stderr, so it won't cause a wrong answer.

```java
System.err.println("dbg: " + Arrays.toString(a));
```

---

## 8. Redirecting input from a file for local testing

```java
public static void main(String[] args) throws IOException {
    // only local: set -DLOCAL in your IDE's VM options, or use an env var
    if (System.getProperty("LOCAL") != null) {
        System.setIn(new FileInputStream("input.txt"));
        System.setOut(new PrintStream(new FileOutputStream("output.txt")));
    }
    Scanner sc = new Scanner(System.in);   // create readers AFTER setIn
    // ...
}
```

You can also redirect from the shell with no code change: `java Main < input.txt > output.txt`.

---

## 9. Full competitive-programming `Main` template

```java
import java.io.*;
import java.util.*;

public class Main {
    static final int MOD = 1_000_000_007;
    static final int INF = Integer.MAX_VALUE;
    static FastReader in;
    static PrintWriter out;

    public static void main(String[] args) throws IOException {
        if (System.getProperty("LOCAL") != null) System.setIn(new FileInputStream("input.txt"));
        in = new FastReader();
        out = new PrintWriter(new BufferedWriter(new OutputStreamWriter(System.out)));

        int T = in.nextInt();            // remove for single-test problems
        while (T-- > 0) solve();

        out.flush();
    }

    static void solve() {
        int n = in.nextInt();
        int[] a = in.nextIntArray(n);
        long sum = 0;
        for (int x : a) sum += x;
        out.println(sum);
    }

    // ---- paste FastReader here as a static nested class ----
    static class FastReader {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st;
        String next() {
            while (st == null || !st.hasMoreTokens()) {
                try { st = new StringTokenizer(br.readLine()); }
                catch (IOException e) { throw new UncheckedIOException(e); }
            }
            return st.nextToken();
        }
        int nextInt()   { return Integer.parseInt(next()); }
        long nextLong() { return Long.parseLong(next()); }
        int[] nextIntArray(int n) { int[] a = new int[n]; for (int i = 0; i < n; i++) a[i] = nextInt(); return a; }
    }
}
```

Most judges (Codeforces, CodeChef, GFG "full program" mode) need the class to be named `Main` or to match the file name. It must not have a `package` line.

### Deep recursion in CP: run `solve` on a big-stack thread

```java
public static void main(String[] args) {
    new Thread(null, () -> { /* call solve here */ }, "main", 1 << 26).start();   // 64 MB stack
}
```

---

## 10. LeetCode style vs GFG / CodeChef style

| | LeetCode | GFG (function problems) | CodeChef / Codeforces / GFG full-program |
|---|---|---|---|
| Input parsing | none, the judge calls your method | none, driver code is hidden | **you** read stdin |
| What you write | a method inside `class Solution` | a method inside `class Solution` | the full `public class Main` with `main` |
| Output | `return` a value | `return` a value | print to stdout in the exact format |
| Data structures given | `ListNode`, `TreeNode`, and so on, already defined | `Node` class already defined | you build them from input |
| Imports | `java.util.*` is auto-imported | usually there | you add `import java.util.*; import java.io.*;` |

### LeetCode: implement only the method

```java
class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            Integer j = seen.get(target - nums[i]);
            if (j != null) return new int[]{j, i};
            seen.put(nums[i], i);
        }
        return new int[0];
    }
}
```

Watch out for `static` fields on LeetCode: they persist across test cases in the same run. Reset them inside the method, or use instance fields.

### Codeforces / CodeChef: read, solve, print

```java
import java.util.*;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt(), target = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        // ... same logic, then print
    }
}
```

### Scanner vs BufferedReader: when to use which

| Situation | Use |
|---|---|
| Learning, small input (< 10^4 tokens) | `Scanner` |
| Input up to about 10^5 tokens with a relaxed time limit | `Scanner` usually works, `BufferedReader` is safer |
| 10^5 to 10^6+ tokens, tight TL (CF/CodeChef) | `BufferedReader` + `StringTokenizer` / `FastReader` |
| Need full lines with spaces | `BufferedReader.readLine()` (no newline pitfall) |
| Reading until EOF | `Scanner.hasNext*()` or `readLine() != null` |
| Need `nextDouble`, `nextBoolean` convenience | `Scanner` (or `Double.parseDouble` on a token) |
| Output-heavy (many lines) | `StringBuilder` or `PrintWriter` regardless of the reader |
| LeetCode / GFG function problems | neither: no I/O at all |

| Property | Scanner | BufferedReader |
|---|---|---|
| Speed | slow (regex parsing) | fast (8 KB buffer, no parsing) |
| Parses types | yes (`nextInt`, ...) | no, you call `Integer.parseInt` |
| Checked exception | no | `IOException` (add `throws IOException`) |
| Thread-safe | no | yes (synchronized) |
| Buffer | 1 KB | 8 KB |

---

## Common pitfalls

- **`nextInt()` then `nextLine()`** returns an empty string. Call an extra `nextLine()` first, or parse every line yourself.
- **Forgetting `out.flush()`** on a `PrintWriter` gives empty output and a Wrong Answer.
- **Printing an array directly** (`System.out.println(arr)`) prints `[I@hash`. Use `Arrays.toString`.
- **Using `Scanner` on 10^6 numbers** can TLE. Switch to `FastReader`.
- **`println` inside a loop of 10^5+** is slow. Buffer the output.
- **`split(".")` or `split("|")`** are regex metacharacters and give wrong results. Escape them as `"\\."` and `"\\|"`.
- **Leading/trailing spaces** make `split` produce empty tokens and `Integer.parseInt` throws `NumberFormatException`. Call `trim()` first and split on `"\\s+"`.
- **Creating a new `Scanner` inside a loop** or per test case can lose buffered input. Create exactly one.
- **A `package` line or a class not named `Main`** on CF/CodeChef gives a compilation error.
- **Reading an int that doesn't fit** (e.g. 10^10) with `nextInt` throws `InputMismatchException`. Read it as `long`.
- **Static state on LeetCode** leaks between test cases. Reinitialise it inside the method.
- **Off-by-one on 1-indexed graphs**: allocate `n + 1` adjacency lists.
