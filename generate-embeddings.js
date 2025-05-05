const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { OpenAI } = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const dataDir = path.join(__dirname, 'data');
const outputFile = path.join(__dirname, 'embeddings.json');

function splitText(text, maxLength = 500) {
    return text.match(new RegExp(`.{1,${maxLength}}`, 'g')) || [];
}

async function generateEmbeddings() {
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.md'));
    const allChunks = [];

    for (const file of files) {
        const filePath = path.join(dataDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const chunks = splitText(content);

        for (const chunk of chunks) {
            const response = await openai.embeddings.create({
                model: 'text-embedding-ada-002',
                input: chunk
            });

            allChunks.push({
                text: chunk,
                embedding: response.data[0].embedding
            });
        }
    }

    fs.writeFileSync(outputFile, JSON.stringify(allChunks, null, 2));
    console.log('✅ Embeddings generados y guardados en embeddings.json');
}

generateEmbeddings();
