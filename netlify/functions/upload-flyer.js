const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { fileName, file, contentType, token } = JSON.parse(event.body);

    if (!fileName || !file || !contentType) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing fileName, file, or contentType" }) };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const buffer = Buffer.from(file, "base64");

    const { error: uploadError } = await supabase.storage
      .from("flyers")
      .upload(fileName, buffer, {
        upsert: false,
        contentType,
        cacheControl: "no-cache",
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("flyers")
      .getPublicUrl(fileName);

    if (!data?.publicUrl) {
      throw new Error("Falha ao gerar URL pública");
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ url: data.publicUrl, path: fileName }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Upload failed" }),
    };
  }
};
