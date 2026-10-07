/**
 * Pure Number Extractor & Slip Parser
 * สกัดตัวเลข 3 หลัก และ 2 หลักจากข้อความใดๆ ได้อย่างแม่นยำ (รักษาเลข 0 ข้างหน้า เช่น 005, 05)
 */

/**
 * Extract numbers from raw text (รองรับการคั่นด้วย เคาะวรรค, ขึ้นบรรทัดใหม่, ลูกน้ำ, จุด, แท็บ ฯลฯ)
 * @param {string} text - ข้อความที่ผู้ใช้วางลงไป
 * @param {string} mode - 'auto' | '3on' | '2on' | '2under' | '3tod'
 * @param {boolean} deduplicate - กำจัดเลขซ้ำหรือไม่ (ค่าเริ่มต้น true)
 */
function extractNumbersFromText(text, mode = 'auto', deduplicate = true) {
  if (!text || typeof text !== 'string') {
    return { numbers3D: [], numbers2D: [], totalCount: 0, rawText: '' };
  }

  let clean = text.trim();

  // Convert Thai numerals to Arabic numerals
  const thaiDigits = ['๐','๑','๒','๓','๔','๕','๖','๗','๘','๙'];
  thaiDigits.forEach((td, idx) => {
    clean = clean.split(td).join(idx);
  });

  // Extract all numeric sequences
  // Matches pure digit tokens separated by whitespace or punctuation
  // Also handles format like "123=50" by matching digit sequences
  const rawTokens = clean.split(/[^0-9]+/).filter(Boolean);

  const list3D = [];
  const list2D = [];

  rawTokens.forEach(tok => {
    // If length is 3 (e.g. 005, 123)
    if (tok.length === 3) {
      list3D.push(tok);
    } 
    // If length is 2 (e.g. 05, 27)
    else if (tok.length === 2) {
      list2D.push(tok);
    }
    // If user pasted continuous string of 3-digit numbers or longer chunks
    else if (tok.length > 3) {
      // If divisible by 3 and mode is 3D or auto
      if (tok.length % 3 === 0 && (mode === '3on' || mode === '3tod')) {
        for (let i = 0; i < tok.length; i += 3) {
          list3D.push(tok.slice(i, i + 3));
        }
      }
      // If divisible by 2 and mode is 2D
      else if (tok.length % 2 === 0 && (mode === '2on' || mode === '2under')) {
        for (let i = 0; i < tok.length; i += 2) {
          list2D.push(tok.slice(i, i + 2));
        }
      }
    }
  });

  // Deduplicate if requested
  const final3D = deduplicate ? Array.from(new Set(list3D)) : list3D;
  const final2D = deduplicate ? Array.from(new Set(list2D)) : list2D;

  // Sort ascending
  final3D.sort((a, b) => a.localeCompare(b));
  final2D.sort((a, b) => a.localeCompare(b));

  return {
    numbers3D: final3D,
    numbers2D: final2D,
    totalCount: final3D.length + final2D.length,
    rawCount3D: list3D.length,
    rawCount2D: list2D.length
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractNumbersFromText
  };
}
