// The Markdown notes under public/notes, from puneetkhatri99/DSA_Tracker.
// Pattern notes are linked from topics by id (Topic.notes in questions.json).

export interface Note {
  id: string;
  title: string;
  file: string;
}

const pattern = (id: string, title: string): Note => ({ id, title, file: `notes/patterns/${id}.md` });

export const NOTE_SECTIONS: { section: string; items: Note[] }[] = [
  {
    section: "DSA patterns",
    items: [
      pattern("basics", "Java Basics & Math"),
      pattern("patterns", "Logic Building: Patterns"),
      pattern("recursion-basics", "Basic Recursion"),
      pattern("hashing", "Basic Hashing"),
      pattern("sorting", "Sorting Algorithms"),
      pattern("arrays", "Arrays"),
      pattern("two-pointers", "Two Pointers"),
      pattern("sliding-window", "Sliding Window"),
      pattern("binary-search", "Binary Search"),
      pattern("strings", "Strings"),
      pattern("linked-list", "Linked List"),
      pattern("recursion", "Recursion & Backtracking"),
      pattern("bits", "Bit Manipulation"),
      pattern("greedy", "Greedy & Intervals"),
      pattern("stack-queue", "Stack, Queue & Monotonic Stack"),
      pattern("binary-trees", "Binary Trees"),
      pattern("bst", "Binary Search Trees"),
      pattern("heaps", "Heaps / Priority Queue"),
      pattern("graphs", "Graphs"),
      pattern("dp", "Dynamic Programming"),
      pattern("tries", "Tries"),
      pattern("strings-advanced", "Advanced Strings"),
      pattern("math", "Math & Geometry"),
    ],
  },
  {
    section: "Java for DSA",
    items: [
      { id: "java-io", title: "Input / Output", file: "notes/java/01-input-output.md" },
      { id: "java-basics", title: "Basics for DSA", file: "notes/java/02-basics-for-dsa.md" },
      { id: "java-strings", title: "Strings & StringBuilder", file: "notes/java/03-strings.md" },
      { id: "java-collections", title: "Collections Framework", file: "notes/java/04-collections-framework.md" },
      { id: "java-comparators", title: "Comparators & Lambdas", file: "notes/java/05-comparators-lambdas.md" },
      { id: "java-math-bits", title: "Math & Bit Tricks", file: "notes/java/06-math-bits.md" },
    ],
  },
  {
    section: "Java core / OOP",
    items: [
      { id: "core-oop", title: "OOP in Java", file: "notes/java-core/01-oop.md" },
      { id: "core-jvm", title: "JVM, Memory & Objects", file: "notes/java-core/02-jvm-memory.md" },
      { id: "core-generics", title: "Generics & Exceptions", file: "notes/java-core/03-generics-exceptions.md" },
      { id: "core-modern", title: "Modern Java (8 → 21)", file: "notes/java-core/04-java8-plus.md" },
      { id: "core-threads", title: "Multithreading Basics", file: "notes/java-core/05-multithreading.md" },
    ],
  },
];

export const NOTES_BY_ID: Record<string, Note> = Object.fromEntries(
  NOTE_SECTIONS.flatMap((s) => s.items).map((n) => [n.id, n])
);
