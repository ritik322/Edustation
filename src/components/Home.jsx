import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, storage, db } from "../firebase-config";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
  getStorage,
} from "firebase/storage";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import axios from "axios";
import * as pdfjs from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.entry";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import Tesseract from "tesseract.js";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const Home = () => {
  const [customSubject, setCustomSubject] = useState("");
  const [suggestedSubject, setSuggestedSubject] = useState("");
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [files, setFiles] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(null);
  const [showFileMenu, setShowFileMenu] = useState(null);
  const [isRenamingFile, setIsRenamingFile] = useState(null);
  const [newFileName, setNewFileName] = useState("");
  const [isMovingFile, setIsMovingFile] = useState(null);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [customFolders, setCustomFolders] = useState([]);
  const [subjects] = useState([
    "Artificial Intelligence",
    "Database Management System",
    "Information Retrieval",
    "Design and Analysis of Algorithms",
    "Data Structures And Algorithms",
  ]);
  const navigate = useNavigate();
  const [currentFolder, setCurrentFolder] = useState(null);

  useEffect(() => {
    if (auth.currentUser) {
      loadUserFiles();
      loadCustomFolders();
    }
  }, [files]);
  const getActiveFolders = () => {
    const activeFolders = new Set();

    // Add folders from files
    Object.keys(files).forEach((subject) => {
      if (files[subject] && files[subject].length > 0) {
        activeFolders.add(subject);
      }
    });

    // Add custom folders that contain files
    customFolders.forEach((folder) => {
      if (files[folder.name] && files[folder.name].length > 0) {
        activeFolders.add(folder.name);
      }
    });

    return Array.from(activeFolders);
  };

  const loadCustomFolders = async () => {
    if (!auth.currentUser) return;
    try {
      const foldersRef = collection(db, "folders");
      const q = query(foldersRef, where("userId", "==", auth.currentUser.uid));
      const snapshot = await getDocs(q);
      const folders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCustomFolders(folders);
    } catch (error) {
      console.error("Error loading folders:", error);
    }
  };

  const createNewFolder = async () => {
    if (!newFolderName.trim() || !auth.currentUser) return;

    try {
      await addDoc(collection(db, "folders"), {
        userId: auth.currentUser.uid,
        name: newFolderName.trim(),
        createdAt: new Date().toISOString(),
      });
      setNewFolderName("");
      setShowNewFolderDialog(false);
      await loadCustomFolders();
    } catch (error) {
      console.error("Error creating folder:", error);
      alert("Error creating folder");
    }
  };

  const handleRenameFile = async (fileId, newName) => {
    if (!newName.trim() || !auth.currentUser) return;

    try {
      const fileRef = doc(db, "documents", fileId);
      await updateDoc(fileRef, {
        name: newName.trim(),
      });
      setIsRenamingFile(null);
      setNewFileName("");
      await loadUserFiles();
    } catch (error) {
      console.error("Error renaming file:", error);
      alert("Error renaming file");
    }
  };

  const handleMoveFile = async (file, newFolder) => {
    if (!newFolder || !auth.currentUser) return;

    try {
      // Create new storage reference
      const newStorageRef = ref(
        storage,
        `documents/${auth.currentUser.uid}/${newFolder}/${file.name}`
      );

      // Get the file content from the old location
      const oldStorageRef = ref(
        storage,
        `documents/${auth.currentUser.uid}/${file.subject}/${file.name}`
      );
      const fileUrl = await getDownloadURL(oldStorageRef);
      const response = await fetch(fileUrl);
      const fileBlob = await response.blob();

      // Upload to new location
      await uploadBytes(newStorageRef, fileBlob);
      const newUrl = await getDownloadURL(newStorageRef);

      // Update Firestore document
      const fileRef = doc(db, "documents", file.id);
      await updateDoc(fileRef, {
        subject: newFolder,
        url: newUrl,
      });

      // Delete from old location
      await deleteObject(oldStorageRef);

      setIsMovingFile(null);
      await loadUserFiles();
    } catch (error) {
      console.error("Error moving file:", error);
      alert("Error moving file");
    }
  };

  const loadUserFiles = async (subject = null) => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "documents"),
      where("userId", "==", auth.currentUser.uid)
    );

    const querySnapshot = await getDocs(q);
    const subjectFiles = {};

    querySnapshot.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      const subject = data.subject || "Uncategorized"; // Fallback to "Uncategorized"
      if (!subjectFiles[subject]) {
        subjectFiles[subject] = [];
      }
      subjectFiles[subject].push(data);
    });

    setFiles(subjectFiles);
    if (subject) {
      setCurrentFolder(subject);
    }
  };

  const extractTextFromPDF = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    const totalPages = pdf.numPages;
    const maxPages = Math.min(totalPages, 5);

    // Process each page to extract images for OCR
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d");

      await page.render({ canvasContext: context, viewport: viewport }).promise;

      // Perform OCR on the rendered canvas (image)
      const {
        data: { text: pageText },
      } = await Tesseract.recognize(canvas.toDataURL(), "eng", {
        logger: (info) => console.log(info), // Optional: log progress
      });

      text += pageText + " ";
    }
    return text;
  };

  const classifyPDFSubject = async (text) => {
    console.log(text);
    const prompt = `Based on the text provided below, please identify the most relevant subject from the following list: ${subjects.join(
      ", "
    )}. If none of the subjects fit, reply with "Uncategorized". 
  Text: ${text}
  Respond only with the subject name.`;

    const apiKey = "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";

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

      console.log(
        "API Response:",
        response.data.choices[0].message.content.trim()
      );
      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error("Error classifying the document:", error);
      if (error.response) {
        console.error("Response data:", error.response.data);
        console.error("Response status:", error.response.status);
        console.error("Response headers:", error.response.headers);
      } else if (error.request) {
        console.error("No response received:", error.request);
      } else {
        console.error("Error setting up request:", error.message);
      }
      return "Uncategorized";
    }
  };

  const FileMenu = ({ file }) => (
    <div
      className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5"
      onClick={(e) => e.stopPropagation()} // Prevent closing when clicking menu
    >
      <div className="py-1" role="menu">
        <button
          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          onClick={() => {
            setIsRenamingFile(file.id);
            setNewFileName(file.name);
            setShowFileMenu(null);
          }}
        >
          Rename
        </button>
        <button
          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          onClick={() => {
            setIsMovingFile(file);
            setShowFileMenu(null);
          }}
        >
          Move to folder
        </button>
        <button
          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
          onClick={() => {
            handleDeleteFile(file);
            setShowFileMenu(null);
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );

  const handleSingleFileUpload = async (file, startTime, subject) => {
    try {
      // Create a unique file name
      const uniqueFileName = `${
        file.name.split(".")[0]
      }_${Date.now()}.${file.name.split(".").pop()}`;

      // Reference the storage path
      const storageRef = ref(
        storage,
        `documents/${auth.currentUser.uid}/${subject}/${uniqueFileName}`
      );

      // Upload the file
      const uploadResult = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(uploadResult.ref); // Get download URL from upload result

      // Add document data to Firestore
      await addDoc(collection(db, "documents"), {
        userId: auth.currentUser.uid,
        name: uniqueFileName,
        url: url,
        subject: subject || "Uncategorized",
        uploadedAt: new Date().toISOString(),
      });

      // Calculate progress and estimated time
      const timeElapsed = Date.now() - startTime;
      const progress = ((currentUploadIndex + 1) / uploadQueue.length) * 100;
      setUploadProgress(progress);

      const averageTimePerFile = timeElapsed / (currentUploadIndex + 1);
      const remainingFiles = uploadQueue.length - (currentUploadIndex + 1);
      const estimatedTime = Math.ceil(
        (averageTimePerFile * remainingFiles) / 1000
      ); // Convert to seconds
      setEstimatedTimeRemaining(estimatedTime);
      setUploadQueue((prevQueue) =>
        prevQueue.filter((_, index) => index !== currentUploadIndex)
      );

      await loadUserFiles(); // Refresh user files
    } catch (error) {
      console.error("Error uploading file:", error.message);
      alert(`Error uploading ${file.name}: ${error.message}`);
    }
  };

  const handleFileUpload = (event) => {
    const selectedFiles = Array.from(event.target.files).filter((file) =>
      file.type.includes("pdf")
    );

    if (selectedFiles.length === 0) {
      alert("Please select PDF files only");
      return;
    }

    setUploadQueue(selectedFiles);
    setCurrentUploadIndex(0);
    setUploadProgress(0);

    // Handle the first file to extract the subject
    const file = selectedFiles[0];

    extractTextFromPDF(file)
      .then((pdfText) => {
        return classifyPDFSubject(pdfText.substring(0, 1000));
      })
      .then((suggestedSubject) => {
        setSuggestedSubject(suggestedSubject);
        setShowSubjectModal(true); // Show the modal for subject confirmation
      })
      .catch((error) => {
        console.error("Error processing file:", error);
      });
  };
  const handleConfirmSubject = (subject) => {
    setCustomSubject(subject);
    setShowSubjectModal(false);
    uploadFiles();
  };
  const uploadFiles = async () => {
    for (const file of uploadQueue) {
      const startTime = Date.now();
      await handleSingleFileUpload(
        file,
        startTime,
        customSubject || suggestedSubject
      );
      setCurrentUploadIndex((prevIndex) => prevIndex + 1);
    }

    // Reset states after uploading
    setUploadQueue([]); // Clear the upload queue
    setCurrentUploadIndex(0); // Reset index
    setUploadProgress(0); // Reset progress
  };
  const handleDeleteFile = async (file) => {
    if (window.confirm("Are you sure you want to delete this file?")) {
      const storageRef = ref(
        storage,
        `documents/${auth.currentUser.uid}/${file.subject}/${file.name}`
      ); // Correct storage path
      try {
        // Delete the file from Firebase Storage
        await deleteObject(storageRef);
        // Delete the document from Firestore
        await deleteDoc(doc(db, "documents", file.id));
        loadUserFiles(); // Refresh the file list
      } catch (error) {
        console.error("Error deleting file:", error);
        alert("Error deleting file");
      }
    }
  };
  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} min ${remainingSeconds} sec`;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => setShowNewFolderDialog(true)}
            className="flex items-center bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            <CreateNewFolderIcon className="mr-2" />
            Create New Folder
          </button>
        </div>
        {/* New Folder Dialog */}
        {showNewFolderDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg w-96">
              <h3 className="text-lg font-semibold mb-4">Create New Folder</h3>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full p-2 border rounded mb-4"
                placeholder="Folder name"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowNewFolderDialog(false);
                    setNewFolderName("");
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={createNewFolder}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">My Documents</h1>
          <div className="flex gap-4">
            <button
              onClick={() => navigate("/chat")}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              AI Chat
            </button>
            <button
              onClick={() => signOut(auth)}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          {uploadQueue.length > 0 ? (
            <div className="space-y-4">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <div className="text-sm text-gray-600">
                <p>
                  Processing file {currentUploadIndex + 1} of{" "}
                  {uploadQueue.length}
                </p>
                {estimatedTimeRemaining && (
                  <p>
                    Estimated time remaining:{" "}
                    {formatTime(estimatedTimeRemaining)}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          )}
        </div>
        {showSubjectModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-11/12 max-w-md">
              <h3 className="text-lg font-semibold mb-4">
                Suggested Subject:{" "}
                <span className="text-blue-500">{suggestedSubject}</span>
              </h3>
              <input
                type="text"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="Enter custom subject (optional)"
                className="border border-gray-300 rounded-lg p-2 mb-4 w-full"
              />
              <div className="flex justify-end">
                <button
                  className="confirm-button bg-blue-500 text-white rounded-lg px-4 py-2 hover:bg-blue-600 transition"
                  onClick={() =>
                    handleConfirmSubject(customSubject || suggestedSubject)
                  }
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {uploadQueue.length === 0 && (
          <div>
            {currentFolder && (
              <div className="mb-4">
                <button
                  onClick={() => {
                    setCurrentFolder(null);
                    loadUserFiles();
                  }}
                  className="text-blue-600"
                >
                  Back to Folders
                </button>
              </div>
            )}
            {getActiveFolders().length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {currentFolder === null &&
                  getActiveFolders().map((subject) => (
                    <div
                      key={subject}
                      className="bg-white rounded-lg p-4 shadow cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => loadUserFiles(subject)}
                    >
                      <h2 className="text-xl font-semibold flex items-center">
                        <span className="material-icons mr-2">folder</span>
                        <span>{subject}</span>
                      </h2>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <p>No documents uploaded yet.</p>
                <p className="text-sm mt-2">Upload PDF files to get started.</p>
              </div>
            )}
            {/* Files List */}
            {currentFolder && files[currentFolder] ? (
              <div>
                <table className="min-w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-white">
                      <th className="text-center py-2 px-4 border-b border-gray-300">
                        Name
                      </th>
                      <th className="text-center py-2 px-4 border-b border-gray-300">
                        Uploaded
                      </th>
                      <th className="text-center py-2 px-4 border-b border-gray-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {files &&
                      files[currentFolder].map((file) => (
                        <tr
                          key={file.id}
                          className="hover:bg-gray-100 bg-white"
                          onClick={() => navigate(`/document/${file.id}`)}
                        >
                          <td className="py-2 px-4 border-gray-300 hover:cursor-pointer flex justify-center">
                            <PictureAsPdfIcon
                              style={{ fontSize: 20, marginRight: 8 }}
                            />
                            {file.name}
                          </td>
                          <td className="py-2 px-4 border-b border-gray-300 text-center">
                            {new Date(file.uploadedAt).toLocaleDateString()}
                          </td>
                          <td className="py-2 px-4 border-b border-gray-300 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent triggering onClick for the parent
                                handleDeleteFile(file);
                              }}
                              className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              !files && <div>No files in this folder.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
