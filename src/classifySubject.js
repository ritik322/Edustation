const express = require('express');
const { Groq } = require('groq'); // Import Groq client library
const app = express();
const port = 3001;
const cors = require('cors');
require('dotenv').config();

app.use(cors());
app.use(express.json());

const client = new Groq({
  api_key: process.env.GROQ_API_KEY, // Store your API key in .env file
});

app.post('/classify', async (req, res) => {
  const { text, subjects } = req.body;
  
  // Prompt creation - Adjust as needed
  const prompt = `Classify the following text into one of these subjects: ${subjects.join(', ')}.\n\nText: ${text}`;
  
  try {
    const chatCompletion = await client.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama3-8b-8192",
    });
    
    const result = chatCompletion.choices[0].message.content;
    res.json({ subject: result });
  } catch (error) {
    console.error("Error calling Groq model:", error);
    res.status(500).send("Error classifying the document.");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
