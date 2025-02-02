const express = require('express');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.use(bodyParser.urlencoded({ extended: true }));

const dialectConfig = {
    'access': {
        prompt: `You are a MS Access SQL expert. Rules:
1. Use Access-specific syntax (COUNTER for auto-increment, DATETIME for dates)
2. Maximum VARCHAR length 255
3. Use DOUBLE for floating numbers
4. No SERIAL type, use COUNTER instead
5. Table names in PascalCase`
    },
    'postgres': {
        prompt: `You are a PostgreSQL expert. Rules:
1. Use PostgreSQL syntax (SERIAL for auto-increment)
2. Use TEXT type for long strings
3. Use TIMESTAMPTZ for timestamps
4. Use lowercase table names with underscores
5. Include schema if necessary`
    },
    'mysql': {
        prompt: `You are a MySQL expert. Rules:
1. Use MySQL syntax (AUTO_INCREMENT)
2. Use VARCHAR(191) for indexes
3. Use DATETIME(3) for millisecond precision
4. Use backticks for identifiers
5. Include ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    }
};

async function generateSQL(userQuery, dialect = 'access') {
    try {
        const config = dialectConfig[dialect] || dialectConfig.access;
        const fullPrompt = `${config.prompt}\n\nGenerate SQL for: ${userQuery}\n\nSQL:`;
        
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        
        const sql = response.text()
            .replace(/```sql/g, '')
            .replace(/```/g, '')
            .trim();
            
        return sql || '/* No SQL generated */';
    } catch (error) {
        console.error('Generation error:', error);
        return `/* Error: ${error.message} */`;
    }
}

app.get('/', async (req, res) => {
    try {
        const { q: query, l: dialect = 'access' } = req.query;
        if (!query) return res.status(400).send('Missing "q" parameter');
        
        const validDialects = Object.keys(dialectConfig);
        const selectedDialect = validDialects.includes(dialect.toLowerCase()) 
            ? dialect.toLowerCase() 
            : 'access';

        const sql = await generateSQL(query, selectedDialect);
        res.type('text/plain').send(sql);
        
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).send('Internal server error');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
