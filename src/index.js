const { Client, Databases, Storage, ID, InputFile } = require('node-appwrite');
const fetch = require('node-fetch');

module.exports = async ({ req, res, log, error }) => {
  log("Function started!");

  try {
    const payload = req.payload ? JSON.parse(req.payload) : (typeof req.body === 'string' ? JSON.parse(req.body) : req.body);
    const { userId, replicateUrl, textSnippet, speakerId, speakerLabel, languageCode } = payload;

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const storage = new Storage(client);
    const databases = new Databases(client);

    // 1. Fetch
    log("Fetching URL...");
    const response = await fetch(replicateUrl);
    if (!response.ok) throw new Error(`Fetch gagal: ${response.statusText}`);
    const buffer = Buffer.from(await response.arrayBuffer());

    // 2. Upload - Menggunakan pendekatan InputFile.fromBuffer yang lebih aman
    log("Mencoba upload ke Bucket ID: " + process.env.APPWRITE_BUCKET_ID);
    
    const uploadedFile = await storage.createFile(
      process.env.APPWRITE_BUCKET_ID,
      ID.unique(),
      InputFile.fromBuffer(buffer, 'audio.wav', 'audio/wav') 
    );
    
    log("Upload berhasil. File ID: " + uploadedFile.$id);

    // 3. Database
    log("Mencoba buat dokumen di Database ID: " + process.env.APPWRITE_DATABASE_ID);
    const newDoc = await databases.createDocument(
      process.env.APPWRITE_DATABASE_ID,
      'generations',
      ID.unique(),
      {
        user_id: userId,
        file_id: uploadedFile.$id,
        bucket_id: process.env.APPWRITE_BUCKET_ID,
        text_snippet: textSnippet ? String(textSnippet).substring(0, 150) : "",
        speaker_id: speakerId,
        speaker_label: speakerLabel,
        language_code: languageCode
      }
    );
    log("Database berhasil diupdate!");

    return res.json({ success: true, docId: newDoc.$id });

  } catch (err) {
    error("CRITICAL ERROR: " + err.message);
    if (err.stack) error("Stack trace: " + err.stack);
    return res.json({ success: false, error: err.message }, 500);
  }
};
