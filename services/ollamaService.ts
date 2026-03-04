import { GradingConfig, GradeResult, RubricCriterion, Submission, FeedbackStyle } from "../types";

const OLLAMA_API_URL = '/ollama/api/chat';

export const testOllamaConnection = async (): Promise<{ success: boolean; response?: string; error?: string }> => {
  try {
    const response = await fetch(OLLAMA_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma3:12b',
        messages: [{ role: 'user', content: 'Say "Hello from Ollama!" in exactly 5 words.' }],
        stream: false,
      }),
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const data = await response.json();
    return { success: true, response: data.message.content };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
};
const MODEL_NAME = 'gemma3:12b';

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

interface OllamaRequest {
  model: string;
  messages: OllamaMessage[];
  stream: boolean;
  format?: 'json';
}

interface OllamaResponse {
  message: {
    role: string;
    content: string;
  };
}

const callOllama = async (
  messages: OllamaMessage[],
  jsonFormat: boolean = false
): Promise<string> => {
  const payload: OllamaRequest = {
    model: MODEL_NAME,
    messages,
    stream: false,
  };

  if (jsonFormat) {
    payload.format = 'json';
  }

  const response = await fetch(OLLAMA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data: OllamaResponse = await response.json();
  return data.message.content;
};

const getFeedbackInstruction = (style: FeedbackStyle): string => {
  switch (style) {
    case 'glow_and_grow':
      return "Format the 'overallFeedback' into two distinct sections: '🌟 Glows' (what the student did exceptionally well) and '🌱 Grows' (specific areas for future improvement). Use bullet points.";
    case 'rubric_narrative':
      return "Provide 'overallFeedback' as a cohesive, professional narrative paragraph that weaves together the student's performance across all rubric criteria into a single story of their progress.";
    case 'guided_questions':
      return "Do NOT provide direct corrections or answers. Instead, in the 'overallFeedback', provide 3-5 thought-provoking 'Guided Questions' that lead the student to realize where they can improve their work through self-reflection.";
    case 'targeted_rubric':
      return "The 'overallFeedback' should be extremely concise and strictly limited to actionable, direct feedback mapped to specific rubric criteria. No fluff, just direct improvement steps.";
    case 'scoring_with_feedback':
    default:
      return "Provide a balanced summary of the numerical scoring in the 'overallFeedback', explaining the rationale for the final grade.";
  }
};

const RUBRIC_JSON_SCHEMA = `{
  "criteria": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "maxPoints": number
    }
  ]
}`;

const GRADE_RESULT_JSON_SCHEMA = `{
  "totalScore": number,
  "maxPossibleScore": number,
  "overallFeedback": "string",
  "criterionResults": [
    {
      "criterionId": "string",
      "score": number,
      "feedback": "string"
    }
  ]
}`;

export const parseRubricFromFile = async (
  base64Data: string,
  mimeType: string
): Promise<RubricCriterion[]> => {
  const messages: OllamaMessage[] = [
    {
      role: 'system',
      content: `You are a rubric extraction assistant. Extract grading rubrics from documents and return them as JSON. 
Output format: ${RUBRIC_JSON_SCHEMA}
If the document doesn't specify points, default to 10.`
    },
    {
      role: 'user',
      content: 'Extract the grading rubric from this document. Return the result in the specified JSON format.',
      images: [base64Data]
    }
  ];

  const responseText = await callOllama(messages, true);
  const result = JSON.parse(responseText.trim());
  return result.criteria;
};

export const parseRubricFromUrl = async (url: string): Promise<RubricCriterion[]> => {
  const messages: OllamaMessage[] = [
    {
      role: 'system',
      content: `You are a rubric extraction assistant. Extract grading rubrics and return them as JSON.
Output format: ${RUBRIC_JSON_SCHEMA}
If the document doesn't specify points, default to 10.`
    },
    {
      role: 'user',
      content: `Extract the grading rubric from the content at this URL: ${url}. Focus on finding criteria, their descriptions, and point values. Return the data as a structured JSON list of criteria.`
    }
  ];

  const responseText = await callOllama(messages, true);
  const result = JSON.parse(responseText.trim());
  return result.criteria;
};

export const gradeSubmission = async (
  config: GradingConfig,
  submission: Submission
): Promise<{ result: GradeResult; feedbackInserted: boolean }> => {
  const styleInstruction = getFeedbackInstruction(config.feedbackStyle);
  
  const systemPrompt = `You are a professional academic grader. 
Target Grade Level: ${config.gradeLevel}
Assignment Prompt: ${config.prompt}
Feedback Style: ${styleInstruction}

Grading Standards:
${config.rubric.map(c => `- [ID: ${c.id}] ${c.name} (Max ${c.maxPoints} pts): ${c.description}`).join('\n')}

You MUST respond with valid JSON in this exact format:
${GRADE_RESULT_JSON_SCHEMA}

The output must be strictly valid JSON with no additional text.`;

  const messages: OllamaMessage[] = [
    { role: 'system', content: systemPrompt }
  ];

  if (submission.url) {
    messages.push({
      role: 'user',
      content: `Grade the student submission at ${submission.url}.`
    });
  } else if (submission.fileData) {
    messages.push({
      role: 'user',
      content: 'Grade this student submission.',
      images: [submission.fileData.data]
    });
  } else {
    messages.push({
      role: 'user',
      content: `Student Submission Content:\n\n${submission.content}`
    });
  }

  const responseText = await callOllama(messages, true);
  
  if (!responseText) throw new Error("No response generated from AI.");
  const result = JSON.parse(responseText.trim()) as GradeResult;
  
  return { result, feedbackInserted: false };
};

export const insertFeedbackIntoDoc = async (
  submission: Submission,
  result: GradeResult
): Promise<boolean> => {
  // Ollama/Gemma3 cannot directly insert into Google Docs
  // This would require a separate Google Docs API integration
  console.warn('insertFeedbackIntoDoc is not supported with Ollama. Use Google Docs API separately.');
  return false;
};
