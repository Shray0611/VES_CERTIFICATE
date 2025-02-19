import React, { useState } from "react";
import { saveAs } from "file-saver";

const StudentCertificate = () => {
  const [certificateId, setCertificateId] = useState("");
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePreview = async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:5000/api/certificates/${certificateId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Preview failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (previewUrl) {
      saveAs(previewUrl, `certificate-${certificateId}.png`);
    }
  };

  const closePreview = () => {
    setPreviewUrl(null);
    URL.revokeObjectURL(previewUrl);
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
      <div className="certificate-actions">
        <button onClick={handlePreview} disabled={loading || !certificateId}>
          {loading ? "Loading..." : "Preview"}
        </button>
        <button onClick={handleDownload} disabled={!previewUrl}>
          Download
        </button>
      </div>

      {previewUrl && (
        <div className="preview-modal">
          <div className="preview-content">
            <img src={previewUrl} alt="Certificate Preview" />
            <button onClick={closePreview}>Close Preview</button>
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
};

export default StudentCertificate;
