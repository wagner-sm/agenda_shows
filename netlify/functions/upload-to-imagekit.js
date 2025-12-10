const fetch = require('node-fetch');
const FormData = require('form-data');

exports.handler = async (event, context) => {
  // Configure CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const imageUrl = event.queryStringParameters?.url;
    
    if (!imageUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URL da imagem é obrigatória' })
      };
    }

    // ImageKit credentials from environment variables
    const IMAGEKIT_PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY;
    const IMAGEKIT_PUBLIC_KEY = process.env.IMAGEKIT_PUBLIC_KEY;
    const IMAGEKIT_URL_ENDPOINT = process.env.IMAGEKIT_URL_ENDPOINT;

    if (!IMAGEKIT_PRIVATE_KEY || !IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_URL_ENDPOINT) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Credenciais do ImageKit não configuradas' })
      };
    }

    // Download the image
    console.log('Baixando imagem de:', imageUrl);
    const imageResponse = await fetch(imageUrl);
    
    if (!imageResponse.ok) {
      throw new Error(`Falha ao baixar imagem: ${imageResponse.status}`);
    }

    const imageBuffer = await imageResponse.buffer();

    // Generate a unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const fileName = `flyer_${timestamp}_${randomStr}.jpg`;

    // Upload to ImageKit using FormData
    console.log('Enviando para ImageKit...');
    const authHeader = Buffer.from(`${IMAGEKIT_PRIVATE_KEY}:`).toString('base64');
    
    const formData = new FormData();
    formData.append('file', imageBuffer, {
      filename: fileName,
      contentType: 'image/jpeg'
    });
    formData.append('fileName', fileName);
    formData.append('folder', '/flyers');
    
    const uploadResponse = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    const uploadData = await uploadResponse.json();

    if (!uploadResponse.ok) {
      console.error('Erro do ImageKit:', uploadData);
      throw new Error(uploadData.message || 'Erro ao fazer upload para ImageKit');
    }

    console.log('Upload bem-sucedido:', {
      fileId: uploadData.fileId,
      url: uploadData.url
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        url: uploadData.url,
        fileId: uploadData.fileId,
        name: uploadData.name,
        thumbnailUrl: uploadData.thumbnailUrl
      })
    };

  } catch (error) {
    console.error('Erro no upload para ImageKit:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Erro ao processar upload'
      })
    };
  }
};