const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');  // Import the CORS middleware
const csv = require('csv-parser');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

// Use CORS middleware
const allowedOrigins = ['http://localhost:5173', 'https://fixit-bot.vercel.app'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
}));

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

// Load the CSV data into memory
let knowledgeBase = [];
fs.createReadStream('knowledge_base.csv')
  .pipe(csv())
  .on('data', (row) => {
    knowledgeBase.push(row);
  })
  .on('end', () => {
    console.log('CSV file successfully processed');
  });

// List of tech support experts or agencies
const techSupportList = [
  { name: 'TechSupport Agency', contact: 'support@techagency.com', phone: '+1-800-555-0199' },
  { name: 'IT Help Desk', contact: 'helpdesk@ithelp.com', phone: '+1-800-555-0177' },
  { name: 'Gadget Gurus', contact: 'info@gadgetgurus.com', phone: '+1-800-555-0123' },
  { name: 'Computer Fixers', contact: 'contact@computerfixers.com', phone: '+1-800-555-0165' }
];

// Function to get solutions based on device and issue
function getSolution(device, issue) {
  const entry = knowledgeBase.find(item => item.Device === device && item.Issue === issue);
  return entry ? entry.Solution : null; // Return null if solution is not found
}

// Function to extract device from message
function extractDeviceFromMessage(message) {
  const lowerCaseMessage = message.toLowerCase();
  const devices = ['laptop', 'phone', 'mifi'];

  for (const device of devices) {
    if (lowerCaseMessage.includes(device)) {
      return device.charAt(0).toUpperCase() + device.slice(1);
    }
  }

  return 'Unknown';
}

// Function to extract issue from message
function extractIssueFromMessage(message) {
  const lowerCaseMessage = message.toLowerCase();
  const issues = [
    'slow performance',
    'no internet connection',
    'app crashing',
    'not charging',
    'no signal',
    'slow internet speed'
  ];

  for (const issue of issues) {
    if (lowerCaseMessage.includes(issue)) {
      return issue.charAt(0).toUpperCase() + issue.slice(1);
    }
  }

  return 'Unknown';
}

// Function to get tech support contact information
function getTechSupportContacts() {
  return techSupportList.map(support => 
    `Name: ${support.name}\nContact: ${support.contact}\nPhone: ${support.phone}`
  ).join('\n\n');
}

app.post('/api/chat', async (req, res) => {
  const userMessage = req.body.message;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(userMessage);
    const response = await result.response;
    const text = await response.text();

    // Extract device and issue from the user's message
    const device = extractDeviceFromMessage(userMessage);
    const issue = extractIssueFromMessage(userMessage);

    // Get the solution from the knowledge base
    const solution = getSolution(device, issue);

    // Prepare response
    const additionalInfo = solution 
      ? `Additional Info: ${solution}` 
      : `Sorry, I couldn't find a solution for your issue. Here are some tech support contacts:\n\n${getTechSupportContacts()}`;

    res.status(200).json({ reply: `${text}\n\n${additionalInfo}` });
  } catch (error) {
    console.error('Error processing the AI response:', error);
    res.status(500).json({ error: 'Failed to process the AI response' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
