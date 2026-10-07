/**
 * Lottery Storage & Supabase Sync Engine
 * จัดการแยกข้อมูลตัวเลขของแต่ละหวยอย่างเป็นอิสระ (Each lottery has its own independent batches)
 * แต่ละหวยจะมีชุดตัวเลขของตัวเอง พร้อมบันทึกไปยัง Supabase Cloud Database แบบเรียลไทม์
 */

const STORAGE_KEY_SESSION = 'LOTTERY_NUMBERS_SESSION';
const STORAGE_KEY_BOARDS = 'LOTTERY_BOARDS_STORE';
const STORAGE_KEY_RECENT_WEBSITES = 'LOTTERY_RECENT_WEBSITES';
const STORAGE_KEY_LOTTERY_LIST = 'LOTTERY_NAMES_LIST';
const STORAGE_KEY_SUPABASE = 'LOTTERY_SUPABASE_CONFIG';

const defaultLotteryList = [
  'ฮานอยพิเศษ',
  'ฮานอยปกติ',
  'ฮานอย VIP',
  'ลาวพัฒนา',
  'หวยรัฐบาลไทย',
  'ยี่กี',
  'หวยหุ้น'
];

class LotteryStorage {
  constructor() {
    this._lotteryName = 'ฮานอยพิเศษ';
    this._lotteryDate = new Date().toISOString().split('T')[0];

    this.boardsData = this.loadAllBoardsData();
    this.recentWebsites = this.loadRecentWebsites();
    this.lotteryList = this.loadLocalLotteryList();
    this.supabaseConfig = this.loadSupabaseConfig();
    this.supabaseClient = null;
    this.isSupabaseConnected = false;
    this.syncListeners = [];
    this.statusListeners = [];
    this.cloudSaveListeners = [];
    this.realtimeChannel = null;

    // Load initial session state (active lottery and date)
    this.loadInitialSession();

    // Setup session proxy for 100% backward compatibility
    const self = this;
    this.session = {
      get lotteryName() { return self._lotteryName; },
      set lotteryName(val) { if (val) self._lotteryName = val.trim(); },
      get lotteryDate() { return self._lotteryDate; },
      set lotteryDate(val) { if (val) self._lotteryDate = val.trim(); },
      get batches() { return self.getBatchesFor(self._lotteryName, self._lotteryDate); },
      set batches(val) { self.setBatchesFor(self._lotteryName, self._lotteryDate, val); }
    };

    this.initSupabaseClient();
    this.ensureSupabaseReady();
  }

  // Generate unique isolated board key for each lottery and date
  getBoardKey(lotteryName = this._lotteryName, lotteryDate = this._lotteryDate) {
    return `${(lotteryName || 'ฮานอยพิเศษ').trim()}__${(lotteryDate || '').trim()}`;
  }

  // Get batches specifically for a lottery
  getBatchesFor(lotteryName, lotteryDate) {
    const key = this.getBoardKey(lotteryName, lotteryDate);
    if (!this.boardsData[key]) {
      this.boardsData[key] = [];
    }
    return this.boardsData[key];
  }

  // Set batches specifically for a lottery
  setBatchesFor(lotteryName, lotteryDate, batches) {
    const key = this.getBoardKey(lotteryName, lotteryDate);
    this.boardsData[key] = Array.isArray(batches) ? batches : [];
    this.saveAllBoardsData();
  }

  // Load all isolated boards from local storage
  loadAllBoardsData() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_BOARDS);
      if (data) {
        return JSON.parse(data) || {};
      }
      
      // Backward compatibility: migrate legacy single-session batches
      const legacySession = localStorage.getItem(STORAGE_KEY_SESSION);
      if (legacySession) {
        const parsed = JSON.parse(legacySession);
        if (parsed && parsed.batches && parsed.batches.length > 0) {
          const initLottery = parsed.lotteryName || 'ฮานอยพิเศษ';
          const initDate = parsed.lotteryDate || new Date().toISOString().split('T')[0];
          const legacyKey = `${initLottery.trim()}__${initDate.trim()}`;
          return { [legacyKey]: parsed.batches };
        }
      }
      return {};
    } catch (e) {
      return {};
    }
  }

  // Save all isolated boards to local storage
  saveAllBoardsData() {
    try {
      localStorage.setItem(STORAGE_KEY_BOARDS, JSON.stringify(this.boardsData));
      this.saveLocalSession();
    } catch (e) {
      console.warn('Error saving boards data:', e);
    }
  }

  loadInitialSession() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_SESSION);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.lotteryName) this._lotteryName = parsed.lotteryName;
        if (parsed.lotteryDate) this._lotteryDate = parsed.lotteryDate;
      }
    } catch (e) {}
  }

  // Poll for window.supabase CDN availability
  ensureSupabaseReady() {
    if (!window.supabase) {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (window.supabase) {
          clearInterval(interval);
          this.initSupabaseClient();
        } else if (attempts > 20) {
          clearInterval(interval);
        }
      }, 250);
    }
  }

  // ==========================================
  // Supabase Configuration Management
  // ==========================================
  loadSupabaseConfig() {
    if (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey) {
      return {
        url: window.SUPABASE_CONFIG.url.trim(),
        anonKey: window.SUPABASE_CONFIG.anonKey.trim()
      };
    }
    try {
      const data = localStorage.getItem(STORAGE_KEY_SUPABASE);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && (parsed.url || parsed.anonKey)) {
          return parsed;
        }
      }
    } catch (e) {}

    return {
      url: 'https://bqlwgvcrkwneismlkzhx.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxbHdndmNya3duZWlzbWxremh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNjAyMTksImV4cCI6MjEwNjkzNjIxOX0.3DLrAF-41jfosJF3Est1QYWjJM1xx0fa1ZZnRcMa19M'
    };
  }

  saveSupabaseConfig(url, anonKey) {
    this.supabaseConfig = { url: (url || '').trim(), anonKey: (anonKey || '').trim() };
    localStorage.setItem(STORAGE_KEY_SUPABASE, JSON.stringify(this.supabaseConfig));
    this.initSupabaseClient();
  }

  clearSupabaseConfig() {
    this.supabaseConfig = { url: '', anonKey: '' };
    localStorage.removeItem(STORAGE_KEY_SUPABASE);
    if (this.supabaseClient && this.realtimeChannel) {
      try { this.supabaseClient.removeChannel(this.realtimeChannel); } catch (e) {}
    }
    this.supabaseClient = null;
    this.isSupabaseConnected = false;
    this.notifyStatusChange();
  }

  async testConnection(url, anonKey) {
    if (!window.supabase) {
      return { success: false, message: 'ไลบรารี Supabase กำลังโหลด กรุณาลองใหม่อีกครั้ง' };
    }
    const cleanUrl = (url || '').trim();
    const cleanKey = (anonKey || '').trim();
    if (!cleanUrl || !cleanKey) {
      return { success: false, message: 'กรุณากรอกทั้ง Project URL และ Anon Key' };
    }

    try {
      const testClient = window.supabase.createClient(cleanUrl, cleanKey);
      const { data, error } = await testClient.from('lottery_names').select('name').limit(1);
      if (error) {
        return { success: false, message: `การเชื่อมต่อผิดพลาด: ${error.message}` };
      }
      return { success: true, message: 'เชื่อมต่อกับฐานข้อมูล Supabase สำเร็จเรียบร้อย!' };
    } catch (err) {
      return { success: false, message: `ไม่สามารถเชื่อมต่อได้: ${err.message}` };
    }
  }

  async initSupabaseClient() {
    if (window.supabase && this.supabaseConfig.url && this.supabaseConfig.anonKey) {
      try {
        this.supabaseClient = window.supabase.createClient(
          this.supabaseConfig.url,
          this.supabaseConfig.anonKey
        );
        const { error } = await this.supabaseClient.from('lottery_names').select('name').limit(1);
        if (error) {
          console.warn('Supabase test query warning:', error.message);
          this.isSupabaseConnected = false;
        } else {
          this.isSupabaseConnected = true;
          this.setupRealtimeSubscription();
          this.syncFromSupabase();
        }
      } catch (err) {
        console.error('Supabase init error:', err);
        this.isSupabaseConnected = false;
      }
    } else {
      this.supabaseClient = null;
      this.isSupabaseConnected = false;
    }
    this.notifyStatusChange();
  }

  setupRealtimeSubscription() {
    if (!this.supabaseClient) return;
    try {
      if (this.realtimeChannel) {
        this.supabaseClient.removeChannel(this.realtimeChannel);
      }
      this.realtimeChannel = this.supabaseClient
        .channel('poi_huay_live_sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'lottery_batches' },
          (payload) => {
            console.log('Realtime change from Supabase on lottery_batches:', payload.eventType);
            this.syncFromSupabase();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'lottery_names' },
          (payload) => {
            console.log('Realtime change from Supabase on lottery_names:', payload.eventType);
            this.syncFromSupabase();
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Realtime subscription error:', e);
    }
  }

  // Event Listeners
  onSync(callback) {
    if (typeof callback === 'function') {
      this.syncListeners.push(callback);
    }
  }

  notifySync() {
    this.syncListeners.forEach(cb => {
      try { cb(); } catch (e) { console.error(e); }
    });
  }

  onStatusChange(callback) {
    if (typeof callback === 'function') {
      this.statusListeners.push(callback);
    }
  }

  notifyStatusChange() {
    this.statusListeners.forEach(cb => {
      try { cb(this.isSupabaseConnected, this.supabaseConfig); } catch (e) { console.error(e); }
    });
  }

  onCloudSave(callback) {
    if (typeof callback === 'function') {
      this.cloudSaveListeners.push(callback);
    }
  }

  notifyCloudSave(detail) {
    this.cloudSaveListeners.forEach(cb => {
      try { cb(detail); } catch (e) { console.error(e); }
    });
  }

  // ==========================================
  // Cloud Sync (ดึงข้อมูลเฉพาะของหวยที่กำลังเลือก)
  // ==========================================
  async syncFromSupabase() {
    if (!this.supabaseClient || !this.isSupabaseConnected) return;

    const targetLottery = this._lotteryName;
    const targetDate = this._lotteryDate;
    const boardKey = this.getBoardKey(targetLottery, targetDate);

    try {
      // 1. Fetch Lottery Names
      const { data: names, error: errNames } = await this.supabaseClient
        .from('lottery_names')
        .select('name')
        .order('id', { ascending: true });

      if (!errNames && names && names.length > 0) {
        const cloudNames = names.map(n => n.name);
        const mergedNames = Array.from(new Set([...this.lotteryList, ...cloudNames]));
        this.lotteryList = mergedNames;
        this.saveLocalLotteryList();
      }

      // 2. Fetch Batches specifically for current lotteryName and lotteryDate
      const { data: batches, error: errBatches } = await this.supabaseClient
        .from('lottery_batches')
        .select('*')
        .eq('lottery_name', targetLottery)
        .eq('lottery_date', targetDate);

      if (!errBatches && batches) {
        // อัปเดตข้อมูลของหวยนี้โดยเฉพาะ ไม่ปนกับหวยอื่น
        this.boardsData[boardKey] = batches.map(b => ({
          id: b.id,
          lotteryName: b.lottery_name,
          lotteryDate: b.lottery_date,
          website: b.website,
          type: b.type,
          typeName: b.type_name,
          numbers: Array.isArray(b.numbers) ? b.numbers : JSON.parse(b.numbers || '[]'),
          badgeText: b.badge_text,
          count: b.count,
          createdAt: b.created_at
        }));
        this.saveAllBoardsData();
      }

      this.notifySync();
    } catch (e) {
      console.warn('Sync from Supabase failed, using local cache:', e);
    }
  }

  // เปลี่ยนชื่อหวยหรืองวดวันที่ (จะสลับชุดข้อมูลไปยังหวยนั้นทันที)
  setSessionLottery(lotteryName, lotteryDate) {
    if (lotteryName) this._lotteryName = lotteryName.trim();
    if (lotteryDate) this._lotteryDate = lotteryDate.trim();
    this.saveLocalSession();
    this.syncFromSupabase();
  }

  // ==========================================
  // Local Storage Helpers
  // ==========================================
  saveLocalSession() {
    try {
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify({
        lotteryName: this._lotteryName,
        lotteryDate: this._lotteryDate
      }));
    } catch (e) {}
  }

  saveSession() {
    this.saveLocalSession();
  }

  loadLocalLotteryList() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_LOTTERY_LIST);
      return data ? JSON.parse(data) : [...defaultLotteryList];
    } catch (e) {
      return [...defaultLotteryList];
    }
  }

  saveLocalLotteryList() {
    localStorage.setItem(STORAGE_KEY_LOTTERY_LIST, JSON.stringify(this.lotteryList));
  }

  saveLotteryList() {
    this.saveLocalLotteryList();
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

  // ==========================================
  // Lottery Names Management
  // ==========================================
  async addLotteryName(name) {
    if (!name || !name.trim()) return false;
    const trimmed = name.trim();
    if (!this.lotteryList.includes(trimmed)) {
      this.lotteryList.push(trimmed);
      this.saveLocalLotteryList();

      if (this.supabaseClient) {
        this.supabaseClient
          .from('lottery_names')
          .upsert([{ name: trimmed }])
          .then(({ error }) => {
            if (error) {
              console.warn('Supabase insert lottery_name error:', error.message);
            } else {
              this.isSupabaseConnected = true;
              this.notifyCloudSave({ type: 'name_add', name: trimmed });
            }
          })
          .catch(err => console.warn('Supabase insert lottery_name network error:', err));
      }
      return true;
    }
    return false;
  }

  async deleteLotteryName(name) {
    if (!name) return false;
    this.lotteryList = this.lotteryList.filter(item => item !== name);
    if (this.lotteryList.length === 0) {
      this.lotteryList = ['ฮานอยพิเศษ'];
    }
    this.saveLocalLotteryList();

    if (this._lotteryName === name) {
      this._lotteryName = this.lotteryList[0];
      this.saveLocalSession();
    }

    if (this.supabaseClient) {
      this.supabaseClient
        .from('lottery_names')
        .delete()
        .eq('name', name)
        .then(({ error }) => {
          if (error) {
            console.warn('Supabase delete lottery_name error:', error.message);
          } else {
            this.notifyCloudSave({ type: 'name_delete', name });
          }
        })
        .catch(err => console.warn('Supabase delete lottery_name network error:', err));
    }
    return true;
  }

  // ==========================================
  // Batch Numbers Management (แยกอิสระตามชื่อหวย)
  // ==========================================
  addBatch({ website, type, numbers, badgeText = '' }) {
    if (!numbers || numbers.length === 0) return null;

    let typeName = '3 ตัวบน';
    if (type === '2on') typeName = '2 ตัวบน';
    else if (type === '2under') typeName = '2 ตัวล่าง';
    else if (type === '3tod') typeName = '3 ตัวโต๊ด';

    const id = 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const site = (website && website.trim()) ? website.trim() : 'เว็ปหลัก';

    this.saveRecentWebsites(site);

    const lotName = this._lotteryName;
    const lotDate = this._lotteryDate;
    const boardKey = this.getBoardKey(lotName, lotDate);
    const currentBatches = this.getBatchesFor(lotName, lotDate);

    const batch = {
      id,
      lotteryName: lotName,
      lotteryDate: lotDate,
      website: site,
      type,
      typeName,
      numbers: [...numbers].sort((a, b) => a.localeCompare(b)),
      badgeText: badgeText || 'ตัดยอด',
      count: numbers.length,
      createdAt: new Date().toISOString()
    };

    const existingIndex = currentBatches.findIndex(
      b => b.website.toLowerCase() === site.toLowerCase() && b.type === type
    );

    let savedBatch = null;

    if (existingIndex !== -1) {
      const combined = Array.from(new Set([...currentBatches[existingIndex].numbers, ...batch.numbers])).sort((a, b) => a.localeCompare(b));
      currentBatches[existingIndex].numbers = combined;
      currentBatches[existingIndex].count = combined.length;
      currentBatches[existingIndex].createdAt = new Date().toISOString();
      if (badgeText) currentBatches[existingIndex].badgeText = badgeText;
      savedBatch = currentBatches[existingIndex];
    } else {
      currentBatches.push(batch);
      savedBatch = batch;
    }

    this.boardsData[boardKey] = currentBatches;
    this.saveAllBoardsData();

    // บันทึกลง Supabase เฉพาะของหวยนี้
    if (this.supabaseClient) {
      this.supabaseClient
        .from('lottery_batches')
        .upsert({
          id: savedBatch.id,
          lottery_name: lotName,
          lottery_date: lotDate,
          website: savedBatch.website,
          type: savedBatch.type,
          type_name: savedBatch.typeName,
          numbers: savedBatch.numbers,
          badge_text: savedBatch.badgeText,
          count: savedBatch.count,
          created_at: savedBatch.createdAt
        })
        .then(({ error }) => {
          if (error) {
            console.error('Supabase upsert batch error:', error.message);
          } else {
            this.isSupabaseConnected = true;
            this.notifyStatusChange();
            this.notifyCloudSave({ type: 'batch_save', batch: savedBatch });
          }
        })
        .catch(err => console.warn('Supabase upsert batch network error:', err));
    }

    return savedBatch;
  }

  // Update existing batch header (แก้ไขชื่อเว็ป หรือ ป้ายกำกับ 30/3, ตัดยอด)
  updateBatch(batchId, updates = {}) {
    const lotName = this._lotteryName;
    const lotDate = this._lotteryDate;
    const boardKey = this.getBoardKey(lotName, lotDate);
    const currentBatches = this.getBatchesFor(lotName, lotDate);

    const batch = currentBatches.find(b => b.id === batchId);
    if (!batch) return null;

    let hasChanges = false;

    if (updates.website !== undefined && updates.website.trim() && updates.website.trim() !== batch.website) {
      batch.website = updates.website.trim();
      this.saveRecentWebsites(batch.website);
      hasChanges = true;
    }

    if (updates.badgeText !== undefined && updates.badgeText.trim() !== batch.badgeText) {
      batch.badgeText = updates.badgeText.trim();
      hasChanges = true;
    }

    if (updates.numbers !== undefined && Array.isArray(updates.numbers)) {
      batch.numbers = [...updates.numbers].sort((a, b) => a.localeCompare(b));
      batch.count = batch.numbers.length;
      hasChanges = true;
    }

    if (!hasChanges) return batch;

    batch.updatedAt = new Date().toISOString();
    this.boardsData[boardKey] = currentBatches;
    this.saveAllBoardsData();

    // บันทึกการแก้ไขลง Supabase ทันที
    if (this.supabaseClient) {
      this.supabaseClient
        .from('lottery_batches')
        .update({
          website: batch.website,
          badge_text: batch.badgeText,
          numbers: batch.numbers,
          count: batch.count
        })
        .eq('id', batchId)
        .then(({ error }) => {
          if (error) {
            console.error('Supabase update batch error:', error.message);
          } else {
            this.isSupabaseConnected = true;
            this.notifyStatusChange();
            this.notifyCloudSave({ type: 'batch_update', batch });
          }
        })
        .catch(err => console.warn('Supabase update batch network error:', err));
    }

    return batch;
  }

  deleteBatch(batchId) {
    const lotName = this._lotteryName;
    const lotDate = this._lotteryDate;
    const boardKey = this.getBoardKey(lotName, lotDate);
    const currentBatches = this.getBatchesFor(lotName, lotDate);

    this.boardsData[boardKey] = currentBatches.filter(b => b.id !== batchId);
    this.saveAllBoardsData();

    // ลบออกจาก Supabase Cloud ทันที
    if (this.supabaseClient) {
      this.supabaseClient
        .from('lottery_batches')
        .delete()
        .eq('id', batchId)
        .then(({ error }) => {
          if (error) {
            console.error('Supabase delete batch error:', error.message);
          } else {
            this.notifyCloudSave({ type: 'batch_delete', batchId });
          }
        })
        .catch(err => console.warn('Supabase delete batch network error:', err));
    }
  }

  clearAllBatches() {
    const lotName = this._lotteryName;
    const lotDate = this._lotteryDate;
    const boardKey = this.getBoardKey(lotName, lotDate);

    this.boardsData[boardKey] = [];
    this.saveAllBoardsData();

    // ล้างเฉพาะข้อมูลของหวยนี้บน Supabase (หวยอื่นยังอยู่ครบ!)
    if (this.supabaseClient) {
      this.supabaseClient
        .from('lottery_batches')
        .delete()
        .eq('lottery_name', lotName)
        .eq('lottery_date', lotDate)
        .then(({ error }) => {
          if (error) {
            console.error('Supabase clear batches error:', error.message);
          } else {
            this.notifyCloudSave({ type: 'clear_batches', lotteryName: lotName, lotteryDate: lotDate });
          }
        })
        .catch(err => console.warn('Supabase clear batches network error:', err));
    }
  }

  getBatchesByType(type) {
    const currentBatches = this.getBatchesFor(this._lotteryName, this._lotteryDate);
    return currentBatches.filter(b => b.type === type);
  }

  getWebsites() {
    const set = new Set();
    const currentBatches = this.getBatchesFor(this._lotteryName, this._lotteryDate);
    currentBatches.forEach(b => set.add(b.website));
    return Array.from(set);
  }
}

window.LotteryStorage = LotteryStorage;
