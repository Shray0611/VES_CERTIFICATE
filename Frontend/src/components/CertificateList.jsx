import React, { useEffect, useState } from "react";
import { saveAs } from "file-saver";

const CertificateList = () => {
  const [certificates, setCertificates] = useState([]);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    const fetchCertificates = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch("http://localhost:5000/api/certificates", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        setCertificates(data);
      } catch (err) {
        setError(err.message);
      }
    };

    fetchCertificates();
  }, []);

  const handlePreview = async (certificateId) => {
    try {
      setLoadingPreview(true);
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
      setLoadingPreview(false);
    }
  };

  const handleDownload = (certificateId) => {
    if (previewUrl) {
      saveAs(previewUrl, `certificate-${certificateId}.png`);
    }
  };

  const closePreview = () => {
    setPreviewUrl(null);
    URL.revokeObjectURL(previewUrl);
  };

  return (
    <div className="certificate-list">
      <h2>Your Certificates</h2>
      {error && <p className="error">{error}</p>}

      {previewUrl && (
        <div className="preview-modal">
          <div className="preview-content">
            <img src={previewUrl} alt="Certificate Preview" />
            <div className="preview-actions">
              <button onClick={closePreview}>Close Preview</button>
              <button onClick={() => handleDownload()}>Download</button>
            </div>
          </div>
        </div>
      )}

      <div className="certificates">
        {certificates.map((cert) => (
          <div key={cert._id} className="certificate-item">
            <h3>{cert.studentData.name}'s Certificate</h3>
            <p>Issued: {new Date(cert.createdAt).toLocaleDateString()}</p>
            <div className="certificate-actions">
              <button
                onClick={() => handlePreview(cert._id)}
                disabled={loadingPreview}
              >
                {loadingPreview ? "Loading..." : "Preview"}
              </button>
              <button onClick={() => handleDownload(cert._id)}>Download</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CertificateList;
