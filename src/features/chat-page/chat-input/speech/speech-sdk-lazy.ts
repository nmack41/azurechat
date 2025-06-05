// ABOUTME: Lazy-loaded wrapper for Microsoft Speech SDK to optimize bundle size
// ABOUTME: Dynamically imports speech SDK only when speech features are used

export interface SpeechSDKTypes {
  AudioConfig: any;
  AutoDetectSourceLanguageConfig: any;
  SpeechConfig: any;
  SpeechRecognizer: any;
  SpeechSynthesizer: any;
  SpeechSynthesisOutputFormat: any;
}

let sdkCache: SpeechSDKTypes | null = null;

/**
 * Lazy loads the Microsoft Cognitive Services Speech SDK
 * @returns Promise resolving to the speech SDK types
 */
export async function loadSpeechSDK(): Promise<SpeechSDKTypes> {
  if (sdkCache) {
    return sdkCache;
  }

  try {
    const sdk = await import('microsoft-cognitiveservices-speech-sdk');
    
    sdkCache = {
      AudioConfig: sdk.AudioConfig,
      AutoDetectSourceLanguageConfig: sdk.AutoDetectSourceLanguageConfig,
      SpeechConfig: sdk.SpeechConfig,
      SpeechRecognizer: sdk.SpeechRecognizer,
      SpeechSynthesizer: sdk.SpeechSynthesizer,
      SpeechSynthesisOutputFormat: sdk.SpeechSynthesisOutputFormat,
    };
    
    return sdkCache;
  } catch (error) {
    console.error('Failed to load Speech SDK:', error);
    throw new Error('Speech SDK could not be loaded. Speech features may be unavailable.');
  }
}

/**
 * Checks if Speech SDK is already loaded
 */
export function isSpeechSDKLoaded(): boolean {
  return sdkCache !== null;
}

/**
 * Preloads the Speech SDK in the background
 */
export function preloadSpeechSDK(): void {
  loadSpeechSDK().catch(console.error);
}