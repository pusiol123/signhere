const express = require('express');
const multer = require('multer');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('fontkit');
const fs = require('fs');

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/signed', express.static(path.join(__dirname, 'signed')));
app.use(express.static(path.join(__dirname))); // Udostępnia pliki statyczne (HTML, JS)

// Upewnij się, że foldery `uploads` i `signed` istnieją
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'));
}
if (!fs.existsSync(path.join(__dirname, 'signed'))) {
  fs.mkdirSync(path.join(__dirname, 'signed'));
}

// Storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads');
  },
  filename: (req, file, cb) => {
    const sanitizedFilename = file.originalname.replace(/\s+/g, '_');
    cb(null, `${Date.now()}-${sanitizedFilename}`);
  },
});

const upload = multer({ storage });

let coordinates = {};
let uploadedFile = '';

// Obsługa strony głównej (przekierowanie na admina)
app.get('/', (req, res) => {
  res.redirect('/admin.html');
});

// Upload pliku
app.post('/upload', upload.single('document'), (req, res) => {
  if (!req.file) {
    return res.status(400).send({ error: 'No file uploaded.' });
  }

  uploadedFile = req.file.filename;
  coordinates = {}; // Reset współrzędnych
  console.log('Uploaded file:', uploadedFile);
  res.send({ file: `/uploads/${uploadedFile}` });
});

// Zapis współrzędnych i numeru strony
app.post('/save-coordinates', (req, res) => {
  const { x, y, page } = req.body;
  coordinates = { x, y, page };
  console.log('Coordinates saved:', coordinates);
  res.send({ message: 'Coordinates saved.' });
});

// Generowanie linku dla klienta
app.get('/generate-link', (req, res) => {
  const link = `/client.html?file=${uploadedFile}&x=${coordinates.x}&y=${coordinates.y}&page=${coordinates.page}`;
  console.log('Generated client link:', link);
  res.send({ link });
});

// Podpisanie dokumentu
app.post('/sign-document', async (req, res) => {
  const { file, x, y, page, name } = req.body;

  try {
    const filePath = path.join(__dirname, 'uploads', file);
    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      return res.status(404).send({ error: 'File not found.' });
    }

    const pdfBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Rejestracja fontkit
    PDFDocument.prototype.registerFontkit(fontkit);

    // Ładowanie czcionki Allura
    const fontPath = path.join(__dirname, 'fonts', 'Allura-Regular.ttf');
    if (!fs.existsSync(fontPath)) {
      console.error('Font file not found:', fontPath);
      return res.status(500).send({ error: 'Font file not found.' });
    }
    const fontBytes = fs.readFileSync(fontPath);
    const customFont = await pdfDoc.embedFont(fontBytes);

    const pages = pdfDoc.getPages();
    const targetPage = pages[parseInt(page) - 1];

    // Pobieramy wymiary strony PDF
    const { width: pdfWidth, height: pdfHeight } = targetPage.getSize();

    // Kalibracja współrzędnych (dopasowanie z canvas do PDF)
    const scaleFactor = 1.5; // Skala viewportu użyta w widoku klienta
    const yOffset = 15; // Dostosowanie położenia pionowego
    const calibratedX = parseFloat(x) / scaleFactor;
    const calibratedY = pdfHeight - (parseFloat(y) / scaleFactor) - yOffset;

    // Dodanie podpisu
    targetPage.drawText(name, {
      x: calibratedX,
      y: calibratedY,
      size: 25,
      font: customFont,
      color: rgb(0, 0, 0),
    });

    const signedPdfBytes = await pdfDoc.save();
    const signedFilePath = path.join(__dirname, 'signed', `signed-${file}`);
    fs.writeFileSync(signedFilePath, signedPdfBytes);

    console.log('Document signed and saved to:', signedFilePath);
    res.send({ file: `/signed/signed-${file}` });
  } catch (error) {
    console.error('Error signing document:', error);
    res.status(500).send({ error: 'Error signing document.' });
  }
});

// Start serwera
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
