const OpenAI = require('openai');
const axios = require('axios');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function generateWithOpenAI(prompt) {
    console.log('chatgpt');

    const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8
    });

    return completion.choices?.[0]?.message?.content?.trim();
}

async function generateWithDeepSeek(prompt) {
    console.log('deepseek');
    
    const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
            model: 'deepseek-reasoner',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.8
        },
        {
            headers: {
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        }
    );

    return response.data.choices?.[0]?.message?.content?.trim();
}

async function getEmbedding(text) {
    const response = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text
    });

    return response.data[0].embedding;
}

module.exports = {
    generateWithOpenAI,
    generateWithDeepSeek,
    getEmbedding
};
