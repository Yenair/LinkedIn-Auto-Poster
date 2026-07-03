# 📱 LinkedIn Auto-Poster

Automatically posts daily LinkedIn updates about your GitHub projects. The script randomly picks a repository and a post type each day, generating human-like conversational content.

## 📁 Project Structure

```
LinkedIn-Auto-Poster/
├── index.js                  # Main entry point — scheduler & orchestration
├── repos.json                # List of repositories to pick from (optional)
├── package.json              # Dependencies and scripts
├── .env.example              # Template for environment variables
├── .gitignore
├── assets/
│   └── project-logo.png      # 👈 Place your project image here (optional)
├── src/
│   ├── githubService.js      # Fetches commits & repo info from GitHub API
│   ├── linkedinService.js    # Posts text + images to LinkedIn API
│   └── contentGenerator.js   # Generates conversational post text
└── README.md                 # This file
```

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
cd LinkedIn-Auto-Poster
npm install
```

### 2. Configure Environment Variables

Copy [`.env.example`](.env.example) to `.env` and fill in your credentials:

```bash
copy .env.example .env     # Windows
# or
cp .env.example .env       # Linux/Mac
```

### 3. Get Your LinkedIn API Credentials

1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps)
2. Click **"Create app"**
3. Fill in the required fields:
   - **App name**: `Smart Attendance Auto-Poster`
   - **LinkedIn Page**: (optional, skip)
4. After creation, go to **"Auth"** tab → copy **Client ID** & **Client Secret**
5. Go to **"Products"** tab → add **"Share on LinkedIn"** product
6. Generate an **Access Token** using the [LinkedIn OAuth Token Generator](https://www.linkedin.com/developers/tools/oauth/token-generator) (select `w_member_social` scope)

### 4. Get Your LinkedIn Profile URN

Your URN looks like: `urn:li:person:abc123def`

To find it:
- Go to your LinkedIn profile
- Your profile URL is `https://www.linkedin.com/in/your-name-abc123/`
- The URN is the last part of your profile URL under the hood — use the token generator or API explorer to get it

### 5. Get Your Google Gemini API Key (Optional — For AI-Generated Content)

By default, posts are written from pre-built sentence templates (which can feel repetitive). For truly unique, randomised content every time, the script can use Google Gemini to generate each post from scratch.

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click **"Get API Key"** → **"Create API Key"**
3. Copy the key and add it to your `.env` file as `GEMINI_API_KEY=your_key_here`
4. That's it. The script auto-detects the key and uses Gemini when available, falling back to templates if the key is missing or the API call fails.

> **Cost:** Gemini 1.5 Flash costs ~$0.0003 per post — about $0.01/month for daily posting. The free tier is generous enough for most use cases.

### 6. Get Your GitHub Token

1. Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
2. Click **"Generate new token (classic)"**
3. Select scope: **`repo`** (full control of private repositories)
4. Copy the generated token

## ⚙️ Usage

### Test Immediately (One-Time Post)

```bash
npm run dev
```

This runs the script once with the `--now` flag.

### Start the Scheduler (Runs Daily — Local)

```bash
npm start
```

The script will post every day at **9:00 AM** by default. To change the schedule, update the `POST_SCHEDULE` variable in your `.env` file (cron format).

### Random Post Time (GitHub Actions)

When running in GitHub Actions, the workflow triggers at **5:00 AM UTC** but passes both `--now` and `--random` flags. The `--random` flag causes the script to sleep for a random duration (0-360 minutes by default) before posting, so the post goes out at a **different time each day**.

- `RANDOM_MAX_DELAY_MINUTES` (default: `360`): Maximum random delay in minutes. With the default and the trigger at 5:00 AM UTC, posts appear anytime between 5:00 AM and 11:00 AM UTC.

> **Note:** GitHub Actions has a **6-hour job execution limit**. The default 360-minute (6h) max delay ensures the job completes within this limit. You can reduce this value for a narrower posting window.

## 🎲 How It Works

### Random Repository Selection

Create a [`repos.json`](repos.json) file in the project root with an array of repositories. You can use two formats:

**Option A — Owner + Name (original):**
```json
[
  {"owner": "Yenair", "name": "Smart-Attendance"},
  {"owner": "Yenair", "name": "AnotherProject"}
]
```

**Option B — Full GitHub URL (easier):**
```json
[
  {"url": "https://github.com/Yenair/Smart-Attendance"},
  {"url": "https://github.com/Yenair/classAI"}
]
```

You can even mix both formats in the same file. Each day, the script randomly picks **one repository** from this list and fetches live data (commits, stars, topics) from the GitHub API. If `repos.json` is missing, empty, or invalid, it falls back to the single repository defined in your `.env` file (`GITHUB_REPO_OWNER` / `GITHUB_REPO_NAME`).

### Random Post Type

After picking a repo, the script randomly chooses between two post types:

| Type | Description |
|------|-------------|
| **Feature Spotlight** | Highlights a cool feature of the project — uses the repo's description, topics, and star count from GitHub |
| **Commit Update** | Posts about recent commits (last 24 hours) — grouped by theme in a conversational style |

If the **"update"** type is chosen but no commits were found in the last 24 hours, the script automatically **falls back to a feature spotlight** for the same repository (with a clear log message).

### Conversational Content

All posts are written in a **casual, first-person tone** — like you're sharing progress with a friend or colleague:
- No headers like "Daily Update" or "Feature Spotlight"
- No hashtags
- Short paragraphs (2–3 sentences), easy to read on mobile
- Emojis used sparingly (2–3 max per post)
- Ends with an engaging question to the reader
- Includes a GitHub link with a simple call-to-action

### AI-Generated Content (Gemini Integration)

When a `GEMINI_API_KEY` is configured in `.env`, the script uses **Google Gemini 1.5 Flash** to write each post from scratch — producing truly unique phrasing, structure, and tone every time.

**How it works:**
1. Before generating a post, the script checks if Gemini is available
2. If yes, it sends a structured prompt with the repo's data (description, stars, topics — or commit messages for update posts)
3. Gemini returns a completely original post that avoids repetitive patterns
4. If the Gemini call fails (network error, rate limit, etc.), the script silently **falls back to the template-based generator** — your posts never get skipped

**Prompt rules enforced on every generation:**
- Never uses "I've been working on", "If you haven't seen it before", "think of it", or similar repetitive openers
- Varies the opening sentence structure each time
- No hashtags, no headers, no titles
- Ends with a natural engagement question
- Keeps it under 200 words

> **Tip:** You can toggle Gemini on/off simply by adding or removing the `GEMINI_API_KEY` from your `.env`. No code changes needed.

> **Rate limits:** Gemini's free tier allows ~60 requests per minute and 1,500 requests per day (enough for daily posting). If you hit a 429 error, the script automatically falls back to templates — your posts won't be affected. The limit resets after a minute.

### Post Flow

1. **Load repos** → pick one at random
2. **Pick post type** at random (`feature` or `update`)
3. **Feature path**: Fetch repo metadata (description, topics, stars) → generate feature spotlight
4. **Update path**: Fetch recent commits → if none found in 24h, fall back to feature; otherwise generate update post
5. **Post to LinkedIn** with optional image attachment

## 🖼️ Adding an Image

Place a PNG image (recommended: 1200×628px) at `assets/project-logo.png` to have it automatically attached to each post.

## 🔧 How It Works (Technical)

1. **GitHub API** — Fetches repo metadata or recent commits from the randomly selected repository
2. **Content Generator** — Generates a conversational, human-like post (feature spotlight or commit update)
3. **LinkedIn API** — Publishes the post (with optional image) to your LinkedIn feed
4. **Scheduler** — Uses `node-cron` to run this process automatically every day

---

## PLACEHOLDERS TO REPLACE

Below is every value you need to replace in your [`.env`](.env.example) file:

| # | Variable | Where to Get It | Placeholder Value |
|---|----------|----------------|-------------------|
| 1 | `LINKEDIN_CLIENT_ID` | [LinkedIn Developer App](https://www.linkedin.com/developers/apps) → Auth tab | `your_linkedin_client_id_here` |
| 2 | `LINKEDIN_CLIENT_SECRET` | [LinkedIn Developer App](https://www.linkedin.com/developers/apps) → Auth tab | `your_linkedin_client_secret_here` |
| 3 | `LINKEDIN_ACCESS_TOKEN` | [LinkedIn OAuth Token Generator](https://www.linkedin.com/developers/tools/oauth/token-generator) → scope: `w_member_social` | `your_linkedin_access_token_here` |
| 4 | `LINKEDIN_USER_URN` | Your LinkedIn profile URN (format: `urn:li:person:xxxxx`) | `urn:li:person:your_linkedin_profile_id_here` |
| 5 | `GITHUB_TOKEN` | [GitHub Personal Access Tokens](https://github.com/settings/tokens) → scope: `repo` | `your_github_personal_access_token_here` |
| 6 | `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) → Create API Key | *(optional — leave empty to use templates)* |

> **Note:** Your `GITHUB_REPO_OWNER` and `GITHUB_REPO_NAME` are already set to `Yene` and `Smart-Attendance` respectively — no change needed unless your repo location changes. These are used as the fallback if `repos.json` is missing or empty.
