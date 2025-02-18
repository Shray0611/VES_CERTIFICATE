import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const VerifyCertificate = () => {
  const { code } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyCertificate = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/verify/${code}`
        );
        const data = await response.json();
        setResult(data);
      } catch (error) {
        setResult({ error: "Verification failed" });
      } finally {
        setLoading(false);
      }
    };
    verifyCertificate();
  }, [code]);

  if (loading) return <div>Verifying...</div>;

  return (
    <div className="verification-container">
      {result?.valid ? (
        <>
          <h2>✅ Valid Certificate</h2>
          <h3>Certificate Details:</h3>
          <ul>
            {Object.entries(result.certificate.studentData).map(
              ([key, value]) => (
                <li key={key}>
                  <strong>{key}:</strong> {value}
                </li>
              )
            )}
          </ul>
          <p>
            Issued on:{" "}
            {new Date(result.certificate.createdAt).toLocaleDateString()}
          </p>
          {result.certificate.collection && (
            <p>Collection: {result.certificate.collection}</p>
          )}
        </>
      ) : (
        <h2>❌ Invalid Certificate</h2>
      )}
    </div>
  );
};

export default VerifyCertificate;
