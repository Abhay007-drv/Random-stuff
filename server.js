const express = require('express');
const multer = require('multer');
const fs = require('fs');

const app = express();
fs.mkdirSync('uploads', { recursive: true });
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

app.post('/upload', upload.any(), (req, res) => {
  console.log('Received:', req.files.map(f => f.originalname));
  res.json({ success: true, count: req.files.length });
});

app.listen(3000, () => console.log('Open http://localhost:3000'));