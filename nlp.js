/**
 * AuraFinance // Natural Language Processing Engine (nlp.js)
 * Implements client-side rules-based parsing of text descriptions,
 * with an optional connection to the Google Gemini API.
 */

// Category to keywords map for local rules-based classification
const CATEGORY_KEYWORDS = {
  Food: [
    'lunch', 'dinner', 'breakfast', 'brunch', 'restaurant', 'cafe', 'coffee',
    'starbucks', 'subway', 'mcdonald', 'burger', 'pizza', 'chipotle', 'food',
    'sushi', 'taco', 'bar', 'pub', 'boba', 'donut', 'bakery', 'eats'
  ],
  Groceries: [
    'grocery', 'groceries', 'supermarket', 'walmart', 'costco', 'target',
    'whole foods', 'trader joe', 'safeway', 'aldi', 'h-mart', 'kroger', 'food lion'
  ],
  Entertainment: [
    'netflix', 'spotify', 'youtube', 'hulu', 'disney', 'hbo', 'max', 'paramount',
    'subscription', 'sub', 'membership', 'movie', 'cinema', 'theater', 'ticket',
    'concert', 'gig', 'show', 'game', 'gaming', 'steam', 'playstation', 'xbox',
    'nintendo', 'book', 'audible', 'kindle'
  ],
  Transport: [
    'gas', 'fuel', 'petrol', 'chevron', 'shell', 'exxon', 'mobil', 'uber',
    'lyft', 'taxi', 'cab', 'train', 'bus', 'flight', 'airline', 'delta', 'united',
    'subway card', 'metro', 'parking', 'toll', 'fare', 'commute', 'transit'
  ],
  Utilities: [
    'bill', 'utilities', 'electric', 'electricity', 'power', 'water', 'sewer',
    'gas bill', 'internet', 'wifi', 'comcast', 'verizon', 'att', 't-mobile',
    'phone', 'mobile', 'rent', 'lease', 'insurance', 'geico', 'state farm', 'trash'
  ],
  Shopping: [
    'shopping', 'clothes', 'apparel', 'shoes', 'shirt', 'pants', 'jacket',
    'amazon', 'ebay', 'keyboard', 'mouse', 'gadget', 'electronics', 'gift',
    'mall', 'ikea', 'furniture', 'decor', 'hardware', 'homedepot'
  ],
  Health: [
    'health', 'fitness', 'gym', 'workout', 'membership gym', 'medicine',
    'medical', 'doctor', 'dentist', 'pharmacy', 'cvs', 'walgreens', 'hospital',
    'copay', 'pill', 'prescriptions', 'therapy'
  ]
};

// Word to number helper for simple numbers
const WORD_NUMBERS = {
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'fifteen': 15, 'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
  'a hundred': 100, 'hundred': 100
};

/**
 * Clean up stop words and parse-remnants to isolate the merchant/description
 */
function extractCleanDescription(phrase, amountMatch, dateMatch) {
  let clean = phrase;
  
  // Remove amount text
  if (amountMatch) {
    clean = clean.replace(amountMatch, '');
  }
  
  // Remove currency words and simple digits
  clean = clean.replace(/\b\d+(?:\.\d{1,2})?\b/g, '');
  clean = clean.replace(/\b(dollars|dollars|bucks|cents|euro|euros|pounds|gbp|usd)\b/gi, '');
  
  // Remove date expressions
  if (dateMatch) {
    clean = clean.replace(dateMatch, '');
  }
  clean = clean.replace(/\b(today|yesterday|tomorrow|on\s+[a-zA-Z]+|last\s+[a-zA-Z]+)\b/gi, '');
  
  // Remove operational verbs and prepositions
  const stopWords = [
    /^\s*(spent|bought|purchased|paid|add|log|record|put|entered)\s+/i,
    /\b(on|for|at|to|in|a|an|the|my|of|with)\b/gi
  ];
  
  stopWords.forEach(regex => {
    clean = clean.replace(regex, ' ');
  });
  
  // Clean whitespace, trim, and format capitalization
  clean = clean.replace(/\s+/g, ' ').trim();
  
  // If nothing is left, return a default
  if (!clean) return 'Expense';
  
  // Capitalize first letter of words
  return clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Extract Date based on relative words in text
 */
function extractDate(text) {
  const normalized = text.toLowerCase();
  const today = new Date();
  
  let dateTextMatch = null;
  
  if (normalized.includes('yesterday')) {
    today.setDate(today.getDate() - 1);
    dateTextMatch = /yesterday/i;
  } else if (normalized.includes('day before yesterday')) {
    today.setDate(today.getDate() - 2);
    dateTextMatch = /day before yesterday/i;
  } else if (normalized.includes('last week')) {
    today.setDate(today.getDate() - 7);
    dateTextMatch = /last week/i;
  } else {
    // Check for days of the week: e.g., "on Monday", "last Tuesday"
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < 7; i++) {
      const day = days[i];
      
      // "on Monday"
      if (normalized.includes(`on ${day}`)) {
        dateTextMatch = new RegExp(`on ${day}`, 'i');
        const currentDayIndex = today.getDay();
        const diff = currentDayIndex - i;
        const daysToSubtract = diff > 0 ? diff : 7 + diff;
        today.setDate(today.getDate() - daysToSubtract);
        break;
      }
      
      // "last Monday"
      if (normalized.includes(`last ${day}`)) {
        dateTextMatch = new RegExp(`last ${day}`, 'i');
        const currentDayIndex = today.getDay();
        const diff = currentDayIndex - i;
        const daysToSubtract = (diff > 0 ? diff : 7 + diff) + 7;
        today.setDate(today.getDate() - daysToSubtract);
        break;
      }
    }
  }
  
  // Return YYYY-MM-DD
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  
  return {
    dateStr: `${yyyy}-${mm}-${dd}`,
    match: dateTextMatch ? dateTextMatch.source : null
  };
}

/**
 * Local offline rules-based NLP parser
 */
function parseWithLocalRules(text) {
  const normalized = text.toLowerCase();
  
  // 1. Extract Amount
  let amount = null;
  let amountTextMatch = null;
  
  // Look for currency patterns ($10, 10.50, £50, etc)
  const currencyRegex = /(?:\$|£|€|¥)\s*(\d+(?:\.\d{1,2})?)/i;
  const currencyMatch = text.match(currencyRegex);
  
  if (currencyMatch) {
    amount = parseFloat(currencyMatch[1]);
    amountTextMatch = currencyMatch[0];
  } else {
    // Look for numbers followed by currency name (10 dollars, 5.50 bucks)
    const trailingCurrencyRegex = /(\d+(?:\.\d{1,2})?)\s*(?:dollars|bucks|euros|pounds|gbp|usd|cents)/i;
    const trailingMatch = text.match(trailingCurrencyRegex);
    if (trailingMatch) {
      amount = parseFloat(trailingMatch[1]);
      amountTextMatch = trailingMatch[0];
    } else {
      // Just extract any isolated float number in the text
      const genericNumberRegex = /\b(\d+(?:\.\d{1,2})?)\b/;
      const genericMatch = text.match(genericNumberRegex);
      if (genericMatch) {
        amount = parseFloat(genericMatch[1]);
        amountTextMatch = genericMatch[0];
      }
    }
  }
  
  // Fallback to checking simple text numbers if no digits found
  if (amount === null) {
    for (const [word, val] of Object.entries(WORD_NUMBERS)) {
      if (normalized.includes(word)) {
        amount = val;
        amountTextMatch = word;
        break;
      }
    }
  }
  
  // Default amount is 0 if completely unparseable
  amount = amount !== null ? amount : 0.00;

  // 2. Determine Category
  let category = 'Other';
  for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const hasKeyword = keywords.some(keyword => normalized.includes(keyword));
    if (hasKeyword) {
      category = catName;
      break;
    }
  }

  // 3. Determine Date
  const dateResult = extractDate(text);

  // 4. Extract Merchant/Description
  const description = extractCleanDescription(text, amountTextMatch, dateResult.match);

  return {
    amount: amount,
    category: category,
    description: description,
    date: dateResult.dateStr,
    parsedBy: 'Local Offline Engine'
  };
}

/**
 * Google Gemini Web API Parser
 */
async function parseWithGemini(text, apiKey) {
  const currentDate = new Date().toISOString().split('T')[0];
  const systemPrompt = `
    You are an expert financial ledger extraction assistant.
    Analyze the user's natural language expense report and convert it into a structured JSON object.
    
    The JSON structure MUST follow this schema exactly:
    {
      "amount": number (positive float, represent the cost),
      "category": string (MUST be exactly one of: "Food", "Groceries", "Entertainment", "Transport", "Utilities", "Shopping", "Health", "Other"),
      "description": string (the merchant, item, or description cleaned of filler words),
      "date": string (YYYY-MM-DD format. Base relative date calculations on current date: ${currentDate}. Default to "${currentDate}" if not specified)
    }
    
    Ensure that:
    - Amount is a positive number.
    - Category strictly maps to the 8 predefined values.
    - Description is neat, capitalized, and refers to the merchant (e.g. "Whole Foods", "Netflix", "Shell Gas").
    - Respond ONLY with the JSON object. Do not include markdown codeblocks or explanations.
  `;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt },
              { text: `Parse this phrase: "${text}"` }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const jsonText = data.candidates[0].content.parts[0].text;
    const parsedData = JSON.parse(jsonText.trim());

    // Validation post-processing to keep categories strict
    const allowedCategories = ["Food", "Groceries", "Entertainment", "Transport", "Utilities", "Shopping", "Health", "Other"];
    if (!allowedCategories.includes(parsedData.category)) {
      parsedData.category = "Other";
    }

    return {
      amount: parseFloat(parsedData.amount) || 0.00,
      category: parsedData.category || 'Other',
      description: parsedData.description || 'Expense',
      date: parsedData.date || currentDate,
      parsedBy: 'Gemini 2.5 AI Engine'
    };

  } catch (error) {
    console.error("Gemini Parsing failed, falling back to local engine:", error);
    // Add fallback alert metadata
    const fallback = parseWithLocalRules(text);
    fallback.fallbackNotice = `Gemini API Error: ${error.message}. Local parser was used.`;
    return fallback;
  }
}

/**
 * Public facing main parse function
 */
async function parseExpense(text) {
  const apiKey = localStorage.getItem('aura_gemini_key');
  if (apiKey && apiKey.trim() !== '') {
    return await parseWithGemini(text, apiKey);
  } else {
    return parseWithLocalRules(text);
  }
}
