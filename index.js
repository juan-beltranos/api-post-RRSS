const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const { generateWithDeepSeek, generateWithOpenAI, getEmbedding } = require('./services');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());



// Cargar embeddings generados
const embeddingsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'embeddings.json'), 'utf-8'));

// Cargar archivos clave
const tone = fs.readFileSync(path.join(__dirname, 'data', '02_tone-style-guide (1).md'), 'utf-8');
const about = fs.readFileSync(path.join(__dirname, 'data', '01_about-company.md'), 'utf-8');

function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}

app.post('/generate-post', async (req, res) => {
    const { instruccion, noticia, ia } = req.body;
    const useDeepSeek = ia === 'deepseek';

    if (!instruccion || !noticia) {
        return res.status(400).json({ error: "Faltan datos: instruccion y noticia son requeridos." });
    }

    try {
        // Obtener embedding de la noticia
        const noticiaEmbedding = await getEmbedding(noticia);

        // Calcular similitud con los chunks del dataset
        const scoredChunks = embeddingsData.map(chunk => ({
            ...chunk,
            score: cosineSimilarity(noticiaEmbedding, chunk.embedding)
        }));

        const topChunks = scoredChunks
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map(c => c.text)
            .join('\n---\n');

        const prompt = `
        Eres un generador de contenido para LinkedIn que trabaja para la agencia creativa SOSADIAZ.

        Instrucción: ${instruccion}
        Noticia: ${noticia}

        Guía de estilo y tono:
        ${tone}

        Sobre la empresa:
        ${about}

        Contexto relevante:
        ${topChunks}

        Genera un post atractivo, profesional y con enfoque estratégico. No pongas hashtags ni emojis, escribe como lo haría un equipo editorial profesional.
        `;

        const caption = useDeepSeek
            ? await generateWithDeepSeek(prompt)
            : await generateWithOpenAI(prompt);

        if (!caption) {
            throw new Error("No se pudo generar el contenido del post.");
        }

        res.send(caption);

    } catch (error) {
        console.error("Error al generar el post:", error);
        res.status(500).json({ error: "Error generando contenido." });
    }
});

app.listen(PORT, () => {
    console.log(`Sosadiaz API corriendo en http://localhost:${PORT}`);
});
