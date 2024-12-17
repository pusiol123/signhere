const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Middleware do obsługi plików w folderze uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ustawienie Multera do obsługi uploadu plików
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads');  // Pliki będą zapisywane w folderze 'uploads'
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));  // Używamy daty do unikalnej nazwy pliku
  }
});

const upload = multer({ storage: storage });

// Endpoint do uploadu pliku
app.post('/upload', upload.single('document'), (req, res) => {
  if (!req.file) {
    return res.status(400).send({ error: 'No file uploaded.' });
  }

  console.log('File uploaded:', req.file);  // Potwierdzenie, że plik został przesłany

  // Zwrócenie ścieżki do pliku, żeby można było go pobrać z front-endu
  const filePath = `/uploads/${req.file.filename}`;
  res.json({ file: filePath });  // Zwracamy pełną ścieżkę pliku
});

// Endpoint dla strony głównej, żeby wyświetlić 'index.html' (lub 'main.html')
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));  // Dopasuj do swojej struktury pliku HTML
});

// Uruchomienie serwera
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
