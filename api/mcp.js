const playwright = require('playwright-aws-lambda');

async function scrapeGoogle(query) {
    let browser = null;
    let context = null;
    try {
        browser = await playwright.launchChromium();
        context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.84 Safari/537.36'
        });
        const page = await context.newPage();
        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`);

        // Wait for search results to load
        await page.waitForSelector('div.g', { timeout: 10000 });

        const results = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('div.g'));
            return items.slice(0, 5).map(item => {
                const titleEl = item.querySelector('h3');
                const linkEl = item.querySelector('a');
                const snippetEl = item.querySelector('div[data-sncf="2"]');
                
                return {
                    title: titleEl ? titleEl.innerText : 'No Title',
                    uri: linkEl ? linkEl.href : 'No Link',
                    snippet: snippetEl ? snippetEl.innerText : 'No Snippet'
                };
            });
        });

        let combinedText = `Intelligence report based on top 5 search results for query: "${query}"\n\n`;
        results.forEach((res, i) => {
            combinedText += `[Source ${i+1}: ${res.title}]\nSnippet: ${res.snippet}\n\n`;
        });

        return { text: combinedText, sources: results };

    } catch (error) {
        console.error(error);
        return { text: `Failed to conduct intelligence gathering. Error: ${error.message}`, sources: [] };
    } finally {
        if (context) {
            await context.close();
        }
        if (browser) {
            await browser.close();
        }
    }
}

module.exports = async (req, res) => {
    // Set CORS headers to allow requests from any origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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