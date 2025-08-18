// Translation agents implementation
export class AgentManager {
  constructor(env, database = null) {
    this.env = env;
    this.db = database;
    this.agentCache = new Map();
  }

  createAgent(type, config) {
    switch (type) {
      case 'openai':
        return new OpenAIAgent(config, this.env);
      case 'deepl':
        return new DeepLAgent(config, this.env);
      case 'libretranslate':
        return new LibreTranslateAgent(config, this.env);
      case 'test':
        return new TestAgent(config, this.env);
      default:
        throw new Error(`Unknown agent type: ${type}`);
    }
  }

  async getAgentById(agentId) {
    if (!this.db) {
      throw new Error('Database not available for agent lookup');
    }

    // Check cache first
    if (this.agentCache.has(agentId)) {
      return this.agentCache.get(agentId);
    }

    // Load from database
    const agentData = await this.db.getAgentById(agentId);
    if (!agentData) {
      return null;
    }

    // Create agent instance
    const agent = this.createAgent(agentData.type, {
      ...JSON.parse(agentData.config || '{}'),
      name: agentData.name,
      valid: agentData.valid,
      is_ai: agentData.is_ai
    });

    // Cache the agent
    this.agentCache.set(agentId, agent);
    
    return agent;
  }
}

// Base Agent class
class Agent {
  constructor(config, env) {
    this.config = config;
    this.env = env;
    this.name = config.name;
    this.valid = config.valid;
    this.isAI = config.is_ai || false;
  }

  async translate(text, targetLanguage, options = {}) {
    throw new Error('translate method must be implemented by subclasses');
  }

  async validate() {
    throw new Error('validate method must be implemented by subclasses');
  }

  getMinSize() {
    return this.config.max_characters ? this.config.max_characters * 0.7 :
           this.config.max_tokens ? this.config.max_tokens * 0.7 : 0;
  }

  getMaxSize() {
    return this.config.max_characters ? this.config.max_characters * 0.9 :
           this.config.max_tokens ? this.config.max_tokens * 0.9 : 0;
  }
}

// OpenAI Agent
export class OpenAIAgent extends Agent {
  constructor(config, env) {
    super(config, env);
    this.apiKey = env.OPENAI_API_KEY || config.api_key;
    this.baseUrl = config.base_url || 'https://api.openai.com/v1';
    this.model = config.model || 'gpt-3.5-turbo';
    this.maxTokens = config.max_tokens || 4096;
    this.temperature = config.temperature || 0.2;
    this.isAI = true;
  }

  async validate() {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://www.rsstranslator.com',
          'X-Title': 'RSS Translator'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: 'You must only reply with exactly one character: 1' },
            { role: 'user', content: '1' }
          ],
          max_completion_tokens: 50,
          temperature: 0
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices && data.choices[0] && data.choices[0].finish_reason === 'stop';
    } catch (error) {
      console.error('OpenAI validation failed:', error);
      return false;
    }
  }

  async translate(text, targetLanguage, options = {}) {
    const { textType = 'content', userPrompt = '' } = options;
    
    const systemPrompts = {
      title: `You are a professional, authentic translation engine. Translate only the text into ${targetLanguage}, return only the translations, do not explain the original text.`,
      content: `You are a professional, authentic translation engine specialized in HTML content translation.

Requirements:
1. Translate only the text content into ${targetLanguage}
2. Preserve ALL HTML tags, attributes, and structure completely unchanged
3. Maintain proper context awareness across different HTML elements and their relationships
4. Consider semantic meaning within nested tags and their hierarchical context
5. Ensure translated text fits naturally within the HTML structure
6. Keep inline elements (like <span>, <a>, <strong>) contextually coherent with their surrounding text
7. Maintain consistency in terminology throughout the entire HTML document
8. Return only the translated HTML content without explanations or comments

Important: Do not modify, remove, or alter any HTML tags, attributes, classes, IDs, or structural elements. Only translate the actual text content between tags.`
    };

    let systemPrompt = systemPrompts[textType] || systemPrompts.content;
    if (userPrompt) {
      systemPrompt += `\\n\\n${userPrompt}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://www.rsstranslator.com',
          'X-Title': 'RSS Translator'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ],
          temperature: this.temperature,
          max_completion_tokens: Math.min(4096, this.maxTokens),
          reasoning_effort: 'minimal'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        text: data.choices[0]?.message?.content || '',
        tokens: data.usage?.total_tokens || 0,
        success: true
      };
    } catch (error) {
      console.error('OpenAI translation failed:', error);
      return {
        text: '',
        tokens: 0,
        success: false,
        error: error.message
      };
    }
  }

  async summarize(text, targetLanguage, options = {}) {
    const systemPrompt = `Summarize the following text in ${targetLanguage} and return markdown format.`;
    
    return await this.translate(text, targetLanguage, { 
      ...options, 
      systemPrompt 
    });
  }

  async filter(text, filterPrompt) {
    const systemPrompt = filterPrompt + '\\n\\n**Output Requirements**\\n• Only return "Passed" or "Blocked" based on the above checks.\\n• ABSOLUTELY NO:\\n  - Explanations\\n  - Metadata\\n  - Discarded IDs\\n  - Additional text';
    
    try {
      const result = await this.translate(text, 'English', { 
        systemPrompt,
        textType: 'filter' 
      });
      
      const passed = result.text && result.text.includes('Passed');
      
      return {
        passed,
        tokens: result.tokens,
        success: result.success
      };
    } catch (error) {
      console.error('OpenAI filtering failed:', error);
      return {
        passed: false,
        tokens: 0,
        success: false,
        error: error.message
      };
    }
  }
}

// DeepL Agent
export class DeepLAgent extends Agent {
  constructor(config, env) {
    super(config, env);
    this.apiKey = env.DEEPL_API_KEY || config.api_key;
    this.serverUrl = config.server_url;
    this.maxCharacters = config.max_characters || 5000;
    this.languageMap = {
      'English': 'EN-US',
      'Chinese Simplified': 'ZH',
      'Russian': 'RU',
      'Japanese': 'JA',
      'Korean': 'KO',
      'Czech': 'CS',
      'Danish': 'DA',
      'German': 'DE',
      'Spanish': 'ES',
      'French': 'FR',
      'Indonesian': 'ID',
      'Italian': 'IT',
      'Hungarian': 'HU',
      'Norwegian Bokmål': 'NB',
      'Dutch': 'NL',
      'Polish': 'PL',
      'Portuguese': 'PT-PT',
      'Swedish': 'SV',
      'Turkish': 'TR'
    };
  }

  async validate() {
    try {
      const baseUrl = this.serverUrl || 'https://api-free.deepl.com/v2';
      const response = await fetch(`${baseUrl}/usage`, {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.character_count !== undefined;
    } catch (error) {
      console.error('DeepL validation failed:', error);
      return false;
    }
  }

  async translate(text, targetLanguage, options = {}) {
    const targetCode = this.languageMap[targetLanguage];
    
    if (!targetCode) {
      return {
        text: '',
        characters: 0,
        success: false,
        error: `Language not supported: ${targetLanguage}`
      };
    }

    try {
      const baseUrl = this.serverUrl || 'https://api-free.deepl.com/v2';
      const response = await fetch(`${baseUrl}/translate`, {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          text: text,
          target_lang: targetCode,
          preserve_formatting: '1',
          split_sentences: 'nonewlines',
          tag_handling: 'html'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        text: data.translations[0]?.text || '',
        characters: text.length,
        success: true
      };
    } catch (error) {
      console.error('DeepL translation failed:', error);
      return {
        text: '',
        characters: 0,
        success: false,
        error: error.message
      };
    }
  }
}

// Test Agent for development
export class TestAgent extends Agent {
  constructor(config, env) {
    super(config, env);
    this.translatedText = config.translated_text || '@@Translated Text@@';
    this.maxCharacters = config.max_characters || 50000;
    this.maxTokens = config.max_tokens || 50000;
    this.interval = config.interval || 0; // No delay in Workers
    this.isAI = true;
  }

  async validate() {
    return true;
  }

  async translate(text, targetLanguage, options = {}) {
    // Simulate processing time if needed
    if (this.interval > 0) {
      await new Promise(resolve => setTimeout(resolve, this.interval * 1000));
    }

    return {
      text: this.translatedText,
      tokens: 10,
      characters: text.length,
      success: true
    };
  }

  async summarize(text, targetLanguage, options = {}) {
    return this.translate(text, targetLanguage, options);
  }

  async filter(text, filterPrompt) {
    const passed = Math.random() > 0.5; // Random for testing
    
    return {
      passed,
      tokens: 10,
      success: true
    };
  }
}

// LibreTranslate Agent
export class LibreTranslateAgent extends Agent {
  constructor(config, env) {
    super(config, env);
    this.apiKey = config.api_key || '';
    this.serverUrl = config.server_url || 'https://libretranslate.com';
    this.maxCharacters = config.max_characters || 5000;
    this.languageMap = {
      'Chinese Simplified': 'zh',
      'Chinese Traditional': 'zh',
      'English': 'en',
      'Spanish': 'es',
      'French': 'fr',
      'German': 'de',
      'Italian': 'it',
      'Portuguese': 'pt',
      'Russian': 'ru',
      'Japanese': 'ja',
      'Dutch': 'nl',
      'Korean': 'ko',
      'Czech': 'cs',
      'Danish': 'da',
      'Indonesian': 'id',
      'Polish': 'pl',
      'Hungarian': 'hu',
      'Norwegian Bokmål': 'nb',
      'Swedish': 'sv',
      'Turkish': 'tr'
    };
  }

  async validate() {
    try {
      const response = await fetch(`${this.serverUrl}/languages`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.ok;
    } catch (error) {
      console.error('LibreTranslate validation failed:', error);
      return false;
    }
  }

  async translate(text, targetLanguage, options = {}) {
    const targetCode = this.languageMap[targetLanguage];
    
    if (!targetCode) {
      return {
        text: '',
        characters: 0,
        success: false,
        error: `Language not supported: ${targetLanguage}`
      };
    }

    try {
      const body = new URLSearchParams({
        q: text,
        source: 'auto',
        target: targetCode,
        format: 'html'
      });

      if (this.apiKey) {
        body.append('api_key', this.apiKey);
      }

      const response = await fetch(`${this.serverUrl}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: body
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      return {
        text: data.translatedText || '',
        characters: text.length,
        success: true
      };
    } catch (error) {
      console.error('LibreTranslate translation failed:', error);
      return {
        text: '',
        characters: 0,
        success: false,
        error: error.message
      };
    }
  }
}