const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage for student CAD submissions
const studentSubmissionStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'cad-lab/student-submissions',
    resource_type: 'raw', // Required for non-image files like .dxf
    public_id: (req, file) => {
      const timestamp = Date.now();
      const studentId = req.user ? req.user.id : 'unknown';
      return `submission_${studentId}_${timestamp}`;
    },
  },
});

// Storage for faculty answer/reference CAD files
const answerKeyStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'cad-lab/answer-keys',
    resource_type: 'raw',
    public_id: (req, file) => {
      const timestamp = Date.now();
      const facultyId = req.user ? req.user.id : 'unknown';
      return `answer_${facultyId}_${timestamp}`;
    },
  },
});

// Storage for user avatars
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'cad-lab/avatars',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    public_id: (req, file) => {
      const userId = req.user ? req.user.id : 'unknown';
      return `avatar_${userId}`; // Overwrite previous avatar
    },
  },
});

// Multer file filter - only allow .dxf files
const dxfFileFilter = (req, file, cb) => {
  console.log('[Backend Upload] Received file:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
  });

  const originalName = file.originalname.toLowerCase();
  const isDxf = originalName.endsWith('.dxf');
  const isDwg = originalName.endsWith('.dwg');

  if (!isDxf && !isDwg) {
    return cb(new Error('Only .dxf or .dwg files are allowed'), false);
  }
  cb(null, true);
};

// File size limit: 20MB
const fileSizeLimit = 20 * 1024 * 1024;

// Upload middleware instances
const uploadStudentSubmission = multer({
  storage: studentSubmissionStorage,
  fileFilter: dxfFileFilter,
  limits: { fileSize: fileSizeLimit },
});

const uploadAnswerKey = multer({
  storage: answerKeyStorage,
  fileFilter: dxfFileFilter,
  limits: { fileSize: fileSizeLimit },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for images
});

module.exports = {
  cloudinary,
  uploadStudentSubmission,
  uploadAnswerKey,
  uploadAvatar,
};
