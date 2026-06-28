const { Client, Databases, Storage, ID, InputFile } = require('node-appwrite');
// Tambahkan ini jika runtime Anda tidak mendukung fetch global
const fetch = require('node-fetch'); 

module.exports = async ({ req, res, log, error }) => {
  log("Function started!");

  // Inisialisasi Client
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const storage = new Storage(client);
  const databases = new Databases(client);

  try {
    // Parsing body dengan aman
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { userId, replicateUrl, textSnippet, speakerId, speakerLabel, languageCode } = body;

    log(`Fetching URL: ${replicateUrl}`);

    // Fetch data dari Replicate
    const response = await fetch(replicateUrl);
    if (!response.ok) throw new Error(`Gagal mendownload audio: ${response.statusText}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload ke Storage
    log("Uploading to storage...");
    const uploadedFile = await storage.createFile(
      process.env.BUCKET_ID,
      ID.unique(),
      InputFile.fromBuffer(buffer, 'generated-audio.wav', 'audio/wav')
    );

    // Simpan ke Database
    log("Creating document...");
    const newDoc = await databases.createDocument(
      process.env.DATABASE_ID,
      'generations',
      ID.unique(),
      {
        user_id: userId,
        file_id: uploadedFile.$id,
        bucket_id: process.env.BUCKET_ID,
        text_snippet: textSnippet ? textSnippet.substring(0, 150) : "",
        speaker_id: speakerId,
        speaker_label: speakerLabel,
        language_code: languageCode
      }
    );

    return res.json({ success: true, document: newDoc });

  } catch (err) {
    error(`Error details: ${err.message}`);
    return res.json({ success: false, error: err.message }, 500);
  }
};
