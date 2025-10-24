const cheerio = require('cheerio');

async function scrapeGoogle(query) {
    try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.84 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch Google search results. Status: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const results = [];
        $('div.g').slice(0, 5).each((i, el) => {
            const titleEl = $(el).find('h3');
            const linkEl = $(el).find('a');
            let snippetContainer = $(el).find('div[data-sncf="2"]').first();
            if (snippetContainer.length === 0) {
                 snippetContainer = $(el).find('div.VwiC3b').first();
            }
             
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

    } catch (error) {
        console.error(error);
        return { text: `Failed to conduct intelligence gathering. Error: ${error.message}`, sources: [] };
    }
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
    
    let query = '';

    try {
        switch (tool) {
            case 'call_watchtower':
                query = params.target_name;
                break;
            case 'veiled_mirror_query':
                const { mission_type, query: veiledQuery } = params;
                 switch (mission_type) {
                    case 'threat_intelligence':
                        query = `cybersecurity report dark web zero-day exploit for "${veiledQuery}"`;
                        break;
                    case 'market_analysis':
                        query = `dark web marketplace price list for "${veiledQuery}" OR chatter about "${veiledQuery}" data breach`;
                        break;
                    case 'counter_intelligence':
                        query = `leaked credentials containing "${veiledQuery}" OR haveibeenpwned analysis for "${veiledQuery}"`;
                        break;
                    default:
                        query = veiledQuery;
                }
                break;
            case 'call_social_cartographer':
                query = `professional relationships and social network graph for "${params.target_name}"`;
                break;
            default:
                return res.status(400).json({ error: `Unknown tool: ${tool}` });
        }

        if (!query) {
             return res.status(400).json({ error: 'Could not construct a valid search query.' });
        }

        const result = await scrapeGoogle(query);
        return res.status(200).json(result);

    } catch (error) {
        return res.status(500).json({ error: `An internal error occurred: ${error.message}` });
    }
};