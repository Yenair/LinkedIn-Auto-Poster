require('dotenv').config();
const cron = require('node-cron');
const { getLatestCommits, getRepoInfo } = require('./src/githubService');
const { postToLinkedIn } = require('./src/linkedinService');
const { generatePost } = require('./src/contentGenerator');

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
    // Step 1: Fetch latest commits from GitHub
    console.log('\n📡 Fetching latest commits from GitHub...');
    const commits = await getLatestCommits(
      CONFIG.github.owner,
      CONFIG.github.repo,
      CONFIG.github.token,
      5
    );
    console.log(`   Found ${commits.length} recent commit(s).`);

    // Step 2: Fetch repository metadata
    console.log('\n📦 Fetching repository metadata...');
    const repoInfo = await getRepoInfo(
      CONFIG.github.owner,
      CONFIG.github.repo,
      CONFIG.github.token
    );
    if (repoInfo) {
      console.log(`   Language: ${repoInfo.language || 'N/A'}`);
      console.log(`   Stars: ${repoInfo.stars}`);
    }

    // Step 3: Generate post content
    console.log('\n✍️  Generating post content...');
    const postText = generatePost(commits, repoInfo, {
      PROJECT_NAME: CONFIG.project.name,
      PROJECT_TAGLINE: CONFIG.project.tagline,
      POST_HASHTAGS: CONFIG.project.hashtags,
      GITHUB_REPO_OWNER: CONFIG.github.owner,
      GITHUB_REPO_NAME: CONFIG.github.repo,
    });

    console.log('\n--- Generated Post Preview ---');
    console.log(postText);
    console.log('-----------------------------\n');

    // Step 4: Post to LinkedIn
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
