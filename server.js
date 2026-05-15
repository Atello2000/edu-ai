const app  = require('./app');

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`EDU AI démarré sur http://localhost:${PORT}`));
