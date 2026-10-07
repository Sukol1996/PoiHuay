/**
 * Lottery Storage & Supabase Sync Engine
 * จัดการบันทึกข้อมูลตัวเลขและชื่อหวย ทั้งใน LocalStorage และบันทึกไปยัง Supabase Cloud Database อัตโนมัติทุกครั้งที่มีการเปลี่ยนแปลง
 */

const STORAGE_KEY_SESSION = 'LOTTERY_NUMBERS_SESSION';
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

const defaultSession = {
  lotteryName: 'ฮานอยพิเศษ',
  lotteryDate: new Date().toISOString().split('T')[0],
  batches: []
};

class LotteryStorage {
  constructor() {
    this.session = this.loadLocalSession();
    this.recentWebsites = this.loadRecentWebsites();
    this.lotteryList = this.loadLocalLotteryList();
    this.supabaseConfig = this.loadSupabaseConfig();
    this.supabaseClient = null;
    this.isSupabaseConnected = false;
    this.syncListeners = [];
    this.statusListeners = [];
    this.cloudSaveListeners = [];
    this.realtimeChannel = null;

    this.initSupabaseClient();
    this.ensureSupabaseReady();
  }

  // Poll for window.supabase CDN availability if slightly delayed
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
    // 1. Check window.SUPABASE_CONFIG (Injected from Streamlit secrets)
    if (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey) {
      return {
        url: window.SUPABASE_CONFIG.url.trim(),
        anonKey: window.SUPABASE_CONFIG.anonKey.trim()
      };
    }
    // 2. Check localStorage
    try {
      const data = localStorage.getItem(STORAGE_KEY_SUPABASE);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && (parsed.url || parsed.anonKey)) {
          return parsed;
        }
      }
    } catch (e) {}

    // 3. Default connected Supabase credentials
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
        // Quick verification ping
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

  // Realtime updates from Supabase
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
        .subscribe((status) => {
          console.log('Supabase Realtime status:', status);
        });
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
  // Cloud Sync
  // ==========================================
  async syncFromSupabase() {
    if (!this.supabaseClient || !this.isSupabaseConnected) return;

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

      // 2. Fetch Batches for current lotteryName and lotteryDate
      const { data: batches, error: errBatches } = await this.supabaseClient
        .from('lottery_batches')
        .select('*')
        .eq('lottery_name', this.session.lotteryName)
        .eq('lottery_date', this.session.lotteryDate);

      if (!errBatches && batches) {
        if (batches.length > 0) {
          this.session.batches = batches.map(b => ({
            id: b.id,
            website: b.website,
            type: b.type,
            typeName: b.type_name,
            numbers: Array.isArray(b.numbers) ? b.numbers : JSON.parse(b.numbers || '[]'),
            badgeText: b.badge_text,
            count: b.count,
            createdAt: b.created_at
          }));
          this.saveLocalSession();
        } else if (this.session.batches && this.session.batches.length > 0) {
          // If Supabase table is empty for this date but local has batches, sync them UP to Supabase!
          this.syncAllLocalBatchesToSupabase();
        }
      }

      this.notifySync();
    } catch (e) {
      console.warn('Sync from Supabase failed, using local cache:', e);
    }
  }

  // Push all local batches to Supabase Cloud
  async syncAllLocalBatchesToSupabase() {
    if (!this.supabaseClient || !this.isSupabaseConnected || this.session.batches.length === 0) return;

    try {
      const rows = this.session.batches.map(b => ({
        id: b.id,
        lottery_name: this.session.lotteryName,
        lottery_date: this.session.lotteryDate,
        website: b.website,
        type: b.type,
        type_name: b.typeName,
        numbers: b.numbers,
        badge_text: b.badgeText,
        count: b.count,
        created_at: b.createdAt
      }));

      const { error } = await this.supabaseClient.from('lottery_batches').upsert(rows);
      if (!error) {
        console.log('Synced local batches up to Supabase Cloud:', rows.length);
        this.notifyCloudSave({ type: 'sync_up', count: rows.length });
      }
    } catch (e) {
      console.warn('Error syncing local batches up to Supabase:', e);
    }
  }

  setSessionLottery(lotteryName, lotteryDate) {
    if (lotteryName) this.session.lotteryName = lotteryName;
    if (lotteryDate) this.session.lotteryDate = lotteryDate;
    this.saveLocalSession();
    this.syncFromSupabase();
  }

  // ==========================================
  // Local Storage Helpers & Backward Compatibility
  // ==========================================
  loadLocalSession() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_SESSION);
      return data ? { ...defaultSession, ...JSON.parse(data) } : { ...defaultSession };
    } catch (e) {
      return { ...defaultSession };
    }
  }

  saveLocalSession() {
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(this.session));
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
  // Lottery Names Management (บันทึกขึ้น Supabase ทุกครั้ง)
  // ==========================================
  async addLotteryName(name) {
    if (!name || !name.trim()) return false;
    const trimmed = name.trim();
    if (!this.lotteryList.includes(trimmed)) {
      this.lotteryList.push(trimmed);
      this.saveLocalLotteryList();

      // บันทึกลง Supabase ทันที
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

    if (this.session.lotteryName === name) {
      this.session.lotteryName = this.lotteryList[0];
      this.saveLocalSession();
    }

    // ลบออกจาก Supabase ทันที
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
  // Batch Numbers Management (บันทึกขึ้น Supabase ทุกครั้ง)
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

    const existingIndex = this.session.batches.findIndex(
      b => b.website.toLowerCase() === site.toLowerCase() && b.type === type
    );

    let savedBatch = null;

    if (existingIndex !== -1) {
      const combined = Array.from(new Set([...this.session.batches[existingIndex].numbers, ...batch.numbers])).sort((a, b) => a.localeCompare(b));
      this.session.batches[existingIndex].numbers = combined;
      this.session.batches[existingIndex].count = combined.length;
      this.session.batches[existingIndex].createdAt = new Date().toISOString();
      if (badgeText) this.session.batches[existingIndex].badgeText = badgeText;
      savedBatch = this.session.batches[existingIndex];
    } else {
      this.session.batches.push(batch);
      savedBatch = batch;
    }

    this.saveLocalSession();

    // บันทึก/อัปเดตลง Supabase Cloud ทันทีทุกครั้ง
    if (this.supabaseClient) {
      this.supabaseClient
        .from('lottery_batches')
        .upsert({
          id: savedBatch.id,
          lottery_name: this.session.lotteryName,
          lottery_date: this.session.lotteryDate,
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

  deleteBatch(batchId) {
    this.session.batches = this.session.batches.filter(b => b.id !== batchId);
    this.saveLocalSession();

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
    const lotName = this.session.lotteryName;
    const lotDate = this.session.lotteryDate;

    this.session.batches = [];
    this.saveLocalSession();

    // ล้างข้อมูลใน Supabase Cloud ทันที
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
    return this.session.batches.filter(b => b.type === type);
  }

  getWebsites() {
    const set = new Set();
    this.session.batches.forEach(b => set.add(b.website));
    return Array.from(set);
  }
}

window.LotteryStorage = LotteryStorage;
