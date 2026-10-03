# Logic Building: Star Patterns

## When to use / signals

- Warm-up for nested loops: any question that asks you to print a 2D shape of `*`, numbers or letters.
- Trains the skill of turning "what changes per row" into a formula, which carries over to matrix and DP index work.
- If the shape has rows and each row is "some spaces, then some symbols", this cheat sheet applies.

## Templates

### The 4-step approach

1. **Outer loop = rows.** Count the rows (usually `n`, `2n - 1` for diamonds).
2. **Inner loop(s) = columns.** For one row, list what gets printed left to right: spaces, stars, numbers.
3. **Write each count as a function of the row index `i`.** Make a small table for `n = 4` and fit a formula.
4. **Print a newline after each row.**

```java
static void pattern(int n) {
    StringBuilder sb = new StringBuilder();        // faster than many System.out.print calls
    for (int i = 0; i < n; i++) {                  // rows (0-based)
        for (int j = 0; j < spaces(i, n); j++) sb.append(' ');
        for (int j = 0; j < stars(i, n); j++)  sb.append('*');
        sb.append('\n');
    }
    System.out.print(sb);
}
// Java 11+: sb.append(" ".repeat(k)) replaces a whole inner loop
```

### Deriving the formulas

Pyramid, `n = 4`, 0-based rows:

| Row i | Spaces | Stars |
|---|---|---|
| 0 | 3 | 1 |
| 1 | 2 | 3 |
| 2 | 1 | 5 |
| 3 | 0 | 7 |

- Spaces drop by 1 per row starting at `n - 1`, so `spaces = n - i - 1`.
- Stars grow by 2 per row starting at 1, so `stars = 2i + 1`.
- General recipe: if a count changes by `d` per row, it is `d·i + c` (or `c - d·i`). Plug in row 0 to get `c`.
- Symmetric top/bottom shapes: map the lower half onto the upper with `k = min(i, 2n - 2 - i)` and reuse the upper formula.
- 1-based rows shift everything by one (`spaces = n - i`, `stars = 2i - 1`). Pick one convention and stay with it.

### 1. Right triangle

```java
// *
// **
// ***
// ****
static void rightTriangle(int n) {
    for (int i = 1; i <= n; i++) {               // row i has i stars
        for (int j = 1; j <= i; j++) System.out.print("*");
        System.out.println();
    }
}
```

### 2. Inverted right triangle

```java
// ****
// ***
// **
// *
static void invertedTriangle(int n) {
    for (int i = 1; i <= n; i++) {               // row i has n - i + 1 stars
        for (int j = 1; j <= n - i + 1; j++) System.out.print("*");
        System.out.println();
    }
}
```

### 3. Pyramid

```java
//    *
//   ***
//  *****
// *******
static void pyramid(int n) {
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n - i - 1; j++) System.out.print(" ");   // spaces = n - i - 1
        for (int j = 0; j < 2 * i + 1; j++) System.out.print("*");   // stars  = 2i + 1
        System.out.println();
    }
}
// Inverted pyramid: same body with i running from n - 1 down to 0.
```

### 4. Diamond (pyramid + inverted pyramid)

```java
//    *
//   ***
//  *****
// *******
//  *****
//   ***
//    *
static void diamond(int n) {
    for (int i = 0; i < 2 * n - 1; i++) {
        int k = (i < n) ? i : 2 * n - 2 - i;     // mirror lower rows onto upper rows
        System.out.println(" ".repeat(n - k - 1) + "*".repeat(2 * k + 1));
    }
}
// Some versions print the middle row twice: run pyramid(n), then the inverted pyramid(n).
```

### 5. Number triangle (and Floyd's triangle)

```java
// 1            1
// 1 2          2 3
// 1 2 3        4 5 6
// 1 2 3 4      7 8 9 10
static void numberTriangle(int n) {
    for (int i = 1; i <= n; i++) {
        for (int j = 1; j <= i; j++) System.out.print(j + " ");      // column number
        System.out.println();
    }
}

static void floyd(int n) {
    int num = 1;                                  // counter lives OUTSIDE both loops
    for (int i = 1; i <= n; i++) {
        for (int j = 1; j <= i; j++) System.out.print(num++ + " ");
        System.out.println();
    }
}
```

### 6. Alphabet triangle (and the alpha hill)

```java
// A              A
// A B           ABA
// A B C        ABCBA
// A B C D     ABCDCBA
static void alphabetTriangle(int n) {
    for (int i = 0; i < n; i++) {
        for (char c = 'A'; c <= 'A' + i; c++) System.out.print(c + " ");
        System.out.println();
    }
}

static void alphaHill(int n) {
    for (int i = 0; i < n; i++) {
        StringBuilder row = new StringBuilder(" ".repeat(n - i - 1));
        int breakpoint = (2 * i + 1) / 2;         // middle column of this row
        char c = 'A';
        for (int j = 0; j < 2 * i + 1; j++) {
            row.append(c);
            if (j < breakpoint) c++; else c--;    // climb to the middle, then descend
        }
        System.out.println(row);
    }
}
```

### Bonus tricks

```java
// Hollow square: print '*' only on the border, ' ' inside
for (int i = 0; i < n; i++) {
    for (int j = 0; j < n; j++)
        System.out.print(i == 0 || i == n - 1 || j == 0 || j == n - 1 ? '*' : ' ');
    System.out.println();
}

// Concentric squares (n = 3 gives a 5 x 5 grid, 3 on the outer ring, 1 in the centre)
int size = 2 * n - 1;
for (int i = 0; i < size; i++) {
    for (int j = 0; j < size; j++) {
        int distToEdge = Math.min(Math.min(i, j), Math.min(size - 1 - i, size - 1 - j));
        System.out.print(n - distToEdge);
    }
    System.out.println();
}
```

## Complexity

| Pattern | Time | Extra space |
|---|---|---|
| Any triangle / pyramid of n rows | O(n²) | O(1) |
| Diamond (2n - 1 rows) | O(n²) | O(1) |
| Square / hollow / concentric (k × k grid) | O(k²) | O(1) |
| Using a StringBuilder per row | O(n²) | O(n) buffer |

Output size itself is Θ(n²), so O(n²) is optimal.

## Pitfalls

- `print` vs `println`: forgetting the newline at the end of each row merges all rows.
- Mixing 0-based and 1-based rows inside one formula gives off-by-one shapes. Fix the convention first.
- `'A' + j` is an `int` (65 + j). Cast with `(char) ('A' + j)` before printing.
- `System.out.print(num++ + " ")` is fine, but `System.out.print('*' + ' ')` prints the number 74 (char addition).
- The diamond's middle row is printed twice if you run pyramid and inverted pyramid naively. Check what the expected output wants.
- Some judges reject trailing spaces; build the row and trim, or print the separator only between items.
- Hundreds of `System.out.print` calls are slow in Java; use one `StringBuilder` and print once.

## Must-know problems

- Rectangular Star Pattern
- Right-Angled Triangle Pattern
- Right-Angled Number Pyramid
- Inverted Right Pyramid
- Star Pyramid
- Inverted Star Pyramid
- Diamond Star Pattern
- Half Diamond Star Pattern
- Binary Number Triangle
- Number Crown Pattern
- Increasing Number Triangle (Floyd's Triangle)
- Increasing Letter Triangle
- Reverse Letter Triangle
- Alpha-Ramp Pattern
- Alpha-Hill Pattern
- Alpha-Triangle Pattern
- Symmetric-Void Pattern
- Symmetric-Butterfly Pattern
- Hollow Rectangle Pattern
- The Number Pattern (concentric squares)
