const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.post('/caption', (req, res) => {
    const { instruccion, noticia } = req.body;

    if (!instruccion || !noticia) {
        return res.status(400).json({ error: "Faltan datos: instruccion y noticia son requeridos." });
    }

    const caption = `🚀 *${noticia}*\n🧠 ${instruccion}, enfocado en captar atención.`

    res.json({ caption });
});

app.listen(PORT, () => {
    console.log(`Sosadiaz API corriendo en http://localhost:${PORT}`);
});
