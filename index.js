const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});


function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}

const embeddingsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'embeddings.json'), 'utf-8'));


app.post('/generate-post', async (req, res) => {
    const { instruccion, noticia } = req.body;

    if (!instruccion || !noticia) {
        return res.status(400).json({ error: "Faltan datos: instruccion y noticia son requeridos." });
    }

    try {
        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: noticia
        });

        const noticiaEmbedding = embeddingResponse.data[0].embedding;

        // Calcular similitud con todos los chunks
        const scoredChunks = embeddingsData.map(chunk => ({
            ...chunk,
            score: cosineSimilarity(noticiaEmbedding, chunk.embedding)
        }));

        // Ordenar y tomar los top 3 más relevantes
        const topChunks = scoredChunks
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map(c => c.text)
            .join('\n---\n');

        const prompt = `
        Eres un generador de contenido para LinkedIn que trabaja para la agencia creativa Sosadiaz.

        Instrucción: ${instruccion}
        Noticia: ${noticia}

        Contexto relevante:
        ${topChunks}

        Genera un post atractivo, profesional y con enfoque estratégico. No pongas hashtags ni emojis, escribe como lo haría un equipo editorial profesional.
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.8,
            //  max_tokens: 400,
        });

        const caption = completion.choices?.[0]?.message?.content?.trim();

        if (!caption) {
            throw new Error("No se pudo generar el contenido del post.");
        }

        res.json({ caption });

    } catch (error) {
        console.error("Error al generar el post:", error);
        res.status(500).json({ error: "Error generando contenido." });
    }
});


app.listen(PORT, () => {
    console.log(`Sosadiaz API corriendo en http://localhost:${PORT}`);
});
