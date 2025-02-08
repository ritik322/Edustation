import { GoogleGenerativeAI } from "@google/generative-ai";
import * as pdfjsLib from 'pdfjs-dist';

const GEMINI_API_KEY = "AIzaSyABZUXHaGViOJ3G1y1aqL-lNRqd5v3V9Q4";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

export class DocumentProcessor {
  constructor() {
    this.vectorStore = null;
    this.chunks = [];
    this.embeddings = [];
    this.model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
    this.autoSummarize = true;
    this.lastSummary = null;
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

  // Generate embeddings using Gemini API
  async generateEmbeddings(texts) {
    try {
      const embeddings = await Promise.all(
        texts.map(async (text) => {
          const result = await this.model.generateContent({
            contents: [{ role: 'user', parts: [{ text }] }],
            generationConfig: { temperature: 0 }
          });
          return result.response.text().split(' ').map(Number);
        })
      );
      return embeddings;
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw error;
    }
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

  // Generate summary using Gemini API
  async generateSummary(text) {
    try {
      const prompt = `Create a concise, clear summary of the following text while maintaining key information. Keep it short, 4-5 lines:\n\n"${text}"`;
      const result = await this.model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      console.error('Error generating summary:', error);
      throw error;
    }
  }

  // Answer questions using similarity search and Gemini
  async answerQuestion(question) {
    try {
      if (!this.embeddings.length) {
        throw new Error('Vector store not initialized');
      }

      // Get relevant chunks using similarity search
      const relevantChunks = await this.similaritySearch(question);
      const context = relevantChunks.join('\n\n');

      // Generate answer using Gemini
      const prompt = `
        Answer the following question based only on the provided context.
        If the answer cannot be found in the context, say "I cannot find the answer in the provided context."
        
        Context:
        ${context}
        
        Question: ${question}
        
        Answer:
      `;

      const result = await this.model.generateContent(prompt);
      return {
        answer: result.response.text().trim(),
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

  async generateMCQs(text, options = { number: 3, subject: 'General', tone: 'formal' }) {
    try {
      const prompt = `
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
      `;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text().trim();
      const cleanJSON = response.replace(/```(?:json)?\n?/g, '').trim();
      
      return JSON.parse(cleanJSON);
    } catch (error) {
      console.error('Error generating MCQs:', error);
      throw new Error(`MCQ Generation Error: ${error.message}`);
    }
  }

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