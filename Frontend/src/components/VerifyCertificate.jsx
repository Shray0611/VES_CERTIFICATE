import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const VerifyCertificate = () => {
  const { id } = useParams();
  const [certificate, setCertificate] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`http://localhost:5000/api/verify/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Certificate not found');
        return res.json();
      })
      .then(data => setCertificate(data))
      .catch(err => setError(err.message));
  }, [id]);

  if (error) return <div className="verify-page"><h1>Error</h1><p>{error}</p></div>;
  if (!certificate) return <div className="verify-page"><p>Loading...</p></div>;

  return (
    <div className="verify-page">
      <h1>Certificate Verified</h1>
      <p><strong>Name:</strong> {certificate.studentName}</p>
      <p><strong>Email:</strong> {certificate.email}</p>
      <p><strong>Division:</strong> {certificate.division}</p>
      <p><strong>Event:</strong> {certificate.event}</p>
      <p><strong>Issued On:</strong> {new Date(certificate.issuedAt).toLocaleDateString()}</p>
      {/* Add additional fields here if needed */}
    </div>
  );
};

export default VerifyCertificate;
