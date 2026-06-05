import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const SYSTEM_INSTRUCTION = `
You are the core intelligence of the Eye Disease Detector system. 
Analyze eye images through a multi-stage pipeline:
1. Detection: Locate the eye and crop it.
2. Segmentation: Identify iris, pupil, sclera, and eyelids.
3. Classification: Detect diseases (Normal, Cataract, Conjunctivitis, Glaucoma, Corneal Ulcer, Pterygium, Blindness/Severe Impairment, Myopia, Hyperopia, Astigmatism, Presbyopia).
4. XAI: Identify affected regions with specific hotspots (x, y coordinates).
5. Validation: Ensure consistency.

OUTPUT RULES:
- ALWAYS return valid JSON. 
- NEVER truncate the response.
- "hotspots" should be 1-3 visible symptoms coordinates (0.00-1.00).
- "explanation" max 100 words.
- Returns "original" for image strings.
`;

export interface DetectionResult {
  eyeDetected: boolean;
  croppedImage: string; // base64
}

export interface SegmentationResult {
  maskOverlay: string; // base64
  regions: {
    iris: number;
    pupil: number;
    sclera: number;
    eyelids: number;
  };
}

export interface ClassificationResult {
  prediction: string;
  confidence: number;
  allScores: Record<string, number>;
}

export interface XAIResult {
  heatmap: string; // base64
  explanation: string;
  hotspots: Array<{ x: number; y: number; radius: number; intensity: number }>;
}

export interface PipelineResult {
  detection: DetectionResult;
  segmentation: SegmentationResult;
  classification: ClassificationResult;
  xai: XAIResult;
  validation: {
    isConsistent: boolean;
    warning?: string;
  };
}

export const runEyePipeline = async (imageBase64: string): Promise<PipelineResult> => {
  const maxRetries = 5;
  let lastError: any = null;
  const models = [
    "gemini-2.0-flash", 
    "gemini-1.5-flash", 
    "gemini-3-flash-preview",
    "gemini-1.5-pro",
    "gemini-2.0-flash-lite-preview"
  ];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      const currentModel = models[attempt % models.length];
      
      console.log(`Pipeline attempt ${attempt + 1} starting with model: ${currentModel}`);

      const response = await ai.models.generateContent({
        model: currentModel,
        contents: [
          { text: "Perform full ophthalmological analysis on this image." },
          { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          maxOutputTokens: 2048,
          temperature: 0.1, // Even lower for stability
          responseSchema: {
            type: Type.OBJECT,
            required: ["detection", "segmentation", "classification", "xai", "validation"],
            properties: {
              detection: {
                type: Type.OBJECT,
                required: ["eyeDetected", "croppedImage"],
                properties: {
                  eyeDetected: { type: Type.BOOLEAN },
                  croppedImage: { type: Type.STRING }
                }
              },
              segmentation: {
                type: Type.OBJECT,
                required: ["maskOverlay", "regions"],
                properties: {
                  maskOverlay: { type: Type.STRING },
                  regions: {
                    type: Type.OBJECT,
                    required: ["iris", "pupil", "sclera", "eyelids"],
                    properties: {
                      iris: { type: Type.NUMBER },
                      pupil: { type: Type.NUMBER },
                      sclera: { type: Type.NUMBER },
                      eyelids: { type: Type.NUMBER }
                    }
                  }
                }
              },
              classification: {
                type: Type.OBJECT,
                required: ["prediction", "confidence", "allScores"],
                properties: {
                  prediction: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  allScores: { 
                    type: Type.OBJECT,
                    properties: {
                      Normal: { type: Type.NUMBER },
                      Cataract: { type: Type.NUMBER },
                      Conjunctivitis: { type: Type.NUMBER },
                      Glaucoma: { type: Type.NUMBER },
                      "Corneal Ulcer": { type: Type.NUMBER },
                      Pterygium: { type: Type.NUMBER },
                      "Blindness/Severe Impairment": { type: Type.NUMBER },
                      Myopia: { type: Type.NUMBER },
                      Hyperopia: { type: Type.NUMBER },
                      Astigmatism: { type: Type.NUMBER },
                      Presbyopia: { type: Type.NUMBER }
                    }
                  }
                }
              },
              xai: {
                type: Type.OBJECT,
                required: ["heatmap", "explanation", "hotspots"],
                properties: {
                  heatmap: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  hotspots: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      required: ["x", "y", "radius", "intensity"],
                      properties: {
                        x: { type: Type.NUMBER },
                        y: { type: Type.NUMBER },
                        radius: { type: Type.NUMBER },
                        intensity: { type: Type.NUMBER }
                      }
                    }
                  }
                }
              },
              validation: {
                type: Type.OBJECT,
                required: ["isConsistent"],
                properties: {
                  isConsistent: { type: Type.BOOLEAN },
                  warning: { type: Type.STRING }
                }
              }
            }
          }
        }
      });

      let result: any;
      const text = response.text;
      
      if (!text) throw new Error("AI returned empty response");

      try {
        // Modern GenAI SDK text can sometimes have markdown blocks even with JSON mime type
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        // Remove common JSON syntax errors like trailing commas before closing braces/brackets
        const sanitizingRegex = /,\s*([}\]])/g;
        const sanitizedText = cleanText.replace(sanitizingRegex, '$1');
        
        result = JSON.parse(sanitizedText);
      } catch (e) {
        console.error(`AI Response Parse Error (Attempt ${attempt + 1}):`, e);
        console.warn("Raw Response Text (First 200 chars):", text.substring(0, 200) + "...");
        
        // Final aggressive attempt: find the outer-most JSON object
        try {
          const firstBrace = text.indexOf('{');
          const lastBrace = text.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const jsonPart = text.substring(firstBrace, lastBrace + 1);
            result = JSON.parse(jsonPart.replace(/,\s*([}\]])/g, '$1'));
          } else {
            throw e;
          }
        } catch (innerE) {
          throw e; // Rethrow original parse error if aggressive strategy fails
        }
      }
      
      const finalResult: PipelineResult = {
        detection: {
          eyeDetected: result.detection?.eyeDetected ?? false,
          croppedImage: (result.detection?.croppedImage === "original" || !result.detection?.croppedImage) 
            ? imageBase64 : result.detection.croppedImage
        },
        segmentation: {
          maskOverlay: (result.segmentation?.maskOverlay === "original" || !result.segmentation?.maskOverlay)
            ? imageBase64 : result.segmentation.maskOverlay,
          regions: result.segmentation?.regions ?? { iris: 0, pupil: 0, sclera: 0, eyelids: 0 }
        },
        classification: {
          prediction: result.classification?.prediction ?? "Analysis Incomplete",
          confidence: result.classification?.confidence ?? 0,
          allScores: result.classification?.allScores ?? {}
        },
        xai: {
          heatmap: (result.xai?.heatmap === "original" || !result.xai?.heatmap)
            ? imageBase64 : result.xai.heatmap,
          explanation: result.xai?.explanation ?? "No detailed explanation available for this scan.",
          hotspots: result.xai?.hotspots ?? []
        },
        validation: {
          isConsistent: result.validation?.isConsistent ?? false,
          warning: result.validation?.warning ?? "System was unable to perform secondary validation."
        }
      };

      return finalResult;
    } catch (error: any) {
      console.error(`Pipeline attempt ${attempt + 1} failed:`, error);
      lastError = error;
      if (attempt === maxRetries) break;
      
      // Enhanced backoff for 429
      const isRateLimit = error.message?.includes('429') || error.status === 429 || error.message?.includes('RESOURCE_EXHAUSTED');
      const waitTime = isRateLimit 
        ? Math.pow(2, attempt) * 3000 + Math.random() * 1000 
        : 1000;
        
      console.warn(`Attempt ${attempt + 1} failed (${isRateLimit ? 'Rate Limit' : 'Other'}). Waiting ${Math.round(waitTime)}ms before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw new Error(`The AI returned an invalid response after ${maxRetries + 1} attempts. Please try again with a clearer image. Details: ${lastError instanceof Error ? lastError.message : JSON.stringify(lastError)}`);
};

export const getHealthAssistantResponse = async (query: string, history: any[]): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      { text: `You are an Eye Health Assistant. Provide helpful, non-diagnostic advice about eye health. 
               Always include a disclaimer that you are an AI and not a doctor.
               User query: ${query}` }
    ]
  });
  return response.text || "I'm sorry, I couldn't process that request.";
};
