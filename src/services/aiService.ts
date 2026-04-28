import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const prompt = `
        You are the core intelligence of the Eye Disease Detector system. 
        Analyze the provided eye image through a multi-stage pipeline:
        1. Detection: Locate the eye and crop it.
        2. Segmentation: Identify iris, pupil, sclera, and eyelids.
        3. Classification: Detect diseases and refractive errors (Normal, Cataract, Conjunctivitis, Glaucoma, Corneal Ulcer, Pterygium, Blindness/Severe Impairment, Myopia, Hyperopia, Astigmatism, Presbyopia).
        4. XAI: Explain the prediction and identify affected regions.
        5. Validation: Cross-check for consistency.

        Return a JSON object matching this structure:
        {
          "detection": { "eyeDetected": boolean, "croppedImage": "original" },
          "segmentation": { "maskOverlay": "original", "regions": { "iris": float, "pupil": float, "sclera": float, "eyelids": float } },
          "classification": { "prediction": string, "confidence": float, "allScores": { "DiseaseName": float } },
          "xai": { 
            "heatmap": "original", 
            "explanation": string,
            "hotspots": [
              { "x": float, "y": float, "radius": float, "intensity": float }
            ]
          },
          "validation": { "isConsistent": boolean, "warning": string }
        }
        
        For "hotspots", provide 1-3 coordinates (0.0 to 1.0) where the disease symptoms are most visible. 
        Intensity should be between 0.5 and 1.0.
        Note: For "croppedImage", "maskOverlay", and "heatmap", ALWAYS return the literal string "original". Do NOT attempt to return base64 data.
        Keep the "explanation" concise but medically accurate (max 150 words).
        Special Note for Blindness/Severe Impairment: Look for:
        - Total corneal or lenticular opacification (leukocoria).
        - Severe structural atrophy (phthisis bulbi).
        - Advanced degenerative markers (macular scarring, extensive retinal detachment signs).
        - Absence of clear anatomical structures in the anterior or posterior segment.
      `;

      const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { text: prompt },
          { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
        ],
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 2048,
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
      const text = response.text || "{}";
      try {
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        result = JSON.parse(cleanText);
      } catch (e) {
        console.error(`AI Response Parse Error (Attempt ${attempt + 1}):`, e);
        console.error("Raw Response Text:", text);
        
        // If it's an unterminated string, we might try to fix it by adding a closing brace if it looks like it's just missing that
        if (e instanceof Error && e.message.includes('Unterminated string')) {
           // Very basic attempt to close JSON if it's just missing the end
           try {
             result = JSON.parse(text + '"} } }'); // This is risky but sometimes works for cut-off strings
           } catch (innerE) {
             throw e; // Rethrow original if fix fails
           }
        } else {
          throw e;
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
      
      // Exponential backoff: base * 2^attempt + jitter
      const isRateLimit = error.message?.includes('429') || error.status === 429;
      const waitTime = isRateLimit 
        ? Math.pow(2, attempt) * 2000 + Math.random() * 1000 
        : 1000;
        
      console.log(`Waiting ${Math.round(waitTime)}ms before retry...`);
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
    ],
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
    }
  });
  return response.text || "I'm sorry, I couldn't process that request.";
};
