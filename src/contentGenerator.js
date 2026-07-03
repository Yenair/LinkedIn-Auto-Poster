/**
 * Generates human-like conversational LinkedIn post content.
 * No headers, no hashtags — just natural, engaging text.
 */

const featureExamples = [
  { tech: 'face recognition', analogy: 'like having a bouncer who remembers every face that\'s ever walked through the door' },
  { tech: 'offline database', analogy: 'like a library that works even when the power\'s out' },
  { tech: 'cross-platform', analogy: 'like writing once and having it magically work on every device you own' },
  { tech: 'real-time sync', analogy: 'like having a telepathic connection between all your devices' },
  { tech: 'biometric auth', analogy: 'like a fingerprint scanner that never gets fooled by a photo' },
];

/**
 * Picks a random item from an array.
 */
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates a feature-spotlight post for a given repository.
 * @param {string} owner - GitHub owner
 * @param {string} repo - GitHub repo name
 * @param {Object} repoDetails - { description, topics, stargazers_count }
 * @returns {string} Conversational post text
 */
function generateFeaturePost(owner, repo, repoDetails) {
  const projectDisplay = repo.replace(/-/g, ' ');
  const rawDescription = (repoDetails.description || pickRandom([
    'a handy tool I built',
    'something I\'ve been tinkering with',
    'a project I\'ve been having fun with',
    'a little tool I\'ve been building on the side',
  ])).replace(/\.+$/, ''); // Remove trailing periods to avoid double punctuation
  const topics = repoDetails.topics && repoDetails.topics.length > 0
    ? repoDetails.topics.join(', ')
    : null;
  const stars = repoDetails.stargazers_count || 0;

  const example = pickRandom(featureExamples);
  const topicSnippet = topics
    ? `It touches on a few areas I really enjoy — ${topics}.`
    : '';

  const starsLine = stars > 0
    ? `\nIt's got ${stars} star${stars > 1 ? 's' : ''} on GitHub so far, which still feels surreal every time I check.\n`
    : '\n';

  const post = `I've been working on ${projectDisplay}, which is basically ${rawDescription.toLowerCase()}.

If you haven't seen it before, think of it ${example.analogy}. That's the vibe I'm going for, anyway. ${topicSnippet}

It's one of those projects that started as a "wouldn't it be cool if…" idea and slowly turned into something real. I've lost count of how many evenings I've spent tweaking little details, but honestly? Totally worth it.
${starsLine}
I'd love to hear — what's a project you've been pouring time into lately? Always looking for new ideas to steal 🙃

Check it out here: https://github.com/${owner}/${repo}`;

  return post;
}

/**
 * Translates a commit message into a natural, conversational snippet.
 */
function describeCommit(commit) {
  const msg = commit.message.toLowerCase();

  if (msg.includes('fix') || msg.includes('bug')) {
    const snippets = [
      'tracked down a sneaky bug that had me questioning my life choices',
      'finally squashed a bug that\'s been bothering me for a while',
      'spent way too long debugging something that turned out to be a one-line fix',
    ];
    return pickRandom(snippets);
  }
  if (msg.includes('feat') || msg.includes('add') || msg.includes('feature') || msg.includes('new')) {
    const snippets = [
      'added a new feature — honestly pretty excited about how this one turned out',
      'got a new piece working, feels like a solid step forward',
      'implemented something I\'ve been planning for ages, feels great to have it done',
    ];
    return pickRandom(snippets);
  }
  if (msg.includes('refactor') || msg.includes('clean') || msg.includes('improve')) {
    const snippets = [
      'did some long-overdue cleanup in the codebase, future me will thank me',
      'refactored a chunk of code that was getting messy, much happier with it now',
      'spent some time improving the architecture — it\'s one of those things you don\'t see but definitely feel',
    ];
    return pickRandom(snippets);
  }
  if (msg.includes('doc') || msg.includes('readme')) {
    const snippets = [
      'finally wrote some proper documentation — future contributors won\'t hate me anymore',
      'updated the README with better instructions, should be easier for new folks to get started',
    ];
    return pickRandom(snippets);
  }
  if (msg.includes('test')) {
    const snippets = [
      'added more tests — because sleeping soundly is underrated',
      'wrote some tests to cover edge cases I previously ignored (sorry, past me)',
    ];
    return pickRandom(snippets);
  }
  // Generic fallback
  const snippets = [
    'made some progress on things, nothing flashy but it all adds up',
    'been chipping away at the to-do list, one commit at a time',
    'pushed some changes that\'ll make sense in context',
  ];
  return pickRandom(snippets);
}

/**
 * Generates an update post from recent commits.
 * @param {Array} commits - List of commit objects
 * @param {string} owner - GitHub owner
 * @param {string} repo - GitHub repo name
 * @returns {string} Conversational post text
 */
function generateUpdatePost(commits, owner, repo) {
  const projectDisplay = repo.replace(/-/g, ' ');
  const count = commits.length;

  // Group commits into meaningful themes by classifying them
  const themes = { fixes: [], features: [], improvements: [], other: [] };
  commits.forEach((c) => {
    const msg = c.message.toLowerCase();
    if (msg.includes('fix') || msg.includes('bug')) {
      themes.fixes.push(c);
    } else if (msg.includes('feat') || msg.includes('add') || msg.includes('feature') || msg.includes('new')) {
      themes.features.push(c);
    } else if (msg.includes('refactor') || msg.includes('clean') || msg.includes('improve') || msg.includes('test') || msg.includes('doc')) {
      themes.improvements.push(c);
    } else {
      themes.other.push(c);
    }
  });

  // Build the narrative conversationally
  let storyParts = [];

  if (themes.features.length > 0) {
    const desc = describeCommit(themes.features[0]);
    storyParts.push(desc);
  }

  if (themes.fixes.length > 0) {
    const desc = describeCommit(themes.fixes[0]);
    storyParts.push(`While I was at it, I ${desc}`);
  }

  if (themes.improvements.length > 0) {
    const desc = describeCommit(themes.improvements[0]);
    storyParts.push(`Also ${desc}`);
  }

  if (themes.other.length > 0) {
    // Pick a random generic description for remaining commits
    themes.other.forEach(() => {
      storyParts.push(pickRandom([
        'a few other small bits and pieces got tidied up along the way',
        'there were some miscellaneous updates that don\'t make for a great story but needed doing',
      ]));
    });
  }

  // De-duplicate and limit to keep it readable
  const uniqueParts = [...new Set(storyParts)];
  const story = uniqueParts.slice(0, 4).join('. ') + '.';

  const post = `I've been working on ${projectDisplay} and made about ${count} commit${count > 1 ? 's' : ''} recently.

${story}

Some days it feels like I'm making slow progress, but looking back at what's changed, I'm pretty happy with where things are heading. There's something satisfying about seeing a project evolve one small step at a time.

What have you been building or fixing lately? Always curious what everyone else is up to.

Here's the link if you want to peek: https://github.com/${owner}/${repo}`;

  return post;
}

module.exports = { generateFeaturePost, generateUpdatePost };
