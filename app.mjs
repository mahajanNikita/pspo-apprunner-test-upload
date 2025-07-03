import express from 'express';
import AWS from 'aws-sdk';
import dotenv from 'dotenv';
import multer from 'multer';
import cors from 'cors';


dotenv.config();

AWS.config.update({
  region: process.env.REGION
})

const s3 = new AWS.S3();
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const BUCKET_NAME = process.env.BUCKET_NAME;
const FOLDER_PATH = process.env.FOLDER_PATH;

app.use(cors({
  origin: ['http://localhost:3000', 'https://vapayfqgnb.us-west-2.awsapprunner.com'], // or your frontend URL
  methods: ['GET', 'POST']
}));

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    
    if (!file) {
      return res.status(400).send('No file uploaded');
    }

    const params = {
      Bucket: BUCKET_NAME,
      Key: `${FOLDER_PATH}${file.originalname}`,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    const data = await s3.upload(params).promise();
    res.status(200).send({
      message: 'File uploaded successfully',
      url: data.Location
    });

  } catch (error) {
    console.error('Error uploading file to S3:', {
      message: error.message,
      stack: error.stack,
      params: {
        bucketName: BUCKET_NAME,
        folderPath: FOLDER_PATH,
        fileName: req.file ? req.file.originalname : 'No file',
        fileSize: req.file ? req.file.size : 'No file'
      }
    });

    if (error.code === 'NoSuchBucket') {
      return res.status(500).send({error: 'S3 bucket not found', details: error.message});
    }

    if (error.code === 'AccessDenied') {
      return res.status(500).send({error: 'Access denied to S3 bucket', details: error.message});
    }
    res.status(500).send({error: 'File upload to S3 failed', details: error.message});
  }

});



app.get('/health', (req, res) => {
  const currentTime = new Date().toISOString();
  res.status(200).send({
    message: `Healthcheck performed at: ${currentTime}`
  });
});

app.get('/files', async (req, res) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Prefix: FOLDER_PATH
    };

    const data = await s3.listObjectsV2(params).promise();
    const files = data.Contents.map(file => ({
      key: file.Key,
      lastModified: file.LastModified,
      size: file.Size
    }));

    res.json(files);
  } catch (error) {
    console.error('Error listing files from to S3:', error.message);
    res.status(500).send({error: 'Failed to list files from S3', details: error.message});
  }
});

//start server

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`S3 Upload is running on port ${port}`);
});
