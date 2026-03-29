const express = require('express');
const cors = require('cors');
const routes = require('./routes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Main Routes
app.use('/api', routes);

app.get('/', (req, res) => {
    res.send('Indian Travel Platform API is running...');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
