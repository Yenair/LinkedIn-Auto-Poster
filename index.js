require('dotenv').config();
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { getLatestCommits, getRepoInfo, getRepoDetails } = require('./src/githubService');
const { postToLinkedIn } = require('./src/linkedinService');
const { generateFeaturePost, generateUpdatePost } = require('./src/contentGenerator');

// =============================================
// Configuration
// =============================================
const CONFIG = {
  linkedin: {
    accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
    userUrn: process.env.LINKEDIN_USER_URN,
  },
  github: {
    token: process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_REPO_OWNER || 'Yene',
    repo: process.env.GITHUB_REPO_NAME || 'Smart-Attendance',
  },
  project: {
    name: process.env.PROJECT_NAME,
    tagline: process.env.PROJECT_TAGLINE,
    hashtags: process.env.POST_HASHTAGS,
  },
  imagePath: process.env.PROJECT_LOGO_PATH || './assets/project-logo.png',
  schedule: process.env.POST_SCHEDULE || '0 9 * * *', // Default: daily at 9:00 AM
  randomMaxDelay: process.env.RANDOM_MAX_DELAY_MINUTES ? parseInt(process.env.RANDOM_MAX_DELAY_MINUTES, 10) : 360, // Max random delay in minutes (default: 6h = 360min)
};

// =============================================
// Repo Selection
// =============================================

/**
 * Reads repos.json and returns the list of repositories.
 * Supports both formats:
 *   { "owner": "...", "name": "..." }
 *   { "url": "https://github.com/owner/name" }
 * Falls back to the single repo from .env if the file is missing or invalid.
 */
function loadRepos() {
  try {
    const reposPath = path.join(__dirname, 'repos.json');
    if (!fs.existsSync(reposPath)) {
      console.warn('⚠️  repos.json not found. Falling back to single repo from .env.');
      return [{ owner: CONFIG.github.owner, name: CONFIG.github.repo }];
    }
    const data = fs.readFileSync(reposPath, 'utf-8');
    const raw = JSON.parse(data);
    if (!Array.isArray(raw) || raw.length === 0) {
      console.warn('⚠️  repos.json is empty or invalid. Falling back to single repo from .env.');
      return [{ owner: CONFIG.github.owner, name: CONFIG.github.repo }];
    }

    // Normalise each entry: support both { owner, name } and { url } formats
    const repos = raw.map((entry) => {
      // If it has a "url" field, parse owner/name from it
      if (entry.url) {
        const parsed = parseRepoUrl(entry.url);
        if (parsed) return parsed;
        console.warn(`⚠️  Could not parse URL: ${entry.url}. Skipping.`);
        return null;
      }
      // Otherwise assume { owner, name }
      if (entry.owner && entry.name) return { owner: entry.owner, name: entry.name };
      console.warn(`⚠️  Invalid repo entry in repos.json: ${JSON.stringify(entry)}. Skipping.`);
      return null;
    }).filter(Boolean); // Remove any that failed to parse

    if (repos.length === 0) {
      console.warn('⚠️  No valid entries in repos.json. Falling back to single repo from .env.');
      return [{ owner: CONFIG.github.owner, name: CONFIG.github.repo }];
    }
    return repos;
  } catch (error) {
    console.warn('⚠️  Failed to read repos.json:', error.message);
    console.warn('   Falling back to single repo from .env.');
    return [{ owner: CONFIG.github.owner, name: CONFIG.github.repo }];
  }
}

/**
 * Parses a GitHub repo URL into { owner, name }.
 * Accepts URLs like:
 *   https://github.com/owner/name
 *   https://github.com/owner/name.git
 * @param {string} url - Full GitHub repository URL
 * @returns {{ owner: string, name: string } | null}
 */
function parseRepoUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/github\.com\/([^/]+)\/([^/#?]+)/);
  if (!match) return null;
  return {
    owner: match[1],
    name: match[2].replace(/\.git$/, ''), // Strip optional .git suffix
  };
}

/**
 * Picks a random repository from the given list.
 * @param {Array} repos - Array of { owner, name }
 * @returns {Object} { owner, name }
 */
function pickRandomRepo(repos) {
  if (!repos || repos.length === 0) {
    return { owner: CONFIG.github.owner, name: CONFIG.github.repo };
  }
  return repos[Math.floor(Math.random() * repos.length)];
}

/**
 * Checks all repos for commits within the last N hours.
 * Returns only repos that have had recent activity.
 * @param {Array} repos - Array of { owner, name }
 * @param {string} token - GitHub Personal Access Token
 * @param {number} hours - Look-back window (default 24)
 * @returns {Promise<Array>} Active repos with their recent commits
 */
async function findReposWithRecentActivity(repos, token, hours = 24) {
  const sinceDate = new Date(Date.now() - hours * 60 * 60 * 1000);
  const activeRepos = [];

  for (const repo of repos) {
    try {
      const commits = await getLatestCommits(repo.owner, repo.name, token, 5);
      const recentCommits = commits.filter((c) => new Date(c.date) >= sinceDate);
      if (recentCommits.length > 0) {
        console.log(`   ✅ ${repo.owner}/${repo.name}: ${recentCommits.length} recent commit(s)`);
        activeRepos.push({ owner: repo.owner, name: repo.name, commits: recentCommits });
      } else {
        console.log(`   ⏳ ${repo.owner}/${repo.name}: no recent activity`);
      }
    } catch (err) {
      console.warn(`   ⚠️  Could not check ${repo.owner}/${repo.name}: ${err.message}`);
    }
  }

  return activeRepos;
}

// =============================================
// Main post function
// =============================================
async function runDailyPost() {
  console.log('='.repeat(50));
  console.log(`📅 LinkedIn Auto-Poster — ${new Date().toLocaleString()}`);
  console.log('='.repeat(50));

  // Validate required environment variables
  const missingVars = [];
  if (!CONFIG.linkedin.accessToken) missingVars.push('LINKEDIN_ACCESS_TOKEN');
  if (!CONFIG.linkedin.userUrn) missingVars.push('LINKEDIN_USER_URN');
  if (!CONFIG.github.token) missingVars.push('GITHUB_TOKEN');

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach((v) => console.error(`   - ${v}`));
    console.error('\n   Please create a .env file based on .env.example');
    return;
  }

  try {
    // Step 1: Load repos
    const repos = loadRepos();
    console.log(`\n📋 Loaded ${repos.length} repositor(ies) from repos.json`);

    // Step 2: Check ALL repos for commits in the last 24 hours — priority logic
    console.log('\n🔍 Checking all repos for recent activity (last 24h)...');
    const activeRepos = await findReposWithRecentActivity(repos, CONFIG.github.token);

    let owner, repo, postText;

    if (activeRepos.length > 0) {
      // PRIORITY: Repos with recent commits — pick one randomly and make an update post
      const selected = pickRandomRepo(activeRepos);
      owner = selected.owner;
      repo = selected.name;
      const recentCommits = selected.commits;
      console.log(`\n🎯 Priority: recent commits found! Picked ${owner}/${repo} with ${recentCommits.length} commit(s)`);

      console.log('\n✍️  Generating update post...');
      postText = await generateUpdatePost(recentCommits, owner, repo);
    } else {
      // NO recent activity — pick a random repo and do a feature spotlight
      const selected = pickRandomRepo(repos);
      owner = selected.owner;
      repo = selected.name;
      console.log(`\n📭 No recent activity across any repo. Picked random repo: ${owner}/${repo} for feature spotlight`);

      console.log('\n📦 Fetching repository metadata for feature post...');
      const repoDetails = await getRepoDetails(owner, repo);
      console.log(`   Description: ${repoDetails.description || '(none)'}`);
      console.log(`   Topics: ${repoDetails.topics.length > 0 ? repoDetails.topics.join(', ') : '(none)'}`);
      console.log(`   Stars: ${repoDetails.stargazers_count}`);

      console.log('\n✍️  Generating feature spotlight post...');
      postText = await generateFeaturePost(owner, repo, repoDetails);
    }

    console.log('\n--- Generated Post Preview ---');
    console.log(postText);
    console.log('-----------------------------\n');

    // Step 3: Post to LinkedIn
    console.log('📤 Publishing to LinkedIn...');
    const result = await postToLinkedIn(
      CONFIG.linkedin.accessToken,
      CONFIG.linkedin.userUrn,
      postText,
      CONFIG.imagePath
    );

    console.log('\n🎉 Post published successfully!');
    console.log('   Post ID:', result.id);
  } catch (error) {
    console.error('\n❌ Failed to complete the posting process.');
    console.error('   Error:', error.message);
  }
}

// =============================================
// Random delay helper
// =============================================

/**
 * If the --random flag is passed, sleeps for a random duration
 * between 0 and CONFIG.randomMaxDelay minutes.
 * This makes posts go out at a different time each day.
 */
async function applyRandomDelay() {
  const useRandom = process.argv.includes('--random');
  if (!useRandom) return;

  const maxMinutes = CONFIG.randomMaxDelay;
  const delayMinutes = Math.floor(Math.random() * (maxMinutes + 1)); // 0..maxMinutes
  const delayMs = delayMinutes * 60 * 1000;

  // Compute approximate wall-clock time for logging
  const targetTime = new Date(Date.now() + delayMs);
  console.log(`🎲 Random delay enabled. Sleeping for ${delayMinutes} minute(s) (0–${maxMinutes} range).`);
  console.log(`   Estimated post time: ${targetTime.toLocaleString()}`);

  if (delayMinutes > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

// =============================================
// Scheduling
// =============================================

// Check if --now flag was passed (for testing/dev / CI run)
const shouldRunNow = process.argv.includes('--now');

if (shouldRunNow) {
  console.log('🔧 Running in CI / dev mode (--now flag detected)');

  // If --random is also passed, apply a random delay first so the post
  // goes out at a different time each day instead of a fixed clock time.
  const run = async () => {
    await applyRandomDelay();
    await runDailyPost();
  };
  run().catch((err) => console.error('❌ Error during post execution:', err.message));
} else {
  console.log(`⏰ Scheduler started. Will post daily at schedule: ${CONFIG.schedule}`);
  console.log('   Press Ctrl+C to stop.\n');

  // Schedule the daily post
  cron.schedule(CONFIG.schedule, () => {
    runDailyPost();
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down LinkedIn Auto-Poster...');
  process.exit(0);
});
