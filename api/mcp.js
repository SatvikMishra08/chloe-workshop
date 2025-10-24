const cheerio = require('cheerio');

async function executeScrape(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.84 Safari/537.36'
        }
    });

    if (!response.ok) {
        throw new Error(`Request failed with status: ${response.status}`);
    }

    return response.text();
}

async function processGoogleSearch(html, query) {
    const $ = cheerio.load(html);
    const results = [];
    $('div.g').slice(0, 5).each((i, el) => {
        const titleEl = $(el).find('h3');
        const linkEl = $(el).find('a');
        const snippetContainer = $(el).find('div.VwiC3b, div[data-sncf="2"]').first();
        
        const title = titleEl.text();
        const uri = linkEl.attr('href');
        const snippet = snippetContainer.text();

        if (title && uri && snippet) {
            results.push({ title, uri, snippet });
        }
    });

    let combinedText = `Intelligence report based on top search results for query: "${query}"\n\n`;
    results.forEach((res, i) => {
        combinedText += `[Source ${i+1}: ${res.title}]\nSnippet: ${res.snippet}\n\n`;
    });

    return { text: combinedText, sources: results };
}

async function processOnionSite(html, url) {
    const $ = cheerio.load(html);
    let content = $('main').text() || $('article').text() || $('body').text();
    content = content.replace(/\s\s+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
    return { text: `Raw text content from ${url}:\n\n${content.substring(0, 5000)}`, sources: [{ title: $('title').text() || url, uri: url }] };
}

// This is the main Vercel serverless function handler
module.exports = async (req, res) => {
    // Set CORS headers to allow requests from any origin (your AI Studio app)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle pre-flight CORS requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { tool, params } = req.body;

    if (!tool || !params) {
        return res.status(400).json({ error: 'Missing tool or params in request body' });
    }
    
    try {
        let targetUrl = '';
        let queryForProcessing = '';
        let processingFunction;

        switch (tool) {
            case 'call_watchtower':
                queryForProcessing = params.target_name;
                targetUrl = `https://www.google.com/search?q=${encodeURIComponent(queryForProcessing)}`;
                processingFunction = (html) => processGoogleSearch(html, queryForProcessing);
                break;

            case 'veiled_mirror_query':
                const { mission_type, query } = params;
                switch (mission_type) {
                    case 'onion_browse':
                        if (!query.endsWith('.onion')) {
                           return res.status(400).json({ error: 'Invalid .onion address provided.' });
                        }
                        targetUrl = `https://${query.replace('.onion', '.onion.ly')}`;
                        processingFunction = (html) => processOnionSite(html, targetUrl);
                        break;
                    default:
                        const searchTerms = {
                            threat_intelligence: `cybersecurity report dark web zero-day exploit for "${query}"`,
                            market_analysis: `dark web marketplace price list for "${query}" OR chatter about "${query}" data breach`,
                            counter_intelligence: `leaked credentials containing "${query}" OR haveibeenpwned analysis for "${query}"`,
                        };
                        queryForProcessing = searchTerms[mission_type] || query;
                        targetUrl = `https://www.google.com/search?q=${encodeURIComponent(queryForProcessing)}`;
                        processingFunction = (html) => processGoogleSearch(html, queryForProcessing);
                }
                break;

            case 'call_social_cartographer':
                queryForProcessing = `professional relationships and social network graph for "${params.target_name}"`;
                targetUrl = `https://www.google.com/search?q=${encodeURIComponent(queryForProcessing)}`;
                processingFunction = (html) => processGoogleSearch(html, queryForProcessing);
                break;

            default:
                return res.status(400).json({ error: `Unknown tool: ${tool}` });
        }

        if (!targetUrl || !processingFunction) {
            return res.status(400).json({ error: 'Could not determine action for the provided tool.' });
        }

        const rawHtml = await executeScrape(targetUrl);
        const result = await processingFunction(rawHtml);
        
        return res.status(200).json(result);

    } catch (error) {
        console.error('MCP Internal Error:', error);
        return res.status(500).json({ error: `An internal error occurred in the workshop: ${error.message}` });
    }
};