const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Configure CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST' && event.httpMethod !== 'DELETE') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // ImageKit credentials
    const IMAGEKIT_PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY;

    if (!IMAGEKIT_PRIVATE_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Credenciais do ImageKit não configuradas' })
      };
    }

    // Parse body
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'JSON inválido' })
      };
    }

    const fileIds = body.fileIds || [];

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'fileIds é obrigatório e deve ser um array' })
      };
    }

    console.log(`Deletando ${fileIds.length} arquivo(s) do ImageKit...`);

    const authHeader = Buffer.from(`${IMAGEKIT_PRIVATE_KEY}:`).toString('base64');
    const results = [];

    // Delete each file
    for (const fileId of fileIds) {
      if (!fileId || fileId.trim() === '') {
        results.push({
          fileId: fileId,
          success: false,
          error: 'fileId vazio'
        });
        continue;
      }

      try {
        console.log(`Deletando fileId: ${fileId}`);
        
        const deleteResponse = await fetch(`https://api.imagekit.io/v1/files/${fileId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${authHeader}`
          }
        });

        if (deleteResponse.status === 204) {
          // 204 No Content = sucesso
          console.log(`✓ FileId ${fileId} deletado com sucesso`);
          results.push({
            fileId: fileId,
            success: true
          });
        } else if (deleteResponse.status === 404) {
          // Arquivo não encontrado
          console.log(`⚠ FileId ${fileId} não encontrado (já foi deletado ou não existe)`);
          results.push({
            fileId: fileId,
            success: true,
            warning: 'Arquivo não encontrado'
          });
        } else {
          const errorData = await deleteResponse.json();
          console.error(`✗ Erro ao deletar ${fileId}:`, errorData);
          results.push({
            fileId: fileId,
            success: false,
            error: errorData.message || `Status ${deleteResponse.status}`
          });
        }
      } catch (error) {
        console.error(`✗ Exceção ao deletar ${fileId}:`, error);
        results.push({
          fileId: fileId,
          success: false,
          error: error.message
        });
      }
    }

    // Count successes
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Resumo: ${successCount} deletados, ${failCount} falharam`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        total: fileIds.length,
        deleted: successCount,
        failed: failCount,
        results: results
      })
    };

  } catch (error) {
    console.error('Erro geral ao deletar do ImageKit:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Erro ao processar deleção'
      })
    };
  }
};