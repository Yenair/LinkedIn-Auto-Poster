const axios = require('axios');
const fs = require('fs');
const path = require('path');

const LINKEDIN_API = 'https://api.linkedin.com/v2';
const TOKEN_REFRESH_URL = 'https://api.linkedin.com/oauth/v2/accessToken';

/**
 * Refreshes the LinkedIn access token using the refresh token from .env, or
 * returns the current token if no refresh token is available.
 * Updates process.env.LINKEDIN_ACCESS_TOKEN in-memory with the new token.
 * @param {string} currentToken - The current access token (returned as-is if no refresh token configured)
 * @returns {Promise<string>} The (possibly refreshed) access token
 */
async function refreshAccessToken(currentToken) {
  const refreshToken = process.env.LINKEDIN_REFRESH_TOKEN;
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!refreshToken || !clientId || !clientSecret) {
    console.warn(
      '⚠️  Cannot refresh token: LINKEDIN_REFRESH_TOKEN is not configured in .env.\n' +
      '   The access token is still valid and will be used as-is. If it expires,\n' +
      '   generate a new one at https://www.linkedin.com/developers/apps'
    );
    return currentToken; // Return the existing token without refreshing
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', refreshToken);
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);

  console.log('🔄 Refreshing LinkedIn access token...');

  const response = await axios.post(TOKEN_REFRESH_URL, params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const newToken = response.data.access_token;
  process.env.LINKEDIN_ACCESS_TOKEN = newToken;

  console.log('🔑 LinkedIn access token refreshed successfully.');
  return newToken;
}

/**
 * Wraps an axios request call with automatic 401 detection and single retry.
 * On 401, it refreshes the token via refreshAccessToken() and retries once.
 * @param {string} accessToken - Current LinkedIn OAuth access token
 * @param {Function} requestFn - Async function that takes (token) and returns an axios response
 * @returns {Promise<Object>} Axios response
 */
async function executeWithRetry(accessToken, requestFn) {
  try {
    return await requestFn(accessToken);
  } catch (error) {
    // On 401 Unauthorized, attempt to refresh the token and retry once
    if (error.response && error.response.status === 401) {
      console.log('🔐 Access token expired (401). Refreshing and retrying...');
      const newToken = await refreshAccessToken(accessToken);
      console.log('🔄 Retrying original request with new token...');
      return await requestFn(newToken);
    }
    throw error;
  }
}

/**
 * Posts a text update to LinkedIn with an optional image.
 * Automatically refreshes the access token on 401 and retries once.
 * @param {string} accessToken - LinkedIn OAuth access token
 * @param {string} userUrn - LinkedIn user URN (e.g., "urn:li:person:abc123")
 * @param {string} text - The post content
 * @param {string} [imagePath] - Optional path to an image to upload and attach
 * @returns {Promise<Object>} LinkedIn API response
 */
async function postToLinkedIn(accessToken, userUrn, text, imagePath = null) {
  try {
    let mediaUrn = null;

    // If an image is provided, upload it first
    if (imagePath && fs.existsSync(imagePath)) {
      mediaUrn = await uploadImage(accessToken, userUrn, imagePath);
    }

    // Build the post payload
    const postData = {
      author: userUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: text,
          },
          shareMediaCategory: mediaUrn ? 'IMAGE' : 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    // Attach media if uploaded
    if (mediaUrn) {
      postData.specificContent['com.linkedin.ugc.ShareContent'].media = [
        {
          status: 'READY',
          description: {
            text: 'Project screenshot or visual',
          },
          media: mediaUrn,
          title: {
            text: 'Smart Attendance Project',
          },
        },
      ];
    }

    const response = await executeWithRetry(accessToken, async (token) => {
      return await axios.post(
        `${LINKEDIN_API}/ugcPosts`,
        postData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'Content-Type': 'application/json',
          },
        }
      );
    });

    console.log('✅ LinkedIn post published successfully!');
    console.log('   Post ID:', response.data.id);
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.error('❌ LinkedIn access token does not have permission to create posts.');
      console.error('   The token can read your profile but lacks the "w_member_social" scope.');
      console.error('');
      console.error('   To fix this:');
      console.error('   1. Go to https://www.linkedin.com/developers/apps');
      console.error('   2. Under your app, go to the "Auth" tab');
      console.error('   3. Make sure "w_member_social" is selected in the OAuth 2.0 scopes');
      console.error('   4. Generate a new access token with these scopes');
      console.error('   5. Update LINKEDIN_ACCESS_TOKEN in your .env file');
      console.error('   6. Run "npm run dev" again');
    } else {
      console.error('❌ Error posting to LinkedIn:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Response:', JSON.stringify(error.response.data, null, 2));
      }
    }
    throw error;
  }
}

/**
 * Uploads an image to LinkedIn and returns the media URN.
 * Automatically refreshes the access token on 401 and retries once.
 * @param {string} accessToken - LinkedIn OAuth access token
 * @param {string} userUrn - LinkedIn user URN
 * @param {string} imagePath - Local path to the image file
 * @returns {Promise<string>} Media URN for the uploaded image
 */
async function uploadImage(accessToken, userUrn, imagePath) {
  try {
    // Step 1: Register the image upload
    const registerResponse = await executeWithRetry(accessToken, async (token) => {
      return await axios.post(
        `${LINKEDIN_API}/assets?action=registerUpload`,
        {
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: userUrn,
            serviceRelationships: [
              {
                relationshipType: 'OWNER',
                identifier: 'urn:li:userGeneratedContent',
              },
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'Content-Type': 'application/json',
          },
        }
      );
    });

    const uploadUrl = registerResponse.data.value.uploadMechanism[
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
    ].uploadUrl;
    const mediaUrn = registerResponse.data.value.asset;

    console.log('   Image upload registered. URN:', mediaUrn);

    // Step 2: Upload the image binary
    const imageBuffer = fs.readFileSync(imagePath);
    const fileSize = fs.statSync(imagePath).size;

    await executeWithRetry(accessToken, async (token) => {
      return await axios.post(uploadUrl, imageBuffer, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'image/png',
          'Content-Length': fileSize.toString(),
        },
      });
    });

    console.log('   Image uploaded successfully!');
    return mediaUrn;
  } catch (error) {
    console.error('❌ Error uploading image:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

module.exports = { postToLinkedIn };
