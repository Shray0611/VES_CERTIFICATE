// StudentCertificate.js
import React, { useState } from "react";
import { saveAs } from "file-saver";

const StudentCertificate = () => {
  const [certificateId, setCertificateId] = useState("");
  const [error, setError] = useState("");

  
// In StudentCertificate.js
const handleDownload = async (certificateId) => {
  try {
    const token = localStorage.getItem('token');
    console.log("Sending request with token:", token);

    const response = await fetch(`http://localhost:5000/api/certificates/${certificateId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log("Response status:", response.status);
    console.log("Response headers:", response.headers);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Download failed with error:", errorText);
      throw new Error(errorText || "Download failed");
    }

    const blob = await response.blob();
    console.log("Received blob:", blob);
    saveAs(blob, `certificate-${certificateId}.png`);
  } catch (err) {
    console.error("Error in handleDownload:", err);
    setError(err.message);
  }
};

  return (
    <div className="student-certificate">
      <h2>Download Your Certificate</h2>
      <input
        type="text"
        value={certificateId}
        onChange={(e) => setCertificateId(e.target.value)}
        placeholder="Enter Certificate ID"
      />
      <button onClick={handleDownload}>Download Certificate</button>
      {error && <p className="error">{error}</p>}
    </div>
  );
};

export default StudentCertificate;
