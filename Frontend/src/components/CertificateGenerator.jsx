import React, { useState, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { read, utils } from "xlsx";
import { saveAs } from "file-saver";
import Draggable from "react-draggable";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";

const CertificateGenerator = () => {
  const [template, setTemplate] = useState(null);
  const [variables, setVariables] = useState([]);
  const [currentVar, setCurrentVar] = useState("");
  const [excelData, setExcelData] = useState([]);
  const [userInput, setUserInput] = useState({});
  const [previewCertificate, setPreviewCertificate] = useState(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  // State to control whether the QR field is added or not
  const [qrEnabled, setQrEnabled] = useState(false);
  const [qrConfig, setQrConfig] = useState({
    x: 50, // in percentage
    y: 50, // in percentage
    width: 100, // in pixels
    height: 100, // in pixels
  });
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const imgRef = useRef(null);
  const navigate = useNavigate();

  const fontOptions = [
    "Arial",
    "Times New Roman",
    "Courier New",
    "Verdana",
    "Helvetica",
    "Georgia",
  ];

  useEffect(() => {
    if (imgRef.current) {
      const observer = new ResizeObserver(() => {
        setImageDimensions({
          width: imgRef.current.offsetWidth,
          height: imgRef.current.offsetHeight,
        });
      });
      observer.observe(imgRef.current);
      return () => observer.disconnect();
    }
  }, [template]);

  const {
    getRootProps: getTemplateRootProps,
    getInputProps: getTemplateInputProps,
  } = useDropzone({
    accept: { "image/*": [".png", ".jpg", ".jpeg"] },
    onDrop: (files) => {
      const reader = new FileReader();
      reader.onload = () => setTemplate(reader.result);
      reader.readAsDataURL(files[0]);
    },
  });

  const { getRootProps: getExcelRootProps, getInputProps: getExcelInputProps } =
    useDropzone({
      accept: {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      },
      onDrop: async (files) => {
        const file = await files[0].arrayBuffer();
        const wb = read(file);
        const data = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        if (!data[0]?.email) alert("Excel file must contain an email column");
        else setExcelData(data);
      },
    });

  const addVariable = () => {
    if (!currentVar) return;
    setVariables((prev) => [
      ...prev,
      {
        type: "text",
        name: currentVar,
        x: 0,
        y: 0,
        fontSize: 24,
        fontFamily: "Arial",
        color: "#000000",
      },
    ]);
    setCurrentVar("");
  };

  const addQRVariable = () => {
    setVariables((prev) => [
      ...prev,
      { type: "qr", name: "qrCode", x: 0, y: 0, size: 10 },
    ]);
  };

  const updateVariableProperty = (index, property, value) => {
    setVariables((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [property]: value } : v))
    );
  };

  const handleDrag = (index, data) => {
    if (!imgRef.current) return;
    const newX = (data.x / imageDimensions.width) * 100;
    const newY = (data.y / imageDimensions.height) * 100;
    setVariables((prev) =>
      prev.map((v, i) =>
        i === index ? { ...v, x: newX, y: newY } : v
      )
    );
  };

  const handleQrDrag = (data) => {
    if (!imgRef.current) return;
    const newX = (data.x / imageDimensions.width) * 100;
    const newY = (data.y / imageDimensions.height) * 100;
    setQrConfig((prev) => ({ ...prev, x: newX, y: newY }));
  };

  const deleteVariable = (index) => {
    setVariables((prev) => prev.filter((_, i) => i !== index));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserInput((prev) => ({ ...prev, [name]: value }));
  };

  const generatePreview = async () => {
    if (!template) return;
    const img = await loadImage(template);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    ctx.textBaseline = "top";
    variables.forEach(({ type, name, x, y, fontSize, fontFamily, color }) => {
      if (type === "text") {
        const posX = (x / 100) * canvas.width;
        const posY = (y / 100) * canvas.height;
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillStyle = color;
        ctx.fillText(userInput[name] || "", posX, posY);
      }
    });
    setPreviewCertificate(canvas.toDataURL("image/png"));
  };

  const generateCertificates = async () => {
    try {
      const token = localStorage.getItem("token");
      const payload = {
        image: template,
        variables,
        excelData,
      };
      if (qrEnabled) {
        payload.qrConfig = qrConfig;
      }
      const response = await fetch("http://localhost:5000/api/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await response.text());
      navigate("/admin/certificates");
    } catch (error) {
      alert(error.message);
    }
  };

  const loadImage = (src) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = src;
    });

  const exportConfig = () => {
    const config = { variables };
    if (qrEnabled) {
      config.qrConfig = qrConfig;
    }
    const blob = new Blob([JSON.stringify(config)], { type: "application/json" });
    saveAs(blob, "certificate-config.json");
  };

  return (
    <div className="container">
      <div {...getTemplateRootProps()} className="dropzone">
        <input {...getTemplateInputProps()} />
        <p>Drag & drop certificate template, or click to select</p>
      </div>

      {template && (
        <div className="variable-section">
          <div className="preview-container">
            <img
              ref={imgRef}
              src={template}
              alt="Template Preview"
              style={{ maxWidth: "100%", position: "relative" }}
            />
            {variables.map((varConfig, index) => {
              const xPixel = (varConfig.x / 100) * imageDimensions.width;
              const yPixel = (varConfig.y / 100) * imageDimensions.height;
              return varConfig.type === "text" ? (
                <Draggable
                  key={index}
                  bounds="parent"
                  onStop={(e, data) => handleDrag(index, data)}
                  position={{ x: xPixel, y: yPixel }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      border: "2px dashed #000",
                      padding: "5px",
                      backgroundColor: "rgba(255, 255, 255, 0.7)",
                      cursor: "move",
                      fontFamily: varConfig.fontFamily,
                      fontSize: `${varConfig.fontSize}px`,
                      color: varConfig.color,
                    }}
                  >
                    {varConfig.name}
                  </div>
                </Draggable>
              ) : (
                <Draggable
                  key={index}
                  bounds="parent"
                  onStop={(e, data) => handleDrag(index, data)}
                  position={{ x: xPixel, y: yPixel }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      border: "2px dashed #000",
                      backgroundColor: "rgba(255, 255, 255, 0.7)",
                      cursor: "move",
                      width: `${
                        (varConfig.size / 100) * imageDimensions.width
                      }px`,
                      height: `${
                        (varConfig.size / 100) * imageDimensions.width
                      }px`,
                    }}
                  >
                    [QR Code]
                  </div>
                </Draggable>
              );
            })}
            {qrEnabled && qrDataUrl && (
              <Draggable
                bounds="parent"
                onStop={(e, data) => handleQrDrag(data)}
                position={{
                  x: (qrConfig.x / 100) * imageDimensions.width,
                  y: (qrConfig.y / 100) * imageDimensions.height,
                }}
              >
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: qrConfig.width,
                    height: qrConfig.height,
                    cursor: "move",
                  }}
                />
              </Draggable>
            )}
          </div>

          <div className="variables-control">
            <div className="variable-input">
              <input
                value={currentVar}
                onChange={(e) => setCurrentVar(e.target.value)}
                placeholder="New variable name"
              />
              <button onClick={addVariable}>Add Text Field</button>
              <button onClick={addQRVariable} style={{ marginLeft: "10px" }}>
                Add QR Code
              </button>
            </div>

            {variables.map((varConfig, index) => (
              <div key={index} className="variable-item">
                <h4>
                  {varConfig.type === "text" ? varConfig.name : "QR Code"}
                  <button
                    className="delete-btn"
                    onClick={() => deleteVariable(index)}
                  >
                    ×
                  </button>
                </h4>
                <div className="variable-properties">
                  <div className="position-controls">
                    <label>
                      X (%):
                      <input
                        type="number"
                        value={varConfig.x}
                        onChange={(e) =>
                          updateVariableProperty(index, "x", e.target.value)
                        }
                      />
                    </label>
                    <label>
                      Y (%):
                      <input
                        type="number"
                        value={varConfig.y}
                        onChange={(e) =>
                          updateVariableProperty(index, "y", e.target.value)
                        }
                      />
                    </label>
                  </div>
                  {varConfig.type === "text" ? (
                    <div className="font-controls">
                      <label>
                        Font:
                        <select
                          value={varConfig.fontFamily}
                          onChange={(e) =>
                            updateVariableProperty(
                              index,
                              "fontFamily",
                              e.target.value
                            )
                          }
                        >
                          {fontOptions.map((font) => (
                            <option key={font} value={font}>
                              {font}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Size:
                        <input
                          type="number"
                          value={varConfig.fontSize}
                          onChange={(e) =>
                            updateVariableProperty(
                              index,
                              "fontSize",
                              e.target.value
                            )
                          }
                        />
                      </label>
                      <label>
                        Color:
                        <input
                          type="color"
                          value={varConfig.color}
                          onChange={(e) =>
                            updateVariableProperty(
                              index,
                              "color",
                              e.target.value
                            )
                          }
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="qr-controls">
                      <label>
                        Size (% of width):
                        <input
                          type="number"
                          value={varConfig.size}
                          onChange={(e) =>
                            updateVariableProperty(
                              index,
                              "size",
                              e.target.value
                            )
                          }
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* QR Code Field Section */}
            {!qrEnabled && (
              <button onClick={() => setQrEnabled(true)}>Add QR Code</button>
            )}
            {qrEnabled && (
              <div className="qr-control">
                <h4>
                  QR Code Placement
                  <button onClick={() => setQrEnabled(false)} className="delete-btn">
                    ×
                  </button>
                </h4>
                <div className="qr-properties">
                  <label>
                    X (%):
                    <input
                      type="number"
                      value={qrConfig.x}
                      onChange={(e) =>
                        setQrConfig((prev) => ({ ...prev, x: parseFloat(e.target.value) }))
                      }
                    />
                  </label>
                  <label>
                    Y (%):
                    <input
                      type="number"
                      value={qrConfig.y}
                      onChange={(e) =>
                        setQrConfig((prev) => ({ ...prev, y: parseFloat(e.target.value) }))
                      }
                    />
                  </label>
                  <label>
                    Width (px):
                    <input
                      type="number"
                      value={qrConfig.width}
                      onChange={(e) =>
                        setQrConfig((prev) => ({ ...prev, width: parseInt(e.target.value) }))
                      }
                    />
                  </label>
                  <label>
                    Height (px):
                    <input
                      type="number"
                      value={qrConfig.height}
                      onChange={(e) =>
                        setQrConfig((prev) => ({ ...prev, height: parseInt(e.target.value) }))
                      }
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="user-input-section">
        <h3>Enter Your Details</h3>
        {variables
          .filter((v) => v.type === "text")
          .map((varConfig, index) => (
            <div key={index} className="input-field">
              <label>{varConfig.name}</label>
              <input
                type="text"
                name={varConfig.name}
                value={userInput[varConfig.name] || ""}
                onChange={handleInputChange}
                placeholder={`Enter ${varConfig.name}`}
              />
            </div>
          ))}
        <button onClick={generatePreview}>Preview Certificate</button>
      </div>

      {previewCertificate && (
        <div className="preview-certificate">
          <h3>Your Certificate</h3>
          <img src={previewCertificate} alt="Generated Certificate" />
          <button onClick={() => saveAs(previewCertificate, "certificate.png")}>
            Download Certificate
          </button>
        </div>
      )}

      <div {...getExcelRootProps()} className="dropzone">
        <input {...getExcelInputProps()} />
        <p>Drag & drop Excel file, or click to select</p>
      </div>

      <div className="actions">
        <button onClick={exportConfig} disabled={!variables.length}>
          Export Configuration
        </button>
        <button onClick={generateCertificates} disabled={!excelData.length}>
          Generate Certificates
        </button>
      </div>
      <div>
        <a href="/admin/certificates">Generated Certificate Sets</a>
      </div>
    </div>
  );
};

export default CertificateGenerator;
