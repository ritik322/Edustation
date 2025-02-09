import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, storage, db } from "../firebase-config";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import axios from "axios";
import * as pdfjs from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.entry";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const Home = () => {
  // State variables for subjects, file management and UI feedback
  const [suggestedSubject, setSuggestedSubject] = useState("");
  const [files, setFiles] = useState({});
  // uploadQueue holds objects: { file, status, progress }
  const [uploadQueue, setUploadQueue] = useState([]);
  const navigate = useNavigate();
  const [currentFolder, setCurrentFolder] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [newSubject, setNewSubject] = useState("");
  const [showSubjectDialog, setShowSubjectDialog] = useState(false);
  const [pdfSearchQuery, setPdfSearchQuery] = useState("");
  const [pdfSearchResults, setPdfSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Load user files and subjects on mount.
  useEffect(() => {
    if (auth.currentUser) {
      loadUserFiles();
      fetchSubjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSubjects = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.error("No user logged in");
        return;
      }
      const subjectsRef = collection(db, "subjects");
      const q = query(subjectsRef, where("userId", "==", user.uid));
      const snapshot = await getDocs(q);
      const subjectsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSubjects(subjectsList);
    } catch (error) {
      console.error("Error fetching subjects:", error);
    }
  };

  const getActiveFolders = () => {
    const activeFolders = new Set();
    Object.keys(files).forEach((subject) => {
      if (files[subject] && files[subject].length > 0) {
        activeFolders.add(subject);
      }
    });
    return Array.from(activeFolders);
  };

  const loadUserFiles = async (subject = null) => {
    if (!auth.currentUser) return;
    try {
      const q = query(
        collection(db, "documents"),
        where("userId", "==", auth.currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const subjectFiles = {};
      querySnapshot.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() };
        // Default subject to "Uncategorized" if missing.
        const subjectName = data.subject;
        if (!subjectFiles[subjectName]) {
          subjectFiles[subjectName] = [];
        }
        subjectFiles[subjectName].push(data);
      });
      setFiles(subjectFiles);
      if (subject) setCurrentFolder(subject);
    } catch (error) {
      console.error("Error loading user files:", error);
    }
  };

  const extractTextFromPDF = async (file) => {
    // Read the file as an array buffer.
    const arrayBuffer = await file.arrayBuffer();
    // Load the PDF document.
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    const totalPages = pdf.numPages;
    const maxPages = Math.min(totalPages, 5);

    // Loop through the first maxPages pages.
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      // Get the text content of the page.
      const textContent = await page.getTextContent();
      // Map the text items to strings and join them.
      const pageText = textContent.items.map((item) => item.str).join(" ");
      text += pageText + " ";
      console.log(`Page ${i} text:`, pageText.substring(0, 100));
    }

    // Limit the text to the first 1000 words.
    const words = text.split(/\s+/);
    const limitedWords = words.slice(0, 1000);
    return limitedWords.join(" ");
  };

  // Build a subject list string from the fetched subjects.
  const getSubjectListString = () => {
    return subjects.map((s) => s.name).join(", ");
  };

  const classifyPDFSubject = async (text) => {
    const subjectList = getSubjectListString();
    const prompt = `Based on the text provided below, please identify the most relevant subject from the following list: ${subjectList}.
Text: ${text}
Respond only with the subject name mentioned in the subject list.`;
    const apiKey = "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";
    console.log("Classifying PDF using prompt:", prompt);
    try {
      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama3-8b-8192",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      const classified = response.data.choices[0].message.content.trim();
      console.log("Classification result:", classified);
      return classified;
    } catch (error) {
      console.error("Error classifying the document:", error);
    }
  };

  // Upload a single file with granular progress updates.
  const handleSingleFileUpload = async (fileObj, index, subject) => {
    try {
      const file = fileObj.file;
      // Update file status to "uploading" with initial progress 0
      setUploadQueue((prevQueue) => {
        const newQueue = [...prevQueue];
        newQueue[index] = {
          ...newQueue[index],
          status: "uploading",
          progress: 0,
        };
        return newQueue;
      });

      // Generate a unique file name
      const uniqueFileName = `${
        file.name.split(".")[0]
      }_${Date.now()}.${file.name.split(".").pop()}`;

      // Use the file's classified subject instead of suggestedSubject
      const finalSubject = fileObj.subject; // Fixed: Use the file's own subject
      const storagePath = `documents/${auth.currentUser.uid}/${finalSubject}/${uniqueFileName}`;
      const storageRef = ref(storage, storagePath);

      // Use uploadBytesResumable to track progress
      const uploadTask = uploadBytesResumable(storageRef, file);

      return new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress =
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadQueue((prevQueue) => {
              const newQueue = [...prevQueue];
              newQueue[index] = { ...newQueue[index], progress };
              return newQueue;
            });
          },
          (error) => {
            console.error("Error uploading file:", error);
            setUploadQueue((prevQueue) => {
              const newQueue = [...prevQueue];
              newQueue[index] = { ...newQueue[index], status: "failed" };
              return newQueue;
            });
            reject(error);
          },
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            // Save file info to Firestore
            await addDoc(collection(db, "documents"), {
              userId: auth.currentUser.uid,
              name: uniqueFileName,
              url: url,
              subject: finalSubject,
              storagePath: storagePath,
              uploadedAt: new Date().toISOString(),
            });
            setUploadQueue((prevQueue) => {
              const newQueue = [...prevQueue];
              newQueue[index] = {
                ...newQueue[index],
                status: "completed",
                progress: 100,
              };
              return newQueue;
            });
            resolve();
          }
        );
      });
    } catch (error) {
      console.error("Error in handleSingleFileUpload:", error);
      setUploadQueue((prevQueue) => {
        const newQueue = [...prevQueue];
        newQueue[index] = { ...newQueue[index], status: "failed" };
        return newQueue;
      });
      throw error; // Propagate error to handle it in handleFileUpload
    }
  };

  const handleFileUpload = async (event) => {
    const selectedFiles = Array.from(event.target.files).filter((file) =>
      file.type.includes("pdf")
    );
    if (selectedFiles.length === 0) {
      alert("Please select PDF files only");
      return;
    }

    // Initialize empty upload queue
    setUploadQueue([]);

    // Process and upload each file immediately
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      try {
        const text = await extractTextFromPDF(file);
        console.log(`Extracted text for ${file.name}:`, text.substring(0, 100));

        const subject = await classifyPDFSubject(text.substring(0, 1000));
        console.log(`Suggested subject for ${file.name}:`, subject);

        const fileObject = {
          file,
          status: "pending",
          progress: 0,
          subject: subject,
        };

        // Add to upload queue
        setUploadQueue((prevQueue) => [...prevQueue, fileObject]);

        // Upload immediately using the correct index
        await handleSingleFileUpload(fileObject, i, subject);
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        setUploadQueue((prevQueue) => [
          ...prevQueue,
          {
            file,
            status: "failed",
            progress: 0,
            subject: "Default",
          },
        ]);
      }
    }

    // After all files are processed and uploaded
    await loadUserFiles();
    setUploadQueue([]);
  };

  // Delete a file using the stored storagePath (or compute it if missing).
  const handleDeleteFile = async (file) => {
    if (window.confirm("Are you sure you want to delete this file?")) {
      let storagePath = file.storagePath;
      if (!storagePath) {
        const finalSubject = file.subject;
        storagePath = `documents/${auth.currentUser.uid}/${finalSubject}/${file.name}`;
      }
      const storageRef = ref(storage, storagePath);
      try {
        await deleteObject(storageRef);
        await deleteDoc(doc(db, "documents", file.id));
        await loadUserFiles();
      } catch (error) {
        console.error("Error deleting file:", error);
        alert("Error deleting file");
      }
    }
  };
  // New Functions for PDF Search using SerpApi
  // ========================
  const handlePdfSearch = async () => {
    if (!pdfSearchQuery.trim()) return;
    setIsSearching(true);
    try {
      // Replace with your actual SerpApi key
      const SERPAPI_KEY =
        "ac4da2c5814275143f88d5ea82a85882aec9b8abde313be0d700db2a84d2f7da";
      // Append "filetype:pdf" to force PDF results
      const query = encodeURIComponent(pdfSearchQuery);
      const url = `https://serpapi.com/search.json?engine=google&q=${query}&api_key=${SERPAPI_KEY}`;
      const response = await axios.get(url);

      // SerpApi returns an organic_results array
      const pdfResults = response.data.organic_results;
      const formattedResults = pdfResults.map((result) => ({
        title: result.title,
        snippet: result.snippet,
        downloadLink: result.link,
      }));
      setPdfSearchResults(formattedResults);
    } catch (error) {
      console.error("Error searching for PDF:", error);
      alert("Error searching for PDF. Please try again later.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddExternalPdf = async (result) => {
    try {
      await addDoc(collection(db, "documents"), {
        userId: auth.currentUser.uid,
        name: result.title,
        url: result.downloadLink,
        subject: "External",
        uploadedAt: new Date().toISOString(),
      });
      loadUserFiles();
      alert("PDF added successfully to your documents!");
    } catch (error) {
      console.error("Error adding external PDF:", error);
      alert("Error adding PDF.");
    }
  };

  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} min ${remainingSeconds} sec`;
  };

  const addSubject = async () => {
    if (!newSubject.trim()) return;
    try {
      const user = auth.currentUser;
      if (!user) {
        console.error("No user logged in");
        return;
      }
      const docRef = await addDoc(collection(db, "subjects"), {
        name: newSubject,
        userId: user.uid,
      });
      setSubjects([
        ...subjects,
        { id: docRef.id, name: newSubject, userId: user.uid },
      ]);
      setNewSubject("");
      setShowSubjectDialog(false);
    } catch (error) {
      console.error("Error adding subject:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Top Navigation */}
        <nav className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowSubjectDialog(true)}
                className="flex items-center bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
              >
                📚 Manage Subjects
              </button>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() =>
                  (window.location.href = "http://localhost:3000/")
                }
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
              >
                Study Room
              </button>
              <button
                onClick={() => navigate("/chat")}
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
              >
                Edu Assisstant
              </button>
              <button
                onClick={() => signOut(auth)}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </nav>

        {/* Subject Dialog */}
        {showSubjectDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl w-96 shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold">Manage Subjects</h3>
                <button
                  onClick={() => setShowSubjectDialog(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-lg p-4 mb-4 bg-gray-50">
                {subjects.length > 0 ? (
                  <ul className="space-y-2">
                    {subjects.map((subject, index) => (
                      <li
                        key={index}
                        className="flex items-center text-gray-700 p-2 hover:bg-gray-100 rounded"
                      >
                        📚 {subject.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    No subjects added yet.
                  </p>
                )}
              </div>
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="w-full p-3 border rounded-lg mb-4 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter new subject"
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowSubjectDialog(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addSubject}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  Add Subject
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="space-y-6">
          {/* Search Section */}
          <section className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">Search for PDF Online</h2>
            <div className="flex gap-3">
              <input
                type="text"
                value={pdfSearchQuery}
                onChange={(e) => setPdfSearchQuery(e.target.value)}
                placeholder="Enter PDF name"
                className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handlePdfSearch}
                className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Search
              </button>
            </div>

            {isSearching && (
              <div className="mt-4 text-center">
                <div className="animate-spin inline-block w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                <p className="mt-2 text-gray-600">Searching...</p>
              </div>
            )}

            {pdfSearchResults.length > 0 && (
              <div className="mt-6 space-y-4">
                {pdfSearchResults.map((result, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg mb-1">
                          {result.title}
                        </h3>
                        {result.snippet && (
                          <p className="text-gray-600 mb-2">{result.snippet}</p>
                        )}
                        <a
                          href={result.downloadLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700 inline-flex items-center"
                        >
                          📥 Download PDF
                        </a>
                      </div>
                      <button
                        onClick={() => handleAddExternalPdf(result)}
                        className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                      >
                        Add to My Documents
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Upload Section */}
          <section className="bg-white rounded-lg shadow-sm p-6">
            {uploadQueue.length > 0 ? (
              <div className="space-y-4">
                {uploadQueue.map((fileObj, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-4 border rounded-lg bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-red-500">📄</span>
                      <p className="font-medium">{fileObj.file.name}</p>
                    </div>

                    {fileObj.status === "uploading" && (
                      <div className="w-48 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${fileObj.progress}%` }}
                        ></div>
                      </div>
                    )}

                    {fileObj.status === "completed" && (
                      <span className="text-green-600 flex items-center gap-1">
                        ✅ Uploaded
                      </span>
                    )}

                    {fileObj.status === "failed" && (
                      <button
                        onClick={() =>
                          handleSingleFileUpload(
                            fileObj,
                            index,
                            suggestedSubject
                          )
                        }
                        className="text-red-500 hover:text-red-700 flex items-center gap-1"
                      >
                        🔄 Retry
                      </button>
                    )}

                    {fileObj.status === "pending" && (
                      <span className="text-gray-600">⏳ Pending</span>
                    )}
                  </div>
                ))}
                <button
                  onClick={handleFileUpload}
                  className="mt-6 bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors w-full"
                >
                  Start Upload
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handleFileUpload}
                  className="w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100
                    cursor-pointer"
                />
              </div>
            )}
          </section>

          {/* Files & Folders Section */}
          {uploadQueue.length === 0 && (
            <section>
              {currentFolder && (
                <button
                  onClick={() => {
                    setCurrentFolder(null);
                    loadUserFiles();
                  }}
                  className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
                >
                  ← Back to Folders
                </button>
              )}
              <h1 className="text-3xl mb-6 font-bold text-gray-800">My Documents</h1>

              {getActiveFolders().length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {currentFolder === null &&
                    getActiveFolders().map((subject) => (
                      <div
                        key={subject}
                        onClick={() => loadUserFiles(subject)}
                        className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                      >
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                          📁 {subject}
                        </h2>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center bg-white rounded-lg shadow-sm p-12">
                  <p className="text-xl text-gray-600 mb-2">
                    No documents uploaded yet
                  </p>
                  <p className="text-gray-500">
                    Upload PDF files to get started
                  </p>
                </div>
              )}

              {currentFolder && files[currentFolder] && (
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Uploaded
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {files[currentFolder].map((file) => (
                        <tr
                          key={file.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => navigate(`/document/${file.id}`)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-red-500 mr-2">📄</span>
                              <span className="font-medium">{file.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                            {new Date(file.uploadedAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFile(file);
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              🗑️ Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default Home;
