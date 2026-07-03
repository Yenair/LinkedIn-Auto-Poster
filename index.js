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
};

// =============================================
// Repo Selection
// =============================================

/**
 * Reads repos.json and returns the list of repositories.
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
    const repos = JSON.parse(data);
    if (!Array.isArray(repos) || repos.length === 0) {
      console.warn('⚠️  repos.json is empty or invalid. Falling back to single repo from .env.');
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
    // Step 1: Load repos and pick one randomly
    const repos = loadRepos();
    const selected = pickRandomRepo(repos);
    const { owner, name: repo } = selected;
    console.log(`\n🎲 Picked: ${owner}/${repo}`);

    // Step 2: Randomly decide post type (feature or update)
    const postTypes = ['feature', 'update'];
    let postType = postTypes[Math.floor(Math.random() * postTypes.length)];
    console.log(`   Post type: ${postType}`);

    let postText;

    if (postType === 'feature') {
      // Feature spotlight — fetch repo metadata and generate a feature post
      console.log('\n📦 Fetching repository metadata for feature post...');
      const repoDetails = await getRepoDetails(owner, repo);
      console.log(`   Description: ${repoDetails.description || '(none)'}`);
      console.log(`   Topics: ${repoDetails.topics.length > 0 ? repoDetails.topics.join(', ') : '(none)'}`);
      console.log(`   Stars: ${repoDetails.stargazers_count}`);

      console.log('\n✍️  Generating feature spotlight post...');
      postText = generateFeaturePost(owner, repo, repoDetails);
    } else {
      // Update post — fetch recent commits
      console.log('\n📡 Fetching latest commits from GitHub...');
      const sinceDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const commits = await getLatestCommits(owner, repo, CONFIG.github.token, 10);

      // Filter to last 24 hours
      const recentCommits = commits.filter((c) => new Date(c.date) >= new Date(sinceDate));

      if (recentCommits.length === 0) {
        // No commits found — fall back to feature post for the same repo
        console.log(`\n⚠️  No commits found in last 24h, falling back to feature post for ${owner}/${repo}`);
        const repoDetails = await getRepoDetails(owner, repo);
        postText = generateFeaturePost(owner, repo, repoDetails);
      } else {
        console.log(`   Found ${recentCommits.length} recent commit(s) in the last 24h.`);
        console.log('\n✍️  Generating update post...');
        postText = generateUpdatePost(recentCommits, owner, repo);
      }
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
// Scheduling
// =============================================

// Check if --now flag was passed (for testing/dev)
const shouldRunNow = process.argv.includes('--now');

if (shouldRunNow) {
  console.log('🔧 Running in dev mode (--now flag detected)');
  runDailyPost();
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
