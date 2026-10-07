/**
 * Excel Board Formatter for Pure Number Lists
 * จัดตารางคอลัมน์แนวตั้งตามแบบภาพ Excel (Col 1 ถึง Col 10, count ที่มุมล่างขวา)
 */

class LotteryCalculator {
  constructor(storage) {
    this.storage = storage;
  }

  /**
   * Format numbers into multi-column vertical grid (ตารางแบบในรูป Excel)
   * @param {Array<string>} numbersList - Array of number strings e.g. ['005', '006', ...]
   * @param {number} colCount - Number of columns (e.g. 10 for 3 digits, 5-6 for 2 digits)
   */
  formatGridColumns(numbersList, colCount = 10) {
    if (!numbersList || numbersList.length === 0) {
      return { rows: [], totalCount: 0, rowCount: 0, colCount, sorted: [] };
    }

    // Sort numbers ascending
    const sorted = [...numbersList].sort((a, b) => a.localeCompare(b));
    const totalCount = sorted.length;
    
    // Calculate number of rows needed
    const rowCount = Math.ceil(totalCount / colCount);
    
    // Fill columns top-to-bottom like in Excel
    // Column c gets items from start to end
    const columns = [];
    for (let c = 0; c < colCount; c++) {
      const colItems = [];
      const start = c * rowCount;
      const end = Math.min(start + rowCount, totalCount);
      for (let i = start; i < end; i++) {
        colItems.push(sorted[i]);
      }
      columns.push(colItems);
    }

    // Convert columns into rows for HTML table rendering
    const rows = [];
    for (let r = 0; r < rowCount; r++) {
      const row = [];
      for (let c = 0; c < colCount; c++) {
        row.push(columns[c][r] || null);
      }
      rows.push(row);
    }

    return { rows, totalCount, rowCount, colCount, sorted };
  }

  /**
   * Convert grid data into Tab-Separated Values (TSV) for pasting directly into Excel
   */
  gridToExcelClipboard(gridData, title = '', websiteName = '') {
    if (!gridData || !gridData.rows || gridData.rows.length === 0) return '';
    let tsv = '';
    if (websiteName || title) {
      tsv += `${websiteName}\t${title}\n`;
    }
    
    gridData.rows.forEach(row => {
      const line = row.map(cell => cell || '').join('\t');
      tsv += line + '\n';
    });
    tsv += `count\t${gridData.totalCount}\n`;
    return tsv;
  }

  /**
   * Chunks an array of items into groups of given size (default 50)
   * @param {Array} list 
   * @param {number} size 
   * @returns {Array<Array>}
   */
  chunkNumbers(list, size = 50) {
    if (!Array.isArray(list) || list.length === 0) return [];
    const chunks = [];
    for (let i = 0; i < list.length; i += size) {
      chunks.push(list.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Formats numbers into chunks separated by space inside, and custom delimiter between chunks
   * @param {Array<string>} list 
   * @param {number} size 
   * @param {string} delimiter 
   * @returns {string}
   */
  formatNumbersChunked(list, size = 50, delimiter = '\n\n') {
    const chunks = this.chunkNumbers(list, size);
    return chunks.map(c => c.join(' ')).join(delimiter);
  }

  /**
   * Groups grid data rows into chunks (e.g. 5 rows = 50 numbers if 10 columns)
   * @param {object} gridData 
   * @param {number} rowsPerChunk 
   * @returns {Array<Array<string>>}
   */
  chunkGridByRows(gridData, rowsPerChunk = 5) {
    if (!gridData || !gridData.rows || gridData.rows.length === 0) return [];
    const chunks = [];
    for (let r = 0; r < gridData.rows.length; r += rowsPerChunk) {
      const sliceRows = gridData.rows.slice(r, r + rowsPerChunk);
      const numbers = [];
      sliceRows.forEach(row => {
        row.forEach(cell => {
          if (cell) numbers.push(cell);
        });
      });
      if (numbers.length > 0) {
        chunks.push(numbers);
      }
    }
    return chunks;
  }
}

window.LotteryCalculator = LotteryCalculator;

