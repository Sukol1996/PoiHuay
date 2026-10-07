/**
 * Lottery Storage & State Management (เน้นเก็บเฉพาะตัวเลข, ชื่อเว็ป และชื่อหวย)
 */

const STORAGE_KEY_SESSION = 'LOTTERY_NUMBERS_SESSION';
const STORAGE_KEY_RECENT_WEBSITES = 'LOTTERY_RECENT_WEBSITES';
const STORAGE_KEY_LOTTERY_LIST = 'LOTTERY_NAMES_LIST';

const defaultLotteryList = [
  'ฮานอยพิเศษ',
  'ฮานอยปกติ',
  'ฮานอย VIP',
  'ลาวพัฒนา',
  'หวยรัฐบาลไทย',
  'ยี่กี',
  'หวยหุ้น'
];

const defaultSession = {
  lotteryName: 'ฮานอยพิเศษ',
  lotteryDate: new Date().toISOString().split('T')[0],
  batches: [] // Array of { id, website, type, typeName, numbers, badgeText, createdAt }
};

class LotteryStorage {
  constructor() {
    this.session = this.loadSession();
    this.recentWebsites = this.loadRecentWebsites();
    this.lotteryList = this.loadLotteryList();
  }

  loadLotteryList() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_LOTTERY_LIST);
      return data ? JSON.parse(data) : [...defaultLotteryList];
    } catch (e) {
      return [...defaultLotteryList];
    }
  }

  saveLotteryList() {
    localStorage.setItem(STORAGE_KEY_LOTTERY_LIST, JSON.stringify(this.lotteryList));
  }

  addLotteryName(name) {
    if (!name || !name.trim()) return false;
    const trimmed = name.trim();
    if (!this.lotteryList.includes(trimmed)) {
      this.lotteryList.push(trimmed);
      this.saveLotteryList();
      return true;
    }
    return false;
  }

  deleteLotteryName(name) {
    if (!name) return false;
    this.lotteryList = this.lotteryList.filter(item => item !== name);
    if (this.lotteryList.length === 0) {
      this.lotteryList = ['ฮานอยพิเศษ'];
    }
    this.saveLotteryList();
    if (this.session.lotteryName === name) {
      this.session.lotteryName = this.lotteryList[0];
      this.saveSession();
    }
    return true;
  }

  loadSession() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_SESSION);
      return data ? { ...defaultSession, ...JSON.parse(data) } : { ...defaultSession };
    } catch (e) {
      return { ...defaultSession };
    }
  }

  saveSession() {
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(this.session));
  }

  loadRecentWebsites() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_RECENT_WEBSITES);
      return data ? JSON.parse(data) : ['lotterich', 'chudjen', 'huaydee', 'เว็ปหลัก'];
    } catch (e) {
      return ['lotterich', 'chudjen', 'huaydee', 'เว็ปหลัก'];
    }
  }

  saveRecentWebsites(siteName) {
    if (!siteName) return;
    const trimmed = siteName.trim();
    if (!this.recentWebsites.includes(trimmed)) {
      this.recentWebsites.unshift(trimmed);
      if (this.recentWebsites.length > 8) this.recentWebsites.pop();
      localStorage.setItem(STORAGE_KEY_RECENT_WEBSITES, JSON.stringify(this.recentWebsites));
    }
  }

  // Add new number batch
  addBatch({ website, type, numbers, badgeText = '' }) {
    if (!numbers || numbers.length === 0) return null;

    let typeName = '3 ตัวบน';
    if (type === '2on') typeName = '2 ตัวบน';
    else if (type === '2under') typeName = '2 ตัวล่าง';
    else if (type === '3tod') typeName = '3 ตัวโต๊ด';

    const id = 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const site = (website && website.trim()) ? website.trim() : 'เว็ปหลัก';

    this.saveRecentWebsites(site);

    const batch = {
      id,
      website: site,
      type,
      typeName,
      numbers: [...numbers].sort((a, b) => a.localeCompare(b)),
      badgeText: badgeText || `ตัดยอด`,
      count: numbers.length,
      createdAt: new Date().toISOString()
    };

    // If a batch for this website and type already exists, merge numbers or add new?
    // Let's check if user wants to replace or add to existing website:
    const existingIndex = this.session.batches.findIndex(b => b.website.toLowerCase() === site.toLowerCase() && b.type === type);
    if (existingIndex !== -1) {
      // Merge unique numbers
      const combined = Array.from(new Set([...this.session.batches[existingIndex].numbers, ...batch.numbers])).sort((a, b) => a.localeCompare(b));
      this.session.batches[existingIndex].numbers = combined;
      this.session.batches[existingIndex].count = combined.length;
      this.session.batches[existingIndex].createdAt = new Date().toISOString();
      if (badgeText) this.session.batches[existingIndex].badgeText = badgeText;
      this.saveSession();
      return this.session.batches[existingIndex];
    } else {
      this.session.batches.push(batch);
      this.saveSession();
      return batch;
    }
  }

  // Delete a specific batch
  deleteBatch(batchId) {
    this.session.batches = this.session.batches.filter(b => b.id !== batchId);
    this.saveSession();
  }

  // Clear all data for current board
  clearAllBatches() {
    this.session.batches = [];
    this.saveSession();
  }

  // Get batches grouped by type (e.g. '3on', '2on')
  getBatchesByType(type) {
    return this.session.batches.filter(b => b.type === type);
  }

  // Get unique websites in session
  getWebsites() {
    const set = new Set();
    this.session.batches.forEach(b => set.add(b.website));
    return Array.from(set);
  }
}

window.LotteryStorage = LotteryStorage;
