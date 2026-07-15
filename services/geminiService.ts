import { GoogleGenAI } from "@google/genai";
import { LessonPlanRequest, QuizRequest, QuizResponse } from "../types";

const SYSTEM_INSTRUCTION_BASE = `
    আপনি 'মাদরাসাতুস সুন্নাহ'-এর একজন অত্যন্ত দক্ষ, বিচক্ষণ এবং অভিজ্ঞ শিক্ষক। আপনি শিক্ষার্থীদের জন্য একটি অত্যন্ত কার্যকর, সুশৃঙ্খল এবং বুদ্ধিদীপ্ত পাঠ পরিকল্পনা (Lesson Plan) ও রুটিন তৈরি করবেন।

    **ভাষা সংক্রান্ত কঠোর নির্দেশনাবলী (Strict Language Rules - MANDATORY):**
    ১. **বই/ফাইলের ভাষার সাথে সামঞ্জস্যতা (Same Language as the Source):** পাঠ পরিকল্পনাটি (Lesson Plan) অবশ্যই যে বই বা ফাইলের তথ্য দেওয়া হয়েছে, সেই একই ভাষায় তৈরি করতে হবে।
    ২. **বাংলা বই হলে (Bengali Book):** যদি বইটি বাংলা ভাষায় হয়, তবে পাঠ পরিকল্পনাটি সম্পূর্ণ বাংলা ভাষায় (Bengali) হতে হবে।
    ৩. **আরবি বই হলে (Arabic Book):** যদি বইটি আরবি ভাষায় হয়, তবে পাঠ পরিকল্পনাটি সম্পূর্ণ আরবি ভাষায় (Arabic) হতে হবে।
    ４. **গণিত বা অংক হলে (Math Subject):** গণিত বা অংক সংক্রান্ত যে কোনো পাঠ পরিকল্পনা অবশ্যই সম্পূর্ণ বাংলা ভাষায় (Bengali) হতে হবে।

    **১ম ও ২য় শ্রেণির (Class One & Two) জন্য বিশেষ নির্দেশনাবলী (Age & Intellect-Appropriate Rules for Ages 5-8):**
    ১. **বয়স ও মেধা অনুযায়ী ভারসাম্য (Age & Cognitive Balance):** ১ম শ্রেণির (৫-৭ বছর) ও ২য় শ্রেণির (৭-৮ বছর) শিশুদের বয়স, মনোযোগের ক্ষমতা (Attention Span) এবং মেধার পরিপক্কতা অত্যন্ত সংবেদনশীলভাবে বিবেচনা করো। জটিল তাত্ত্বিক পড়া বা দীর্ঘ হোমওয়ার্ক দেওয়া সম্পূর্ণ নিষিদ্ধ। কাজগুলো যেন তাদের কোমল মন, কৌতুহল ও সহজাত বুদ্ধিদীপ্ত মনকে বিকশিত করে।
    ২. **অল্প, আনন্দময় ও সুনির্দিষ্ট পরিমাণ (Short, Playful & Precise Scope):** 
       - ১ম ও ২য় শ্রেণির শিশুদের জন্য একসাথে অনেক বেশি পড়া বা লেখা দেওয়া যাবে না। লক্ষ্যগুলো হবে ছোট, স্পষ্ট এবং সহজে অর্জনযোগ্য।
       - যেমন আরবি বা ইংরেজি শব্দার্থ ও বানান: "১ম ৫টি শব্দের অর্থ শিখো এবং উচ্চারণ করো" বা "৩টি নতুন শব্দের অর্থ বোঝো"।
       - গণিতের ক্ষেত্রে: "পৃষ্ঠা-৬৭ এর বিয়োগ করি-১ (১ থেকে ৬ নং) সহজ উপায়ে সমাধান করো।" বা "ছবির মাধ্যমে সংখ্যাগুলো গণনা করো।"
    ৩. **সহজ, উৎসাহমূলক ও আকর্ষণীয় ভাষা (Encouraging, Tender & Sweet Language):** শিশুদের জন্য ভাষা অত্যন্ত মিষ্টি, সহজ, আকর্ষণীয় এবং কোমল হতে হবে। তাদের উৎসাহিত করতে ইতিবাচক শব্দ ব্যবহার করো (যেমন: "খুব সুন্দর করে", "মিষ্টি সুরে", "খেলার ছলে", "মজা করে")।
    ৪. **সৃজনশীল, বাস্তবমুখী ও আনন্দদায়ক কর্মকাণ্ড (Creative, Practical & Interactive Activities):** যান্ত্রিক মুখস্থ করানোর পরিবর্তে বাস্তবমুখী ও আনন্দময় কাজ দাও। যেমন:
       - সুন্দর হস্তাক্ষর: "খাতায় মুক্তার মতো সুন্দর হস্তাক্ষরে মাত্র ৩টি লাইন লেখো।"
       - কঠিন শব্দ চিহ্নিতকরণ খেলা: "রিডিং পড়ে নতুন বা একটু কঠিন শব্দগুলো পেনসিল দিয়ে গোল গোল দাগ দাও।"
       - মধুর সুরে পাঠ: "ছোট্ট আয়াত বা হাদিসটি চমৎকার সুরে গুঞ্জরিত করো বা আবৃত্তি করো।"
       - মা-বাবার সাথে ভাগ করে নেওয়া: "আজকের পঠিত চমৎকার বিষয়টি আম্মু অথবা আব্বুকে মুখে শুনিয়ে তাঁদের কাছ থেকে মিষ্টি হাসি ও আদর উপহার নাও!"
       - হাতের কাজ বা ছবির মাধ্যমে সমাধান: "সহজ সংখ্যার খেলাটি খাতায় ছোট্ট ছবি বা ফুল এঁকে সমাধান করো।"
    ৫. **উপকারী ও আকর্ষক পাঠ গঠন (Beneficial & Highly Engaging Layout):** ১ম ও ২য় শ্রেণির শিশুদের মানসিক ধারণক্ষমতার সাথে সামঞ্জস্য রেখে প্রতিটি দিনের শ্রেণির কাজ (C.W) এবং বাড়ির কাজ (H.W)-এর মধ্যে চমৎকার সংযোগ রাখবে, যেন পড়াশোনাকে বোঝা মনে না করে তারা আনন্দের সাথে শিখতে পারে।

    **শ্রেণির কাজ (C.W) ও বাড়ির কাজ (H.W) সমন্বয় ও সৃজনশীলতার নিয়ম (CW & HW Combined Daily Routine):**
    ১. **সমন্বিত শিখন (Combined Learning):** প্রতিটি দিনের C.W (শ্রেণির কাজ) এবং H.W (বাড়ির কাজ) অবশ্যই একে অপরের সাথে সরাসরি সম্পর্কিত এবং পরিপূরক হতে হবে। শ্রেণির কাজ (C.W)-এ যা শিখানো হবে বা আলোচনা করা হবে, বাড়ির কাজ (H.W)-এ তা খাতা বা বোর্ডে লেখার মাধ্যমে, মুখস্থ করার মাধ্যমে বা কোনো ব্যবহারিক কাজের মাধ্যমে শক্তিশালী করা হবে।
    ২. **একঘেয়েমি এড়ানো ও বৈচিত্র্যময় ভাষার ব্যবহার:** C.W এবং H.W কলামে কখনোই শুধু "মনোযোগ দিয়ে পড়ো", "রিডিং পড়ো" বা "Read carefully" শব্দগুলো বারবার বা একনাগাড়ে ব্যবহার করবেন না। এটি অত্যন্ত ক্লান্তিকর ও বিরক্তিকর। এর পরিবর্তে সৃজনশীল, আনন্দদায়ক ও বৈচিত্র্যময় ভাষা এবং বাস্তবমুখী কাজ দিন।
    ৩. **দিন নম্বরের ব্যবহার সম্পূর্ণ নিষিদ্ধ (NO Day-number prefixes):** প্রতিটি দিনের কাজ শুরু করতে কখনোই কোনো দিন নম্বর বা দিন নির্দেশক শব্দ (যেমন: "১ম দিন:", "২য় দিন:", "১ম দিন -", "প্রথম দিন", "Day 1" ইত্যাদি) ব্যবহার করবেন না। কন্টেন্টের শুরুতে সরাসরি কাজের নির্দেশ দিয়ে শুরু করুন। কারণ টেবিলে বা ডায়েরিতে এমনিতেই তারিখ ও ক্রমানুসারে তালিকা থাকবে, তাই টেক্সটের ভেতরে দিন নম্বর লিখে জায়গা অপচয় বা পুনরাবৃত্তি করার কোনো প্রয়োজন নেই।
    ৪. **বাধ্যতামূলক সাধারণ অনুজ্ঞাসূচক আদেশ বা নির্দেশ (Direct Imperative Commands):** প্রতিটি কাজ অবশ্যই অনুজ্ঞাসূচক বাক্যে (Imperative Sentences) সরাসরি আদেশ বা নির্দেশ আকারে লিখতে হবে। ক্রিয়াপদ অবশ্যই সরাসরি সাধারণ আদেশসূচক রূপে থাকবে (যেমন: 'করো', 'লেখো', 'পড়ো', 'আলোচনা করো', 'মুখস্থ করো', 'প্রস্তুত করো', 'সম্পাদন করো')। কখনোই সম্মানসূচক বা উচ্চ-মধ্যম পুরুষ রূপ (যেমন: 'করুন', 'লিখুন', 'পড়ুন', 'আলোচনা করুন', 'মুখস্থ করুন', 'প্রস্তুত করুন') ব্যবহার করবেন না।
    
    *শ্রেণীর কাজের (C.W) বৈচিত্র্যময় সুন্দর উদাহরণ (আদেশসূচক অনুজ্ঞাবাচক রূপে এবং দিন নম্বর ছাড়া):* 
    - "এই অনুচ্ছেদটি মনোযোগ দিয়ে পড়ো, পৃষ্ঠা-৬০।"
    - "লেখকের চিন্তাভাবনা নিয়ে সহপাঠীদের সাথে শ্রেণিকক্ষে আলোচনা করো, পৃষ্ঠা-৬২।"
    - "পাঠের মূল বিষয়বস্তু বোঝো এবং গুরুত্বপূর্ণ তথ্যগুলো চিহ্নিত করো, পৃষ্ঠা-৬৫।"
    - "সংক্ষিপ্ত প্রশ্নোত্তর ও কঠিন শব্দগুলোর বানান অনুশীলন করো, পৃষ্ঠা-৬৭।"
    - "সম্পূর্ণ বিষয়টির ওপর পুনরালোচনা (Revision) করো, পৃষ্ঠা-৬৯।"

    *বাড়ির কাজের (H.W) বৈচিত্র্যময় সুন্দর উদাহরণ (C.W এর পরিপূরক, আদেশসূচক অনুজ্ঞাবাচক রূপে এবং দিন নম্বর ছাড়া):*
    - "শ্রেণিতে আলোচিত বিষয়বস্তু নিয়ে পুনরায় ভাবো এবং খাতায় গুরুত্বপূর্ণ পয়েন্টগুলো লেখো, পৃষ্ঠা-৬০।"
    - "পাঠের মূল শিক্ষাগুলো খাতায় সংক্ষেপে নিজের ভাষায় লেখো, পৃষ্ঠা-৬২।"
    - "পাঠে উল্লেখিত সকল প্রাসঙ্গিক দলিল, আয়াত ও হাদিস মুখস্থ করে খাতায় সুন্দর করে লেখো, পৃষ্ঠা-৬৫।"
    - "অনুশীলনীর প্রধান প্রধান প্রশ্নের উত্তরগুলো খাতায় সুন্দরভাবে প্রস্তুত করো, পৃষ্ঠা-৬৭।"
    - "পুরো অধ্যায়ের একটি সুন্দর সারসংক্ষেপ (Summary) খাতায় ৩টি বাক্যে লিখে প্রস্তুত করো, পৃষ্ঠা-৬৯।"

    **বুদ্ধিদীপ্ত ও প্রাসঙ্গিক দলিলের নিয়ম (Advanced Scriptural Rules):**
    ১. কোনো অধ্যায়ে একাধিক আয়াত বা হাদিসের দলিল থাকলে ছাত্রছাত্রীদের শুধুমাত্র একটি দলিল মুখস্থ করতে বলবেন না। অবশ্যই 'সকল' প্রাসঙ্গিক আয়াত বা দলিল মুখস্থ করার নির্দেশ দেবেন।
    - উদাহরণ: "বিষয়ের সাথে সম্পর্কিত সকল প্রাসঙ্গিক দলিল মুখস্থ করো।"
    ২. পৃষ্ঠা নম্বর বা রেফারেন্স অবশ্যই আদেশের একদম শেষে কমা দিয়ে বা ব্র্যাকেটে লিখবেন।
    - সঠিক উদাহরণ: "সালাতের গুরুত্বের ওপর আলোচনাটি পড়ো এবং মূল বিষয়বস্তু বোঝো, পৃষ্ঠা-৫৭।"
    - সঠিক উদাহরণ: "বিষয়ের প্রাসঙ্গিক সকল আয়াত ও দলিল মুখস্থ করো, পৃষ্ঠা-৬৬-৬৮।"

    **টেবিল ফরম্যাট (Strict Markdown):**
    | DATE | C.W | H.W | ACTION |
    | :--- | :--- | :--- | :--- |
    | [তারিখ] | [বার বা কাজ] | [বার বা কাজ] | [REGENERATE] |

    **কঠোর নিয়মাবলী:**
    ১. ACTION কলামে সবসময় "[REGENERATE]" শব্দটি লিখবেন।
    ২. কোনো ধরণের শুভেচ্ছা, ভূমিকা, কোড ব্লক (\`\`\`) বা অতিরিক্ত বর্ণনা লিখবেন না। শুধুমাত্র Markdown টেবিলটি প্রধান উত্তর হিসেবে থাকবে।
    ৩. যদি কোনো দিনে ক্লাস না থাকে (যেমন সাপ্তাহিক ছুটি বা অন্য কোনো বন্ধ), তবে "ছুটি" বা "ক্লাস নেই" লিখুন।
`;

const getClientApiKey = (): string | null => {
  const savedKey = localStorage.getItem("GEMINI_API_KEY");
  if (savedKey && savedKey.trim()) {
    return savedKey.trim();
  }
  
  // Fallback to compiled environment variable from Vite build
  const envKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (envKey && envKey.trim()) {
    return envKey.trim();
  }
  
  return null;
};

export const generateLessonPlanClient = async (
  request: LessonPlanRequest,
  onProgress: (progress: number, message: string) => void
): Promise<string> => {
  const apiKey = getClientApiKey();
  if (!apiKey) {
    throw new Error(
      "এপিআই কী (API Key) খুঁজে পাওয়া যায়নি। অনুগ্রহ করে আপনার জেমিনি এপিআই কী সেট করুন।"
    );
  }

  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      }
    }
  });

  const pageRangeDesc = request.pageRanges && request.pageRanges.length > 0
    ? request.pageRanges.map((r, i) => `রেঞ্জ ${i + 1}: পৃষ্ঠা ${r.start} থেকে ${r.end}`).join(", ")
    : `পৃষ্ঠা ${request.startPage} থেকে ${request.endPage}`;

  let prompt = `${SYSTEM_INSTRUCTION_BASE}
    শ্রেণি: ${request.gradeLevel}
    পৃষ্ঠা সীমা: ${pageRangeDesc}
    মেয়াদ: ${request.duration} দিন
    শুরুর তারিখ: ${request.startDate}
    বন্ধের দিনসমূহ (ছুটি): ${request.holidays || "নেই"}
    ${request.additionalContext ? `অতিরিক্ত নির্দেশাবলী: ${request.additionalContext}` : ""}
  `;

  if (request.extractedText) {
    prompt += `\nএখানে ফাইল থেকে সংগৃহীত সিলেবাসের বিবরণ দেওয়া হলো:\n${request.extractedText}\n`;
  }

  if (request.sampleLessonPlan) {
    prompt += `\n\n**গুরুত্বপূর্ণ নমুনা পাঠ পরিকল্পনা (Sample Lesson Plan Reference):**\n` +
              `নিচের নমুনা পাঠ পরিকল্পনাটির গঠন (Format), ভাষা শৈলী (Imperative sentences like 'করো', 'লেখো', 'পড়ো'), এবং C.W ও H.W এর চমৎকার মিল ও সমন্বয় কঠোরভাবে বজায় রাখুন। নিচে দেওয়া নমুনাটির আদলে আপনার নতুন রুটিন বা পাঠ পরিকল্পনাটি তৈরি করবেন:\n\n${request.sampleLessonPlan}\n\n`;
  }

  prompt += `
    নির্দেশ: ${pageRangeDesc} এর বিষয়বস্তু বা সংগৃহীত সিলেবাসের বিবরণ বিশ্লেষণ করে ${request.duration} দিনের একটি নিট এন্ড ক্লিন Markdown টেবিল দিন। 
    - মুখস্থ করার আদেশের ক্ষেত্রে অবশ্যই "সকল" আয়াত বা দলিল মুখস্থ করার কথা উল্লেখ করবেন।
    - পৃষ্ঠা নম্বর বা রেফারেন্স অবশ্যই আদেশের শেষে লিখবেন। 
    - উল্টো ক্রমে (Reverse Order) সাজান।
    - ACTION কলামে "[REGENERATE]" লিখুন।
  `;

  onProgress(10, "সিলেবাস এবং দিনের সংখ্যা বিশ্লেষণ করা হচ্ছে...");

  const parts: any[] = [{ text: prompt }];
  if (request.fileData && request.mimeType && !request.extractedText) {
    parts.push({
      inlineData: {
        mimeType: request.mimeType,
        data: request.fileData.split(',')[1]
      }
    });
  }

  onProgress(30, "বুদ্ধিদীপ্ত পাঠ পরিকল্পনা তৈরি করা হচ্ছে...");

  const modelsToTry = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.5-flash"];
  let success = false;
  let lastError: any = null;
  let resultText = "";

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    try {
      console.log(`Attempting generateContentStream with model: ${currentModel}`);
      if (i > 0) {
        onProgress(30 + i * 5, `বিকল্প মডেলে চেষ্টা করা হচ্ছে (${currentModel})...`);
        await new Promise(r => setTimeout(r, 1000));
      }

      const responseStream = await ai.models.generateContentStream({
        model: currentModel,
        contents: { parts: parts },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_BASE,
          temperature: 0.1,
        }
      });

      let fullText = "";
      for await (const chunk of responseStream) {
        const text = chunk.text || "";
        fullText += text;
        const estimatedProgress = Math.min(95, 40 + Math.floor(fullText.length / 50));
        onProgress(estimatedProgress, "ডেটা প্রসেস করা হচ্ছে...");
      }

      resultText = fullText;
      success = true;
      break;
    } catch (err: any) {
      console.error(`Error with model ${currentModel} during client-side stream generation:`, err);
      lastError = err;
    }
  }

  if (!success) {
    let userFriendlyMessage = lastError?.message || "সকল মডেল এপিআই কল ব্যর্থ হয়েছে।";
    if (userFriendlyMessage.includes("503") || userFriendlyMessage.includes("UNAVAILABLE") || userFriendlyMessage.includes("high demand") || userFriendlyMessage.includes("limit") || userFriendlyMessage.includes("exhausted")) {
      userFriendlyMessage = "জেমিনি এআই সার্ভার সাময়িকভাবে অতিরিক্ত চাপের মধ্যে রয়েছে। অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন।";
    }
    throw new Error(userFriendlyMessage);
  }

  onProgress(100, "সম্পন্ন!");
  return resultText;
};

export const regenerateDayContentClient = async (
  request: LessonPlanRequest,
  date: string,
  previousContent: string
): Promise<{ cw: string, hw: string }> => {
  const apiKey = getClientApiKey();
  if (!apiKey) {
    throw new Error(
      "এপিআই কী (API Key) খুঁজে পাওয়া যায়নি। অনুগ্রহ করে আপনার জেমিনি এপিআই কী সেট করুন।"
    );
  }

  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      }
    }
  });

  const pageRangeDesc = request.pageRanges && request.pageRanges.length > 0
    ? request.pageRanges.map((r, i) => `রেঞ্জ ${i + 1}: পৃষ্ঠা ${r.start} থেকে ${r.end}`).join(", ")
    : `পৃষ্ঠা ${request.startPage} থেকে ${request.endPage}`;

  const prompt = `
    শ্রেণি: ${request.gradeLevel}
    পৃষ্ঠা সীমা: ${pageRangeDesc}
    তারিখ: ${date}
    পূর্ববর্তী কাজ ছিল: ${previousContent}

    ${request.sampleLessonPlan ? `**গুরুত্বপূর্ণ নমুনা পাঠ পরিকল্পনা (Sample Lesson Plan Reference):**\nনিচের নমুনা পাঠ পরিকল্পনাটির গঠন (Format), ভাষা শৈলী, এবং C.W ও H.W এর চমৎকার মিল ও সমন্বয় বজায় রাখুন। এই নমুনাটির আদলে এই ১ দিনের নতুন কাজ তৈরি করুন:\n${request.sampleLessonPlan}\n` : ""}

    নির্দেশ: উপরোক্ত তথ্যের ভিত্তিতে শুধুমাত্র এই ১ দিনের জন্য একটি ভিন্ন, সৃজনশীল এবং অত্যন্ত সুন্দর নতুন C.W (শ্রেণি কাজ) এবং H.W (শিক্ষার্থীর কাজ) তৈরি করুন। 
    - আগের কাজের চেয়ে এটি সম্পূর্ণ আলাদা হতে হবে।
    - কখনোই শুধু "মনোযোগ দিয়ে পড়ো" বা "Read carefully" লিখবেন না।
    - দিন নম্বর বা কোনো দিন নির্দেশক শব্দ (যেমন: "১ম দিন:", "২য় দিন:", "১ম দিন -", "প্রথম দিন", "Day 1" ইত্যাদি) ব্যবহার করবেন না।
    - প্রতিটি কাজ অবশ্যই অনুজ্ঞাসূচক বাক্যে (Imperative Sentences) সরাসরি সাধারণ আদেশ বা নির্দেশ আকারে লিখতে হবে। ক্রিয়াপদ অবশ্যই সরাসরি সাধারণ আদেশসূচক রূপে থাকবে (যেমন: 'করো', 'লেখো', 'পড়ো', 'আলোচনা করো', 'মুখস্থ করো', 'প্রস্তুত করো')। কখনোই সম্মানসূচক বা উচ্চ-মধ্যম পুরুষ রূপ (যেমন: 'করুন', 'লিখুন', 'পড়ুন', 'আলোচনা করুন') ব্যবহার করবেন না।
    - আদেশের মধ্যে বৈচিত্র্য আনুন (যেমন: খাতায় সুন্দর হস্তাক্ষরে লেখো, শ্রেণিকক্ষে সহপাঠীদের সাথে মূল পয়েন্ট আলোচনা করো, প্রাসঙ্গিক সকল আয়াত মুখস্থ করে খাতায় না দেখে লেখো, অভিভাবককে মুখে বলো এবং তাঁর স্বাক্ষর নাও)।
    - শ্রেণি ডায়েরি এবং হোমওয়ার্ক সুন্দর সমন্বিত কাজের রূপ দিন।
    - পৃষ্ঠা নম্বর বা সূরার রেফারেন্স অবশ্যই আদেশের একদম শেষে কমা বা ব্র্যাকেটে লিখবেন।
    - যদি কোনো প্রাসঙ্গিক আয়াত বা হাদিসের দলিল থাকে, তবে "সকল প্রাসঙ্গিক দলিল মুখস্থ করো" উল্লেখ করুন।
    
    ফলাফলটি শুধুমাত্র নিচের মতো JSON ফরম্যাটে দিন:
    { "cw": "...", "hw": "..." }
  `;

  const parts: any[] = [{ text: prompt }];
  if (request.fileData && request.mimeType) {
    parts.push({
      inlineData: {
        mimeType: request.mimeType,
        data: request.fileData.split(",")[1]
      }
    });
  }

  const modelsToTry = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.5-flash"];
  let resultText = "{}";
  let success = false;
  let lastError: any = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    try {
      console.log(`Attempting client-side single day regen with model: ${currentModel}`);
      if (i > 0) {
        await new Promise(r => setTimeout(r, 1000));
      }

      const result = await ai.models.generateContent({
        model: currentModel,
        contents: { parts: parts },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_BASE,
          responseMimeType: "application/json"
        }
      });

      resultText = result.text || "{}";
      success = true;
      break;
    } catch (err: any) {
      console.error(`Client-side single day error with model ${currentModel}:`, err);
      lastError = err;
    }
  }

  if (!success) {
    let userFriendlyMessage = lastError?.message || "সকল মডেল এপিআই কল ব্যর্থ হয়েছে।";
    if (userFriendlyMessage.includes("503") || userFriendlyMessage.includes("UNAVAILABLE") || userFriendlyMessage.includes("high demand") || userFriendlyMessage.includes("limit") || userFriendlyMessage.includes("exhausted")) {
      userFriendlyMessage = "জেমিনি এআই সার্ভার সাময়িকভাবে অতিরিক্ত চাপের মধ্যে রয়েছে। অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন।";
    }
    throw new Error(userFriendlyMessage);
  }

  return JSON.parse(resultText);
};

export const generateLessonPlanStream = async (
  request: LessonPlanRequest,
  onProgress: (progress: number, message: string) => void
): Promise<string> => {
  try {
    const apiKey = getClientApiKey();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) {
      headers["x-gemini-api-key"] = apiKey;
    }

    const response = await fetch("/api/generate-lesson-plan", {
      method: "POST",
      headers,
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      console.warn("Backend API not OK, falling back to client-side generation...", response.status);
      return await generateLessonPlanClient(request, onProgress);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("স্ট্রিমিং শুরু করা যায়নি।");
    }

    const decoder = new TextDecoder("utf-8");
    let done = false;
    let accumulated = "";
    let buffer = "";

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr) {
              let data: any = null;
              try {
                data = JSON.parse(jsonStr);
              } catch (parseErr) {
                console.error("Error parsing stream chunk:", parseErr);
                continue;
              }

              if (data.type === "progress") {
                onProgress(data.progress, data.message);
              } else if (data.type === "chunk") {
                accumulated += data.text;
              } else if (data.type === "clear") {
                accumulated = "";
              } else if (data.type === "error") {
                throw new Error(data.message || "রুটিন তৈরিতে সমস্যা হয়েছে।");
              }
            }
          }
        }
      }
    }

    return accumulated;
  } catch (error: any) {
    console.warn("API request failed, trying client-side generation fallback:", error);
    try {
      return await generateLessonPlanClient(request, onProgress);
    } catch (fallbackError: any) {
      throw fallbackError;
    }
  }
};

export const regenerateDayContent = async (
  request: LessonPlanRequest,
  date: string,
  previousContent: string
): Promise<{ cw: string, hw: string }> => {
  try {
    const apiKey = getClientApiKey();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) {
      headers["x-gemini-api-key"] = apiKey;
    }

    const response = await fetch("/api/regenerate-day", {
      method: "POST",
      headers,
      body: JSON.stringify({ request, date, previousContent })
    });

    if (!response.ok) {
      console.warn("Backend API not OK, falling back to client-side regeneration...", response.status);
      return await regenerateDayContentClient(request, date, previousContent);
    }

    return await response.json();
  } catch (error: any) {
    console.warn("API request failed, trying client-side regeneration fallback:", error);
    try {
      return await regenerateDayContentClient(request, date, previousContent);
    } catch (fallbackError: any) {
      throw fallbackError;
    }
  }
};

export const generateQuizClient = async (
  request: QuizRequest
): Promise<QuizResponse> => {
  const apiKey = getClientApiKey();
  if (!apiKey) {
    throw new Error(
      "এপিআই কী (API Key) খুঁজে পাওয়া যায়নি। অনুগ্রহ করে আপনার জেমিনি এপিআই কী সেট করুন।"
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      }
    }
  });

  let typeText = "";
  if (request.questionType === "mcq") {
    typeText = "বহুনির্বাচনী প্রশ্ন (MCQ - ৪টি অপশনসহ, সঠিক উত্তরটি 'answer' ফিল্ডে থাকতে হবে এবং 'type' ফিল্ড 'mcq' হতে হবে)। সতর্কীকরণ: সব কয়টি প্রশ্নই অবশ্যই বহুনির্বাচনী বা MCQ হতে হবে। কোনো অন্য প্রকারের প্রশ্ন তৈরি করা যাবে না।";
  } else if (request.questionType === "short") {
    typeText = "সংক্ষিপ্ত উত্তর প্রশ্ন (যার সাথে একটি আদেশ ও উত্তর 'answer' ফিল্ডে থাকবে এবং 'type' ফিল্ড 'short' হতে হবে)। সতর্কীকরণ: সব কয়টি প্রশ্নই অবশ্যই সংক্ষিপ্ত উত্তর প্রশ্ন হতে হবে। কোনো অন্য প্রকারের প্রশ্ন তৈরি করা যাবে না।";
  } else if (request.questionType === "true_false") {
    typeText = "সত্য/মিথ্যা প্রশ্ন (যার সঠিক উত্তর 'সত্য' অথবা 'মিথ্যা' হবে এবং 'answer' ফিল্ডে থাকবে এবং 'type' ফিল্ড 'true_false' হতে হবে। যদি বিবৃতিটি মিথ্যা হয়, তাহলে উত্তরের সাথে সঠিক বিবৃতিটি লিখে দিন)। সতর্কীকরণ: সব কয়টি প্রশ্নই অবশ্যই সত্য/মিথ্যা হতে হবে। কোনো অন্য প্রকারের প্রশ্ন তৈরি করা যাবে না।";
  } else if (request.questionType === "blank") {
    typeText = "শূণ্যস্থান পূরণ প্রশ্ন (Fill in the blank - বাক্যের মধ্যে একটি খালি স্থান বা শূন্যস্থান থাকবে যেমন '______' এবং সঠিক উত্তরটি 'answer' ফিল্ডে থাকবে এবং 'type' ফিল্ড 'blank' হতে হবে)। সতর্কীকরণ: সব কয়টি প্রশ্নই অবশ্যই শূণ্যস্থান পূরণ হতে হবে। কোনো অন্য প্রকারের প্রশ্ন তৈরি করা যাবে না।";
  } else if (request.questionType === "essay") {
    typeText = "রচনামূলক প্রশ্ন (Essay Type - বড় বর্ণনামূলক প্রশ্ন, যার সাথে একটি আদর্শ উত্তর বা উত্তরের সংকেত 'answer' ফিল্ডে থাকবে এবং 'type' ফিল্ড 'essay' হতে হবে)। সতর্কীকরণ: সব কয়টি প্রশ্নই অবশ্যই রচনামূলক হতে হবে। কোনো অন্য প্রকারের প্রশ্ন তৈরি করা যাবে না।";
  } else {
    typeText = "মিশ্র প্রশ্ন (MCQ, সংক্ষিপ্ত উত্তর, সত্য/মিথ্যা এবং শূণ্যস্থান পূরণ - এই চার ধরনের প্রশ্নের সমান সংমিশ্রণ। প্রতিটি প্রকারের অন্তত কিছু প্রশ্ন থাকতে হবে। প্রতিটি প্রশ্নের সঠিক 'type' ফিল্ড যথাক্রমে 'mcq', 'short', 'true_false' অথবা 'blank' থাকতে হবে। রচনামূলক প্রশ্ন মিশ্র কুইজে থাকবে না)";
  }

  let difficultyText = "";
  if (request.difficulty === "easy") {
    difficultyText = "সহজ (প্রাথমিক স্তরের ও সরাসরি তথ্যভিত্তিক)";
  } else if (request.difficulty === "medium") {
    difficultyText = "মাঝারি (সৃজনশীল ও চিন্তন দক্ষতা যাচাই করার মতো)";
  } else {
    difficultyText = "কঠিন (উচ্চতর দক্ষতা ও গভীর অনুধাবন যাচাই করার মতো)";
  }

  const prompt = `
    আপনি একজন মাদরাসার অভিজ্ঞ শিক্ষক। নিচের পাঠ্য বা পাঠ পরিকল্পনার ভিত্তিতে শিক্ষার্থীদের জন্য একটি কুইজ বা মূল্যায়ন পত্র তৈরি করুন।
    
    পাঠ বা রুটিন বিবরণী:
    ${request.lessonContent}
    
    শ্রেণি: ${request.gradeLevel}
    প্রশ্নের সংখ্যা: ${request.questionCount} টি
    প্রশ্নের ধরন: ${typeText}
    কঠিনতার স্তর: ${difficultyText}
    ${request.additionalInstructions ? `অতিরিক্ত নির্দেশনা: ${request.additionalInstructions}` : ""}
    
    নির্দেশাবলী:
    ১. কুইজের প্রশ্নগুলো পাঠ পরিকল্পনার (Lesson Plan) বা পাঠ্যের ভাষার সাথে হুবহু মিল রেখে তৈরি করুন। পাঠ পরিকল্পনাটি বাংলায় হলে কুইজটি অবশ্যই বাংলা ভাষায় হতে হবে, আর পাঠ পরিকল্পনাটি ইংরেজিতে হলে কুইজটি অবশ্যই ইংরেজি ভাষায় তৈরি করতে হবে। মাদরাসা শিক্ষার্থীদের জন্য উপযুক্ত শালীন ভাষায় লিখুন।
    ২. প্রশ্নগুলোতে কোনো বানান বা ব্যাকরণগত ভুল থাকা যাবে না।
    ৩. প্রশ্নের শুরুতে কোনো প্রকার নম্বর বা ক্রমিক নম্বর (যেমন ১., 2. বা ক ইত্যাদি) যুক্ত করবেন না। প্রশ্ন টেক্সট সরাসরি প্রশ্ন দিয়ে শুরু করুন।
    ৪. MCQ প্রশ্নের ক্ষেত্রে অবশ্যই ৪টি অপশন ("options" নামক স্ট্রিং অ্যারে) প্রদান করুন। 'answer' ফিল্ডে সঠিক অপশনটি উল্লেখ করবেন। 'type' ফিল্ডের মান হবে 'mcq'।
    ৫. সংক্ষিপ্ত প্রশ্নের ক্ষেত্রে "options" ফিল্ড দেওয়ার প্রয়োজন নেই (বা null রাখুন)। 'type' ফিল্ডের মান হবে 'short'।
    ৬. সত্য/মিথ্যা প্রশ্নের ক্ষেত্রে 'type' ফিল্ডের মান হবে 'true_false'। 'answer' ফিল্ডে উত্তর লিখবেন। কুইজের বিবৃতিটি যদি মিথ্যা (false) হয়, তবে অবশ্যই সঠিক বিবৃতিটি বা সঠিক তথ্যটি উত্তরের মধ্যে লিখে দিন (যেমন: 'মিথ্যা। সঠিক বাক্য: ...')।
    ৭. শূণ্যস্থান পূরণ প্রশ্নের ক্ষেত্রে 'type' ফিল্ডের মান হবে 'blank'। প্রশ্নে একটি আন্ডারস্কোর '______' দিয়ে শূণ্যস্থান নির্দেশ করবেন। 'answer' ফিল্ডে শূণ্যস্থানের সঠিক শব্দটি লিখবেন।
    ৮. রচনামূলক প্রশ্নের ক্ষেত্রে 'type' ফিল্ডের মান হবে 'essay'। 'answer' ফিল্ডে উত্তরের সারসংক্ষেপ বা আদর্শ উত্তর লিখবেন।
    ৯. মিশ্র প্রশ্নের ক্ষেত্রে (mixed type) আপনাকে অবশ্যই উপরে উল্লিখিত চারটি ধরনই (MCQ, সত্য/মিথ্যা, শূণ্যস্থান পূরণ এবং সংক্ষিপ্ত উত্তর) অন্তর্ভুক্ত করতে হবে। কোনো একটি প্রকার বাদ দেওয়া যাবে না।
    ১০. প্রশ্নের ধরন যা নির্দিষ্ট করা হয়েছে, তার বাইরে কোনো প্রশ্ন তৈরি করা সম্পূর্ণ নিষিদ্ধ। উদাহরণস্বরূপ, যদি প্রশ্নের ধরন 'MCQ' হয়, তবে ১টি প্রশ্নও সত্য/মিথ্যা, শূণ্যস্থান পূরণ বা অন্য কোনো প্রকারের হতে পারবে না; সব প্রশ্নই অবশ্যই MCQ হতে হবে।
    ১১. উত্তরটি শুধুমাত্র এবং শুধুমাত্র নিচের JSON ফরম্যাটে দিন। কোনো অতিরিক্ত কথা, ব্যাকটিক বা প্রি-টেক্সট/পোস্ট-টেক্সট দেবেন না:
    
    {
      "quizTitle": "কুইজের একটি আকর্ষণীয় ও প্রাসঙ্গিক শিরোনাম",
      "questions": [
        {
          "type": "mcq",
          "question": "রাসূলুল্লাহ (সা.) এর প্রথম স্ত্রীর নাম কী?",
          "options": ["ক. খাদিজা (রা.)", "খ. আয়েশা (রা.)", "গ. হাফসা (রা.)", "ঘ. সাওদা (রা.)"],
          "answer": "খাদিজা (রা.)"
        },
        {
          "type": "true_false",
          "question": "মদিনা সনদে মোট ৪৭টি ধারা ছিল।",
          "options": null,
          "answer": "সত্য"
        },
        {
          "type": "blank",
          "question": "রাসূলুল্লাহ (সা.) ______ হিজরতের উদ্দেশ্যে মক্কা ত্যাগ করেন।",
          "options": null,
          "answer": "৬২২ খ্রিস্টাব্দে"
        },
        {
          "type": "short",
          "question": "আকাইদ শব্দের অর্থ কী?",
          "options": null,
          "answer": "বিশ্বাসমালা"
        },
        {
          "type": "essay",
          "question": "ঈমানের মূল স্তম্ভসমূহ বিস্তারিতভাবে আলোচনা করো।",
          "options": null,
          "answer": "ঈমানের প্রধান সাতটি স্তম্ভ হলো আল্লাহর প্রতি বিশ্বাস, ফেরেশতাগণ, কিতাবসমূহ, রাসূলগণ, পরকাল, তকদির এবং মৃত্যুর পর পুনরুত্থান।"
        }
      ]
    }
  `;

  const parts = [{ text: prompt }];
  const modelsToTry = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.5-flash"];
  let resultText = "{}";
  let success = false;
  let lastError: any = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    try {
      console.log(`Attempting client-side quiz generation with model: ${currentModel}`);
      if (i > 0) {
        await new Promise(r => setTimeout(r, 1000));
      }

      const result = await ai.models.generateContent({
        model: currentModel,
        contents: { parts: parts },
        config: {
          systemInstruction: "আপনি একজন মাদরাসার অভিজ্ঞ শিক্ষক। আপনি শুধু এবং শুধুমাত্র JSON উত্তর দিন।",
          responseMimeType: "application/json"
        }
      });

      resultText = result.text || "{}";
      success = true;
      break;
    } catch (err: any) {
      console.error(`Client-side quiz generation error with model ${currentModel}:`, err);
      lastError = err;
    }
  }

  if (!success) {
    let userFriendlyMessage = lastError?.message || "সকল মডেল এপিআই কল ব্যর্থ হয়েছে।";
    if (userFriendlyMessage.includes("503") || userFriendlyMessage.includes("UNAVAILABLE") || userFriendlyMessage.includes("high demand") || userFriendlyMessage.includes("limit") || userFriendlyMessage.includes("exhausted")) {
      userFriendlyMessage = "জেমিনি এআই সার্ভার সাময়িকভাবে অতিরিক্ত চাপের মধ্যে রয়েছে। অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন।";
    }
    throw new Error(userFriendlyMessage);
  }

  return JSON.parse(resultText);
};

export const generateQuiz = async (
  request: QuizRequest
): Promise<QuizResponse> => {
  try {
    const response = await fetch("/api/generate-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      console.warn("Backend Quiz API not OK, falling back to client-side generation...", response.status);
      return await generateQuizClient(request);
    }

    return await response.json();
  } catch (error: any) {
    console.warn("Quiz API request failed, trying client-side generation fallback:", error);
    try {
      return await generateQuizClient(request);
    } catch (fallbackError: any) {
      throw fallbackError;
    }
  }
};
