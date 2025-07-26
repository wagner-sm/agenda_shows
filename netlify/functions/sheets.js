const { google } = require('googleapis');

exports.handler = async (event, context) => {
  // Configurar CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'OK' })
    };
  }

  try {
    // Extrair parâmetros da URL
    const path = event.path.replace('/.netlify/functions/sheets/', '');
    const [spreadsheetId, action] = path.split('/');

    if (!spreadsheetId || !action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Parâmetros inválidos' })
      };
    }

    // Configurar credenciais do Google
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Handle different actions
    switch (action) {
      case 'read':
        const range = event.queryStringParameters?.range || 'Sheet1!A:Z';

        const result = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range
        });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: result.data.values || [],
            range: range,
            rows_count: (result.data.values || []).length
          })
        };

      case 'update':
        if (event.httpMethod !== 'POST') {
          return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Método não permitido' })
          };
        }

        const updateData = JSON.parse(event.body);
        const updateRange = updateData.range;
        const values = updateData.values;

        if (!updateRange || !values) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Range e values são obrigatórios' })
          };
        }

        const updateResult = await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: updateRange,
          valueInputOption: 'RAW',
          resource: { values }
        });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            updated_cells: updateResult.data.updatedCells,
            updated_rows: updateResult.data.updatedRows,
            range: updateRange
          })
        };

      case 'append':
        if (event.httpMethod !== 'POST') {
          return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Método não permitido' })
          };
        }

        const appendData = JSON.parse(event.body);
        const appendRange = appendData.range || 'Sheet1!A:Z';
        const appendValues = appendData.values;

        if (!appendValues) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Values é obrigatório' })
          };
        }

        const appendResult = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: appendRange,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: { values: appendValues }
        });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            updated_cells: appendResult.data.updates?.updatedCells,
            updated_rows: appendResult.data.updates?.updatedRows,
            range: appendResult.data.updates?.updatedRange
          })
        };

      case 'info':
        const infoResult = await sheets.spreadsheets.get({
          spreadsheetId
        });

        const sheetsInfo = infoResult.data.sheets?.map(sheet => ({
          sheet_id: sheet.properties?.sheetId,
          title: sheet.properties?.title,
          index: sheet.properties?.index,
          sheet_type: sheet.properties?.sheetType,
          grid_properties: sheet.properties?.gridProperties
        })) || [];

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            spreadsheet_id: infoResult.data.spreadsheetId,
            title: infoResult.data.properties?.title,
            sheets: sheetsInfo
          })
        };

      default:
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Ação não encontrada' })
        };
    }

  } catch (error) {
    console.error('Erro:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error.message 
      })
    };
  }
};
