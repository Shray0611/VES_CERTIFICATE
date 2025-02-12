import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const AdminCertificates = () => {
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [editingCert, setEditingCert] = useState(null);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');

  // Fetch collections and certificates
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');

        // Fetch collections
        const collectionsResponse = await fetch('http://localhost:5000/api/collections', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const collectionsData = await collectionsResponse.json();
        setCollections(collectionsData);

        // Fetch all certificates
        const certificatesResponse = await fetch('http://localhost:5000/api/admin/certificates', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const certificatesData = await certificatesResponse.json();
        setCertificates(certificatesData);
      } catch (err) {
        setError(err.message);
      }
    };

    fetchData();
  }, []);

  // Handle collection selection
  const handleCollectionSelect = async (collectionId) => {
    if (!collectionId) {
      setSelectedCollection(null);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/collections/${collectionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setSelectedCollection(data);
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle certificate edit click
  const handleEditClick = (certificate) => {
    setEditingCert(certificate);
    setFormData(certificate.studentData);
  };

  // Handle input change for editing
  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Handle form submission for editing
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/certificates/${editingCert._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Update certificates state
      setCertificates(certs => 
        certs.map(c => 
          c._id === editingCert._id ? { ...c, studentData: formData } : c
        )
      );

      // Update selected collection if it exists
      if (selectedCollection) {
        setSelectedCollection(prev => ({
          ...prev,
          certificates: prev.certificates.map(c => 
            c._id === editingCert._id ? { ...c, studentData: formData } : c
          )
        }));
      }

      setEditingCert(null);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="admin-certificates">
      <h2>Managed Certificates</h2>
      <Link to="/generate" className="back-button">Back to Generator</Link>
      
      {error && <p className="error">{error}</p>}

      {/* Collection Selector */}
      <div className="collection-selector">
        <h3>Collections</h3>
        <div className="collection-list">
          <div 
            className={`collection-item ${!selectedCollection ? 'active' : ''}`}
            onClick={() => handleCollectionSelect(null)}
          >
            <span>All Certificates</span>
            <span>({certificates.length} certificates)</span>
          </div>
          {collections.map(collection => (
            <div 
              key={collection._id} 
              className={`collection-item ${selectedCollection?._id === collection._id ? 'active' : ''}`}
              onClick={() => handleCollectionSelect(collection._id)}
            >
              <span>{collection.name}</span>
              <span>({collection.certificates.length} certificates)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Certificate Table */}
      <div className="certificate-table">
        <h3>Certificates in {selectedCollection ? selectedCollection.name : 'All Certificates'}</h3>
        <table>
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Email</th>
              <th>Issue Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(selectedCollection ? selectedCollection.certificates : certificates).map(cert => (
              <tr key={cert._id}>
                <td>{cert.studentData.name}</td>
                <td>{cert.email}</td>
                <td>{new Date(cert.createdAt).toLocaleDateString()}</td>
                <td>
                  <button onClick={() => handleEditClick(cert)}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingCert && (
        <div className="edit-modal">
          <div className="modal-content">
            <h3>Edit Certificate Data</h3>
            <form onSubmit={handleSubmit}>
              {Object.entries(editingCert.templateId.variables).map(([_, varConfig]) => (
                <div key={varConfig.name} className="form-field">
                  <label>{varConfig.name}</label>
                  <input
                    type="text"
                    name={varConfig.name}
                    value={formData[varConfig.name] || ''}
                    onChange={handleInputChange}
                  />
                </div>
              ))}
              <div className="modal-actions">
                <button type="button" onClick={() => setEditingCert(null)}>Cancel</button>
                <button type="submit">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCertificates;