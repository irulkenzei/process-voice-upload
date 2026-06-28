const { Client, Databases, Storage, ID, InputFile } = require('node-appwrite');
const fetch = require('node-fetch');

module.exports = async ({ req, res, log, error }) => {
  log("Function started!");

  // 1. Ambil data dengan aman (cek req.body atau req.payload)
  // Appwrite sering menaruh JSON di req.payload
  const payload = req.payload ? JSON.parse(req.payload) : (typeof req.body === 'string' ? JSON.parse(req.body) : req.body);
  
  log("Data yang diterima:", JSON.stringify(payload));

  const { userId, replicateUrl, textSnippet, speakerId, speakerLabel, languageCode } = payload;

  if (!replicateUrl) {
    error("replicateUrl tidak ditemukan dalam payload!");
    return res.json({ success: false, error: "replicateUrl missing" }, 400);
  }

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const storage = new Storage(client);
  const databases = new Databases(client);

  try {
    log(`Fetching URL: ${replicateUrl}`);
    const response = await fetch(replicateUrl);
    
    if (!response.ok) throw new Error(`Gagal download: ${response.statusText}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    log("Uploading to storage...");
    const uploadedFile = await storage.createFile(
      process.env.BUCKET_ID,
      ID.unique(),
      InputFile.fromBuffer(buffer, 'audio.wav', 'audio/wav')
    );
    log("Upload berhasil! File ID:", uploadedFile.$id);
    log("Creating document...");
    const newDoc = await databases.createDocument(
      process.env.DATABASE_ID,
      'generations',
      ID.unique(),
      {
        user_id: userId,
        file_id: uploadedFile.$id,
        bucket_id: process.env.BUCKET_ID,
        text_snippet: textSnippet ? String(textSnippet).substring(0, 150) : "",
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
