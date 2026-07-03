<<<<<<< HEAD
# 📱 LinkedIn Auto-Poster — Smart Attendance Project

Automatically posts daily LinkedIn updates about your [`Smart-Attendance`](https://github.com/Yene/Smart-Attendance) project commits.

## 📁 Project Structure

```
LinkedIn-Auto-Poster/
├── index.js                  # Main entry point — scheduler & orchestration
├── package.json              # Dependencies and scripts
├── .env.example              # Template for environment variables
├── .gitignore
├── assets/
│   └── project-logo.png      # 👈 Place your project image here (optional)
├── src/
│   ├── githubService.js      # Fetches commits & repo info from GitHub API
│   ├── linkedinService.js    # Posts text + images to LinkedIn API
│   └── contentGenerator.js   # Generates engaging post text from commits
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

### 5. Get Your GitHub Token

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

### Start the Scheduler (Runs Daily)

```bash
npm start
```

The script will post every day at **9:00 AM** by default. To change the schedule, update the `POST_SCHEDULE` variable in your `.env` file (cron format).

## 🔧 How It Works

1. **GitHub API** — Fetches your 5 most recent commits from [`Yene/Smart-Attendance`](https://github.com/Yene/Smart-Attendance)
2. **Content Generator** — Classifies commits (features, fixes, refactors, etc.) and generates an engaging post
3. **LinkedIn API** — Publishes the post (with optional image) to your LinkedIn feed
4. **Scheduler** — Uses `node-cron` to run this process automatically every day

## 🖼️ Adding an Image

Place a PNG image (recommended: 1200×628px) at `assets/project-logo.png` to have it automatically attached to each post.

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

> **Note:** Your `GITHUB_REPO_OWNER` and `GITHUB_REPO_NAME` are already set to `Yene` and `Smart-Attendance` respectively — no change needed unless your repo location changes.
=======
# LinkedIn-Auto-Poster
Sends post about my latest update daily.
>>>>>>> e2df4deb3b3fc5a9a5f309b6c9444721ea21e029
