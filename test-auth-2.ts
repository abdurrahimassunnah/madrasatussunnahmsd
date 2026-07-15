import { GoogleGenAI } from "@google/genai";

async function test() {
  const originalFetch = globalThis.fetch;
  
  const mockFetch = async (url: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
    console.log("\n--- INTERCEPTED FETCH ---");
    console.log("URL:", url.toString());
    
    // Print all headers
    const headersObj: Record<string, string> = {};
    if (options?.headers) {
      const headers = new Headers(options.headers);
      headers.forEach((value, key) => {
        headersObj[key] = value;
      });
    }
    console.log("Headers:", JSON.stringify(headersObj, null, 2));
    
    const dummyResponse = {
      candidates: [{ content: { parts: [{ text: "Mock response" }] } }]
    };
    
    return new Response(JSON.stringify(dummyResponse), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  globalThis.fetch = mockFetch as any;

  console.log("=== Testing with standard AIzaSy Key ===");
  const aiAIza = new GoogleGenAI({ apiKey: "AIzaSyTestKey" });
  await aiAIza.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Hello"
  }).catch((e) => { console.error("Error in AIza:", e); });

  console.log("\n=== Testing with new AQ Key ===");
  const aiAQ = new GoogleGenAI({ apiKey: "AQ.testAQKey" });
  await aiAQ.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Hello"
  }).catch((e) => { console.error("Error in AQ:", e); });

  // Restore original fetch
  globalThis.fetch = originalFetch;
}

test();
