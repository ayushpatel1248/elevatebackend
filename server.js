import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'elevate_super_secret_key_123';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Admin Schema and Model
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const Admin = mongoose.model('Admin', adminSchema);

// Initialize default admin
const initAdmin = async () => {
  try {
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      const defaultAdmin = new Admin({ username: 'admin', password: 'admin' });
      await defaultAdmin.save();
      console.log('Default admin user created.');
    }
  } catch (err) {
    console.error('Error initializing admin:', err);
  }
};
initAdmin();

// Schema and Model
const serviceRequestSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  serviceId: { type: String, required: true },
  serviceName: { type: String, required: true },
  status: { type: String, default: 'Pending' },
  createdAt: { type: Date, default: Date.now }
});

const ServiceRequest = mongoose.model('ServiceRequest', serviceRequestSchema);

// Routes

// POST /api/admin/login - Authenticate admin against MongoDB
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const admin = await Admin.findOne({ username });
    if (!admin || admin.password !== password) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.status(200).json({ message: 'Login successful', success: true, token });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/requests - Create a new service request
app.post('/api/requests', async (req, res) => {
  try {
    const { name, phone, serviceId, serviceName } = req.body;
    
    if (!name || !phone || !serviceId || !serviceName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const newRequest = new ServiceRequest({
      name,
      phone,
      serviceId,
      serviceName
    });

    await newRequest.save();
    return res.status(201).json({ message: 'Request submitted successfully', request: newRequest });
  } catch (error) {
    console.error('Error creating request:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Middleware function to verify JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(403).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(403).json({ error: 'Invalid token format' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    req.admin = decoded;
    next();
  });
};

// GET /api/requests - Get all service requests (Admin)
app.get('/api/requests', verifyToken, async (req, res) => {
  try {
    const requests = await ServiceRequest.find().sort({ createdAt: -1 });
    return res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
