import { json } from '@sveltejs/kit';
import axios from 'axios';

export async function POST({ request }) {
    const { filePath, header, content } = await request.json();
    const GITHUB_REPO = process.env.VITE_GITHUB_REPO;
    const GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN;

    if (!GITHUB_REPO || !GITHUB_TOKEN) {
        console.error('GitHub configuration is missing');
        return json({ success: false, error: 'GitHub configuration is missing' }, { status: 500 });
    }

    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`;

    try {
        let response;
        try {
            response = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${GITHUB_TOKEN}`,
                    Accept: 'application/vnd.github.v3+json'
                }
            });
        } catch (error) {
            if (error.response && error.response.status === 404) {
                // File doesn't exist, we'll create it
                response = { data: {} };
            } else {
                throw error;
            }
        }

        const { data } = response;

        let newContent, encodedContent, message;

        if (data.content) {
            const existingContent = Buffer.from(data.content, 'base64').toString('utf-8');
            newContent = existingContent + content;
            encodedContent = Buffer.from(newContent).toString('base64');
            message = `Update ${filePath}`;
        } else {
            newContent = header + content;
            encodedContent = Buffer.from(newContent).toString('base64');
            message = `Create ${filePath}`;
        }

        await axios.put(url, {
            message,
            content: encodedContent,
            sha: data.sha
        }, {
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: 'application/vnd.github.v3+json'
            }
        });

        return json({ success: true });
    } catch (error) {
        console.error('Error updating GitHub file:', error);
        return json({ success: false, error: error.message }, { status: 500 });
    }
}
