const { Client, Databases, Storage, ID, InputFile } = require('node-appwrite');

module.exports = async ({ req, res, log, error }) => {
  // Parsing body request dari React Native
  const { userId, replicateUrl, textSnippet, speakerId, speakerLabel, languageCode } = JSON.parse(req.body);

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY); // Pastikan API Key ada di Settings > Variables

  const storage = new Storage(client);
  const databases = new Databases(client);

  try {
    const response = await fetch(replicateUrl);
    const buffer = await response.arrayBuffer();

    const uploadedFile = await storage.createFile(
      process.env.BUCKET_ID,
      ID.unique(),
      InputFile.fromBuffer(Buffer.from(buffer), 'audio.mp3')
    );

    const newDoc = await databases.createDocument(
      process.env.DATABASE_ID,
      'generations',
      ID.unique(),
      {
        user_id: userId,
        file_id: uploadedFile.$id,
        bucket_id: process.env.BUCKET_ID,
        text_snippet: textSnippet.substring(0, 150),
        speaker_id: speakerId,
        speaker_label: speakerLabel,
        language_code: languageCode
      }
    );

    return res.json({ success: true, document: newDoc });
  } catch (err) {
    return res.json({ success: false, error: err.message }, 500);
  }
};
