import { Router } from 'express';
import {
  getDocuments, getDocument, createDocument, deleteDocument, downloadDocument
} from '../controllers/documentController';
import { authenticate } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf','.doc','.docx','.xls','.xlsx','.jpg','.jpeg','.png','.gif','.csv','.txt','.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('File type not allowed'));
  }
});

const router = Router();
router.use(authenticate);

router.get('/', getDocuments);
router.post('/', upload.single('file'), createDocument);
router.get('/:id', getDocument);
router.get('/:id/download', downloadDocument);
router.delete('/:id', deleteDocument);

export default router;
