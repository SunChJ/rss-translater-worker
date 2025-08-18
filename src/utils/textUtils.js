// Text processing utilities for token counting and text chunking

export function getTokenCount(text) {
  if (!text) return 0;
  
  // Simple approximation: 1 token ≈ 4 characters for most languages
  // This is a rough estimate - for precise counting, you'd use tiktoken
  const charCount = text.length;
  const tokenCount = Math.ceil(charCount / 4);
  
  // Add some overhead for non-English languages
  const nonEnglishChars = text.match(/[^\x00-\x7F]/g);
  if (nonEnglishChars && nonEnglishChars.length > charCount * 0.1) {
    return Math.ceil(tokenCount * 1.2);
  }
  
  return tokenCount;
}

export function adaptiveChunking(text, targetChunks = 1, minChunkSize = 500, maxChunkSize = 4000) {
  if (!text || text.length <= maxChunkSize) {
    return [text];
  }
  
  const chunks = [];
  let remainingText = text;
  
  while (remainingText.length > 0) {
    let chunkSize = Math.min(maxChunkSize, remainingText.length);
    
    // If this would be the last chunk and it's very small, merge with previous
    if (remainingText.length - chunkSize < minChunkSize && chunks.length > 0) {
      chunkSize = remainingText.length;
    }
    
    let chunk = remainingText.substring(0, chunkSize);
    
    // Try to break at natural boundaries
    if (chunkSize < remainingText.length) {
      const boundaries = [
        chunk.lastIndexOf('\n\n'),
        chunk.lastIndexOf('\n'),
        chunk.lastIndexOf('. '),
        chunk.lastIndexOf('。'),
        chunk.lastIndexOf('! '),
        chunk.lastIndexOf('？'),
        chunk.lastIndexOf(' ')
      ];
      
      const bestBoundary = boundaries.find(pos => pos > chunkSize * 0.7);
      if (bestBoundary && bestBoundary > minChunkSize) {
        chunk = remainingText.substring(0, bestBoundary + 1);
      }
    }
    
    chunks.push(chunk.trim());
    remainingText = remainingText.substring(chunk.length).trim();
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}

export function stripHtml(html) {
  if (!html) return '';
  
  return html
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncateText(text, maxLength = 150) {
  if (!text || text.length <= maxLength) return text;
  
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

export function detectLanguage(text) {
  if (!text) return 'unknown';
  
  // Simple language detection based on character patterns
  const chineseChars = text.match(/[\u4e00-\u9fff]/g);
  const japaneseChars = text.match(/[\u3040-\u309f\u30a0-\u30ff]/g);
  const koreanChars = text.match(/[\uac00-\ud7af]/g);
  const russianChars = text.match(/[\u0400-\u04ff]/g);
  const arabicChars = text.match(/[\u0600-\u06ff]/g);
  
  const totalChars = text.length;
  
  if (chineseChars && chineseChars.length / totalChars > 0.3) {
    return 'Chinese';
  }
  if (japaneseChars && japaneseChars.length / totalChars > 0.3) {
    return 'Japanese';
  }
  if (koreanChars && koreanChars.length / totalChars > 0.3) {
    return 'Korean';
  }
  if (russianChars && russianChars.length / totalChars > 0.3) {
    return 'Russian';
  }
  if (arabicChars && arabicChars.length / totalChars > 0.3) {
    return 'Arabic';
  }
  
  return 'English';
}

export function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

export function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function normalizeUrl(url) {
  try {
    const parsedUrl = new URL(url);
    
    // Remove default ports
    if ((parsedUrl.protocol === 'http:' && parsedUrl.port === '80') ||
        (parsedUrl.protocol === 'https:' && parsedUrl.port === '443')) {
      parsedUrl.port = '';
    }
    
    // Remove trailing slash from pathname
    if (parsedUrl.pathname.endsWith('/') && parsedUrl.pathname.length > 1) {
      parsedUrl.pathname = parsedUrl.pathname.slice(0, -1);
    }
    
    return parsedUrl.toString();
  } catch {
    return url;
  }
}

export function formatDate(date, format = 'ISO') {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  switch (format) {
    case 'ISO':
      return d.toISOString();
    case 'RFC2822':
      return d.toUTCString();
    case 'human':
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
    default:
      return d.toString();
  }
}

export function parseUserAgent(userAgent) {
  const info = {
    browser: 'unknown',
    version: 'unknown',
    os: 'unknown',
    device: 'desktop'
  };
  
  if (!userAgent) return info;
  
  // Simple user agent parsing
  if (userAgent.includes('Chrome')) {
    info.browser = 'Chrome';
    const match = userAgent.match(/Chrome\/(\d+)/);
    if (match) info.version = match[1];
  } else if (userAgent.includes('Firefox')) {
    info.browser = 'Firefox';
    const match = userAgent.match(/Firefox\/(\d+)/);
    if (match) info.version = match[1];
  } else if (userAgent.includes('Safari')) {
    info.browser = 'Safari';
  }
  
  if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
    info.device = 'mobile';
  } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
    info.device = 'tablet';
  }
  
  return info;
}