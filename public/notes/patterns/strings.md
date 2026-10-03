# Strings

## When to use / signals

- Character counts, anagrams, "same letters": **frequency array** `int[26]` / `int[128]`.
- "Palindromic substring", "longest palindrome": **expand around center**.
- Building or transforming output character by character: **StringBuilder** (never `+=` in a loop).
- Parsing numbers or formats (atoi, roman numerals): **scan left to right with explicit edge-case steps**.
- One-to-one character mapping: **two mapping arrays** (isomorphic, word pattern).
- "Is B a rotation of A": **B is a substring of A + A**.
- Many string problems are really arrays of chars: two pointers, sliding window, hashing all apply.

## Templates

### Java string toolkit

```java
char c = s.charAt(i);                  // O(1)
char[] cs = s.toCharArray();           // O(n) copy, mutable; back with new String(cs)
String sub = s.substring(l, r);        // [l, r), O(r - l) copy
boolean same = a.equals(b);            // never a == b for content
String[] words = s.trim().split("\\s+");         // split on runs of whitespace
int num = Integer.parseInt("123");  String t = String.valueOf(42);
Character.isLetterOrDigit(c); Character.isLetter(c); Character.toLowerCase(c);
int digit = c - '0';  int idx = c - 'a';  char next = (char) (c + 1);

StringBuilder sb = new StringBuilder();
sb.append(x).append(' ');              // amortised O(1)
sb.insert(0, x);                       // O(n): avoid in loops
sb.setCharAt(i, 'z'); sb.deleteCharAt(sb.length() - 1); sb.reverse(); sb.toString();
```

### Frequency array and anagram check

```java
public boolean isAnagram(String s, String t) {
    if (s.length() != t.length()) return false;
    int[] freq = new int[26];
    for (int i = 0; i < s.length(); i++) {
        freq[s.charAt(i) - 'a']++;                 // +1 for s
        freq[t.charAt(i) - 'a']--;                 // -1 for t
    }
    for (int f : freq) if (f != 0) return false;
    return true;
}
```

### Palindrome: expand around center

Every palindrome has a center: a character (odd length) or a gap between two characters (even length). Try all 2n - 1 centers.

```java
public String longestPalindrome(String s) {
    int start = 0, end = 0;                        // best window [start, end]
    for (int c = 0; c < s.length(); c++) {
        int len = Math.max(expand(s, c, c), expand(s, c, c + 1));   // odd, even
        if (len > end - start + 1) {
            start = c - (len - 1) / 2;
            end = c + len / 2;
        }
    }
    return s.substring(start, end + 1);
}

private int expand(String s, int l, int r) {
    while (l >= 0 && r < s.length() && s.charAt(l) == s.charAt(r)) { l--; r++; }
    return r - l - 1;                              // length of the palindrome found
}
// Count palindromic substrings: same loops, count++ on every successful expansion step.
```

### Reverse words in a string

```java
public String reverseWords(String s) {
    String[] words = s.trim().split("\\s+");       // trim first, else a leading "" word appears
    StringBuilder sb = new StringBuilder();
    for (int i = words.length - 1; i >= 0; i--) {
        sb.append(words[i]);
        if (i > 0) sb.append(' ');
    }
    return sb.toString();
}
// O(1) extra space on a char[]: reverse the whole array, then reverse each word.
```

### String to integer (atoi)

```java
public int myAtoi(String s) {
    int i = 0, n = s.length(), sign = 1, res = 0;
    while (i < n && s.charAt(i) == ' ') i++;                        // 1. skip leading spaces
    if (i < n && (s.charAt(i) == '+' || s.charAt(i) == '-'))        // 2. at most one sign
        sign = (s.charAt(i++) == '-') ? -1 : 1;
    while (i < n && s.charAt(i) >= '0' && s.charAt(i) <= '9') {     // 3. digits until a non-digit
        int d = s.charAt(i++) - '0';
        if (res > (Integer.MAX_VALUE - d) / 10)                     // 4. clamp before overflow
            return sign == 1 ? Integer.MAX_VALUE : Integer.MIN_VALUE;
        res = res * 10 + d;
    }
    return sign * res;
}
```

Edge cases: `"   -42"` gives -42, `"4193 with words"` gives 4193, `"words 987"` gives 0, `"+-12"` gives 0, `""` gives 0, `"-91283472332"` gives `Integer.MIN_VALUE`, `"00000123"` gives 123.

### Roman to integer and integer to roman

```java
public int romanToInt(String s) {
    Map<Character, Integer> val = Map.of('I', 1, 'V', 5, 'X', 10, 'L', 50,
                                         'C', 100, 'D', 500, 'M', 1000);
    int total = 0;
    for (int i = 0; i < s.length(); i++) {
        int cur = val.get(s.charAt(i));
        if (i + 1 < s.length() && cur < val.get(s.charAt(i + 1))) total -= cur;  // IV, IX, XL, CM ...
        else total += cur;
    }
    return total;
}

public String intToRoman(int num) {
    int[] vals = {1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1};
    String[] syms = {"M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"};
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < vals.length; i++)
        while (num >= vals[i]) { num -= vals[i]; sb.append(syms[i]); }   // greedy, largest first
    return sb.toString();
}
```

### Isomorphic strings (one-to-one mapping)

```java
public boolean isIsomorphic(String s, String t) {
    if (s.length() != t.length()) return false;
    int[] seenS = new int[256], seenT = new int[256];   // last position + 1 where each char occurred
    for (int i = 0; i < s.length(); i++) {
        char a = s.charAt(i), b = t.charAt(i);
        if (seenS[a] != seenT[b]) return false;         // a and b must always appear together
        seenS[a] = seenT[b] = i + 1;
    }
    return true;
}
```

### Rotation check

```java
public boolean rotateString(String s, String goal) {
    return s.length() == goal.length() && (s + s).contains(goal);   // every rotation lives in s + s
}
// contains() is O(n * m) worst case; KMP or Z-function makes it O(n).
```

### Longest common prefix

```java
public String longestCommonPrefix(String[] strs) {
    Arrays.sort(strs);                              // the most different pair ends up first and last
    String a = strs[0], b = strs[strs.length - 1];
    int i = 0;
    while (i < a.length() && i < b.length() && a.charAt(i) == b.charAt(i)) i++;
    return a.substring(0, i);
}
```

### Building strings: StringBuilder vs concatenation

```java
String bad = "";
for (int i = 0; i < n; i++) bad += i;              // O(n^2): copies the whole string every time

StringBuilder sb = new StringBuilder();
for (int i = 0; i < n; i++) sb.append(i);        // O(n) total
String good = sb.toString();
```

## Complexity

| Problem | Time | Extra space |
|---|---|---|
| Frequency count / anagram check | O(n) | O(σ), σ = alphabet size |
| Longest palindromic substring (expand) | O(n²) | O(1) |
| Reverse words | O(n) | O(n) |
| atoi | O(n) | O(1) |
| Roman to int / int to roman | O(n) / O(1) (bounded output) | O(1) |
| Isomorphic strings | O(n) | O(σ) |
| Rotation check with `contains` | O(n²) worst, O(n) with KMP | O(n) |
| Longest common prefix (sort) | O(k · L · log k) | O(1) besides sort |
| Concatenation in a loop vs StringBuilder | O(n²) vs O(n) | O(n) |

## Pitfalls

- `==` compares references; use `equals` (or `equalsIgnoreCase`).
- Strings are immutable: `s.toUpperCase()` returns a new string, it does not modify `s`.
- `+=` inside a loop is O(n²); use `StringBuilder`.
- `substring` copies (O(length)); in recursion pass indices instead.
- `c - 'a'` assumes lowercase; uppercase or digits need `int[128]`.
- `'a' + 1` is an `int`; cast `(char) ('a' + 1)` for a char.
- `split` takes a regex: `split(".")` returns an empty array; use `split("\\.")`. Leading spaces produce a leading `""` token, so `trim()` first.
- `Character.isDigit` accepts non-ASCII digits; compare with `'0'` and `'9'` when parsing.
- atoi and number building overflow `int`; check before multiplying by 10.

## Must-know problems

- Remove Outermost Parentheses
- Reverse Words in a String
- Largest Odd Number in String
- Longest Common Prefix
- Isomorphic Strings
- Rotate String
- Valid Anagram
- Group Anagrams
- Sort Characters by Frequency
- Maximum Nesting Depth of the Parentheses
- Roman to Integer
- Integer to Roman
- String to Integer (atoi)
- Longest Palindromic Substring
- Palindromic Substrings
- Valid Palindrome
- Count Number of Substrings with K Distinct Characters
- Sum of Beauty of All Substrings
- Find the Index of the First Occurrence in a String (KMP)
- Minimum Add to Make Parentheses Valid
