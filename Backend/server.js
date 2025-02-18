const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createCanvas, loadImage } = require("canvas");
const QRCode = require("qrcode");
const app = express();

// Config
const JWT_SECRET = "your_secure_jwt_secret";
const PORT = 5000;
// When generating QR codes for certificates, the URL will point to the front‑end verify route.
// (If you prefer server verification, use a different constant.)
const FRONTEND_VERIFY_URL = process.env.FRONTEND_VERIFY_URL || "http://localhost:5173/verify";

// Middleware
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "50mb" }));

// Database Connection
mongoose
  .connect("mongodb://127.0.0.1:27017/certi_db")
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Schemas
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["admin", "student"], default: "student" },
  createdAt: { type: Date, default: Date.now },
});

const TemplateSchema = new mongoose.Schema({
  image: String,
  variables: [
    {
      name: String,
      x: Number,
      y: Number,
      fontSize: Number,
      fontFamily: String,
      color: String,
    },
  ],
  qrConfig: {
    x: Number,
    y: Number,
    width: Number,
    height: Number,
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

const CertificateSchema = new mongoose.Schema({
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: "Template" },
  studentData: Object,
  email: String,
  collectionId: { type: mongoose.Schema.Types.ObjectId, ref: "Collection" },
  createdAt: { type: Date, default: Date.now },
});

const CollectionSchema = new mongoose.Schema({
  name: String,
  certificates: [{ type: mongoose.Schema.Types.ObjectId, ref: "Certificate" }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

// Models
const User = mongoose.model("User", UserSchema);
const Template = mongoose.model("Template", TemplateSchema);
const Certificate = mongoose.model("Certificate", CertificateSchema);
const Collection = mongoose.model("Collection", CollectionSchema);

// Auth Middleware
const auth = (roles = []) => {
  return async (req, res, next) => {
    try {
      const token = req.header("Authorization")?.replace("Bearer ", "");
      if (!token) throw new Error("Access denied");
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user || (roles.length && !roles.includes(user.role))) {
        throw new Error("Unauthorized");
      }
      req.user = user;
      next();
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  };
};

// Routes

app.post("/api/register", async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword, role });
    await user.save();
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET);
    res.status(201).json({ token, role: user.role });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new Error("Invalid credentials");
    }
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET);
    res.json({ token, role: user.role });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Generate Template and Certificates (admin)
app.post("/api/templates", auth(["admin"]), async (req, res) => {
  try {
    const { image, variables, qrConfig, excelData } = req.body;
    if (!excelData[0]?.email) {
      throw new Error("Excel file must contain email column");
    }
    const template = new Template({
      image,
      variables,
      qrConfig: qrConfig || null,
      createdBy: req.user._id,
    });
    await template.save();
    const certificates = excelData.map((row) => ({
      templateId: template._id,
      studentData: row,
      email: row.email,
    }));
    const insertedCertificates = await Certificate.insertMany(certificates);
    const collection = new Collection({
      name: `Collection ${new Date().toISOString().slice(0, 10)}`,
      certificates: insertedCertificates.map((c) => c._id),
      createdBy: req.user._id,
    });
    await collection.save();
    await Certificate.updateMany(
      { _id: { $in: insertedCertificates.map((c) => c._id) } },
      { $set: { collectionId: collection._id } }
    );
    res.status(201).json({
      message: "Certificates generated successfully",
      collectionId: collection._id,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get certificates for a student
app.get("/api/certificates", auth(), async (req, res) => {
  try {
    const certificates = await Certificate.find({ email: req.user.email })
      .populate("templateId")
      .populate("collectionId");
    res.json(certificates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Certificate Download Route with QR Code (for student downloads)
app.get("/api/certificates/:id", auth(), async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.id)
      .populate("templateId")
      .populate("collectionId");
    if (!certificate || certificate.email !== req.user.email) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    const dataURL = certificate.templateId.image;
    const image = await loadImage(dataURL);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    ctx.textBaseline = "top";
    certificate.templateId.variables.forEach(
      ({ name, x, y, fontSize, fontFamily, color }) => {
        const posX = (x / 100) * canvas.width;
        const posY = (y / 100) * canvas.height;
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillStyle = color;
        ctx.fillText(certificate.studentData[name] || "", posX, posY);
      }
    );
    if (certificate.templateId.qrConfig) {
      const qrConf = certificate.templateId.qrConfig;
      // The QR code now points to the FRONTEND_VERIFY_URL so that scanning it goes to the front‑end verification page.
      const qrUrl = `${FRONTEND_VERIFY_URL}/${certificate._id}`;
      let qrDataURL;
      try {
        qrDataURL = await QRCode.toDataURL(qrUrl, { width: qrConf.width, margin: 1 });
      } catch (err) {
        console.error("Error generating QR code:", err);
      }
      if (qrDataURL) {
        const qrImage = await loadImage(qrDataURL);
        const qrPosX = (qrConf.x / 100) * canvas.width;
        const qrPosY = (qrConf.y / 100) * canvas.height;
        ctx.drawImage(qrImage, qrPosX, qrPosY, qrConf.width, qrConf.height);
      }
    }
    res.set("Content-Type", "image/png");
    canvas.createPNGStream().pipe(res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API route to return certificate details for verification (returns JSON)
// Here we convert all studentData keys to lowercase to handle case differences.
app.get("/api/verify/:id", async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.id)
      .populate("templateId")
      .populate("collectionId");
    if (!certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    const studentData = certificate.studentData || {};
    const lowerData = {};
    Object.keys(studentData).forEach(key => {
      lowerData[key.toLowerCase()] = studentData[key];
    });
    const studentName = lowerData["name"] || "N/A";
    const email = lowerData["email"] || "N/A";
    // Check for division using either "division" or "div"
    const division = lowerData["division"] || lowerData["div"] || "N/A";
    const event = lowerData["event"] || "N/A";
    res.json({
      certificateId: certificate._id,
      studentName,
      email,
      division,
      event,
      issuedAt: certificate.createdAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Collection Routes (admin)
app.post("/api/collections", auth(["admin"]), async (req, res) => {
  try {
    const { name, certificateIds } = req.body;
    const collection = new Collection({
      name,
      certificates: certificateIds,
      createdBy: req.user._id,
    });
    await collection.save();
    await Certificate.updateMany(
      { _id: { $in: certificateIds } },
      { $set: { collectionId: collection._id } }
    );
    res.status(201).json(collection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/collections", auth(["admin"]), async (req, res) => {
  try {
    const collections = await Collection.find({ createdBy: req.user._id })
      .populate("certificates")
      .populate("createdBy");
    res.json(collections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/collections/:id", auth(["admin"]), async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id).populate({
      path: "certificates",
      populate: {
        path: "templateId",
        match: { createdBy: req.user._id },
      },
    });
    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }
    res.json(collection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/certificates", auth(["admin"]), async (req, res) => {
  try {
    const certificates = await Certificate.find()
      .populate({
        path: "templateId",
        match: { createdBy: req.user._id },
      })
      .then((results) => results.filter((c) => c.templateId !== null));
    res.json(certificates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/certificates/:id", auth(["admin"]), async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.id).populate("templateId");
    if (
      !certificate ||
      certificate.templateId.createdBy.toString() !== req.user._id.toString()
    ) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    certificate.studentData = { ...certificate.studentData, ...req.body };
    await certificate.save();
    res.json(certificate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Duplicate register route if needed
app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    const emailRegex = /^[a-zA-Z0-9._-]+@ves\.ac\.in$/;
    if (!emailRegex.test(email)) {
      throw new Error("Email must be in the ves.ac.in domain");
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword, role: "student" });
    await user.save();
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET);
    res.status(201).json({ token, role: user.role });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/admin/users", auth(["admin"]), async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/admin/users/:id/role", auth(["admin"]), async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) throw new Error("User not found");
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
