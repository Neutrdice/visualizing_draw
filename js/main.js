// 牌堆管理器主类
const deckManager = {
    decks: {},
    currentDeck: null,
    weightMode: false,
    probabilityChart: null,
    editMode: false,
    fullscreenJson: false,
    jsonOriginalStyles: null, // 用于保存全屏前的样式
    
    // 初始化
    init() {
        // 从localStorage加载数据
        this.loadFromLocalStorage();
        
        // 验证并修复数据结构
        this.validateAndFixDataStructure();
        
        // 如果没有保存的数据，使用示例数据
        if (Object.keys(this.decks).length === 0) {
            this.decks = {
                "示例牌堆": [
                    "牌面内容1",
                    "牌面内容2",
                    "牌面内容3",
                    "{示例牌堆} - 引用自身（不放回）",
                    "{%示例牌堆} - 引用自身（放回）"
                ],
                "_隐藏牌堆示例": [
                    "这个牌堆在抽取列表中会被隐藏",
                    "但仍然可以通过{_隐藏牌堆示例}引用它"
                ]
            };
        }
        
        this.currentDeck = Object.keys(this.decks)[0] || null;
        
        // 初始化界面
        this.renderDeckList();
        if (this.currentDeck) {
            this.loadDeck(this.currentDeck);
        } else {
            this.clearCardEditor();
        }
        this.updateJsonPreview();
        this.initProbabilityChart();
        this.updateDrawDeckSelector();
        
        // 添加隐藏牌堆按钮事件
    document.getElementById('toggleHiddenBtn').addEventListener('click', () => this.toggleHiddenState());
    
    // 添加牌堆列表事件委托（只绑定一次）
    const deckListElement = document.getElementById("deckList");
    deckListElement.addEventListener('click', (e) => this.handleDeckListClick(e));
    
    // 添加清除所有牌堆按钮事件
    document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAllDecks());

    // 添加抽取牌面按钮事件
    document.getElementById('drawCardBtn').addEventListener('click', () => this.drawCard());

    // 添加牌堆选择器变更事件
    document.getElementById('drawDeckSelector').addEventListener('change', () => this.drawCard());
    },
    
    // 添加牌堆列表点击处理方法
    handleDeckListClick(e) {
        const upBtn = e.target.closest('.move-deck-up-btn');
        const downBtn = e.target.closest('.move-deck-down-btn');

        if (upBtn) {
            e.stopPropagation();
            this.moveDeckUp(upBtn.dataset.deck);
        } else if (downBtn) {
            e.stopPropagation();
            this.moveDeckDown(downBtn.dataset.deck);
        }
    },
    
    // 验证并修复数据结构
    validateAndFixDataStructure() {
        if (typeof this.decks !== 'object' || this.decks === null || Array.isArray(this.decks)) {
            this.decks = {};
            return;
        }
        
        // 遍历所有牌堆，确保每个牌堆都是数组
        Object.keys(this.decks).forEach(deckName => {
            if (!Array.isArray(this.decks[deckName])) {
                if (this.decks[deckName] !== null && typeof this.decks[deckName] !== 'undefined') {
                    this.decks[deckName] = [String(this.decks[deckName])];
                } else {
                    this.decks[deckName] = [];
                }
                console.warn(`牌堆"${deckName}"数据格式错误，已自动修复`);
            }
        });
    },
    
    // 从localStorage加载数据
    loadFromLocalStorage() {
        try {
            const savedData = localStorage.getItem('deckEditorData');
            if (savedData) {
                this.decks = JSON.parse(savedData);
            }
        } catch (e) {
            console.error('加载保存的数据失败:', e);
            this.decks = {};
        }
    },
    
    // 保存数据到localStorage
    saveToLocalStorage() {
        try {
            localStorage.setItem('deckEditorData', JSON.stringify(this.decks));
        } catch (e) {
            console.error('保存数据失败:', e);
        }
    },
    
    // 创建新牌堆
    createNewDeck(name = "新牌堆") {
        let deckName = name;
        let counter = 1;
        while (this.decks.hasOwnProperty(deckName)) {
            deckName = `${name}(${counter})`;
            counter++;
        }
        
        this.decks[deckName] = [];
        this.currentDeck = deckName;
        
        this.renderDeckList();
        this.loadDeck(deckName);
        this.updateJsonPreview();
        this.updateDrawDeckSelector();
        this.saveToLocalStorage();
        
        return deckName;
    },
    
    // 删除当前牌堆
    deleteCurrentDeck() {
        if (!this.currentDeck) return;
        
        if (confirm("确定要删除牌堆\"" + this.currentDeck + "\"吗？")) {
            delete this.decks[this.currentDeck];
            const deckNames = Object.keys(this.decks);
            
            if (deckNames.length > 0) {
                this.currentDeck = deckNames[0];
                this.loadDeck(this.currentDeck);
            } else {
                this.currentDeck = null;
                this.clearCardEditor();
            }
            
            this.renderDeckList();
            this.updateJsonPreview();
            this.updateDrawDeckSelector();
            this.saveToLocalStorage();
        }
    },
    
    // 清除所有保存的牌堆
    clearAllDecks() {
        // 如果没有牌堆可清除，直接返回
        if (Object.keys(this.decks).length === 0) {
            this.showNotification("没有可清除的牌堆数据", "info");
            return;
        }
        
        // 创建中心弹窗进行二次确认
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 transform transition-all">
                <div class="text-center mb-4">
                    <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
                        <i class="fa fa-exclamation-triangle text-red-500 text-xl"></i>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-900">确认清除所有牌堆</h3>
                    <p class="text-gray-500 mt-2">此操作将删除所有保存的牌堆数据，且无法恢复。</p>
                </div>
                <div class="flex space-x-3 mt-6">
                    <button id="cancelClearBtn" class="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                        取消
                    </button>
                    <button id="confirmClearBtn" class="flex-1 px-4 py-2 bg-red-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-red-700">
                        确认清除
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 添加动画效果
        setTimeout(() => {
            modal.querySelector('div').classList.add('scale-100');
            modal.querySelector('div').classList.remove('scale-95');
        }, 10);
        
        // 取消按钮事件
        modal.querySelector('#cancelClearBtn').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // 确认按钮事件
        modal.querySelector('#confirmClearBtn').addEventListener('click', () => {
            // 清除所有牌堆数据
            this.decks = {};
            this.currentDeck = null;
            
            // 更新界面
            this.clearCardEditor();
            this.renderDeckList();
            this.updateJsonPreview();
            this.updateDrawDeckSelector();
            this.initProbabilityChart();
            
            // 清除本地存储
            localStorage.removeItem('deckEditorData');
            
            // 显示成功通知
            this.showNotification("所有牌堆数据已清除");
            
            // 移除弹窗
            document.body.removeChild(modal);
        });
        
        // 点击弹窗外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    },
    
    // 加载牌堆
    loadDeck(deckName) {
        if (!this.decks.hasOwnProperty(deckName)) return;
        
        if (!Array.isArray(this.decks[deckName])) {
            this.decks[deckName] = [];
        }
        
        this.currentDeck = deckName;
        document.getElementById("deckNameInput").value = deckName.replace(/^_/, "");
    
    // 更新隐藏按钮状态
    this.updateHiddenButtonState();
    
    this.updateCardCount();
        this.renderCards();
        this.updateProbabilityChart();
        this.renderDeckList();
    },
    // 上移牌堆
    moveDeckUp(deckName) {
        const deckNames = Object.keys(this.decks);
        const currentIndex = deckNames.indexOf(deckName);
        
        if (currentIndex > 0) {
            this.swapDecks(currentIndex, currentIndex - 1);
        }
    },

    // 下移牌堆
    moveDeckDown(deckName) {
        const deckNames = Object.keys(this.decks);
        const currentIndex = deckNames.indexOf(deckName);
        
        if (currentIndex < deckNames.length - 1) {
            this.swapDecks(currentIndex, currentIndex + 1);
        }
    },

    // 交换两个牌堆的位置
    swapDecks(index1, index2) {
        const deckNames = Object.keys(this.decks);
        
        // 创建新的牌堆名称顺序数组
        const newDeckNames = [...deckNames];
        [newDeckNames[index1], newDeckNames[index2]] = [newDeckNames[index2], newDeckNames[index1]];
        
        // 根据新顺序重建牌堆对象
        const newDecks = {};
        newDeckNames.forEach(name => {
            newDecks[name] = this.decks[name];
        });
        
        // 更新牌堆对象
        this.decks = newDecks;
        
        // 更新界面和数据
        this.renderDeckList();
        this.updateDrawDeckSelector();
        this.updateJsonPreview(); // 添加JSON预览更新
        this.saveToLocalStorage();
    },

// 更新隐藏按钮状态显示
updateHiddenButtonState() {
    const isHidden = this.currentDeck && this.currentDeck.startsWith("_");
    const btnElement = document.getElementById('toggleHiddenBtn');
    const textElement = document.getElementById('hiddenBtnText');
    
    // 添加安全检查
    if (!btnElement || !textElement) {
        console.error('隐藏牌堆按钮元素未找到');
        return;
    }
    
    if (isHidden) {
        btnElement.classList.remove('bg-gray-100', 'text-gray-600');
        btnElement.classList.add('bg-primary/10', 'text-primary');
        textElement.textContent = '显示牌堆';
    } else {
        btnElement.classList.remove('bg-primary/10', 'text-primary');
        btnElement.classList.add('bg-gray-100', 'text-gray-600');
        textElement.textContent = '隐藏牌堆';
    }
},

// 切换牌堆隐藏状态
    toggleHiddenState() {
        if (!this.currentDeck) return;
        
        const isCurrentlyHidden = this.currentDeck.startsWith("_");
        const baseName = isCurrentlyHidden ? this.currentDeck.substring(1) : this.currentDeck;
        const newName = isCurrentlyHidden ? baseName : "_" + baseName;
        
        // 获取当前所有牌堆名称及其顺序
        const deckNames = Object.keys(this.decks);
        const currentIndex = deckNames.indexOf(this.currentDeck);
        
        // 保存当前牌堆内容
        const deckContent = this.decks[this.currentDeck];
        
        // 删除旧名称牌堆
        delete this.decks[this.currentDeck];
        
        // 创建新的牌堆对象，保持原有顺序
        const newDecks = {};
        deckNames.forEach((name, index) => {
            if (index === currentIndex) {
                // 在原位置插入新名称的牌堆
                newDecks[newName] = deckContent;
            } else if (name !== this.currentDeck) {
                // 其他牌堆保持原顺序
                newDecks[name] = this.decks[name];
            }
        });
        
        // 更新牌堆对象和当前牌堆名称
        this.decks = newDecks;
        this.currentDeck = newName;
        
        // 更新界面
        document.getElementById("deckNameInput").value = baseName;
        this.updateHiddenButtonState();
        this.renderDeckList();
        this.updateDrawDeckSelector();
        this.updateJsonPreview();
        this.saveToLocalStorage();
    },

    // 更新牌堆名称
    updateDeckName(newName) {
        if (!this.currentDeck) return;
        
        const isHidden = this.currentDeck.startsWith("_");
    let normalizedName = newName.trim() || "未命名牌堆";
    
    // 保持原有的隐藏状态
    if (isHidden && !normalizedName.startsWith("_")) {
        normalizedName = "_" + normalizedName;
    }
        
        if (normalizedName !== this.currentDeck && this.decks.hasOwnProperty(normalizedName)) {
            alert("该牌堆名称已存在");
            return;
        }
        
        if (normalizedName !== this.currentDeck) {
            // 获取当前所有牌堆名称及顺序
            const deckNames = Object.keys(this.decks);
            const currentIndex = deckNames.indexOf(this.currentDeck);

            // 保存当前牌堆内容
            const deckContent = this.decks[this.currentDeck];

            // 删除旧名称牌堆
            delete this.decks[this.currentDeck];

            // 创建新的牌堆对象，保持原有顺序
            const newDecks = {};
            deckNames.forEach((name, index) => {
                if (index === currentIndex) {
                    newDecks[normalizedName] = deckContent;
                } else if (name !== this.currentDeck) {
                    newDecks[name] = this.decks[name];
                }
            });

            this.decks = newDecks;
            this.currentDeck = normalizedName;
            this.renderDeckList();
            this.updateDrawDeckSelector();
        }
        
        this.updateJsonPreview();
        this.saveToLocalStorage();
    },
    
    // 添加新牌面
    addCard(content = "", weight = "") {
        if (!this.currentDeck) return;
        
        if (!Array.isArray(this.decks[this.currentDeck])) {
            this.decks[this.currentDeck] = [];
        }
        
        let cardData = content;
        // 处理权重：格式为 ::权重::内容
        if (weight && weight !== "1") {
            cardData = "::" + weight + "::" + content;
        }
        
        this.decks[this.currentDeck].push(cardData);
        this.updateCardCount();
        this.renderCards();
        this.updateJsonPreview();
        this.updateProbabilityChart();
        this.saveToLocalStorage();
        
        // 自动聚焦到新添加的牌面
        const cardItems = document.querySelectorAll("#cardsEditor .card-item");
        if (cardItems.length > 0) {
            cardsEditor.scrollTop = cardsEditor.scrollHeight; // 滚动到底部
            setTimeout(() => {
                cardItems[cardItems.length - 1].querySelector("textarea").focus();
            }, 100);
        }
    },
    
    // 移除选中的牌面
    removeSelectedCard() {
        if (!this.currentDeck) return;
        
        const selectedCard = document.querySelector("#cardsEditor .card-item.active");
        if (selectedCard) {
            const index = parseInt(selectedCard.dataset.index);
            this.decks[this.currentDeck].splice(index, 1);
            this.updateCardCount();
            this.renderCards();
            this.updateJsonPreview();
            this.updateProbabilityChart();
            this.saveToLocalStorage();
        } else {
            alert("请先选择要移除的牌面");
        }
    },
    
    // 更新牌面内容
    updateCardContent(index, content, weight = "") {
        if (!this.currentDeck || !Array.isArray(this.decks[this.currentDeck]) || index < 0 || index >= this.decks[this.currentDeck].length) return;
        
        let cardData = content;
        if (weight && weight !== "1") {
            cardData = "::" + weight + "::" + content;
        }
        
        this.decks[this.currentDeck][index] = cardData;
        this.updateJsonPreview();
        this.updateProbabilityChart();
        this.saveToLocalStorage();
    },
    
    // 移动牌面位置
    moveCard(index, direction) {
        if (!this.currentDeck || !Array.isArray(this.decks[this.currentDeck]) || this.decks[this.currentDeck].length <= 1) return;
        
        const newIndex = direction === "up" ? index - 1 : index + 1;
        
        if (newIndex < 0 || newIndex >= this.decks[this.currentDeck].length) return;
        
        // 交换位置
        const temp = this.decks[this.currentDeck][index];
        this.decks[this.currentDeck][index] = this.decks[this.currentDeck][newIndex];
        this.decks[this.currentDeck][newIndex] = temp;
        
        this.renderCards();
        this.updateJsonPreview();
        this.saveToLocalStorage();
        
        // 滚动到移动后的位置，并保持选中状态
        const cardsEditor = document.getElementById("cardsEditor");
        const movedCard = document.querySelector(`.card-item[data-index="${newIndex}"]`);
        if (cardsEditor && movedCard) {
            cardsEditor.scrollTop = movedCard.offsetTop - 100;
            // 保持选中效果与编辑焦点
            document.querySelectorAll("#cardsEditor .card-item").forEach(item => {
                item.classList.remove("active", "border-primary", "bg-primary/5");
            });
            movedCard.classList.add("active", "border-primary", "bg-primary/5");
            const textarea = movedCard.querySelector('.card-content');
            if (textarea) {
                textarea.focus();
            }
        }
    },
    
    // 渲染牌堆列表

    renderDeckList() {
        const deckListElement = document.getElementById("deckList");
        if (!deckListElement) return;

        deckListElement.innerHTML = "";

        const deckNames = Object.keys(this.decks);
        if (deckNames.length === 0) {
            deckListElement.innerHTML = `
                <div class="p-3 text-center text-gray-500 text-sm">
                    暂无牌堆，请点击"新建牌堆"按钮
                </div>
            `;
            return;
        }

        // 添加HTML转义函数
        const escapeHtml = (unsafe) => {
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };

        deckNames.forEach((deckName, index) => {
            const isHidden = deckName.startsWith("_");
            const displayName = isHidden ? deckName.substring(1) : deckName;
            const isCurrent = deckName === this.currentDeck;
            const cardCount = Array.isArray(this.decks[deckName]) ? this.decks[deckName].length : 0;

            const deckItem = document.createElement("div");
            deckItem.className = "p-2 rounded-md cursor-pointer transition-colors text-sm flex justify-between items-center " + 
                                (isCurrent ? "bg-primary/10 text-primary" : "bg-gray-100 hover:bg-gray-200");

            deckItem.innerHTML = `
                <div class="flex items-center flex-1">
                    ${isHidden ? '<i class="fa fa-eye-slash text-gray-400 mr-2 text-xs" title="隐藏牌堆"></i>' : ''}
                    <span>${escapeHtml(displayName)}</span>
                </div>
                <div class="flex items-center">
                    <button class="move-deck-up-btn p-1 text-gray-400 hover:text-gray-600 mr-1" data-deck="${deckName}" title="上移">
                        <i class="fa fa-arrow-up text-xs"></i>
                    </button>
                    <button class="move-deck-down-btn p-1 text-gray-400 hover:text-gray-600 mr-2" data-deck="${deckName}" title="下移">
                        <i class="fa fa-arrow-down text-xs"></i>
                    </button>
                    <span class="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">${cardCount}</span>
                </div>
            `;
            const upDeckBtnEl = deckItem.querySelector('.move-deck-up-btn');
            if (upDeckBtnEl) upDeckBtnEl.setAttribute('aria-label', '上移牌堆');
            const downDeckBtnEl = deckItem.querySelector('.move-deck-down-btn');
            if (downDeckBtnEl) downDeckBtnEl.setAttribute('aria-label', '下移牌堆');
            
            deckItem.addEventListener("click", (e) => {
                if (!e.target.closest("button")) {
                    this.loadDeck(deckName);
                }
            });

            deckListElement.appendChild(deckItem);
        });
},
    // 渲染牌面列表
    renderCards() {
        const cardsEditor = document.getElementById("cardsEditor");
        if (!cardsEditor) return;
        
        cardsEditor.innerHTML = "";
        
        if (!this.currentDeck || !this.decks[this.currentDeck] || !Array.isArray(this.decks[this.currentDeck])) {
            cardsEditor.innerHTML = `
                <div class="p-6 text-center text-gray-500">
                    <i class="fa fa-file-text-o text-3xl mb-2 opacity-50"></i>
                    <p>牌堆数据格式错误</p>
                    <p class="text-sm mt-1">请检查或重新创建牌堆</p>
                </div>
            `;
            return;
        }
        
        if (this.decks[this.currentDeck].length === 0) {
            cardsEditor.innerHTML = `
                <div class="p-6 text-center text-gray-500">
                    <i class="fa fa-file-text-o text-3xl mb-2 opacity-50"></i>
                    <p>该牌堆暂无牌面</p>
                    <p class="text-sm mt-1">点击"添加牌面"按钮开始添加</p>
                </div>
            `;
            return;
        }
        
        this.decks[this.currentDeck].forEach((card, index) => {
            let weight = "";
            let content = card;
            
            // 解析权重信息
            if (card.startsWith("::")) {
                const weightEndIndex = card.indexOf("::", 2);
                if (weightEndIndex !== -1) {
                    weight = card.substring(2, weightEndIndex);
                    content = card.substring(weightEndIndex + 2);
                }
            }
            
            const cardItem = document.createElement("div");
            cardItem.className = "card-item border border-gray-200 rounded-md overflow-hidden hover:border-primary/30 transition-all";
            cardItem.dataset.index = index;
            
            cardItem.innerHTML = `
                <div class="bg-gray-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center">
                    <span class="text-sm font-medium text-gray-700">牌面 #${index + 1}</span>
                    <div class="flex space-x-1">
                        <button class="move-up-btn text-gray-400 hover:text-gray-600 p-1" data-index="${index}" title="上移">
                            <i class="fa fa-arrow-up"></i>
                        </button>
                        <button class="move-down-btn text-gray-400 hover:text-gray-600 p-1" data-index="${index}" title="下移">
                            <i class="fa fa-arrow-down"></i>
                        </button>
                        <button class="delete-card-btn text-gray-400 hover:text-red-500 p-1" data-index="${index}" title="删除">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="p-3">
                    <div class="mb-2 weight-container ${this.weightMode ? '' : 'hidden'}">
                        <label class="block text-xs text-gray-500 mb-1">权重（可选，默认为1）</label>
                        <input type="text" class="card-weight w-full px-2 py-1 text-sm border border-gray-300 rounded" 
                               placeholder="例如: 5 或 2d6+3" value="${weight}">
                    </div>
                    <label class="block text-xs text-gray-500 mb-1">牌面内容（可使用 {牌堆名} 或 {%牌堆名} 引用其他牌堆）</label>
                    <textarea class="card-content w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[80px] text-sm">${content}</textarea>
                </div>
            `;
            const upBtnEl = cardItem.querySelector('.move-up-btn');
            if (upBtnEl) upBtnEl.setAttribute('aria-label', '上移');
            const downBtnEl = cardItem.querySelector('.move-down-btn');
            if (downBtnEl) downBtnEl.setAttribute('aria-label', '下移');
            const delBtnEl = cardItem.querySelector('.delete-card-btn');
            if (delBtnEl) delBtnEl.setAttribute('aria-label', '删除');
            
            // 选中牌面效果
            cardItem.addEventListener("click", (e) => {
                if (!e.target.closest("button")) {
                    document.querySelectorAll("#cardsEditor .card-item").forEach(item => {
                        item.classList.remove("active", "border-primary", "bg-primary/5");
                    });
                    cardItem.classList.add("active", "border-primary", "bg-primary/5");
                }
            });
            
            // 内容变更事件
            cardItem.querySelector(".card-content").addEventListener("blur", () => {
                const newContent = cardItem.querySelector(".card-content").value;
                const newWeight = this.weightMode ? cardItem.querySelector(".card-weight").value : "";
                this.updateCardContent(index, newContent, newWeight);
            });
            
            // 权重变更事件（仅在权重模式下）
            if (this.weightMode) {
                cardItem.querySelector(".card-weight").addEventListener("blur", () => {
                    const newContent = cardItem.querySelector(".card-content").value;
                    const newWeight = cardItem.querySelector(".card-weight").value;
                    this.updateCardContent(index, newContent, newWeight);
                });
            }
            
            // 删除牌面
            cardItem.querySelector(".delete-card-btn").addEventListener("click", () => {
                this.decks[this.currentDeck].splice(index, 1);
                this.updateCardCount();
                this.renderCards();
                this.updateJsonPreview();
                this.updateProbabilityChart();
                this.saveToLocalStorage();
            });
            
            // 移动牌面
            cardItem.querySelector(".move-up-btn").addEventListener("click", () => {
                this.moveCard(index, "up");
            });
            
            cardItem.querySelector(".move-down-btn").addEventListener("click", () => {
                this.moveCard(index, "down");
            });
            
            cardsEditor.appendChild(cardItem);
        });
    },
    
    // 清空牌面编辑器
    clearCardEditor() {
        const cardsEditor = document.getElementById("cardsEditor");
        if (!cardsEditor) return;
        
        cardsEditor.innerHTML = `
            <div class="p-6 text-center text-gray-500">
                <i class="fa fa-file-text-o text-3xl mb-2 opacity-50"></i>
                <p>请选择一个牌堆</p>
                <p class="text-sm mt-1">或点击"新建牌堆"按钮创建</p>
            </div>
        `;
        
        const deckNameInput = document.getElementById("deckNameInput");
        if (deckNameInput) deckNameInput.value = "";
        
        const hiddenDeckCheckbox = document.getElementById("hiddenDeckCheckbox");
        if (hiddenDeckCheckbox) hiddenDeckCheckbox.checked = false;
        
        this.updateCardCount();
    },
    
    // 更新牌面数量显示
    updateCardCount() {
        const countDisplay = document.getElementById("cardCountDisplay");
        if (!countDisplay) return;
        
        const count = this.currentDeck && this.decks[this.currentDeck] && Array.isArray(this.decks[this.currentDeck]) 
            ? this.decks[this.currentDeck].length 
            : 0;
        countDisplay.value = count;
    },
    
    // 更新JSON预览
    updateJsonPreview() {
        const previewElement = document.getElementById("jsonPreview");
        const editorElement = document.getElementById("jsonEditor");
        
        if (!previewElement) return;
        
        try {
            const jsonText = JSON.stringify(this.decks, null, 4);
            previewElement.textContent = jsonText;
            
            if (editorElement && this.editMode) {
                editorElement.value = jsonText;
            }
        } catch (e) {
            previewElement.textContent = "JSON格式错误: " + e.message;
        }
    },
    
    // 编辑模式切换方法
    toggleEditMode() {
        this.editMode = !this.editMode;
        
        // 获取所有相关元素
        const previewElement = document.getElementById("jsonPreviewContainer");
        const editorElement = document.getElementById("jsonEditorContainer");
        const toggleBtn = document.getElementById("toggleEditModeBtn");
        const previewContent = document.getElementById("jsonPreview");
        const editorContent = document.getElementById("jsonEditor");
        const jsonContainer = document.querySelector(".json-container");
        
        // 确保元素存在
        if (!previewElement || !editorElement || !previewContent || !editorContent || !toggleBtn) {
            console.error("缺少必要的DOM元素");
            return;
        }
        
        // 同步基础样式
        const syncStyles = () => {
            // 复制容器尺寸
            editorElement.style.width = `${previewElement.offsetWidth}px`;
            editorElement.style.minHeight = `${previewElement.offsetHeight}px`;
            
            // 获取预览区域计算后的样式
            const computedStyle = window.getComputedStyle(previewContent);
            
            // 复制字体相关样式
            editorContent.style.fontFamily = computedStyle.fontFamily;
            editorContent.style.fontSize = computedStyle.fontSize;
            editorContent.style.fontWeight = computedStyle.fontWeight;
            editorContent.style.lineHeight = computedStyle.lineHeight;
            editorContent.style.letterSpacing = computedStyle.letterSpacing;
            editorContent.style.textAlign = computedStyle.textAlign;
            
            // 复制内边距和外边距
            editorContent.style.padding = computedStyle.padding;
            editorContent.style.margin = computedStyle.margin;
            
            // 复制边框样式
            editorContent.style.border = computedStyle.border;
            editorContent.style.borderRadius = computedStyle.borderRadius;
            
            // 复制颜色样式
            editorContent.style.color = computedStyle.color;
            editorContent.style.backgroundColor = computedStyle.backgroundColor;
        };
        
        // 同步滚动位置
        const syncScrollPosition = () => {
            if (this.editMode) {
                // 从预览同步到编辑
                editorContent.scrollTop = previewContent.scrollTop;
                editorContent.scrollLeft = previewContent.scrollLeft;
            } else {
                // 从编辑同步到预览
                previewContent.scrollTop = editorContent.scrollTop;
                previewContent.scrollLeft = editorContent.scrollLeft;
            }
        };
        
        // 计算最佳高度
        const calculateOptimalHeight = () => {
            // 保存当前滚动位置
            const scrollPos = previewContent.scrollTop;
            
            // 临时设置为自动高度以获取内容实际高度
            editorContent.style.height = "auto";
            
            // 计算所需高度（内容高度 + 一些缓冲）
            const contentHeight = editorContent.scrollHeight;
            const containerHeight = jsonContainer ? jsonContainer.offsetHeight : window.innerHeight * 0.7;
            
            // 取内容高度和容器高度中的较小值
            const optimalHeight = Math.min(contentHeight, containerHeight);
            
            // 应用计算后的高度
            editorContent.style.height = `${optimalHeight}px`;
            
            // 恢复滚动位置
            editorContent.scrollTop = scrollPos;
            
            return optimalHeight;
        };
        
        // 执行样式同步
        syncStyles();
        
        if (this.editMode) {
            // 切换到编辑模式
            previewElement.classList.add("hidden");
            editorElement.classList.remove("hidden");
            toggleBtn.textContent = "预览模式";
            toggleBtn.classList.remove("bg-primary");
            toggleBtn.classList.add("bg-secondary");
            
            // 同步内容
            editorContent.value = previewContent.textContent;
            
            // 计算并设置最佳高度
            calculateOptimalHeight();
            
            // 同步滚动位置
            setTimeout(syncScrollPosition, 0); // 在下一帧执行以确保DOM已更新
            
            // 自动聚焦到编辑器
            editorContent.focus();
            
        } else {
            // 切换到预览模式
            previewElement.classList.remove("hidden");
            editorElement.classList.add("hidden");
            toggleBtn.textContent = "编辑模式";
            toggleBtn.classList.remove("bg-secondary");
            toggleBtn.classList.add("bg-primary");
            
            // 同步滚动位置
            setTimeout(syncScrollPosition, 0);
        }
        
        // 添加窗口大小变化监听，动态调整高度
        const handleResize = () => {
            if (this.editMode) {
                calculateOptimalHeight();
            }
        };
        
        // 先移除可能存在的监听，避免重复绑定
        window.removeEventListener("resize", handleResize);
        window.addEventListener("resize", handleResize);
    },
    
    // 应用JSON编辑的更改
    applyJsonChanges() {
        const editorContent = document.getElementById("jsonEditor");
        if (!editorContent) return false;
        
        try {
            const jsonText = editorContent.value.trim();
            if (!jsonText) {
                throw new Error("JSON内容不能为空");
            }
            
            const parsedData = JSON.parse(jsonText);
            
            if (typeof parsedData !== "object" || parsedData === null || Array.isArray(parsedData)) {
                throw new Error("无效的牌堆格式，必须是JSON对象");
            }
            
            this.decks = parsedData;
            this.validateAndFixDataStructure();
            
            const deckNames = Object.keys(this.decks);
            if (deckNames.length > 0) {
                this.currentDeck = deckNames[0];
                this.loadDeck(this.currentDeck);
            } else {
                this.currentDeck = null;
                this.clearCardEditor();
            }
            
            this.renderDeckList();
            this.updateJsonPreview();
            this.updateProbabilityChart();
            this.updateDrawDeckSelector();
            this.saveToLocalStorage();
            
            this.showNotification("JSON数据已更新");
            this.toggleEditMode();
            
            return true;
        } catch (e) {
            this.showNotification("JSON解析错误: " + e.message, "error");
            return false;
        }
    },
    
    // 切换权重模式
    toggleWeightMode() {
        this.weightMode = !this.weightMode;
        
        const toggleBtn = document.getElementById("toggleWeightBtn");
        if (!toggleBtn) return;
        
        if (this.weightMode) {
            toggleBtn.classList.remove("bg-accent/10", "text-accent");
            toggleBtn.classList.add("bg-accent", "text-white");
            this.showNotification("已启用权重模式，可设置牌面抽取概率");
        } else {
            toggleBtn.classList.remove("bg-accent", "text-white");
            toggleBtn.classList.add("bg-accent/10", "text-accent");
            this.showNotification("已禁用权重模式，所有牌面抽取概率相同");
        }
        
        // 显示或隐藏权重输入框
        document.querySelectorAll(".weight-container").forEach(container => {
            if (this.weightMode) {
                container.classList.remove("hidden");
            } else {
                container.classList.add("hidden");
            }
        });
        
        if (this.currentDeck) {
            this.renderCards();
        }
    },
    
    // 切换当前牌堆的隐藏状态
    toggleHiddenDeck() {
        if (!this.currentDeck) return;
        
        const isHidden = !this.currentDeck.startsWith("_");
        const newName = isHidden ? "_" + this.currentDeck : this.currentDeck.substring(1);
        
        if (this.decks.hasOwnProperty(newName)) {
            alert("无法切换隐藏状态，因为名称已存在");
            const hiddenDeckCheckbox = document.getElementById("hiddenDeckCheckbox");
            if (hiddenDeckCheckbox) hiddenDeckCheckbox.checked = this.currentDeck.startsWith("_");
            return;
        }
        
        this.decks[newName] = this.decks[this.currentDeck];
        delete this.decks[this.currentDeck];
        this.currentDeck = newName;
        
        this.renderDeckList();
        const hiddenDeckCheckbox = document.getElementById("hiddenDeckCheckbox");
        if (hiddenDeckCheckbox) hiddenDeckCheckbox.checked = isHidden;
        this.updateJsonPreview();
        this.updateDrawDeckSelector();
        this.saveToLocalStorage();
    },
    
    // 导出JSON
    exportJson() {
        try {
            const jsonText = JSON.stringify(this.decks, null, 4);
            const blob = new Blob([jsonText], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "牌堆_" + new Date().getTime() + ".json";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification("牌堆已导出成功");
        } catch (e) {
            this.showNotification("导出失败: " + e.message, "error");
        }
    },
    
    // 导入JSON
    importJson(jsonData) {
        try {
            const importedDecks = typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;
            
            if (typeof importedDecks !== "object" || importedDecks === null || Array.isArray(importedDecks)) {
                throw new Error("无效的牌堆格式，必须是JSON对象");
            }
            
            if (Object.keys(this.decks).length > 0) {
                if (confirm("是否合并到现有牌堆？\n选择确定将合并（同名牌堆会被覆盖），选择取消将替换所有牌堆。")) {
                    Object.assign(this.decks, importedDecks);
                } else {
                    this.decks = importedDecks;
                }
            } else {
                this.decks = importedDecks;
            }
            
            this.validateAndFixDataStructure();
            
            const deckNames = Object.keys(this.decks);
            if (deckNames.length > 0) {
                this.currentDeck = deckNames[0];
                this.loadDeck(this.currentDeck);
            } else {
                this.currentDeck = null;
                this.clearCardEditor();
            }
            
            this.renderDeckList();
            this.updateJsonPreview();
            this.updateProbabilityChart();
            this.updateDrawDeckSelector();
            this.saveToLocalStorage();
            
            this.showNotification("牌堆已导入成功");
            return true;
        } catch (e) {
            this.showNotification("导入失败: " + e.message, "error");
            return false;
        }
    },
    
    // 更新抽取牌堆选择器（过滤隐藏牌堆）
    updateDrawDeckSelector() {
        const selector = document.getElementById('drawDeckSelector');
        if (!selector) return;
        
        // 清空选择器
        selector.innerHTML = '';
        selector.disabled = false; // 确保选择器默认处于启用状态
        
        // 获取所有非隐藏牌堆
        const visibleDecks = Object.keys(this.decks).filter(deckName => !deckName.startsWith('_'));
        
        if (visibleDecks.length === 0) {
            // 如果没有可见牌堆，添加一个禁用的选项
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '无可用牌堆';
            option.disabled = true;
            selector.appendChild(option);
            selector.disabled = true; // 没有牌堆时禁用选择器
        } else {
            // 添加所有可见牌堆作为选项
            visibleDecks.forEach(deckName => {
                const option = document.createElement('option');
                option.value = deckName;
                option.textContent = deckName.replace(/^_/, '');
                
                // 如果是当前选中的牌堆，设置为选中状态
                if (deckName === this.currentDeck) {
                    option.selected = true;
                }
                
                selector.appendChild(option);
            });
        }
    },
    
    // 抽取牌面
    drawCard() {
        const selectedDeck = document.getElementById("drawDeckSelector").value;
        if (!selectedDeck || !this.decks[selectedDeck] || !Array.isArray(this.decks[selectedDeck]) || this.decks[selectedDeck].length === 0) {
            this.showNotification("请选择一个非空牌堆", "warning");
            return;
        }
        
        // 创建带权重的牌组
        const weightedCards = [];
        this.decks[selectedDeck].forEach(card => {
            let weight = 1;
            let content = card;
            
            // 解析权重
            if (card.startsWith("::")) {
                const weightEndIndex = card.indexOf("::", 2);
                if (weightEndIndex !== -1) {
                    const weightExpr = card.substring(2, weightEndIndex);
                    content = card.substring(weightEndIndex + 2);
                    
                    try {
                        // 支持简单的数学表达式作为权重
                        weight = this.evaluateWeightExpression(weightExpr);
                        weight = Math.max(1, Math.round(weight)); // 确保权重至少为1
                    } catch (e) {
                        console.warn("权重表达式解析错误:", e);
                        weight = 1;
                    }
                }
            }
            
            // 根据权重添加多次
            for (let i = 0; i < weight; i++) {
                weightedCards.push(content);
            }
        });
        
        // 随机选择一张牌
        const randomIndex = Math.floor(Math.random() * weightedCards.length);
        let selectedCard = weightedCards[randomIndex];
        
        // 解析牌面中的引用
        selectedCard = this.resolveCardReferences(selectedCard);
        
        // 显示结果
        const resultElement = document.getElementById("drawResult");
        if (resultElement) {
            resultElement.innerHTML = '<div class="slide-in">' + selectedCard + '</div>';
        }
    },
    
    // 解析权重表达式（支持数字、dice表达式如2d6+3等）
    evaluateWeightExpression(expr) {
        // 如果是数字，直接返回
        if (!isNaN(Number(expr))) {
            return Number(expr);
        }
        
        // 处理骰子表达式，如2d6+3
        const diceRegex = /^(\d*)d(\d+)([+-]\d+)?$/i;
        const match = expr.match(diceRegex);
        
        if (match) {
            const count = match[1] ? parseInt(match[1]) : 1; // 骰子数量，默认1
            const sides = parseInt(match[2]); // 骰子面数
            const modifier = match[3] ? parseInt(match[3]) : 0; // 修正值
            
            let total = 0;
            for (let i = 0; i < count; i++) {
                total += Math.floor(Math.random() * sides) + 1;
            }
            
            return total + modifier;
        }
        
        // 无法解析的表达式，返回默认权重1
        return 1;
    },
    
    // 解析牌面中的牌堆引用 {牌堆名} 或 {%牌堆名}
    resolveCardReferences(cardText) {
        let result = cardText;
        
        // 处理放回抽取: {%牌堆名}
        result = result.replace(/\{%(.*?)\}/g, (match, deckName) => {
            return this.drawFromDeck(deckName.trim(), true);
        });
        
        // 处理不放回抽取: {牌堆名}
        result = result.replace(/\{(?!%)\s*(.*?)\s*\}/g, (match, deckName) => {
            return this.drawFromDeck(deckName.trim(), false);
        });
        
        // 如果还有嵌套引用，递归解析
        if (result.includes("{") && result.includes("}")) {
            return this.resolveCardReferences(result);
        }
        
        return result;
    },
    
    // 从指定牌堆抽取牌面
    drawFromDeck(deckName, withReplacement = true) {
        // 检查牌堆是否存在
        if (!this.decks[deckName] || !Array.isArray(this.decks[deckName]) || this.decks[deckName].length === 0) {
            return `[无效引用: 牌堆"${deckName}"不存在或为空]`;
        }
        
        // 找到随机索引
        const randomIndex = Math.floor(Math.random() * this.decks[deckName].length);
        let selectedCard = this.decks[deckName][randomIndex];
        
        // 如果是不放回抽取，从牌堆中移除该牌
        if (!withReplacement) {
            this.decks[deckName].splice(randomIndex, 1);
            this.saveToLocalStorage();
            
            // 如果当前正在编辑该牌堆，更新UI
            if (this.currentDeck === deckName) {
                this.updateCardCount();
                this.renderCards();
                this.updateProbabilityChart();
            }
        }
        
        // 提取牌面内容（去除权重信息）
        if (selectedCard.startsWith("::")) {
            const weightEndIndex = selectedCard.indexOf("::", 2);
            if (weightEndIndex !== -1) {
                selectedCard = selectedCard.substring(weightEndIndex + 2);
            }
        }
        
        return selectedCard;
    },
    
    // 初始化概率分布图
    initProbabilityChart() {
        const ctx = document.getElementById("probabilityChart")?.getContext("2d");
        if (!ctx) return;
        
        if (this.probabilityChart) {
            this.probabilityChart.destroy();
        }
        
        this.probabilityChart = new Chart(ctx, {
            type: "pie",
            data: {
                labels: ["暂无数据"],
                datasets: [{
                    data: [1],
                    backgroundColor: ["#e5e7eb"],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "right",
                        labels: {
                            boxWidth: 12,
                            font: {
                                size: 11
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return context.label + ": " + percentage + "%";
                            }
                        }
                    }
                }
            }
        });
    },
    
    // 更新概率分布图
    updateProbabilityChart() {
        if (!this.currentDeck || !this.decks[this.currentDeck] || !Array.isArray(this.decks[this.currentDeck]) || this.decks[this.currentDeck].length === 0 || !this.probabilityChart) {
            this.initProbabilityChart();
            return;
        }
        
        const labels = [];
        const data = [];
        const backgroundColors = [];
        
        // 生成不同的颜色
        const getColor = (index, total) => {
            const hue = (index * (360 / total)) % 360;
            return "hsl(" + hue + ", 70%, 60%)";
        };
        
        this.decks[this.currentDeck].forEach((card, index) => {
            let weight = 1;
            let content = card;
            
            // 解析权重
            if (card.startsWith("::")) {
                const weightEndIndex = card.indexOf("::", 2);
                if (weightEndIndex !== -1) {
                    const weightExpr = card.substring(2, weightEndIndex);
                    content = card.substring(weightEndIndex + 2);
                    
                    try {
                        weight = this.evaluateWeightExpression(weightExpr);
                        weight = Math.max(1, Math.round(weight));
                    } catch (e) {
                        weight = 1;
                    }
                }
            }
            
            // 截断长文本以在图表中显示
            const label = content.length > 15 ? content.substring(0, 15) + "..." : content;
            
            labels.push("牌面 #" + (index + 1) + ": " + label);
            data.push(weight);
            backgroundColors.push(getColor(index, this.decks[this.currentDeck].length));
        });
        
        this.probabilityChart.data.labels = labels;
        this.probabilityChart.data.datasets[0].data = data;
        this.probabilityChart.data.datasets[0].backgroundColor = backgroundColors;
        this.probabilityChart.update();
    },
    
    // 搜索牌堆
    searchDecks(keyword) {
        const deckListElement = document.getElementById("deckList");
        if (!deckListElement) return;
        
        if (!keyword) {
            this.renderDeckList();
            return;
        }
        
        deckListElement.innerHTML = "";
        
        const deckNames = Object.keys(this.decks);
        const filteredDecks = deckNames.filter(deckName => {
            const displayName = deckName.startsWith("_") ? deckName.substring(1) : deckName;
            return displayName.toLowerCase().includes(keyword.toLowerCase());
        });
        
        if (filteredDecks.length === 0) {
            deckListElement.innerHTML = `
                <div class="p-3 text-center text-gray-500 text-sm">
                    没有找到匹配的牌堆
                </div>
            `;
            return;
        }
        
        filteredDecks.forEach(deckName => {
            const isHidden = deckName.startsWith("_");
            const displayName = isHidden ? deckName.substring(1) : deckName;
            const isCurrent = deckName === this.currentDeck;
            const cardCount = Array.isArray(this.decks[deckName]) ? this.decks[deckName].length : 0;
            
            const deckItem = document.createElement("div");
            deckItem.className = "p-2 rounded-md cursor-pointer transition-colors text-sm flex justify-between items-center " + 
                                (isCurrent ? "bg-primary/10 text-primary" : "bg-gray-100 hover:bg-gray-200");
            
            deckItem.innerHTML = `
                <div class="flex items-center">
                    ${isHidden ? '<i class="fa fa-eye-slash text-gray-400 mr-2 text-xs" title="隐藏牌堆"></i>' : ''}
                    <span>${displayName}</span>
                </div>
                <span class="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">${cardCount}</span>
            `;
            
            deckItem.addEventListener("click", () => this.loadDeck(deckName));
            deckListElement.appendChild(deckItem);
        });
    },
    
    // 显示通知
    showNotification(message, type = "success") {
        const notification = document.createElement("div");
        
        let bgColor, textColor, icon;
        
        switch (type) {
            case "success":
                bgColor = "bg-green-500";
                textColor = "text-white";
                icon = "fa-check-circle";
                break;
            case "warning":
                bgColor = "bg-yellow-500";
                textColor = "text-white";
                icon = "fa-exclamation-triangle";
                break;
            case "error":
                bgColor = "bg-red-500";
                textColor = "text-white";
                icon = "fa-times-circle";
                break;
            case "info":
                bgColor = "bg-blue-500";
                textColor = "text-white";
                icon = "fa-info-circle";
                break;
            default:
                bgColor = "bg-primary";
                textColor = "text-white";
                icon = "fa-info-circle";
        }
        
        notification.className = "fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg " + bgColor + " " + textColor + " flex items-center z-50 transform translate-y-10 opacity-0 transition-all duration-300";
        notification.innerHTML = '<i class="fa ' + icon + ' mr-2"></i> ' + message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.remove("translate-y-10", "opacity-0");
        }, 10);
        
        setTimeout(() => {
            notification.classList.add("translate-y-10", "opacity-0");
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    },
    
    // 切换JSON全屏模式（修复版）
    toggleJsonFullscreen() {
        this.fullscreenJson = !this.fullscreenJson;
        
        const jsonContainer = document.querySelector(".json-container");
        const toggleBtn = document.getElementById("toggleFullscreenBtn");
        const previewContainer = document.getElementById("jsonPreviewContainer");
        const editorContainer = document.getElementById("jsonEditorContainer");
        
        // 确保必要元素存在
        if (!jsonContainer || !toggleBtn || !previewContainer || !editorContainer) {
            console.error("缺少全屏模式所需的DOM元素");
            this.fullscreenJson = false; // 重置状态
            this.showNotification("全屏功能无法使用：缺少必要组件", "error");
            return;
        }
        
        // 移除可能存在的全屏工具栏
        const existingToolbar = document.querySelector(".json-fullscreen-toolbar");
        if (existingToolbar) {
            document.body.removeChild(existingToolbar);
        }
        
        if (this.fullscreenJson) {
            try {
                // 保存原始样式以便恢复
                this.jsonOriginalStyles = {
                    container: {
                        maxHeight: jsonContainer.style.maxHeight,
                        position: jsonContainer.style.position,
                        top: jsonContainer.style.top,
                        left: jsonContainer.style.left,
                        right: jsonContainer.style.right,
                        bottom: jsonContainer.style.bottom,
                        margin: jsonContainer.style.margin,
                        borderRadius: jsonContainer.style.borderRadius,
                        padding: jsonContainer.style.padding,
                        backgroundColor: jsonContainer.style.backgroundColor,
                        zIndex: jsonContainer.style.zIndex
                    },
                    preview: {
                        maxHeight: previewContainer.style.maxHeight
                    },
                    editor: {
                        maxHeight: editorContainer.style.maxHeight
                    }
                };
                
                // 进入全屏模式
                jsonContainer.style.maxHeight = "100vh";
                jsonContainer.style.position = "fixed";
                jsonContainer.style.top = "0";
                jsonContainer.style.left = "0";
                jsonContainer.style.right = "0";
                jsonContainer.style.bottom = "0";
                jsonContainer.style.margin = "0";
                jsonContainer.style.borderRadius = "0";
                jsonContainer.style.padding = "20px";
                jsonContainer.style.backgroundColor = "#fff";
                jsonContainer.style.zIndex = "40";
                
                // 调整内部容器高度
                if (!previewContainer.classList.contains("hidden")) {
                    previewContainer.style.maxHeight = "calc(100vh - 60px)";
                }
                if (!editorContainer.classList.contains("hidden")) {
                    editorContainer.style.maxHeight = "calc(100vh - 60px)";
                }
                
                toggleBtn.innerHTML = '<i class="fa fa-compress mr-1"></i>退出全屏';
                
                // 添加全屏工具栏
                const fullscreenToolbar = document.createElement("div");
                fullscreenToolbar.className = "json-fullscreen-toolbar fixed top-4 left-1/2 transform -translate-x-1/2 z-41 bg-white shadow-md px-4 py-2 rounded-md";
                fullscreenToolbar.innerHTML = `
                    <div class="flex items-center gap-3">
                        <span class="text-sm text-gray-600">全屏编辑模式</span>
                        <button id="exitFullscreenBtn" class="px-3 py-1 bg-primary text-white rounded hover:bg-primary/90 text-sm">
                            <i class="fa fa-compress mr-1"></i>退出全屏
                        </button>
                    </div>
                `;
                document.body.appendChild(fullscreenToolbar);
                
                // 退出全屏按钮事件
                fullscreenToolbar.querySelector("#exitFullscreenBtn").addEventListener("click", () => {
                    this.toggleJsonFullscreen();
                });
                
                // 按ESC键退出全屏
                const handleEsc = (e) => {
                    if (e.key === "Escape") {
                        this.toggleJsonFullscreen();
                        document.removeEventListener("keydown", handleEsc);
                    }
                };
                document.addEventListener("keydown", handleEsc);
                
                this.showNotification("已进入全屏编辑模式，按ESC可退出");
                
            } catch (error) {
                console.error("进入全屏模式失败:", error);
                this.fullscreenJson = false;
                this.showNotification("进入全屏模式失败", "error");
            }
            
        } else {
            try {
                // 退出全屏模式，恢复原始样式
                if (this.jsonOriginalStyles) {
                    // 恢复容器样式
                    jsonContainer.style.maxHeight = this.jsonOriginalStyles.container.maxHeight;
                    jsonContainer.style.position = this.jsonOriginalStyles.container.position;
                    jsonContainer.style.top = this.jsonOriginalStyles.container.top;
                    jsonContainer.style.left = this.jsonOriginalStyles.container.left;
                    jsonContainer.style.right = this.jsonOriginalStyles.container.right;
                    jsonContainer.style.bottom = this.jsonOriginalStyles.container.bottom;
                    jsonContainer.style.margin = this.jsonOriginalStyles.container.margin;
                    jsonContainer.style.borderRadius = this.jsonOriginalStyles.container.borderRadius;
                    jsonContainer.style.padding = this.jsonOriginalStyles.container.padding;
                    jsonContainer.style.backgroundColor = this.jsonOriginalStyles.container.backgroundColor;
                    jsonContainer.style.zIndex = this.jsonOriginalStyles.container.zIndex;
                    
                    // 恢复预览和编辑区域样式
                    previewContainer.style.maxHeight = this.jsonOriginalStyles.preview.maxHeight;
                    editorContainer.style.maxHeight = this.jsonOriginalStyles.editor.maxHeight;
                    
                    // 清除保存的样式
                    this.jsonOriginalStyles = null;
                }
                
                toggleBtn.innerHTML = '<i class="fa fa-expand mr-1"></i>全屏';
                this.showNotification("已退出全屏编辑模式");
                
            } catch (error) {
                console.error("退出全屏模式失败:", error);
                this.showNotification("退出全屏模式失败", "error");
            }
        }
    }
};

// DOM加载完成后初始化
document.addEventListener("DOMContentLoaded", () => {
    try {
        deckManager.init();
        bindEventListeners();
    } catch (error) {
        console.error("初始化失败:", error);
        alert("应用初始化失败: " + error.message + "\n请刷新页面重试");
    }
});

function debounce(fn, delay = 250) {
    let t;
    return function(...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), delay);
    };
}

// 绑定事件监听器
function bindEventListeners() {
    // 工具栏按钮 - 增加存在性检查
    const newDeckBtn = document.getElementById("newDeckBtn");
    if (newDeckBtn) {
        newDeckBtn.addEventListener("click", () => {
            deckManager.createNewDeck();
        });
    }
    
    const deleteDeckBtn = document.getElementById("deleteDeckBtn");
    if (deleteDeckBtn) {
        deleteDeckBtn.addEventListener("click", () => {
            deckManager.deleteCurrentDeck();
        });
    }
    
    const addCardBtn = document.getElementById("addCardBtn");
    if (addCardBtn) {
        addCardBtn.addEventListener("click", () => {
            deckManager.addCard();
        });
    }
    
    const removeCardBtn = document.getElementById("removeCardBtn");
    if (removeCardBtn) {
        removeCardBtn.addEventListener("click", () => {
            deckManager.removeSelectedCard();
        });
    }
    
    // 权重模式切换按钮
    const toggleWeightBtn = document.getElementById("toggleWeightBtn");
    if (toggleWeightBtn) {
        toggleWeightBtn.addEventListener("click", () => {
            deckManager.toggleWeightMode();
        });
    }
    
    // 隐藏牌堆切换按钮
    const hiddenDeckCheckbox = document.getElementById("hiddenDeckCheckbox");
    if (hiddenDeckCheckbox) {
        hiddenDeckCheckbox.addEventListener("change", () => {
            deckManager.toggleHiddenDeck();
        });
    }
    
    // 牌堆名称输入
    const deckNameInput = document.getElementById("deckNameInput");
    if (deckNameInput) {
        deckNameInput.addEventListener("blur", (e) => {
            deckManager.updateDeckName(e.target.value);
        });
        // 按Enter键也触发保存
        deckNameInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.target.blur();
            }
        });
    }
    
    // 牌堆搜索
    const deckSearch = document.getElementById("deckSearch");
    if (deckSearch) {
        const handleSearch = debounce((value) => {
            deckManager.searchDecks(value);
        }, 250);
        deckSearch.addEventListener("input", (e) => {
            handleSearch(e.target.value);
        });
    }
    
    // 导入导出按钮
    const exportBtn = document.getElementById("exportBtn");
    if (exportBtn) {
        exportBtn.addEventListener("click", () => {
            deckManager.exportJson();
        });
    }
    
    const saveBtn = document.getElementById("saveBtn");
    if (saveBtn) {
        saveBtn.addEventListener("click", () => {
            deckManager.updateJsonPreview();
            deckManager.showNotification("已保存当前编辑");
        });
    }
    
    // 清除所有牌堆按钮
    const clearBtn = document.getElementById("clearBtn");
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            deckManager.clearAllDecks();
        });
    }
    
    // 导入模态框
    const importModal = document.getElementById("importModal");
    if (importModal) {
        const importBtn = document.getElementById("importBtn");
        if (importBtn) {
            importBtn.addEventListener("click", () => {
                importModal.classList.remove("hidden");
                // 重置输入
                const jsonImportTextarea = document.getElementById("jsonImportTextarea");
                if (jsonImportTextarea) jsonImportTextarea.value = "";
                const fileInput = document.getElementById("fileInput");
                if (fileInput) fileInput.value = "";
            });
        }
        
        const closeImportModal = document.getElementById("closeImportModal");
        if (closeImportModal) {
            closeImportModal.addEventListener("click", () => {
                importModal.classList.add("hidden");
            });
        }
        
        // 文件上传区域点击事件
        const fileDropArea = document.querySelector("#importModal .border-dashed");
        if (fileDropArea) {
            fileDropArea.addEventListener("click", () => {
                const fileInput = document.getElementById("fileInput");
                if (fileInput) fileInput.click();
            });
        }
        
        // 文件选择事件
        const fileInput = document.getElementById("fileInput");
        if (fileInput) {
            fileInput.addEventListener("change", (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const jsonImportTextarea = document.getElementById("jsonImportTextarea");
                        if (jsonImportTextarea) jsonImportTextarea.value = event.target.result;
                    };
                    reader.readAsText(file);
                }
            });
        }
        
        // 确认导入
        const confirmImportBtn = document.getElementById("confirmImportBtn");
        if (confirmImportBtn) {
            confirmImportBtn.addEventListener("click", () => {
                const jsonImportTextarea = document.getElementById("jsonImportTextarea");
                if (jsonImportTextarea) {
                    const jsonText = jsonImportTextarea.value.trim();
                    if (jsonText) {
                        if (deckManager.importJson(jsonText)) {
                            importModal.classList.add("hidden");
                        }
                    } else {
                        deckManager.showNotification("请输入或上传JSON内容", "warning");
                    }
                }
            });
        }
    }
    
    // 抽取牌面
    const drawCardBtn = document.getElementById("drawCardBtn");
    if (drawCardBtn) {
        drawCardBtn.addEventListener("click", () => {
            deckManager.drawCard();
        });
    }
    
    // 拖放文件上传
    const fileDropArea = document.querySelector("#importModal .border-dashed");
    if (fileDropArea) {
        fileDropArea.addEventListener("dragover", (e) => {
            e.preventDefault();
            fileDropArea.classList.add("bg-gray-100");
        });
        
        fileDropArea.addEventListener("dragleave", () => {
            fileDropArea.classList.remove("bg-gray-100");
        });
        
        fileDropArea.addEventListener("drop", (e) => {
            e.preventDefault();
            fileDropArea.classList.remove("bg-gray-100");
            
            const file = e.dataTransfer.files[0];
            if (file && file.name.endsWith(".json")) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const jsonImportTextarea = document.getElementById("jsonImportTextarea");
                    if (jsonImportTextarea) jsonImportTextarea.value = event.target.result;
                };
                reader.readAsText(file);
            } else {
                deckManager.showNotification("请上传JSON格式的文件", "warning");
            }
        });
    }
    
    // 移动牌面按钮
    const moveUpBtn = document.getElementById("moveUpBtn");
    if (moveUpBtn) {
        moveUpBtn.addEventListener("click", () => {
            const selectedCard = document.querySelector("#cardsEditor .card-item.active");
            if (selectedCard) {
                const index = parseInt(selectedCard.dataset.index);
                deckManager.moveCard(index, "up");
            } else {
                deckManager.showNotification("请先选择一个牌面", "warning");
            }
        });
    }
    
    const moveDownBtn = document.getElementById("moveDownBtn");
    if (moveDownBtn) {
        moveDownBtn.addEventListener("click", () => {
            const selectedCard = document.querySelector("#cardsEditor .card-item.active");
            if (selectedCard) {
                const index = parseInt(selectedCard.dataset.index);
                deckManager.moveCard(index, "down");
            } else {
                deckManager.showNotification("请先选择一个牌面", "warning");
            }
        });
    }
    
    // JSON编辑模式切换
    const toggleEditBtn = document.getElementById("toggleEditModeBtn");
    if (toggleEditBtn) {
        toggleEditBtn.addEventListener("click", () => {
            deckManager.toggleEditMode();
        });
    }
    
    // 应用JSON编辑更改
    const applyJsonBtn = document.getElementById("applyJsonChangesBtn");
    if (applyJsonBtn) {
        applyJsonBtn.addEventListener("click", () => {
            deckManager.applyJsonChanges();
        });
    }
    
    // 为JSON编辑器添加快捷键
    const jsonEditor = document.getElementById("jsonEditor");
    if (jsonEditor) {
        jsonEditor.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                deckManager.applyJsonChanges();
            }
        });
    }
    
    // 牌堆选择器变化时更新概率图表
    const drawDeckSelector = document.getElementById("drawDeckSelector");
    if (drawDeckSelector) {
        drawDeckSelector.addEventListener("change", () => {
            // 可以在这里添加临时显示选中牌堆信息的逻辑
        });
    }
    
    // JSON全屏切换（修复版）
    const toggleFullscreenBtn = document.getElementById("toggleFullscreenBtn");
    if (toggleFullscreenBtn) {
        toggleFullscreenBtn.addEventListener("click", () => {
            // 确保在尝试全屏前已初始化
            if (typeof deckManager !== 'undefined' && deckManager.toggleJsonFullscreen) {
                deckManager.toggleJsonFullscreen();
            } else {
                console.error("全屏功能尚未初始化");
                // 显示用户友好的错误提示
                deckManager.showNotification("全屏功能暂时无法使用，请稍后重试或刷新页面", "error");
            }
        });
    }
    
    // 快速引用功能 - 增加存在性检查
    const quickReferenceBtn = document.getElementById('quickReferenceBtn');
    if (quickReferenceBtn) {
        const referenceDropdown = document.getElementById('referenceDropdown');
        const referenceSearch = document.getElementById('referenceSearch');
        const referenceList = document.getElementById('referenceList');
        
        if (referenceDropdown && referenceSearch && referenceList) {
            // 显示/隐藏引用下拉菜单
            quickReferenceBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                referenceDropdown.classList.toggle('hidden');
                if (!referenceDropdown.classList.contains('hidden')) {
                    renderReferenceList();
                    referenceSearch.focus();
                }
            });
            
            // 点击外部关闭下拉菜单
            document.addEventListener('click', (e) => {
                const container = document.getElementById('quickReferenceContainer');
                if (container && !container.contains(e.target)) {
                    referenceDropdown.classList.add('hidden');
                }
            });
            
            // 搜索引用牌堆
            referenceSearch.addEventListener('input', renderReferenceList);
            
            // 渲染引用列表
            function renderReferenceList() {
                const searchTerm = referenceSearch.value.toLowerCase();
                const deckNames = Object.keys(deckManager.decks);
                
                referenceList.innerHTML = '';
                
                if (deckNames.length === 0) {
                    referenceList.innerHTML = '<div class="p-2 text-sm text-gray-500">没有可用的牌堆</div>';
                    return;
                }
                
                const filteredDecks = deckNames.filter(deckName => {
                    const displayName = deckName.startsWith('_') ? deckName.substring(1) : deckName;
                    return displayName.toLowerCase().includes(searchTerm);
                });
                
                if (filteredDecks.length === 0) {
                    referenceList.innerHTML = '<div class="p-2 text-sm text-gray-500">没有匹配的牌堆</div>';
                    return;
                }
                
                filteredDecks.forEach(deckName => {
                    const displayName = deckName.startsWith('_') ? deckName.substring(1) : deckName;
                    const isHidden = deckName.startsWith('_');
                    
                    const item = document.createElement('div');
                    item.className = 'p-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center';
                    item.innerHTML = `
                        <div class="flex items-center">
                            ${isHidden ? '<i class="fa fa-eye-slash text-gray-400 mr-2 text-xs" title="隐藏牌堆"></i>' : ''}
                            <span>${displayName}</span>
                        </div>
                        <div class="flex gap-1">
                            <button class="quick-ref-btn p-1 text-xs text-gray-600 hover:text-primary" data-deck="${deckName}" data-type="normal" title="不放回引用">
                                { }
                            </button>
                            <button class="quick-ref-btn p-1 text-xs text-gray-600 hover:text-primary" data-deck="${deckName}" data-type="replace" title="放回引用">
                                {% %}
                            </button>
                        </div>
                    `;
                    
                    referenceList.appendChild(item);
                });
                
                // 绑定引用按钮事件
                document.querySelectorAll('.quick-ref-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const deckName = btn.getAttribute('data-deck');
                        const type = btn.getAttribute('data-type');
                        
                        // 插入引用到当前选中的牌面或创建新牌面
                        insertReference(deckName, type);
                        
                        // 关闭下拉菜单
                        referenceDropdown.classList.add('hidden');
                    });
                });
            }
            
            // 插入引用到牌面
            function insertReference(deckName, type) {
                const selectedCard = document.querySelector('#cardsEditor .card-item.active');
                const referenceFormat = type === 'normal' ? `{${deckName}}` : `{%${deckName}}`;
                
                if (selectedCard) {
                    // 如果有选中的牌面，插入到该牌面
                    const textarea = selectedCard.querySelector('.card-content');
                    if (textarea) {
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const currentValue = textarea.value;
                        
                        // 在光标位置插入引用
                        textarea.value = currentValue.substring(0, start) + 
                                        referenceFormat + 
                                        currentValue.substring(end);
                        
                        // 更新光标位置
                        const newCursorPos = start + referenceFormat.length;
                        textarea.focus();
                        textarea.setSelectionRange(newCursorPos, newCursorPos);
                        
                        // 保存更改
                        const index = parseInt(selectedCard.dataset.index);
                        deckManager.updateCardContent(index, textarea.value, 
                            deckManager.weightMode ? selectedCard.querySelector('.card-weight')?.value : '');
                    }
                } else {
                    // 如果没有选中的牌面，创建新牌面并插入引用
                    deckManager.addCard(referenceFormat);
                }
            }
            
            // 添加键盘快捷键支持
            document.addEventListener('keydown', (e) => {
                // Alt+R 打开引用菜单
                if (e.altKey && e.key.toLowerCase() === 'r') {
                    e.preventDefault();
                    quickReferenceBtn.click();
                }
            });
        }
    }
}
    