import React, { useEffect, useState } from 'react';
import { saveAs } from 'file-saver';

const CertificateList = () => {
  const [certificates, setCertificates] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCertificates = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5000/api/certificates', {
          headers: { Authorization: `Bearer ${token}` }
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

  const handleDownload = async (certificateId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/certificates/${certificateId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Download failed');
      }
      
      const blob = await response.blob();
      saveAs(blob, `certificate-${certificateId}.png`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="certificate-list">
      <h2>Your Certificates</h2>
      {error && <p className="error">{error}</p>}
      <div className="certificates">
        {certificates.map(cert => (
          <div key={cert._id} className="certificate-item">
            <h3>{cert.studentData.name}'s Certificate</h3>
            <p>Issued: {new Date(cert.createdAt).toLocaleDateString()}</p>
            <button onClick={() => handleDownload(cert._id)}>
              Download Certificate
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CertificateList;