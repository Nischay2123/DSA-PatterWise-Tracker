# Advanced Strings

## When to use / signals

- Find a pattern in a text faster than O(n * m): KMP, Z-function or Rabin-Karp.
- "Longest prefix that is also a suffix", "period of a string", "is it a repetition": the KMP LPS array.
- "Palindromic prefix", "add characters in front to make a palindrome": KMP on `s + '#' + reverse(s)`.
- Comparing many substrings for equality, duplicate substrings, binary search on length: rolling hash.
- "Longest palindromic substring" in O(n), count palindromic substrings: Manacher.

## Templates

### Which tool?

| Need | Tool | Time |
|---|---|---|
| First / all occurrences of one pattern | KMP (or Z on `pat + '$' + text`) | O(n + m) |
| Longest border (prefix = suffix), string period, repeated pattern | KMP LPS array | O(n) |
| Longest common prefix of `s` with every suffix of `s` | Z-function | O(n) |
| Many substring equality checks, multiple patterns of the same length | Rabin-Karp / prefix hashes | O(n + m) expected |
| Longest palindromic substring, count palindromes | Manacher (or expand-around-centre in O(n^2)) | O(n) |
| Palindromic prefix / min chars to prepend | KMP on `s + '#' + rev(s)` | O(n) |

### KMP: the LPS (prefix function) array

`lps[i]` = length of the longest **proper** prefix of `p[0..i]` that is also a suffix of it. On a mismatch, instead of restarting, fall back to `lps[len - 1]` because that much is already known to match.

Step by step for `p = "aabaaab"`:

| i | p[i] | len before | what happens | lps[i] |
|---|---|---|---|---|
| 0 | a | - | base case | 0 |
| 1 | a | 0 | `p[1] == p[0]`, len becomes 1 | 1 |
| 2 | b | 1 | `b != p[1]`, fall back len = lps[0] = 0; `b != p[0]` | 0 |
| 3 | a | 0 | `a == p[0]`, len becomes 1 | 1 |
| 4 | a | 1 | `a == p[1]`, len becomes 2 | 2 |
| 5 | a | 2 | `a != p[2]`, fall back len = lps[1] = 1; `a == p[1]`, len becomes 2 | 2 |
| 6 | b | 2 | `b == p[2]`, len becomes 3 | 3 |

```java
int[] buildLps(String p) {
    int[] lps = new int[p.length()];
    for (int i = 1, len = 0; i < p.length(); ) {
        if (p.charAt(i) == p.charAt(len)) lps[i++] = ++len;   // extend the border
        else if (len > 0) len = lps[len - 1];                 // fall back, keep i
        else lps[i++] = 0;                                    // no border at all
    }
    return lps;
}

int kmpSearch(String text, String pat) {                      // first index of pat in text, or -1
    if (pat.isEmpty()) return 0;
    int[] lps = buildLps(pat);
    for (int i = 0, j = 0; i < text.length(); ) {             // i in text, j in pat, i never moves back
        if (text.charAt(i) == pat.charAt(j)) {
            i++;
            j++;
            if (j == pat.length()) return i - j;              // all matches: record i - j, then j = lps[j - 1]
        } else if (j > 0) j = lps[j - 1];
        else i++;
    }
    return -1;
}
// Repeated Substring Pattern: int b = lps[n - 1]; answer = b > 0 && n % (n - b) == 0.
```

### Z-function

`z[i]` = length of the longest common prefix of `s` and `s.substring(i)`. Keep the rightmost window `[l, r)` that matches a prefix and reuse values inside it.

```java
int[] zFunction(String s) {
    int n = s.length();
    int[] z = new int[n];
    for (int i = 1, l = 0, r = 0; i < n; i++) {
        if (i < r) z[i] = Math.min(r - i, z[i - l]);          // reuse inside the Z-box
        while (i + z[i] < n && s.charAt(z[i]) == s.charAt(i + z[i])) z[i]++;   // extend naively
        if (i + z[i] > r) { l = i; r = i + z[i]; }
    }
    return z;
}
// Pattern search: z = zFunction(pat + "$" + text); every i with z[i] == pat.length()
// is a match at text index i - pat.length() - 1. The separator must not occur in either string.
```

### Rabin-Karp rolling hash

Hash a window as a polynomial `s[0]*B^(m-1) + ... + s[m-1]` mod a large prime. Slide by removing the leftmost term and appending the new character, in O(1).

```java
int rabinKarp(String text, String pat) {
    final long MOD = 1_000_000_007L, BASE = 131;
    int n = text.length(), m = pat.length();
    if (m > n) return -1;
    long power = 1;                                           // BASE^(m-1) % MOD
    for (int i = 1; i < m; i++) power = power * BASE % MOD;
    long hp = 0, ht = 0;
    for (int i = 0; i < m; i++) {
        hp = (hp * BASE + pat.charAt(i)) % MOD;
        ht = (ht * BASE + text.charAt(i)) % MOD;
    }
    for (int i = 0; ; i++) {
        if (hp == ht && text.regionMatches(i, pat, 0, m)) return i;   // verify: hashes can collide
        if (i + m == n) return -1;
        ht = (ht - text.charAt(i) * power % MOD + MOD) % MOD;          // drop the left char
        ht = (ht * BASE + text.charAt(i + m)) % MOD;                   // append the right char
    }
}

// Prefix hashes: O(1) hash of any substring s[l..r) after O(n) precomputation
long[] h, pw;
void buildHashes(String s, long BASE, long MOD) {
    int n = s.length();
    h = new long[n + 1];
    pw = new long[n + 1];
    pw[0] = 1;
    for (int i = 0; i < n; i++) {
        h[i + 1] = (h[i] * BASE + s.charAt(i)) % MOD;
        pw[i + 1] = pw[i] * BASE % MOD;
    }
}
long hash(int l, int r, long MOD) { return ((h[r] - h[l] * pw[r - l]) % MOD + MOD) % MOD; }
```

Collision notes:
- Two different strings can share a hash. Either verify on a hash hit (as above) or use **double hashing** (two independent mods / bases) and compare the pair.
- Keep every value below the mod before multiplying so `long` never overflows (`1e9 * 1e9 < 9.2e18`).
- Letting `long` overflow naturally (mod 2^64) is fast but breaks on known anti-hash inputs; prefer a prime mod.
- Subtraction under a mod can go negative in Java; add `MOD` before the final `%`.

### Manacher (brief)

Insert separators so every palindrome has odd length, then reuse the mirror of the current rightmost palindrome, just like the Z-box.

```java
String longestPalindrome(String s) {
    StringBuilder sb = new StringBuilder("^");
    for (char c : s.toCharArray()) sb.append('#').append(c);
    String t = sb.append("#$").toString();                    // sentinels ^ and $ stop expansion
    int n = t.length(), center = 0, right = 0;
    int[] p = new int[n];                                     // p[i] = palindrome radius at i in t
    for (int i = 1; i < n - 1; i++) {
        if (i < right) p[i] = Math.min(right - i, p[2 * center - i]);   // mirror value
        while (t.charAt(i + p[i] + 1) == t.charAt(i - p[i] - 1)) p[i]++;
        if (i + p[i] > right) { center = i; right = i + p[i]; }
    }
    int best = 0, at = 0;
    for (int i = 1; i < n - 1; i++) if (p[i] > best) { best = p[i]; at = i; }
    int start = (at - best) / 2;                              // map back to an index in s
    return s.substring(start, start + best);                  // radius in t = length in s
}
```

### Problems

```java
int strStr(String haystack, String needle) { return kmpSearch(haystack, needle); }

String shortestPalindrome(String s) {                         // add the fewest chars in FRONT
    String rev = new StringBuilder(s).reverse().toString();
    int[] lps = buildLps(s + "#" + rev);                      // '#' stops a border crossing the middle
    int palPrefix = lps[lps.length - 1];                      // longest palindromic prefix of s
    return rev.substring(0, s.length() - palPrefix) + s;
}
// Minimum characters to add in front to make a palindrome = s.length() - palPrefix.

String longestPrefix(String s) {                              // Longest Happy Prefix
    int[] lps = buildLps(s);
    return s.substring(0, lps[s.length() - 1]);
}

int repeatedStringMatch(String a, String b) {                 // min copies of a containing b
    StringBuilder sb = new StringBuilder(a);
    int count = 1;
    while (sb.length() < b.length()) { sb.append(a); count++; }
    if (kmpSearch(sb.toString(), b) != -1) return count;
    if (kmpSearch(sb.append(a).toString(), b) != -1) return count + 1;   // b may straddle one more copy
    return -1;
}

String countAndSay(int n) {
    String s = "1";
    for (int k = 1; k < n; k++) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < s.length(); ) {
            int j = i;
            while (j < s.length() && s.charAt(j) == s.charAt(i)) j++;   // run s[i..j)
            sb.append(j - i).append(s.charAt(i));                      // "count" then "digit"
            i = j;
        }
        s = sb.toString();
    }
    return s;
}
```

## Complexity

| Algorithm / problem | Time | Space |
|---|---|---|
| Naive substring search | O(n * m) | O(1) |
| LPS array | O(m) | O(m) |
| KMP search | O(n + m) | O(m) |
| Z-function | O(n) | O(n) |
| Rabin-Karp | O(n + m) expected, O(n * m) worst with many collisions | O(1) |
| Prefix hashes + substring hash | O(n) build, O(1) per query | O(n) |
| Manacher | O(n) | O(n) |
| Shortest palindrome, longest happy prefix | O(n) | O(n) |
| Repeated string match | O(n + m) | O(n + m) |
| Count and say | O(total length of all terms) | O(length of the last term) |

## Pitfalls

- LPS uses **proper** prefixes: `lps[i] <= i`, never the whole string.
- On a KMP mismatch with `j > 0`, do not advance `i`; only fall back `j`.
- For all matches, after a full match set `j = lps[j - 1]` rather than 0, or overlapping matches are lost.
- The separator in `s + '#' + rev` or `pat + '$' + text` must not appear in the inputs.
- Rabin-Karp without verification returns false positives; with a small mod, collisions are frequent.
- `text.charAt(i) * power` is fine because `power` is `long`; with two `int`s the product overflows first.
- Manacher sentinels `^`, `#`, `$` must not occur in `s` (pick other characters if they might).
- Building strings with `+` in a loop is O(n^2); use `StringBuilder`.

## Must-know problems

- Find the Index of the First Occurrence in a String (strStr)
- Repeated Substring Pattern
- Longest Happy Prefix
- Shortest Palindrome
- Minimum Characters to be Added at Front to Make String Palindrome
- Repeated String Match
- Count and Say
- Z-function / pattern search with Z
- Rabin-Karp pattern search
- Longest Duplicate Substring (binary search + rolling hash)
- Longest Palindromic Substring (expand around centre, Manacher)
- Palindromic Substrings count
