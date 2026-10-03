// Merge script to combine puneetkhatri99's roadmap data with existing questions.json
// Run: node scripts/merge-roadmap.mjs

import fs from 'fs';
import path from 'path';

const SOURCES = {
  A2Z: "Striver A2Z",
  NC150: "NeetCode 150",
  NC250: "NeetCode 250",
  B75: "Blind 75",
  LC150: "LeetCode Top 150",
  LC75: "LeetCode 75",
};

// Load puneetkhatri99's roadmap data
const roadmapData = JSON.parse(fs.readFileSync('roadmaps/dsa.json', 'utf-8'));

// Load existing questions.json
const existingData = JSON.parse(fs.readFileSync('data/questions.json', 'utf-8'));

// Create a map of existing problems by id for quick lookup
const existingProblems = new Map();
existingData.topics.forEach(topic => {
  topic.patterns.forEach(pattern => {
    pattern.problems.forEach(problem => {
      existingProblems.set(problem.id, { ...problem, topicId: topic.id, patternId: pattern.id });
    });
  });
});

// Convert roadmap topics to new format
const newTopics = roadmapData.topics.map(rtopic => {
  const patterns = {};
  
  rtopic.questions.forEach(q => {
    const group = q.group || "General";
    if (!patterns[group]) {
      patterns[group] = [];
    }
    
    // Check if problem exists in existing data
    const existing = existingProblems.get(q.id);
    
    // Build merged problem
    const problem = {
      id: q.id,
      subpattern: group,
      question: q.title,
      platform: q.url?.includes('leetcode.com') ? 'LeetCode' : 
                q.url?.includes('geeksforgeeks.org') ? 'GeeksforGeeks' :
                q.url?.includes('takeuforward.org') ? 'TakeUForward' : 'Other',
      link: q.url || null,
      difficulty: q.diff === 'E' ? 'Easy' : q.diff === 'M' ? 'Medium' : 'Hard',
      originalStep: q.article || '',
      estMinutes: '30',
      importance: 'Medium',
      interviewFreq: 'Medium',
      // New fields from puneetkhatri99
      sources: q.src || [],
      needs: q.needs || [],
      group: q.group,
      video: q.video,
      article: q.article,
      alt: q.alt || {},
      premium: q.premium || false,
    };
    
    // If existing, preserve some fields
    if (existing) {
      problem.originalStep = existing.originalStep || problem.originalStep;
      problem.estMinutes = existing.estMinutes || problem.estMinutes;
      problem.importance = existing.importance || problem.importance;
      problem.interviewFreq = existing.interviewFreq || problem.interviewFreq;
      problem.platform = existing.platform || problem.platform;
      if (existing.link) problem.link = existing.link;
    }
    
    patterns[group].push(problem);
  });
  
  return {
    id: rtopic.id,
    name: rtopic.title,
    prereqs: rtopic.prereqs || [],
    note: rtopic.note,
    optional: rtopic.optional || false,
    patterns: Object.entries(patterns).map(([name, problems]) => ({
      id: `${rtopic.id}__${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name,
      problems,
    })),
  };
});

// Merge: Add new topics that don't exist in existing data
const existingTopicIds = new Set(existingData.topics.map(t => t.id));
const mergedTopics = [...existingData.topics];

newTopics.forEach(newTopic => {
  if (!existingTopicIds.has(newTopic.id)) {
    mergedTopics.push(newTopic);
  } else {
    // Update existing topic with prereqs and note
    const existingTopic = mergedTopics.find(t => t.id === newTopic.id);
    if (existingTopic) {
      existingTopic.prereqs = newTopic.prereqs;
      existingTopic.note = newTopic.note;
      existingTopic.optional = newTopic.optional;
      // Merge patterns - add new patterns that don't exist
      newTopic.patterns.forEach(newPattern => {
        const existingPattern = existingTopic.patterns.find(p => p.name === newPattern.name);
        if (!existingPattern) {
          existingTopic.patterns.push(newPattern);
        } else {
          // Merge problems
          const existingProblemIds = new Set(existingPattern.problems.map(p => p.id));
          newPattern.problems.forEach(newProblem => {
            if (!existingProblemIds.has(newProblem.id)) {
              existingPattern.problems.push(newProblem);
            } else {
              // Update existing problem with new fields
              const existingProblem = existingPattern.problems.find(p => p.id === newProblem.id);
              if (existingProblem) {
                Object.assign(existingProblem, {
                  sources: newProblem.sources || existingProblem.sources,
                  needs: newProblem.needs || existingProblem.needs,
                  video: newProblem.video || existingProblem.video,
                  article: newProblem.article || existingProblem.article,
                  alt: newProblem.alt || existingProblem.alt,
                  premium: newProblem.premium || existingProblem.premium,
                  group: newProblem.group || existingProblem.group,
                });
              }
            }
          });
        }
      });
    }
  }
});

const mergedData = { topics: mergedTopics };

// Write merged data
fs.writeFileSync('data/questions.json', JSON.stringify(mergedData, null, 2));
console.log('Merged questions.json written successfully!');
console.log(`Total topics: ${mergedTopics.length}`);
console.log(`Total problems: ${mergedTopics.reduce((sum, t) => sum + t.patterns.reduce((s, p) => s + p.problems.length, 0), 0)}`);

// Also create roadmap.json for the topic structure
const roadmapStructure = newTopics.map(t => ({
  id: t.id,
  name: t.name,
  prereqs: t.prereqs,
  note: t.note,
  optional: t.optional,
}));
fs.writeFileSync('data/roadmap.json', JSON.stringify({ topics: roadmapStructure }, null, 2));
console.log('roadmap.json written successfully!');