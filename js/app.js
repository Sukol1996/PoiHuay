/**
 * Main Application Controller
 * ออกแบบเพื่อการจดโพยเฉพาะตัวเลข พร้อมระบุชื่อเว็ปกำกับ และชื่อหวย
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Core Services
  const storage = new LotteryStorage();
  const calculator = new LotteryCalculator(storage);

  if (window.lucide) lucide.createIcons();

  // State
  let activeTab = 'tab-input';
  let activeBoardFilter = 'all'; // 'all' | '3on' | '2on' | '2under'
  let searchDebounceTimer = null;

  // DOM Elements
  const headerLotterySelect = document.getElementById('headerLotterySelect');
  const headerDateInput = document.getElementById('headerDateInput');
  const inputWebsiteName = document.getElementById('inputWebsiteName');
  const inputBadgeText = document.getElementById('inputBadgeText');
  const selectNumberCategory = document.getElementById('selectNumberCategory');
  const chkDeduplicate = document.getElementById('chkDeduplicate');
  const rawNumbersInput = document.getElementById('rawNumbersInput');
  const liveCount3D = document.getElementById('liveCount3D');
  const liveCount2D = document.getElementById('liveCount2D');
  const liveCountTotal = document.getElementById('liveCountTotal');
  const liveCounterBadge = document.getElementById('liveCounterBadge');
  const boardContainer = document.getElementById('boardContainer');
  const boardSearchInput = document.getElementById('boardSearchInput');
  const boardWebsiteFilter = document.getElementById('boardWebsiteFilter');
  const boardColCountSelect = document.getElementById('boardColCountSelect');

  // Date input setup
  headerDateInput.value = storage.session.lotteryDate || new Date().toISOString().split('T')[0];
  document.getElementById('mobileDateText').textContent = storage.session.lotteryDate;

  // Render Lottery Dropdown
  function renderLotterySelectDropdown() {
    if (!storage.lotteryList || storage.lotteryList.length === 0) {
      storage.lotteryList = ['ฮานอยพิเศษ'];
    }

    if (!storage.lotteryList.includes(storage.session.lotteryName)) {
      storage.session.lotteryName = storage.lotteryList[0];
      storage.saveSession();
    }

    headerLotterySelect.innerHTML = storage.lotteryList.map(name => `
      <option value="${escapeHtml(name)}" ${name === storage.session.lotteryName ? 'selected' : ''}>
        ${escapeHtml(name)}
      </option>
    `).join('');

    document.getElementById('boardCurrentLotteryTitle').textContent = storage.session.lotteryName;
    document.getElementById('statLotteryName').textContent = storage.session.lotteryName;
    document.getElementById('mobileLotteryName').textContent = storage.session.lotteryName;
  }

  // Render Lottery Manager Modal List
  function renderLotteryManagerList() {
    const listEl = document.getElementById('lotteryManagerList');
    if (!listEl) return;

    if (storage.lotteryList.length === 0) {
      listEl.innerHTML = '<div class="p-4 text-center text-slate-400">ยังไม่มีรายชื่อหวย</div>';
      return;
    }

    listEl.innerHTML = storage.lotteryList.map(name => {
      const isCurrent = name === storage.session.lotteryName;
      return `
        <div class="flex items-center justify-between p-2.5 hover:bg-white transition ${isCurrent ? 'bg-emerald-50/80 font-bold' : ''}">
          <div class="flex items-center space-x-2">
            <span class="text-slate-800 text-xs">${escapeHtml(name)}</span>
            ${isCurrent ? '<span class="text-[10px] bg-emerald-600 text-white font-medium px-1.5 py-0.5 rounded">กำลังเลือก</span>' : ''}
          </div>
          <div class="flex items-center space-x-1.5">
            ${!isCurrent ? `
              <button class="btn-select-lottery text-[11px] text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100 font-semibold px-2 py-1 rounded transition" data-name="${escapeHtml(name)}">
                เลือกใช้นี้
              </button>
            ` : ''}
            <button class="btn-delete-lottery text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded transition" data-name="${escapeHtml(name)}" title="ลบชื่อหวยนี้">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach listeners in modal
    listEl.querySelectorAll('.btn-select-lottery').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name');
        storage.setSessionLottery(name, storage.session.lotteryDate);
        renderLotterySelectDropdown();
        renderLotteryManagerList();
        renderBoard();
        showToast(`สลับไปที่หวย "${name}" แล้ว`, 'info');
      });
    });

    listEl.querySelectorAll('.btn-delete-lottery').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name');
        if (confirm(`คุณต้องการลบชื่อหวย "${name}" ออกจากระบบใช่หรือไม่?`)) {
          storage.deleteLotteryName(name);
          renderLotterySelectDropdown();
          renderLotteryManagerList();
          renderBoard();
          showToast(`ลบชื่อหวย "${name}" เรียบร้อยแล้ว`, 'info');
        }
      });
    });

    if (window.lucide) lucide.createIcons();
  }

  // Header Lottery Select Change
  headerLotterySelect.addEventListener('change', (e) => {
    storage.setSessionLottery(e.target.value, storage.session.lotteryDate);
    renderLotterySelectDropdown();
    renderBoard();
  });

  // Open Lottery Manager Modal
  const modalLotteryManager = document.getElementById('modalLotteryManager');
  const inputNewLotteryName = document.getElementById('inputNewLotteryName');

  document.getElementById('btnOpenLotteryManager').addEventListener('click', () => {
    renderLotteryManagerList();
    modalLotteryManager.classList.remove('hidden');
    inputNewLotteryName.value = '';
    inputNewLotteryName.focus();
    if (window.lucide) lucide.createIcons();
  });

  function closeLotteryManagerModal() {
    modalLotteryManager.classList.add('hidden');
  }

  document.getElementById('btnCloseLotteryManager').addEventListener('click', closeLotteryManagerModal);
  document.getElementById('btnCloseLotteryManager2').addEventListener('click', closeLotteryManagerModal);

  // Add New Lottery Confirm
  function handleAddNewLottery() {
    const newName = inputNewLotteryName.value.trim();
    if (!newName) {
      showToast('กรุณากรอกชื่อหวยที่ต้องการเพิ่ม', 'warning');
      return;
    }

    const added = storage.addLotteryName(newName);
    if (!added) {
      showToast(`มีชื่อหวย "${newName}" ในระบบอยู่แล้ว`, 'warning');
      return;
    }

    // Auto select this newly added lottery
    storage.setSessionLottery(newName, storage.session.lotteryDate);

    inputNewLotteryName.value = '';
    renderLotterySelectDropdown();
    renderLotteryManagerList();
    renderBoard();
    showToast(`เพิ่มชื่อหวย "${newName}" และเลือกใช้งานเรียบร้อยแล้ว`, 'success');
  }

  document.getElementById('btnAddLotteryConfirm').addEventListener('click', handleAddNewLottery);
  inputNewLotteryName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNewLottery();
    }
  });

  // Reset to default lotteries
  document.getElementById('btnResetLotteries').addEventListener('click', () => {
    if (confirm('ต้องการคืนค่ารายชื่อหวยทั้งหมดเป็นค่าเริ่มต้นใช่หรือไม่?')) {
      storage.lotteryList = ['ฮานอยพิเศษ', 'ฮานอยปกติ', 'ฮานอย VIP', 'ลาวพัฒนา', 'หวยรัฐบาลไทย', 'ยี่กี', 'หวยหุ้น'];
      storage.saveLotteryList();
      renderLotterySelectDropdown();
      renderLotteryManagerList();
      renderBoard();
      showToast('คืนค่ารายชื่อหวยเริ่มต้นเรียบร้อยแล้ว', 'info');
    }
  });

  // Initial load for lottery dropdown
  renderLotterySelectDropdown();

  headerDateInput.addEventListener('change', (e) => {
    storage.setSessionLottery(storage.session.lotteryName, e.target.value);
    document.getElementById('mobileDateText').textContent = storage.session.lotteryDate;
    renderBoard();
  });

  // Tab Navigation Handling
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  function switchTab(tabId) {
    activeTab = tabId;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');

    document.querySelectorAll('.nav-tab').forEach(b => {
      if (b.getAttribute('data-tab') === tabId) {
        b.className = 'nav-tab flex items-center space-x-1.5 px-4 py-1.5 rounded-md text-white bg-emerald-900/80 shadow-sm border border-emerald-500/40';
      } else {
        b.className = 'nav-tab flex items-center space-x-1.5 px-4 py-1.5 rounded-md text-emerald-100 hover:text-white hover:bg-emerald-800/60 transition';
      }
    });

    if (tabId === 'tab-board') {
      renderBoard();
    }
    if (window.lucide) lucide.createIcons();
  }

  // Quick Preset Website Buttons
  document.querySelectorAll('.btn-preset-web').forEach(btn => {
    btn.addEventListener('click', () => {
      inputWebsiteName.value = btn.getAttribute('data-web');
      inputWebsiteName.focus();
    });
  });

  // Live Numbers Counter on Input
  rawNumbersInput.addEventListener('input', () => {
    updateLiveCount();
  });

  chkDeduplicate.addEventListener('change', () => {
    updateLiveCount();
  });

  selectNumberCategory.addEventListener('change', () => {
    updateLiveCount();
  });

  function updateLiveCount() {
    const text = rawNumbersInput.value;
    const mode = selectNumberCategory.value;
    const dedupe = chkDeduplicate.checked;

    const result = extractNumbersFromText(text, mode, dedupe);

    liveCount3D.textContent = result.numbers3D.length;
    liveCount2D.textContent = result.numbers2D.length;
    liveCountTotal.textContent = result.totalCount;
    liveCounterBadge.textContent = `ตรวจพบ: ${result.totalCount} ตัว`;
  }

  // Paste from clipboard button
  document.getElementById('btnPasteClipboard').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        rawNumbersInput.value = text;
        updateLiveCount();
        showToast('วางตัวเลขจากคลิปบอร์ดแล้ว', 'success');
      }
    } catch (err) {
      showToast('โปรดกด Ctrl+V เพื่อวางตัวเลขด้วยตัวเอง', 'warning');
    }
  });

  // Clear button
  document.getElementById('btnClearInput').addEventListener('click', () => {
    if (rawNumbersInput.value && !confirm('ต้องการล้างตัวเลขในกล่องหรือไม่?')) return;
    rawNumbersInput.value = '';
    updateLiveCount();
  });

  // Sample data: Hanoi Special with lotterich numbers
  function loadHanoiSample() {
    inputWebsiteName.value = 'lotterich';
    inputBadgeText.value = 'ตัดยอด 55';
    selectNumberCategory.value = 'auto';
    headerLotterySelect.value = 'ฮานอยพิเศษ';
    storage.session.lotteryName = 'ฮานอยพิเศษ';
    storage.saveSession();

    const sample3D = [
      '005', '006', '007', '033', '052', '070', '104', '206', '246', '301', '308', '327', '336', '339', '341', '357',
      '055', '071', '075', '077', '092', '112', '131', '132', '137', '196', '208', '217', '224', '232', '233', '244',
      '750', '781', '782', '783', '785', '717', '719', '731', '737', '745', '751', '757', '767', '770', '787', '788',
      '165', '170', '171', '175', '178', '182', '185', '189', '200', '202', '204', '205', '207', '214', '215', '221',
      '427', '431', '435', '436', '438', '444', '446', '448', '450', '454', '461', '462', '464', '470', '474', '484',
      '738', '740', '745', '750', '766', '700', '704', '706', '727', '774', '778', '798', '800', '804', '806', '808',
      '033', '046', '049', '054', '055', '057', '059', '062', '064', '068', '074', '078', '081', '084', '088', '093',
      '251', '257', '259', '264', '265', '266', '267', '270', '272', '273', '275', '286', '294', '330', '334', '335',
      '519', '522', '524', '534', '535', '543', '545', '555', '560', '568', '570', '571', '572', '579', '581', '584',
      '912', '917', '924', '934', '935', '941', '943', '946', '950', '954', '958', '965', '971', '973', '978', '981'
    ];

    const sample2D = [
      '27', '35', '57', '76', '83', '50', '65', '70', '08', '11', '00', '01', '77',
      '22', '41', '51', '49', '69', '18', '21', '26', '33', '54',
      '34', '38', '50', '86', '91', '73', '39', '76', '58', '82', '14', '30', '90'
    ];

    rawNumbersInput.value = sample3D.join(' ') + '\n\n' + sample2D.join(' ');
    updateLiveCount();
    showToast('โหลดตัวอย่างตัวเลข "ฮานอยพิเศษ (lotterich)" เรียบร้อย', 'info');
  }

  document.getElementById('btnSampleHanoi').addEventListener('click', loadHanoiSample);
  document.getElementById('btnQuickSample').addEventListener('click', () => {
    loadHanoiSample();
    document.getElementById('btnAddToBoard').click();
  });

  // Action: Add Numbers to Board
  document.getElementById('btnAddToBoard').addEventListener('click', () => {
    const text = rawNumbersInput.value.trim();
    if (!text) {
      showToast('กรุณาวางตัวเลขก่อนนำขึ้นกระดาน', 'warning');
      return;
    }

    const website = inputWebsiteName.value.trim() || 'เว็ปหลัก';
    const badgeText = inputBadgeText.value.trim() || 'ตัดยอด 55';
    const mode = selectNumberCategory.value;
    const dedupe = chkDeduplicate.checked;

    const result = extractNumbersFromText(text, mode, dedupe);

    if (result.totalCount === 0) {
      showToast('ไม่พบตัวเลข 2 หลัก หรือ 3 หลัก ในข้อความที่วาง', 'warning');
      return;
    }

    let addedBatches = 0;

    // Handle according to category
    if (mode === 'auto') {
      if (result.numbers3D.length > 0) {
        storage.addBatch({
          website,
          type: '3on',
          numbers: result.numbers3D,
          badgeText
        });
        addedBatches++;
      }
      if (result.numbers2D.length > 0) {
        storage.addBatch({
          website,
          type: '2on',
          numbers: result.numbers2D,
          badgeText
        });
        addedBatches++;
      }
    } else {
      // Explicit category
      const targetNumbers = (mode === '3on' || mode === '3tod') ? result.numbers3D : result.numbers2D;
      if (targetNumbers.length > 0) {
        storage.addBatch({
          website,
          type: mode,
          numbers: targetNumbers,
          badgeText
        });
        addedBatches++;
      } else {
        showToast(`ไม่พบตัวเลขที่ตรงกับหมวด ${mode}`, 'warning');
        return;
      }
    }

    showToast(`นำตัวเลขของเว็ป "${website}" ขึ้นกระดานเรียบร้อย (${result.totalCount} ตัว)`, 'success');

    // Reset input
    rawNumbersInput.value = '';
    updateLiveCount();
    updateDashboardStats();

    // Switch to board tab
    switchTab('tab-board');
  });

  // Update Top Stats
  function updateDashboardStats() {
    const websites = storage.getWebsites();
    const batches3on = storage.getBatchesByType('3on');
    const batches2on = storage.getBatchesByType('2on');

    const total3on = batches3on.reduce((s, b) => s + b.numbers.length, 0);
    const total2on = batches2on.reduce((s, b) => s + b.numbers.length, 0);

    document.getElementById('statLotteryName').textContent = storage.session.lotteryName;
    document.getElementById('statTotalWebsites').textContent = `${websites.length} เว็ป`;
    document.getElementById('statTotal3on').textContent = `${total3on} ตัว`;
    document.getElementById('statTotal2on').textContent = `${total2on} ตัว`;

    // Update website filter dropdown
    const currFilter = boardWebsiteFilter.value;
    boardWebsiteFilter.innerHTML = '<option value="">-- รวมทุกเว็ป --</option>' +
      websites.map(w => `<option value="${escapeHtml(w)}" ${w === currFilter ? 'selected' : ''}>${escapeHtml(w)}</option>`).join('');
  }

  // ==========================================
  // RENDER EXCEL BOARD (กระดานตัดเลข)
  // ==========================================
  function renderBoard() {
    updateDashboardStats();
    boardContainer.innerHTML = '';

    const selectedWebsite = boardWebsiteFilter.value || null;
    const colCount = parseInt(boardColCountSelect.value) || 10;
    const searchQuery = boardSearchInput.value.trim();

    const batches = storage.session.batches.filter(b => !selectedWebsite || b.website === selectedWebsite);

    if (batches.length === 0) {
      boardContainer.innerHTML = `
        <div class="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
          <i data-lucide="layout-grid" class="w-12 h-12 mx-auto text-slate-300"></i>
          <div class="font-bold text-slate-700 text-base">ยังไม่มีตัวเลขในกระดานของ "${escapeHtml(storage.session.lotteryName)}"</div>
          <p class="text-xs text-slate-500 max-w-md mx-auto">
            แต่ละหวยแยกชุดตัวเลขออกจากกันเป็นอิสระ สามารถไปที่แท็บ <b>"1. กล่องวางตัวเลข"</b> เพื่อวางตัวเลขของหวยนี้ได้ทันที
          </p>
          <div class="flex justify-center space-x-2 pt-2">
            <button id="btnGoToInput" class="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg transition inline-flex items-center space-x-1.5 shadow-sm">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
              <span>ไปที่กล่องวางตัวเลข</span>
            </button>
            <button id="btnEmptySample" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3.5 py-2 rounded-lg transition inline-flex items-center space-x-1">
              <i data-lucide="sparkles" class="w-4 h-4 text-amber-500"></i>
              <span>โหลดตัวอย่าง</span>
            </button>
          </div>
        </div>
      `;
      document.getElementById('btnGoToInput')?.addEventListener('click', () => {
        switchTab('tab-input');
      });
      document.getElementById('btnEmptySample')?.addEventListener('click', () => {
        loadHanoiSample();
        document.getElementById('btnAddToBoard').click();
      });
      if (window.lucide) lucide.createIcons();
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'space-y-8';

    // Categories to render
    const categories = [
      { type: '3on', title: '3 บน', cols: colCount },
      { type: '2on', title: '2 บน', cols: Math.min(colCount, 6) },
      { type: '2under', title: '2 ล่าง', cols: Math.min(colCount, 6) },
      { type: '3tod', title: '3 โต๊ด', cols: colCount }
    ];

    categories.forEach(cat => {
      if (activeBoardFilter !== 'all' && activeBoardFilter !== cat.type) return;

      const catBatches = batches.filter(b => b.type === cat.type);
      if (catBatches.length === 0) return;

      const secEl = createCategorySectionDOM({
        title: cat.title,
        type: cat.type,
        batches: catBatches,
        cols: cat.cols,
        searchQuery: searchQuery
      });
      wrapper.appendChild(secEl);
    });

    boardContainer.appendChild(wrapper);

    attachBoardEventListeners();
    if (window.lucide) lucide.createIcons();
  }

  /**
   * Builds category section containing multiple website tables side-by-side
   */
  function createCategorySectionDOM({ title, type, batches, cols, searchQuery }) {
    const sec = document.createElement('div');
    sec.className = 'bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4';

    const totalNumbersCount = batches.reduce((s, b) => s + b.numbers.length, 0);

    // Header
    sec.innerHTML = `
      <div class="flex items-center justify-between border-b border-slate-200 pb-2.5">
        <div class="flex items-center space-x-3">
          <h3 class="text-base font-black text-slate-800 flex items-center space-x-2">
            <span class="w-3.5 h-3.5 rounded-full bg-emerald-600"></span>
            <span>${title}</span>
          </h3>
          <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold font-num">
            รวม ${totalNumbersCount} ตัว (${batches.length} เว็ป)
          </span>
        </div>
      </div>
    `;

    // Tables Row (Side by side like in user's Excel sheet!)
    const tablesWrapper = document.createElement('div');
    tablesWrapper.className = 'flex flex-wrap items-start gap-6 overflow-x-auto pb-2';

    batches.forEach(b => {
      const grid = calculator.formatGridColumns(b.numbers, cols);
      const tableCard = createWebsiteTableDOM({
        batch: b,
        gridData: grid,
        title: title,
        searchQuery: searchQuery
      });
      tablesWrapper.appendChild(tableCard);
    });

    sec.appendChild(tablesWrapper);
    return sec;
  }

  /**
   * Builds individual Excel table for a website
   */
  function createWebsiteTableDOM({ batch, gridData, title, searchQuery }) {
    const card = document.createElement('div');
    card.className = 'inline-block border border-slate-300 rounded shadow-xs bg-white text-xs select-none';

    // Header: Website name cell (left) + Green badge cell (right)
    const headerColsLeft = Math.ceil(gridData.colCount / 2);
    const headerColsRight = Math.floor(gridData.colCount / 2);

    let theadHtml = `
      <thead>
        <tr class="bg-slate-50">
          <th colspan="${headerColsLeft}" class="text-left py-1.5 px-2 font-bold text-slate-800 border border-slate-300 tracking-wide">
            <div class="flex items-center space-x-1 group">
              <input type="text" 
                     value="${escapeHtml(batch.website)}" 
                     data-id="${batch.id}"
                     data-field="website"
                     class="input-batch-header-website font-black text-xs text-slate-800 bg-transparent hover:bg-white focus:bg-white px-1.5 py-0.5 rounded border border-transparent hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition w-full max-w-[150px]"
                     title="คลิกเพื่อแก้ไขชื่อเว็ป (บันทึกลง Supabase ทันที)">
              <button type="button" class="btn-open-edit-batch p-1 text-slate-400 hover:text-emerald-700 opacity-40 group-hover:opacity-100 transition" data-id="${batch.id}" title="แก้ไขชื่อเว็ป / ป้ายกำกับ">
                <i data-lucide="edit-2" class="w-3 h-3"></i>
              </button>
            </div>
          </th>
          <th colspan="${headerColsRight}" class="text-right py-1.5 px-2 border border-slate-300">
            <div class="flex items-center justify-end space-x-1 group">
              <input type="text" 
                     value="${escapeHtml(batch.badgeText || '30/3')}" 
                     data-id="${batch.id}"
                     data-field="badgeText"
                     class="input-batch-header-badge text-xs font-bold text-center bg-[#22c55e] text-white hover:bg-emerald-600 focus:bg-emerald-600 px-2.5 py-0.5 rounded border border-emerald-500 focus:border-white focus:ring-1 focus:ring-white outline-none transition w-auto max-w-[120px] shadow-sm cursor-text"
                     title="คลิกเพื่อแก้ไขป้ายกำกับ เช่น 30/3, 40/4 (บันทึกลง Supabase ทันที)">
            </div>
          </th>
        </tr>
      </thead>
    `;

    // Rows
    let tbodyHtml = '<tbody class="divide-y divide-slate-200">';
    const rowsPerChunk = Math.max(1, Math.round(50 / gridData.colCount));

    gridData.rows.forEach((row, rowIndex) => {
      const isDivider = ((rowIndex + 1) % rowsPerChunk === 0) && (rowIndex < gridData.rows.length - 1);
      const rowClass = isDivider ? 'chunk-divider-row' : '';
      tbodyHtml += `<tr class="${rowClass}">`;
      row.forEach(cell => {
        if (!cell) {
          tbodyHtml += '<td class="border border-slate-300 bg-slate-50/40 p-1"></td>';
        } else {
          const isMatched = searchQuery && cell.includes(searchQuery);
          tbodyHtml += `
            <td class="excel-cell font-num border border-slate-300 ${isMatched ? 'highlight-search' : ''}" data-number="${cell}" ${isDivider ? 'title="เส้นแบ่งชุดละ 50 ตัว"' : ''}>
              <div class="font-bold text-slate-900 tracking-wider">${cell}</div>
            </td>
          `;
        }
      });
      tbodyHtml += '</tr>';
    });
    tbodyHtml += '</tbody>';

    // Footer with count and batch actions
    let tfootHtml = `
      <tfoot>
        <tr>
          <td colspan="${gridData.colCount}" class="excel-count-cell py-1.5 px-3">
            <div class="flex justify-between items-center text-xs">
              <div class="flex items-center space-x-1">
                <button class="btn-delete-web-batch text-slate-400 hover:text-rose-600 transition p-1 rounded hover:bg-rose-50" data-id="${batch.id}" title="ลบตารางนี้">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
                <button class="btn-open-edit-batch text-slate-400 hover:text-emerald-600 transition p-1 rounded hover:bg-emerald-50" data-id="${batch.id}" title="แก้ไขชื่อเว็ป และ ป้ายกำกับ 30/3">
                  <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                </button>
                <button class="btn-copy-batch-space text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-1.5 py-0.5 rounded transition flex items-center space-x-1 text-[11px] font-semibold border border-slate-200" data-id="${batch.id}" title="คัดลอกตัวเลขทั้งหมด คั่นด้วยวรรค (spacebar)">
                  <i data-lucide="copy" class="w-3 h-3 text-slate-500"></i>
                  <span>คัดลอกเลข</span>
                </button>
                <button class="btn-copy-batch-50 text-emerald-700 hover:bg-emerald-100 bg-emerald-50 px-1.5 py-0.5 rounded transition flex items-center space-x-1 text-[11px] font-bold border border-emerald-200" data-id="${batch.id}" title="คัดลอกตัวเลขโดยเว้นบรรทัดคั่นทุกๆ 50 ตัว">
                  <i data-lucide="copy-check" class="w-3 h-3 text-emerald-600"></i>
                  <span>คั่น 50 ตัว</span>
                </button>
                <button class="btn-open-batch-chunks-50 text-amber-700 hover:bg-amber-100 bg-amber-50 px-1.5 py-0.5 rounded transition flex items-center space-x-1 text-[11px] font-bold border border-amber-200" data-id="${batch.id}" title="เปิดดูและคัดลอกแยกทีละชุด ชุดละ 50 ตัว">
                  <i data-lucide="layers" class="w-3 h-3 text-amber-600"></i>
                  <span>แบ่งชุด 50</span>
                </button>
              </div>
              <div class="flex items-center space-x-1.5 ml-2">
                <span class="text-slate-500 font-semibold">count</span>
                <span class="font-black text-slate-800 font-num text-sm">${gridData.totalCount}</span>
              </div>
            </div>
          </td>
        </tr>
      </tfoot>
    `;

    const table = document.createElement('table');
    table.className = 'excel-table';
    table.innerHTML = theadHtml + tbodyHtml + tfootHtml;

    card.appendChild(table);
    return card;
  }

  function attachBoardEventListeners() {
    // Delete individual website batch
    document.querySelectorAll('.btn-delete-web-batch').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (confirm('ต้องการลบตารางของเว็ปนี้ใช่หรือไม่?')) {
          storage.deleteBatch(id);
          renderBoard();
          updateDashboardStats();
          showToast('ลบตารางเรียบร้อยแล้ว', 'info');
        }
      });
    });

    // Open Edit Batch Modal
    document.querySelectorAll('.btn-open-edit-batch').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const batch = storage.session.batches.find(b => b.id === id);
        if (batch) {
          openEditBatchModal(batch);
        }
      });
    });

    // Copy single batch numbers joined with spacebar (เช่น 212 231 254)
    document.querySelectorAll('.btn-copy-batch-space').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const batch = storage.session.batches.find(b => b.id === id);
        if (batch && Array.isArray(batch.numbers) && batch.numbers.length > 0) {
          const spaceText = batch.numbers.join(' ');
          navigator.clipboard.writeText(spaceText).then(() => {
            showToast(`คัดลอกตัวเลขเว็ป "${escapeHtml(batch.website)}" (${batch.numbers.length} ตัว คั่นด้วย spacebar) เรียบร้อย!`, 'success');
          });
        } else {
          showToast('ไม่มีตัวเลขในตารางนี้สำหรับคัดลอก', 'warning');
        }
      });
    });

    // Copy single batch numbers chunked by 50 (เว้นบรรทัดทุกๆ 50 ตัว)
    document.querySelectorAll('.btn-copy-batch-50').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const batch = storage.session.batches.find(b => b.id === id);
        if (batch && Array.isArray(batch.numbers) && batch.numbers.length > 0) {
          const chunkedText = calculator.formatNumbersChunked(batch.numbers, 50, '\n\n');
          const chunkCount = Math.ceil(batch.numbers.length / 50);
          navigator.clipboard.writeText(chunkedText).then(() => {
            showToast(`คัดลอกตัวเลขเว็ป "${escapeHtml(batch.website)}" (${batch.numbers.length} ตัว แบ่ง ${chunkCount} ชุด คั่นทุก 50 ตัว) เรียบร้อย!`, 'success');
          });
        } else {
          showToast('ไม่มีตัวเลขในตารางนี้สำหรับคัดลอก', 'warning');
        }
      });
    });

    // Open Chunks 50 modal for single batch
    document.querySelectorAll('.btn-open-batch-chunks-50').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const batch = storage.session.batches.find(b => b.id === id);
        if (batch && Array.isArray(batch.numbers) && batch.numbers.length > 0) {
          openChunk50Modal({
            title: `ชุดตัวเลข: ${batch.website} (${batch.typeName || batch.type})`,
            subtitle: `หวย: ${storage.session.lotteryName} | เว็ป: ${batch.website} | ป้าย: ${batch.badgeText || '30/3'} | รวม ${batch.numbers.length} ตัว`,
            numbers: batch.numbers,
            colCount: parseInt(boardColCountSelect.value, 10) || 10
          });
        } else {
          showToast('ไม่มีตัวเลขในตารางนี้สำหรับแบ่งชุด', 'warning');
        }
      });
    });

    // Inline edit website name
    document.querySelectorAll('.input-batch-header-website').forEach(input => {
      let initialVal = input.value.trim();

      const commitChange = () => {
        const newVal = input.value.trim() || 'เว็ปหลัก';
        if (newVal !== initialVal) {
          const id = input.getAttribute('data-id');
          storage.updateBatch(id, { website: newVal });
          initialVal = newVal;
          updateDashboardStats();
          showToast(`☁️ อัปเดตชื่อเว็ปเป็น "${newVal}" และบันทึกลง Supabase แล้ว`, 'success');
        }
      };

      input.addEventListener('blur', commitChange);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
        }
      });
    });

    // Inline edit badge text (เช่น 30/3, 40/4)
    document.querySelectorAll('.input-batch-header-badge').forEach(input => {
      let initialVal = input.value.trim();

      const commitChange = () => {
        const newVal = input.value.trim() || 'ตัดยอด';
        if (newVal !== initialVal) {
          const id = input.getAttribute('data-id');
          storage.updateBatch(id, { badgeText: newVal });
          initialVal = newVal;
          showToast(`☁️ อัปเดตป้ายกำกับเป็น "${newVal}" และบันทึกลง Supabase แล้ว`, 'success');
        }
      };

      input.addEventListener('blur', commitChange);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
        }
      });
    });

    // Click number cell to copy
    document.querySelectorAll('.excel-cell[data-number]').forEach(cell => {
      cell.addEventListener('click', () => {
        const num = cell.getAttribute('data-number');
        navigator.clipboard.writeText(num).then(() => {
          showToast(`คัดลอกเลข "${num}" แล้ว`, 'info');
        });
      });
    });
  }

  // Filter Sub-tabs in Board
  document.querySelectorAll('.board-type-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.board-type-tab').forEach(b => {
        b.className = 'board-type-tab px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700';
      });
      btn.className = 'board-type-tab px-3 py-1 rounded bg-emerald-600 text-white font-medium';
      activeBoardFilter = btn.getAttribute('data-board-type');
      renderBoard();
    });
  });

  // Board Filter Controls
  boardWebsiteFilter.addEventListener('change', () => renderBoard());
  boardColCountSelect.addEventListener('change', () => renderBoard());

  // Search Input Debounce
  boardSearchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      renderBoard();
    }, 200);
  });

  // Copy Entire Excel Board to Clipboard (TSV format)
  document.getElementById('btnCopyExcelBoard').addEventListener('click', () => {
    const batches = storage.session.batches.filter(b => !boardWebsiteFilter.value || b.website === boardWebsiteFilter.value);
    const colCount = parseInt(boardColCountSelect.value) || 10;

    if (batches.length === 0) {
      showToast('ไม่มีข้อมูลในกระดานสำหรับคัดลอก', 'warning');
      return;
    }

    let fullTsv = `หวย: ${storage.session.lotteryName} | วันที่: ${storage.session.lotteryDate}\n\n`;

    batches.forEach(b => {
      const grid = calculator.formatGridColumns(b.numbers, colCount);
      fullTsv += calculator.gridToExcelClipboard(grid, b.typeName, b.website) + '\n';
    });

    navigator.clipboard.writeText(fullTsv).then(() => {
      showToast('คัดลอกตารางทั้งหมดเรียบร้อย! สามารถกดวาง (Ctrl+V) ใน Excel ได้ทันที', 'success');
    });
  });

  // Copy All Numbers on Board joined with Spacebar (เช่น 212 231 254)
  document.getElementById('btnCopySpaceNumbers')?.addEventListener('click', () => {
    let batches = storage.session.batches.filter(b => !boardWebsiteFilter.value || b.website === boardWebsiteFilter.value);
    if (activeBoardFilter && activeBoardFilter !== 'all') {
      batches = batches.filter(b => b.type === activeBoardFilter);
    }

    if (batches.length === 0) {
      showToast('ไม่มีตัวเลขในกระดานสำหรับคัดลอก', 'warning');
      return;
    }

    const allNumbers = [];
    batches.forEach(b => {
      if (Array.isArray(b.numbers)) {
        allNumbers.push(...b.numbers);
      }
    });

    if (allNumbers.length === 0) {
      showToast('ไม่มีตัวเลขในกระดานสำหรับคัดลอก', 'warning');
      return;
    }

    const spaceSeparated = allNumbers.join(' ');
    navigator.clipboard.writeText(spaceSeparated).then(() => {
      showToast(`คัดลอกตัวเลขทั้งหมด ${allNumbers.length} ตัว (คั่นด้วย spacebar) เรียบร้อย!`, 'success');
    });
  });

  // Copy All Numbers on Board Chunked by 50 (คั่นขึ้นบรรทัดใหม่ทุกๆ 50 ตัว)
  document.getElementById('btnCopy50Numbers')?.addEventListener('click', () => {
    let batches = storage.session.batches.filter(b => !boardWebsiteFilter.value || b.website === boardWebsiteFilter.value);
    if (activeBoardFilter && activeBoardFilter !== 'all') {
      batches = batches.filter(b => b.type === activeBoardFilter);
    }

    if (batches.length === 0) {
      showToast('ไม่มีตัวเลขในกระดานสำหรับคัดลอก', 'warning');
      return;
    }

    const allNumbers = [];
    batches.forEach(b => {
      if (Array.isArray(b.numbers)) {
        allNumbers.push(...b.numbers);
      }
    });

    if (allNumbers.length === 0) {
      showToast('ไม่มีตัวเลขในกระดานสำหรับคัดลอก', 'warning');
      return;
    }

    const chunkedText = calculator.formatNumbersChunked(allNumbers, 50, '\n\n');
    const chunkCount = Math.ceil(allNumbers.length / 50);
    navigator.clipboard.writeText(chunkedText).then(() => {
      showToast(`คัดลอกตัวเลขทั้งหมด ${allNumbers.length} ตัว (แบ่ง ${chunkCount} ชุด คั่นทุก 50 ตัว) เรียบร้อย!`, 'success');
    });
  });

  // Open Modal to Copy 50 Numbers Chunk by Chunk from Toolbar
  document.getElementById('btnOpenChunk50Modal')?.addEventListener('click', () => {
    let batches = storage.session.batches.filter(b => !boardWebsiteFilter.value || b.website === boardWebsiteFilter.value);
    if (activeBoardFilter && activeBoardFilter !== 'all') {
      batches = batches.filter(b => b.type === activeBoardFilter);
    }

    if (batches.length === 0) {
      showToast('ไม่มีตัวเลขในกระดานสำหรับแบ่งชุด', 'warning');
      return;
    }

    const allNumbers = [];
    batches.forEach(b => {
      if (Array.isArray(b.numbers)) {
        allNumbers.push(...b.numbers);
      }
    });

    if (allNumbers.length === 0) {
      showToast('ไม่มีตัวเลขในกระดานสำหรับแบ่งชุด', 'warning');
      return;
    }

    openChunk50Modal({
      title: `แบ่งชุดตัวเลขกระดานตัดเลข (รวมทุกเว็ปที่เลือก)`,
      subtitle: `หวย: ${storage.session.lotteryName} | วันที่: ${storage.session.lotteryDate} | รวม ${allNumbers.length} ตัว`,
      numbers: allNumbers,
      colCount: parseInt(boardColCountSelect.value, 10) || 10
    });
  });

  // Print Board
  document.getElementById('btnPrintBoard').addEventListener('click', () => {
    window.print();
  });

  // Clear Board Button
  document.getElementById('btnClearBoardData').addEventListener('click', () => {
    if (confirm('คุณต้องการล้างข้อมูลกระดานทั้งหมดใช่หรือไม่?')) {
      storage.clearAllBatches();
      renderBoard();
      updateDashboardStats();
      showToast('ล้างกระดานเรียบร้อยแล้ว', 'info');
    }
  });

  // ==========================================
  // Edit Batch Header Modal Logic (แก้ไขชื่อเว็ป และ 30/3)
  // ==========================================
  const modalEditBatch = document.getElementById('modalEditBatch');
  const editBatchId = document.getElementById('editBatchId');
  const editBatchWebsite = document.getElementById('editBatchWebsite');
  const editBatchBadgeText = document.getElementById('editBatchBadgeText');

  function openEditBatchModal(batch) {
    if (!batch || !modalEditBatch) return;
    editBatchId.value = batch.id;
    editBatchWebsite.value = batch.website || '';
    editBatchBadgeText.value = batch.badgeText || '30/3';
    modalEditBatch.classList.remove('hidden');
    editBatchWebsite.focus();
    if (window.lucide) lucide.createIcons();
  }

  function closeEditBatchModal() {
    if (modalEditBatch) modalEditBatch.classList.add('hidden');
  }

  document.getElementById('btnCloseEditBatchModal')?.addEventListener('click', closeEditBatchModal);
  document.getElementById('btnCloseEditBatchModal2')?.addEventListener('click', closeEditBatchModal);

  document.getElementById('btnSaveEditBatch')?.addEventListener('click', () => {
    const id = editBatchId.value;
    const website = editBatchWebsite.value.trim() || 'เว็ปหลัก';
    const badgeText = editBatchBadgeText.value.trim() || '30/3';

    if (!id) return;
    storage.updateBatch(id, { website, badgeText });
    closeEditBatchModal();
    renderBoard();
    updateDashboardStats();
    showToast(`☁️ บันทึกการแก้ไข (${website} / ${badgeText}) ลง Supabase เรียบร้อยแล้ว`, 'success');
  });

  editBatchWebsite?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btnSaveEditBatch')?.click();
    }
  });

  editBatchBadgeText?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btnSaveEditBatch')?.click();
    }
  });

  // ==========================================
  // Modal Chunk 50 Numbers Logic (แบ่งชุดละ 50 ตัว)
  // ==========================================
  const modalChunk50 = document.getElementById('modalChunk50');
  const chunkModalSubtitle = document.getElementById('chunkModalSubtitle');
  const chunkListContainer = document.getElementById('chunkListContainer');
  const chunkSortModeSelect = document.getElementById('chunkSortModeSelect');
  const btnChunkCopyAllSeparated = document.getElementById('btnChunkCopyAllSeparated');

  let activeChunkData = null; // { title, subtitle, numbers, colCount }

  function openChunk50Modal(data) {
    if (!modalChunk50 || !data || !data.numbers || data.numbers.length === 0) return;
    activeChunkData = data;
    if (chunkModalSubtitle) {
      chunkModalSubtitle.textContent = data.subtitle || '';
    }
    renderChunk50List();
    modalChunk50.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  function closeChunk50Modal() {
    if (modalChunk50) modalChunk50.classList.add('hidden');
  }

  document.getElementById('btnCloseChunk50Modal')?.addEventListener('click', closeChunk50Modal);
  document.getElementById('btnCloseChunk50Modal2')?.addEventListener('click', closeChunk50Modal);

  function renderChunk50List() {
    if (!activeChunkData || !chunkListContainer) return;
    const { numbers, colCount = 10 } = activeChunkData;
    const mode = chunkSortModeSelect ? chunkSortModeSelect.value : 'sorted';

    let chunks = [];
    if (mode === 'grid') {
      const grid = calculator.formatGridColumns(numbers, colCount);
      const rowsPerChunk = Math.max(1, Math.round(50 / colCount));
      chunks = calculator.chunkGridByRows(grid, rowsPerChunk);
    } else {
      // Default: sorted sequentially
      const sorted = [...numbers].sort((a, b) => a.localeCompare(b));
      chunks = calculator.chunkNumbers(sorted, 50);
    }

    if (chunks.length === 0) {
      chunkListContainer.innerHTML = '<div class="text-center text-slate-400 py-6">ไม่มีตัวเลข</div>';
      return;
    }

    let html = '';
    let startIdx = 1;

    chunks.forEach((chunk, index) => {
      const count = chunk.length;
      const endIdx = startIdx + count - 1;
      const chunkText = chunk.join(' ');

      html += `
        <div class="border border-slate-200 rounded-xl p-3.5 bg-white hover:border-emerald-300 transition shadow-xs">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div class="flex items-center space-x-2">
              <span class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center font-num">${index + 1}</span>
              <span class="font-bold text-slate-800 text-xs">ชุดที่ ${index + 1} (ตัวที่ ${startIdx} - ${endIdx})</span>
              <span class="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full font-num">${count} ตัว</span>
            </div>
            <button class="btn-copy-individual-chunk inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs font-bold transition shadow-xs" data-chunk-index="${index}">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
              <span>คัดลอกชุดที่ ${index + 1}</span>
            </button>
          </div>
          <div class="p-2.5 bg-slate-50 rounded-lg border border-slate-100 font-num text-xs text-slate-700 tracking-wider font-semibold leading-relaxed break-words select-all max-h-24 overflow-y-auto">
            ${chunkText}
          </div>
        </div>
      `;

      startIdx += count;
    });

    chunkListContainer.innerHTML = html;

    // Attach click events for individual chunk copy buttons
    chunkListContainer.querySelectorAll('.btn-copy-individual-chunk').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-chunk-index'), 10);
        const targetChunk = chunks[idx];
        if (targetChunk && targetChunk.length > 0) {
          const text = targetChunk.join(' ');
          navigator.clipboard.writeText(text).then(() => {
            const originalHtml = btn.innerHTML;
            btn.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
            btn.classList.add('bg-emerald-800');
            btn.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5"></i><span>✓ คัดลอกแล้ว</span>`;
            if (window.lucide) lucide.createIcons();

            showToast(`คัดลอกชุดที่ ${idx + 1} (${targetChunk.length} ตัว) แล้ว! สามารถวางในเว็บแทงหวยได้ทันที`, 'success');

            setTimeout(() => {
              btn.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
              btn.classList.remove('bg-emerald-800');
              btn.innerHTML = originalHtml;
              if (window.lucide) lucide.createIcons();
            }, 2500);
          });
        }
      });
    });

    if (window.lucide) lucide.createIcons();
  }

  // Handle Sort Mode Change in Modal
  chunkSortModeSelect?.addEventListener('change', () => {
    renderChunk50List();
  });

  // Handle Copy All Separated Button in Modal
  btnChunkCopyAllSeparated?.addEventListener('click', () => {
    if (!activeChunkData || !activeChunkData.numbers) return;
    const { numbers, colCount = 10 } = activeChunkData;
    const mode = chunkSortModeSelect ? chunkSortModeSelect.value : 'sorted';

    let chunks = [];
    if (mode === 'grid') {
      const grid = calculator.formatGridColumns(numbers, colCount);
      const rowsPerChunk = Math.max(1, Math.round(50 / colCount));
      chunks = calculator.chunkGridByRows(grid, rowsPerChunk);
    } else {
      const sorted = [...numbers].sort((a, b) => a.localeCompare(b));
      chunks = calculator.chunkNumbers(sorted, 50);
    }

    const fullChunkedText = chunks.map(c => c.join(' ')).join('\n\n');
    navigator.clipboard.writeText(fullChunkedText).then(() => {
      showToast(`คัดลอกทั้งหมด ${numbers.length} ตัว (แบ่ง ${chunks.length} ชุด คั่นบรรทัดทุก 50 ตัว) เรียบร้อย!`, 'success');
    });
  });

  // ==========================================
  // Supabase Modal & Cloud Integration
  // ==========================================
  const modalSupabaseConfig = document.getElementById('modalSupabaseConfig');
  const inputSupabaseUrl = document.getElementById('inputSupabaseUrl');
  const inputSupabaseAnonKey = document.getElementById('inputSupabaseAnonKey');
  const supabaseStatusDot = document.getElementById('supabaseStatusDot');
  const supabaseStatusLabel = document.getElementById('supabaseStatusLabel');
  const modalSupabaseStatusDot = document.getElementById('modalSupabaseStatusDot');
  const modalSupabaseStatusText = document.getElementById('modalSupabaseStatusText');
  const modalSupabaseBadge = document.getElementById('modalSupabaseBadge');

  function updateSupabaseStatusUI(isConnected, config) {
    const isConn = isConnected !== undefined ? isConnected : storage.isSupabaseConnected;
    const cfg = config || storage.supabaseConfig;

    const supabaseSyncBadge = document.getElementById('supabaseSyncBadge');

    if (isConn) {
      if (supabaseStatusDot) supabaseStatusDot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
      if (supabaseStatusLabel) supabaseStatusLabel.textContent = 'Supabase: ออนไลน์';
      if (supabaseSyncBadge) supabaseSyncBadge.classList.remove('opacity-40');
      if (modalSupabaseStatusDot) modalSupabaseStatusDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500';
      if (modalSupabaseStatusText) modalSupabaseStatusText.textContent = 'สถานะ: เชื่อมต่อฐานข้อมูลสำเร็จ (Online Cloud Sync)';
      if (modalSupabaseBadge) {
        modalSupabaseBadge.className = 'text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-100 text-emerald-700';
        modalSupabaseBadge.textContent = 'Cloud Active';
      }
    } else {
      if (supabaseStatusDot) supabaseStatusDot.className = 'w-2 h-2 rounded-full bg-slate-400';
      if (supabaseStatusLabel) supabaseStatusLabel.textContent = 'Supabase: ออฟไลน์';
      if (supabaseSyncBadge) supabaseSyncBadge.classList.add('opacity-40');
      if (modalSupabaseStatusDot) modalSupabaseStatusDot.className = 'w-2.5 h-2.5 rounded-full bg-slate-400';
      if (modalSupabaseStatusText) modalSupabaseStatusText.textContent = 'สถานะ: ยังไม่ได้เชื่อมต่อ (ใช้งานออฟไลน์)';
      if (modalSupabaseBadge) {
        modalSupabaseBadge.className = 'text-[10px] px-2 py-0.5 rounded font-semibold bg-slate-200 text-slate-600';
        modalSupabaseBadge.textContent = 'Local Only';
      }
    }

    if (inputSupabaseUrl && cfg && cfg.url) {
      inputSupabaseUrl.value = cfg.url;
    }
    if (inputSupabaseAnonKey && cfg && cfg.anonKey) {
      inputSupabaseAnonKey.value = cfg.anonKey;
    }
  }

  // Open Supabase Modal
  document.getElementById('btnOpenSupabaseModal')?.addEventListener('click', () => {
    updateSupabaseStatusUI();
    modalSupabaseConfig.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  });

  // Close Supabase Modal
  document.getElementById('btnCloseSupabaseModal')?.addEventListener('click', () => {
    modalSupabaseConfig.classList.add('hidden');
  });

  // Test Supabase Connection
  document.getElementById('btnTestSupabaseConnection')?.addEventListener('click', async () => {
    const url = inputSupabaseUrl.value.trim();
    const key = inputSupabaseAnonKey.value.trim();

    if (!url || !key) {
      showToast('กรุณากรอก Supabase URL และ Anon Key ให้ครบถ้วน', 'warning');
      return;
    }

    showToast('กำลังทดสอบการเชื่อมต่อกับ Supabase...', 'info');
    const result = await storage.testConnection(url, key);
    if (result.success) {
      showToast(result.message, 'success');
    } else {
      showToast(result.message, 'warning');
    }
  });

  // Save Supabase Configuration
  document.getElementById('btnSaveSupabaseConfig')?.addEventListener('click', async () => {
    const url = inputSupabaseUrl.value.trim();
    const key = inputSupabaseAnonKey.value.trim();

    if (!url || !key) {
      showToast('กรุณากรอก Supabase URL และ Anon Key ให้ครบถ้วน', 'warning');
      return;
    }

    showToast('กำลังบันทึกและเชื่อมต่อฐานข้อมูล...', 'info');
    storage.saveSupabaseConfig(url, key);

    const test = await storage.testConnection(url, key);
    if (test.success) {
      showToast('เชื่อมต่อและบันทึกการตั้งค่า Supabase เรียบร้อยแล้ว!', 'success');
      modalSupabaseConfig.classList.add('hidden');
      updateSupabaseStatusUI(true, { url, anonKey: key });
    } else {
      showToast(`บันทึกแล้ว แต่ทดสอบไม่ผ่าน: ${test.message}`, 'warning');
    }
  });

  // Disconnect Supabase
  document.getElementById('btnDisconnectSupabase')?.addEventListener('click', () => {
    if (confirm('คุณต้องการตัดการเชื่อมต่อกับ Supabase และกลับไปใช้ระบบออฟไลน์หรือไม่?')) {
      storage.clearSupabaseConfig();
      inputSupabaseUrl.value = '';
      inputSupabaseAnonKey.value = '';
      updateSupabaseStatusUI(false, { url: '', anonKey: '' });
      showToast('ตัดการเชื่อมต่อ Supabase แล้ว กลับสู่โหมดออฟไลน์', 'info');
    }
  });

  // Register Sync and Status listeners
  storage.onStatusChange((isConnected, config) => {
    updateSupabaseStatusUI(isConnected, config);
  });

  storage.onSync(() => {
    renderLotterySelectDropdown();
    renderBoard();
    updateDashboardStats();
    showToast('ซิงก์ข้อมูลล่าสุดจาก Supabase Cloud เรียบร้อย', 'info');
  });

  storage.onCloudSave((detail) => {
    if (detail.type === 'batch_save') {
      showToast(`☁️ บันทึกลง Supabase สำเร็จ: ${escapeHtml(detail.batch.website)} (${detail.batch.typeName})`, 'success');
    } else if (detail.type === 'batch_delete') {
      showToast('☁️ ลบข้อมูลใน Supabase เรียบร้อยแล้ว', 'info');
    } else if (detail.type === 'clear_batches') {
      showToast('☁️ ล้างข้อมูลกระดานใน Supabase เรียบร้อยแล้ว', 'info');
    } else if (detail.type === 'name_add') {
      showToast(`☁️ บันทึกชื่อหวย "${detail.name}" ลง Supabase เรียบร้อย`, 'success');
    } else if (detail.type === 'name_delete') {
      showToast(`☁️ ลบชื่อหวย "${detail.name}" ออกจาก Supabase แล้ว`, 'info');
    } else if (detail.type === 'sync_up') {
      showToast(`☁️ ซิงก์ข้อมูล ${detail.count} ตารางขึ้น Supabase สำเร็จ`, 'success');
    }
  });

  // Initialize Supabase Status Indicator
  updateSupabaseStatusUI();

  // Toast Notification Helper
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');

    let bg = 'bg-slate-800 text-white';
    let icon = 'info';
    if (type === 'success') {
      bg = 'bg-emerald-600 text-white';
      icon = 'check-circle';
    } else if (type === 'warning') {
      bg = 'bg-amber-600 text-white';
      icon = 'alert-triangle';
    }

    toast.className = `${bg} px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold flex items-center space-x-2 pointer-events-auto transform transition duration-300 translate-y-2 opacity-0`;
    toast.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i><span>${escapeHtml(message)}</span>`;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial Load
  updateDashboardStats();
});
