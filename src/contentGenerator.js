/**
 * Generates engaging LinkedIn post text from commit data.
 */

/**
 * Formats a date string into a readable format.
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Determines the type of work from commit message keywords.
 */
function classifyCommit(message) {
  const lower = message.toLowerCase();
  if (lower.startsWith('feat') || lower.includes('feature') || lower.includes('add')) {
    return 'feature';
  }
  if (lower.startsWith('fix') || lower.includes('bug') || lower.includes('fix')) {
    return 'fix';
  }
  if (lower.startsWith('refactor') || lower.includes('refactor')) {
    return 'refactor';
  }
  if (lower.startsWith('docs') || lower.includes('readme') || lower.includes('doc')) {
    return 'docs';
  }
  if (lower.startsWith('test') || lower.includes('test')) {
    return 'test';
  }
  return 'update';
}

/**
 * Generates a LinkedIn post based on the latest commits.
 * @param {Array} commits - List of commit objects from GitHub
 * @param {Object} repoInfo - Repository metadata
 * @param {Object} config - Project configuration from .env
 * @returns {string} Formatted post text
 */
function generatePost(commits, repoInfo, config) {
  const projectName = config.PROJECT_NAME || 'Smart Attendance';
  const tagline = config.PROJECT_TAGLINE || 'Face Recognition Based Offline Attendance System';
  const hashtags = config.POST_HASHTAGS || '#SmartAttendance #FaceRecognition #Flutter #AI #AttendanceSystem';

  if (!commits || commits.length === 0) {
    return generateNoCommitsPost(projectName, tagline, hashtags);
  }

  // Classify commits
  const categories = { feature: [], fix: [], refactor: [], docs: [], test: [], update: [] };
  commits.forEach((c) => {
    const type = classifyCommit(c.message);
    categories[type].push(c);
  });

  const latestDate = commits[0] ? formatDate(commits[0].date) : 'today';
  const commitCount = commits.length;

  let post = `🚀 ${projectName} — Daily Development Update\n\n`;
  post += `${tagline}\n\n`;
  post += `📅 Latest Activity: ${latestDate}\n`;
  post += `📦 ${commitCount} commit${commitCount > 1 ? 's' : ''} pushed\n\n`;

  // Feature updates
  if (categories.feature.length > 0) {
    post += `✨ **New Features:**\n`;
    categories.feature.forEach((c) => {
      post += `  • ${c.message} (${c.sha})\n`;
    });
    post += '\n';
  }

  // Bug fixes
  if (categories.fix.length > 0) {
    post += `🐛 **Bug Fixes:**\n`;
    categories.fix.forEach((c) => {
      post += `  • ${c.message} (${c.sha})\n`;
    });
    post += '\n';
  }

  // Refactors
  if (categories.refactor.length > 0) {
    post += `🔧 **Refactoring:**\n`;
    categories.refactor.forEach((c) => {
      post += `  • ${c.message} (${c.sha})\n`;
    });
    post += '\n';
  }

  // Other updates
  const otherUpdates = [...categories.docs, ...categories.test, ...categories.update];
  if (otherUpdates.length > 0) {
    post += `📝 **Other Updates:**\n`;
    otherUpdates.forEach((c) => {
      post += `  • ${c.message} (${c.sha})\n`;
    });
    post += '\n';
  }

  // Languages used
  if (repoInfo && repoInfo.languages && repoInfo.languages.length > 0) {
    post += `🛠️ Built with: ${repoInfo.languages.join(', ')}\n\n`;
  }

  post += `Building a robust offline attendance system with face recognition technology — no internet required!\n\n`;
  post += `🔗 https://github.com/${config.GITHUB_REPO_OWNER}/${config.GITHUB_REPO_NAME}\n\n`;
  post += `${hashtags}\n`;

  return post;
}

/**
 * Fallback post when there are no new commits.
 */
function generateNoCommitsPost(projectName, tagline, hashtags) {
  let post = `📌 ${projectName} — Project Spotlight\n\n`;
  post += `${tagline}\n\n`;
  post += `An offline-first attendance system built with Flutter, featuring:\n`;
  post += `  ✅ Face recognition using TensorFlow Lite\n`;
  post += `  ✅ Local SQLite database (no internet needed)\n`;
  post += `  ✅ BlazeFace + MobileFaceNet for face detection & recognition\n`;
  post += `  ✅ Cross-platform (Android, iOS, Windows, Linux, macOS)\n\n`;
  post += `Proud to be building this as a practical solution for attendance tracking in areas with limited connectivity.\n\n`;
  post += `🔗 https://github.com/Yene/Smart-Attendance\n\n`;
  post += `${hashtags}\n`;

  return post;
}

module.exports = { generatePost };
