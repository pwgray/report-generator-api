import { GoogleGenAI, Type } from '@google/genai';

const GEMINI_MODEL = 'gemini-2.5-flash';

const getApiKey = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('GEMINI_API_KEY missing from environment variables');
  }
  return key || '';
};

export const generateReportData = async (dataSource: any, reportConfig: any, rowCount: number = 20): Promise<any[]> => {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  const ai = new GoogleGenAI({ apiKey });

  const schemaDescription = dataSource.tables
    .filter((t: any) => t.exposed)
    .map((t: any) => {
      const cols = t.columns.map((c: any) => `${c.name} (${c.type})`).join(', ');
      return `Table: ${t.name}\nColumns: ${cols}`;
    })
    .join('\n\n');

  const queryDescription = `Generate ${rowCount} rows of realistic mock data for a report.\n\nData Source Schema:\n${schemaDescription}\n\nReport Requirements:\n- Columns needed: ${reportConfig.selectedColumns.map((c: any) => {
    const table = dataSource.tables.find((t: any) => t.id === c.tableId);
    const col = table?.columns.find((col: any) => col.id === c.columnId);
    return `${table?.name}.${col?.name}`;
  }).join(', ')}\n- Filters to apply (simulated): ${JSON.stringify(reportConfig.filters)}\n- Sorting: ${JSON.stringify(reportConfig.sorts)}\n\nReturn ONLY a JSON array of objects. Keys should match the requested columns. Make the data consistent and realistic.`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: queryDescription,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error('Failed to generate report data', error);
    return [];
  }
};

export const discoverSchema = async (type: string, dbName: string, context: string = ''): Promise<any[]> => {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are a database architect.\nGenerate a schema for a '${type}' database named '${dbName}'.\nContext: ${context || 'General business database'}.\n\nConstraints:\n1. Generate EXACTLY 3 tables.\n2. Each table has MAX 5 columns.\n3. Descriptions must be concise (< 10 words).\n4. sampleValues must be short strings.\n5. Output valid JSON.\n\nFor each table/column include: name, alias, description, sampleValue. Column types must be one of: "string", "number", "date", "boolean", "currency".`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    const rawTables = JSON.parse(text);
    return rawTables;
  } catch (error) {
    console.error('Failed to discover schema', error);
    return [];
  }
};
