import Groq from "groq-sdk";

// Configure Groq client - Allow browser usage for testing
const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY; // Use environment variable for API key
const groq = new Groq({ 
  apiKey: GROQ_API_KEY,
  dangerouslyAllowBrowser: true // Enable browser usage (ONLY for testing/development)
});
const DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

export class DocumentProcessor {
  constructor(model = DEFAULT_MODEL, apiKey = null) {
    this.vectorStore = null;
    this.chunks = [];
    this.embeddings = [];
    this.model = model;
    this.autoSummarize = true;
    this.lastSummary = null;
    
    // Allow passing API key directly to constructor for frontend use
    if (apiKey) {
      this.groqClient = new Groq({ 
        apiKey, 
        dangerouslyAllowBrowser: true // Enable browser usage (ONLY for testing/development)
      });
    } else {
      this.groqClient = groq; // Use the global client
    }
  }

  setAutoSummarize(enabled) {
    this.autoSummarize = enabled;
  }

  // Initialize vector store
  async initializeVectorStore(text) {
    // Split text into chunks
    this.chunks = this.createChunks(text, CHUNK_SIZE, CHUNK_OVERLAP);
    
    // Generate embeddings for chunks
    this.embeddings = await this.generateEmbeddings(this.chunks);
  }

  // Create text chunks with overlap
  createChunks(text, size, overlap) {
    const chunks = [];
    let startIndex = 0;
    
    while (startIndex < text.length) {
      const chunk = text.slice(startIndex, startIndex + size);
      chunks.push(chunk);
      startIndex += size - overlap;
    }
    
    return chunks;
  }

  // Generate embeddings using Groq API
  async generateEmbeddings(texts) {
    try {
      const embeddings = await Promise.all(
        texts.map(async (text) => {
          const response = await this.groqClient.chat.completions.create({
            messages: [
              {
                role: "system",
                content: "You are an embedding generator. Return a numeric vector representation of the input text."
              },
              {
                role: "user",
                content: `Generate a numeric embedding vector for this text: "${text}"`
              }
            ],
            model: this.model,
            temperature: 0,
            response_format: { type: "json_object" }
          });
          
          // Extract the embedding from the response
          const content = response.choices[0]?.message?.content || "[]";
          // Parse the JSON string to get the vector (assuming Groq returns a JSON with embedding values)
          try {
            const parsed = JSON.parse(content);
            return Array.isArray(parsed.embedding) ? parsed.embedding : 
                   Array.isArray(parsed) ? parsed : 
                   content.split(',').map(Number);
          } catch (e) {
            // Fallback: create a simple hash-based pseudo-embedding if JSON parsing fails
            return this.createSimpleEmbedding(text);
          }
        })
      );
      return embeddings;
    } catch (error) {
      console.error('Error generating embeddings:', error);
      // Fallback to simple embeddings if Groq API fails
      return texts.map(text => this.createSimpleEmbedding(text));
    }
  }

  // Create a simple hash-based embedding for fallback
  createSimpleEmbedding(text, dimensions = 100) {
    const embedding = Array(dimensions).fill(0);
    
    // Simple hash function to generate pseudo-embeddings
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      embedding[i % dimensions] += charCode;
    }
    
    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  // Calculate cosine similarity between two vectors
  cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
    const normA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
    const normB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
    return dotProduct / (normA * normB);
  }

  // Perform similarity search
  async similaritySearch(query, k = 3) {
    const queryEmbedding = await this.generateEmbeddings([query]);
    
    // Calculate similarities
    const similarities = this.embeddings.map(embedding => 
      this.cosineSimilarity(queryEmbedding[0], embedding)
    );
    
    // Get top k chunks
    const topK = similarities
      .map((score, idx) => ({ score, idx }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
    
    return topK.map(({ idx }) => this.chunks[idx]);
  }

  // Generate summary using Groq API
  async generateSummary(text) {
    try {
      const response = await this.groqClient.chat.completions.create({
        messages: [
          {
            role: "user",
            content: `Create a concise, clear summary of the following text while maintaining key information. Keep it short, 4-5 lines:\n\n"${text}"`
          }
        ],
        model: this.model,
        temperature: 0.2
      });
      
      return response.choices[0]?.message?.content?.trim() || "Failed to generate summary.";
    } catch (error) {
      console.error('Error generating summary:', error);
      throw error;
    }
  }

  // Answer questions using similarity search and Groq
  async answerQuestion(question) {
    try {
      if (!this.embeddings.length) {
        throw new Error('Vector store not initialized');
      }

      // Get relevant chunks using similarity search
      const relevantChunks = await this.similaritySearch(question);
      const context = relevantChunks.join('\n\n');

      // Generate answer using Groq
      const response = await this.groqClient.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "Answer the following question based only on the provided context. If the answer cannot be found in the context, say 'I cannot find the answer in the provided context.'"
          },
          {
            role: "user",
            content: `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer:`
          }
        ],
        model: this.model,
        temperature: 0.2
      });

      return {
        answer: response.choices[0]?.message?.content?.trim() || "Failed to generate an answer.",
        relevantChunks
      };
    } catch (error) {
      console.error('Error answering question:', error);
      throw error;
    }
  }

  // Extract text from PDF page
  async extractPageText(pdfDoc, pageNum) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      return textContent.items.map(item => item.str).join(' ');
    } catch (error) {
      console.error('Error extracting page text:', error);
      throw error;
    }
  }

  // Generate multiple-choice questions using Groq API
  async generateMCQs(text, options = { number: 3, subject: 'General', tone: 'formal' }) {
    try {
      const response = await this.groqClient.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a multiple-choice question generator. Create questions based on the provided text."
          },
          {
            role: "user",
            content: `
              Create ${options.number} multiple-choice questions based on the following text. 
              Make the questions suitable for ${options.subject} students in a ${options.tone} tone.
              
              Text: "${text}"

              Format your response as a JSON object with this exact structure:
              {
                "1": {
                  "no": 1,
                  "mcq": "Question text here?",
                  "options": {
                    "A": "First option",
                    "B": "Second option",
                    "C": "Third option",
                    "D": "Fourth option"
                  },
                  "correct": "B",
                  "explanation": "Detailed explanation of why this answer is correct"
                }
              }
            `
          }
        ],
        model: this.model,
        temperature: 0.4,
        response_format: { type: "json_object" }
      });
      
      const content = response.choices[0]?.message?.content || "{}";
      
      try {
        return JSON.parse(content);
      } catch (error) {
        console.error('Error parsing MCQ JSON:', error);
        throw new Error(`MCQ JSON Parse Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error generating MCQs:', error);
      throw new Error(`MCQ Generation Error: ${error.message}`);
    }
  }

  // Process page content
  async processPageContent(pdfDoc, pageNum, generateMCQ = false, mcqOptions = {}) {
    try {
      const text = await this.extractPageText(pdfDoc, pageNum);
      await this.initializeVectorStore(text);
      
      let summary = null;
      if (this.autoSummarize) {
        summary = await this.generateSummary(text);
        this.lastSummary = summary;
      } else {
        summary = this.lastSummary;
      }
      
      let mcqs = null;
      if (generateMCQ) {
        mcqs = await this.generateMCQs(text, mcqOptions);
      }
      
      return {
        text,
        summary,
        mcqs
      };
    } catch (error) {
      console.error('Error processing page content:', error);
      throw error;
    }
  }

  // Check MCQ answer
  async checkMCQAnswer(mcqNo, selectedAnswer, mcqs) {
    try {
      const question = mcqs[mcqNo];
      const isCorrect = selectedAnswer === question.correct;
      
      return {
        isCorrect,
        correctAnswer: question.correct,
        explanation: question.explanation
      };
    } catch (error) {
      console.error('Error checking MCQ answer:', error);
      throw new Error(`MCQ Answer Check Error: ${error.message}`);
    }
  }
}

// Example usage
async function exampleUsage() {
  try {
    // For direct API key usage (useful in browser environments)
    const apiKey = "your-api-key-here"; // Replace with your actual API key for testing
    const processor = new DocumentProcessor(DEFAULT_MODEL, apiKey);
    
    // Sample text processing
    const sampleText = "This is a sample text that will be processed. It contains information about various topics that can be used for question answering and summarization.";
    
    await processor.initializeVectorStore(sampleText);
    
    // Generate summary
    const summary = await processor.generateSummary(sampleText);
    console.log("Summary:", summary);
    
    // Answer a question
    const answer = await processor.answerQuestion("What topics does the text contain?");
    console.log("Answer:", answer);
    
    // Generate MCQs
    const mcqs = await processor.generateMCQs(sampleText);
    console.log("MCQs:", mcqs);
    
  } catch (error) {
    console.error("Error in example usage:", error);
  }
}

// Uncomment to run the example
// exampleUsage();

// React component example usage
/*
import React, { useState, useEffect } from 'react';
import { DocumentProcessor } from './document-utils';

function DocumentProcessorComponent() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  async function processDocument() {
    setLoading(true);
    try {
      // Get API key from environment variable or configuration
      const apiKey = process.env.REACT_APP_GROQ_API_KEY;
      if (!apiKey) {
        throw new Error("Missing GROQ API key. Set REACT_APP_GROQ_API_KEY in your environment.");
      }
      
      const processor = new DocumentProcessor("meta-llama/llama-4-scout-17b-16e-instruct", apiKey);
      const text = "Sample text for processing and analysis.";
      
      // Initialize and process
      await processor.initializeVectorStore(text);
      const summary = await processor.generateSummary(text);
      
      setResult({ summary });
    } catch (err) {
      console.error("Error processing document:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div className="document-processor">
      <h2>Document Processor</h2>
      <button onClick={processDocument} disabled={loading}>
        {loading ? 'Processing...' : 'Process Document'}
      </button>
      
      {error && <div className="error">Error: {error}</div>}
      
      {result && (
        <div className="result">
          <h3>Summary</h3>
          <p>{result.summary}</p>
        </div>
      )}
    </div>
  );
}

export default DocumentProcessorComponent;
*/