import { useState } from "react";

export default function FileUpload({ onUpload }) {
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("http://localhost:3001/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (data.fileUrl) {
      onUpload(data.fileUrl);
    }
  };

  return (
    <div className="mt-4">
      <input type="file" onChange={handleFileChange} className="mb-2" />
      <button onClick={handleUpload} className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition">
        Upload
      </button>
    </div>
  );
}
