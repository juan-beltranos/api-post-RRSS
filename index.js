const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

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
const projects = fs.readFileSync(path.join(__dirname, 'data', '04_clients-and-projects.md'), 'utf-8');

function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}

async function getOriginalArticle(googleNewsUrl) {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox']
    });
    const page = await browser.newPage();

    const delay = (ms) => new Promise(res => setTimeout(res, ms));

    try {
        await page.goto(googleNewsUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 50000
        });

        await delay(5000);

        const finalUrl = page.url();

        await browser.close();
        return finalUrl;

    } catch (err) {
        await browser.close();
        throw err;
    }

}

app.post('/generate-post', async (req, res) => {
    const { instruccion, noticia, ia } = req.body;
    const useDeepSeek = ia === 'deepseek';

    if (!instruccion || !noticia) {
        return res.status(400).json({ error: "Faltan datos: instruccion y noticia son requeridos." });
    }

    try {
        const noticiaEmbedding = await getEmbedding(noticia);

        const scoredChunks = embeddingsData.map(chunk => ({
            ...chunk,
            score: cosineSimilarity(noticiaEmbedding, chunk.embedding)
        }));

        const topChunks = scoredChunks
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map(c => c.text)
            .join('\n---\n');

        // === PROYECTOS RELACIONADOS ===
        const projectChunks = scoredChunks
            .filter(chunk => chunk.origen === 'projects')
            .sort((a, b) => b.score - a.score)
            .filter(p => p.score > 0.75)
            .slice(0, 2);

        const proyectosRelacionados = projectChunks.length > 0
            ? `\nAdemás, esta noticia conecta con proyectos que SOSADIAZ ha desarrollado:\n${projectChunks.map(p => p.text).join('\n\n')}`
            : '\nAunque esta noticia no conecta directamente con un proyecto específico, plantea una oportunidad clara para que SOSADIAZ pueda aplicar o adaptar su experiencia y soluciones.';

        // === ENFOQUE SOSADIAZ (siempre presente) ===
        const enfoqueSosadiaz = `
        A partir de esta noticia, desarrolla un análisis breve de cómo SOSADIAZ podría:
        1. Implementar estrategias relacionadas.
        2. Conectar con servicios o proyectos que ya ofrece.
        3. Destacar su propuesta de valor de forma alineada a la noticia.
        `;

        const estilosDeApertura = [
            "Comienza con una pregunta que despierte curiosidad.",
            "Inicia con un dato o estadística relevante.",
            "Empieza con una frase breve y provocadora.",
            "Arranca con una mini anécdota ficticia que conecte con la noticia.",
            "Introduce el post de forma directa y profesional."
        ];

        const estiloAleatorio = estilosDeApertura[Math.floor(Math.random() * estilosDeApertura.length)];

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
        ${proyectosRelacionados}

        ${enfoqueSosadiaz}

        ${estiloAleatorio}

        Genera un post atractivo, profesional y con enfoque estratégico que explique cómo SOSADIAZ está alineado o podría alinearse con la noticia. No pongas hashtags ni emojis bajo ninguna circunstancia. El contenido debe estar listo para publicarse en LinkedIn.
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

app.get('/resolve-url', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing url' });
    try {
        const data = await getOriginalArticle(url);
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Sosadiaz API corriendo en http://localhost:${PORT}`);
});
