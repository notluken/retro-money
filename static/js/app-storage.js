/**
 * RetroMoney App Storage - LocalStorage management
 * Handles caching and persistent storage between page loads
 */

const AppStorage = {
    // Configuration
    cacheExpiry: {
        expenses: 30 * 60 * 1000, // 30 minutes
        todos: 30 * 60 * 1000,    // 30 minutes
        rates: 60 * 60 * 1000,    // 1 hour
        salary: 24 * 60 * 60 * 1000, // 24 hours
        stats: 30 * 60 * 1000,     // 30 minutes
        investments: 30 * 60 * 1000 // 30 minutes
    },
    
    // Storage Keys
    keys: {
        expenses: 'retro_money_expenses',
        todos: 'retro_money_todos',
        rateBlue: 'retro_money_rate_blue',
        rateTarjeta: 'retro_money_rate_tarjeta',
        activeRateType: 'retro_money_active_rate',
        salary: 'retro_money_salary',
        budgetAllocations: 'retro_money_budget_allocations',
        weeklyStats: 'retro_money_weekly_stats',
        investments: 'retro_money_investments',
        accounts: 'retro_money_accounts',
        transfers: 'retro_money_transfers'
    },
    
    /**
     * Get data from localStorage with expiry check
     * @param {string} key - Storage key
     * @param {number} expiryTime - Expiry time in milliseconds
     * @returns {Object|null} - Stored data or null if expired/not found
     */
    get: function(key, expiryTime) {
        const storedData = localStorage.getItem(key);
        if (!storedData) return null;
        
        try {
            const data = JSON.parse(storedData);
            const now = new Date().getTime();
            
            // Check if data has expired
            if (data.timestamp && (now - data.timestamp > expiryTime)) {
                // Data expired, remove it
                localStorage.removeItem(key);
                return null;
            }
            
            return data.value;
        } catch (error) {
            console.error('Error parsing stored data:', error);
            localStorage.removeItem(key);
            return null;
        }
    },
    
    /**
     * Save data to localStorage with timestamp
     * @param {string} key - Storage key
     * @param {*} value - Data to store
     */
    set: function(key, value) {
        try {
            const data = {
                timestamp: new Date().getTime(),
                value: value
            };
            
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error storing data:', error);
            return false;
        }
    },
    
    /**
     * Remove specific item from storage
     * @param {string} key - Storage key to remove
     */
    remove: function(key) {
        localStorage.removeItem(key);
    },
    
    /**
     * Clear all app data from localStorage
     */
    clearAll: function() {
        Object.values(this.keys).forEach(key => {
            localStorage.removeItem(key);
        });
    },
    
    // Expenses specific methods
    expenses: {
        /**
         * Get expenses from cache or API
         * @param {Function} callback - Callback function for data
         * @param {boolean} forceRefresh - Force API refresh
         */
        get: function(callback, forceRefresh = false) {
            const expenses = !forceRefresh ? AppStorage.get(AppStorage.keys.expenses, AppStorage.cacheExpiry.expenses) : null;
            
            if (expenses && !forceRefresh) {
                callback(expenses);
                return;
            }
            
            // Fetch from API if not in cache or forced refresh
            fetch('/api/expenses')
                .then(response => response.json())
                .then(data => {
                    AppStorage.set(AppStorage.keys.expenses, data);
                    callback(data);
                })
                .catch(error => {
                    console.error('Error fetching expenses:', error);
                    callback([]);
                });
        },
        
        /**
         * Add a new expense and update cache
         * @param {Object} expense - Expense data
         * @param {Function} callback - Callback on success
         */
        add: function(expense, callback) {
            fetch('/api/expenses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(expense)
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // Force refresh expenses data
                    this.get(callback, true);
                    
                    // Also invalidate budget allocations
                    AppStorage.remove(AppStorage.keys.budgetAllocations);
                } else {
                    callback([]);
                }
            })
            .catch(error => {
                console.error('Error adding expense:', error);
                callback([]);
            });
        },
        
        /**
         * Delete an expense and update cache
         * @param {number} id - Expense ID
         * @param {Function} callback - Callback on success
         */
        delete: function(id, callback) {
            fetch(`/api/expenses/${id}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // Force refresh expenses data
                    this.get(callback, true);
                    
                    // Also invalidate budget allocations
                    AppStorage.remove(AppStorage.keys.budgetAllocations);
                } else {
                    callback([]);
                }
            })
            .catch(error => {
                console.error('Error deleting expense:', error);
                callback([]);
            });
        },
        
        /**
         * Invalidate expenses cache
         */
        invalidateCache: function() {
            AppStorage.remove(AppStorage.keys.expenses);
        }
    },
    
    // Exchange rate specific methods
    exchangeRate: {
        /**
         * Get exchange rate from cache or API
         * @param {string} type - Rate type ('blue' or 'tarjeta')
         * @param {Function} callback - Callback function for rate data
         * @param {boolean} forceRefresh - Force API refresh
         */
        get: function(type, callback, forceRefresh = false) {
            const key = type === 'blue' ? AppStorage.keys.rateBlue : AppStorage.keys.rateTarjeta;
            const rate = !forceRefresh ? AppStorage.get(key, AppStorage.cacheExpiry.rates) : null;
            
            if (rate && !forceRefresh) {
                callback(rate);
                return;
            }
            
            // Fetch from API if not in cache or forced refresh
            const url = type === 'blue' ? '/api/exchange-rate/blue' : '/api/exchange-rate/tarjeta';
            
            fetch(url)
                .then(response => response.json())
                .then(data => {
                    if (!data.error) {
                        AppStorage.set(key, data);
                        callback(data);
                    } else {
                        callback(null);
                    }
                })
                .catch(error => {
                    console.error(`Error fetching ${type} rate:`, error);
                    callback(null);
                });
        },
        
        /**
         * Set active rate type
         * @param {string} type - Rate type ('blue' or 'tarjeta')
         */
        setActiveType: function(type) {
            AppStorage.set(AppStorage.keys.activeRateType, type);
        },
        
        /**
         * Get active rate type
         * @returns {string} - Active rate type ('blue' or 'tarjeta')
         */
        getActiveType: function() {
            return AppStorage.get(AppStorage.keys.activeRateType, Infinity) || 'blue';
        }
    },
    
    // Salary specific methods
    salary: {
        /**
         * Get salary from cache or API
         * @param {Function} callback - Callback function for salary data
         * @param {boolean} forceRefresh - Force API refresh
         */
        get: function(callback, forceRefresh = false) {
            const salary = !forceRefresh ? AppStorage.get(AppStorage.keys.salary, AppStorage.cacheExpiry.salary) : null;
            
            if (salary !== null && !forceRefresh) {
                callback(salary);
                return;
            }
            
            // Fetch from API
            fetch('/api/salary')
                .then(response => response.json())
                .then(data => {
                    AppStorage.set(AppStorage.keys.salary, data.salary);
                    callback(data.salary);
                })
                .catch(error => {
                    console.error('Error fetching salary:', error);
                    callback(0);
                });
        },
        
        /**
         * Save salary and update cache
         * @param {number} amount - Salary amount
         * @param {Function} callback - Callback on success
         */
        save: function(amount, callback) {
            fetch('/api/salary', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ salary: amount })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    AppStorage.set(AppStorage.keys.salary, amount);
                    
                    // Invalidate budget allocations
                    AppStorage.remove(AppStorage.keys.budgetAllocations);
                    
                    callback(true);
                } else {
                    callback(false);
                }
            })
            .catch(error => {
                console.error('Error saving salary:', error);
                callback(false);
            });
        }
    },
    
    // Budget specific methods
    budget: {
        /**
         * Get budget allocations from cache or API
         * @param {Function} callback - Callback function for data
         * @param {boolean} forceRefresh - Force API refresh
         */
        getAllocations: function(callback, forceRefresh = false) {
            const allocations = !forceRefresh ? 
                AppStorage.get(AppStorage.keys.budgetAllocations, AppStorage.cacheExpiry.expenses) : null;
            
            if (allocations && !forceRefresh) {
                callback(allocations);
                return;
            }
            
            // Fetch from API
            fetch('/api/budget-allocations')
                .then(response => response.json())
                .then(data => {
                    AppStorage.set(AppStorage.keys.budgetAllocations, data);
                    callback(data);
                })
                .catch(error => {
                    console.error('Error fetching budget allocations:', error);
                    callback(null);
                });
        },
        
        /**
         * Invalidate budget allocations cache
         */
        invalidateCache: function() {
            AppStorage.remove(AppStorage.keys.budgetAllocations);
        }
    },
    
    // Todo specific methods
    todos: {
        /**
         * Get todos from cache or API
         * @param {Function} callback - Callback function for todo data
         * @param {boolean} forceRefresh - Force API refresh
         */
        get: function(callback, forceRefresh = false) {
            const todos = !forceRefresh ? AppStorage.get(AppStorage.keys.todos, AppStorage.cacheExpiry.todos) : null;
            
            if (todos && !forceRefresh) {
                callback(todos);
                return;
            }
            
            // Fetch from API
            fetch('/api/todos')
                .then(response => response.json())
                .then(data => {
                    AppStorage.set(AppStorage.keys.todos, data);
                    callback(data);
                })
                .catch(error => {
                    console.error('Error fetching todos:', error);
                    callback([]);
                });
        },
        
        /**
         * Add a new todo and update cache
         * @param {string} description - Todo description
         * @param {Function} callback - Callback on success
         */
        add: function(description, callback) {
            fetch('/api/todos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ description })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // Force refresh todos data
                    this.get(callback, true);
                    
                    // Also invalidate weekly stats
                    AppStorage.remove(AppStorage.keys.weeklyStats);
                } else {
                    callback([]);
                }
            })
            .catch(error => {
                console.error('Error adding todo:', error);
                callback([]);
            });
        },
        
        /**
         * Add a new subtask and update cache
         * @param {string} description - Subtask description
         * @param {number} parentId - Parent task ID
         * @param {Function} callback - Callback on success
         */
        addSubtask: function(description, parentId, callback) {
            fetch('/api/todos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    description,
                    parent_id: parentId
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // Force refresh todos data
                    this.get(callback, true);
                } else {
                    callback([]);
                }
            })
            .catch(error => {
                console.error('Error adding subtask:', error);
                callback([]);
            });
        },
        
        /**
         * Toggle todo completion status
         * @param {number} todoId - Todo ID
         * @param {Function} callback - Callback on success
         */
        toggle: function(todoId, callback) {
            fetch(`/api/todos/${todoId}/toggle`, {
                method: 'POST'
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // Force refresh todos data
                    this.get(callback, true);
                    
                    // Also invalidate weekly stats
                    AppStorage.remove(AppStorage.keys.weeklyStats);
                } else {
                    callback([]);
                }
            })
            .catch(error => {
                console.error('Error toggling todo:', error);
                callback([]);
            });
        },
        
        /**
         * Delete a todo and update cache
         * @param {number} todoId - Todo ID
         * @param {Function} callback - Callback on success
         */
        delete: function(todoId, callback) {
            fetch(`/api/todos/${todoId}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // Force refresh todos data
                    this.get(callback, true);
                    
                    // Also invalidate weekly stats
                    AppStorage.remove(AppStorage.keys.weeklyStats);
                } else {
                    callback([]);
                }
            })
            .catch(error => {
                console.error('Error deleting todo:', error);
                callback([]);
            });
        },
        
        /**
         * Get weekly stats from cache or API
         * @param {Function} callback - Callback function for stats data
         * @param {boolean} forceRefresh - Force API refresh
         */
        getWeeklyStats: function(callback, forceRefresh = false) {
            const stats = !forceRefresh ? AppStorage.get(AppStorage.keys.weeklyStats, AppStorage.cacheExpiry.stats) : null;
            
            if (stats && !forceRefresh) {
                callback(stats);
                return;
            }
            
            // Fetch from API
            fetch('/api/todos/stats/weekly')
                .then(response => response.json())
                .then(data => {
                    AppStorage.set(AppStorage.keys.weeklyStats, data);
                    callback(data);
                })
                .catch(error => {
                    console.error('Error fetching weekly stats:', error);
                    callback([]);
                });
        }
    },
    
    // Investments specific methods
    investments: {
        /**
         * Get investments from cache or API
         * @param {Function} callback - Callback function for data
         * @param {boolean} forceRefresh - Force API refresh
         */
        get: function(callback, forceRefresh = false) {
            const investments = !forceRefresh ? 
                AppStorage.get(AppStorage.keys.investments, AppStorage.cacheExpiry.investments) : null;
            
            if (investments && !forceRefresh) {
                callback(investments);
                return;
            }
            
            // Fetch from API
            fetch('/api/investments')
                .then(response => response.json())
                .then(data => {
                    AppStorage.set(AppStorage.keys.investments, data);
                    callback(data);
                })
                .catch(error => {
                    console.error('Error fetching investments:', error);
                    callback(null);
                });
        },
        
        /**
         * Add a new investment
         * @param {Object} investment - Investment data
         * @param {Function} callback - Callback on success
         */
        add: function(investment, callback) {
            fetch('/api/investments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(investment)
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // Force refresh investments data
                    this.get(callback, true);
                } else {
                    callback(null);
                }
            })
            .catch(error => {
                console.error('Error adding investment:', error);
                callback(null);
            });
        },
        
        /**
         * Update an investment
         * @param {number} id - Investment ID
         * @param {Object} data - Updated investment data
         * @param {Function} callback - Callback on success
         */
        update: function(id, data, callback) {
            fetch(`/api/investments/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(result => {
                if (result.status === 'success') {
                    // Force refresh investments data
                    this.get(callback, true);
                } else {
                    callback(null);
                }
            })
            .catch(error => {
                console.error('Error updating investment:', error);
                callback(null);
            });
        },
        
        /**
         * Delete an investment
         * @param {number} id - Investment ID
         * @param {Function} callback - Callback on success
         */
        delete: function(id, callback) {
            fetch(`/api/investments/${id}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // Force refresh investments data
                    this.get(callback, true);
                } else {
                    callback(null);
                }
            })
            .catch(error => {
                console.error('Error deleting investment:', error);
                callback(null);
            });
        },
        
        /**
         * Invalidate investments cache
         */
        invalidateCache: function() {
            AppStorage.remove(AppStorage.keys.investments);
        }
    },
    
    // Accounts management
    accounts: {
        /**
         * Get accounts from cache or API
         * @param {Function} callback - Callback function for account data
         * @param {boolean} forceRefresh - Force API refresh
         */
        get: function(callback, forceRefresh = false) {
            // Always refresh the accounts data to ensure ARS balance is updated
            // The backend handles the ARS account calculation based on Belo and dolar cripto
            forceRefresh = true;
            
            const accounts = !forceRefresh ? 
                AppStorage.get(AppStorage.keys.accounts, Infinity) : null;
            
            if (accounts && !forceRefresh) {
                callback(accounts);
                return;
            }
            
            // Fetch from API or use defaults if API fails
            fetch('/api/accounts')
                .then(response => response.json())
                .then(data => {
                    AppStorage.set(AppStorage.keys.accounts, data);
                    callback(data);
                })
                .catch(error => {
                    console.error('Error fetching accounts:', error);
                    // Default accounts if API fails
                    const defaultAccounts = {
                        payoneer: { balance: 0, currency: 'USD', name: 'Payoneer', fee_percent: 0.03 },
                        belo: { balance: 0, currency: 'USD', name: 'Belo', fee_percent: 0.01 },
                        ars: { balance: 0, currency: 'ARS', name: 'Cuenta ARS', fee_percent: 0 }
                    };
                    AppStorage.set(AppStorage.keys.accounts, defaultAccounts);
                    callback(defaultAccounts);
                });
        },
        
        /**
         * Update account balances
         * @param {Object} accountData - Updated account data
         * @param {Function} callback - Callback on success
         */
        update: function(accountData, callback) {
            fetch('/api/accounts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(accountData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    AppStorage.set(AppStorage.keys.accounts, accountData);
                    callback(true, accountData);
                } else {
                    callback(false, null);
                }
            })
            .catch(error => {
                console.error('Error updating accounts:', error);
                // Fall back to localStorage update if API fails
                AppStorage.set(AppStorage.keys.accounts, accountData);
                callback(true, accountData);
            });
        }
    },
    
    // Transfers management
    transfers: {
        /**
         * Get transfers from cache or API
         * @param {Function} callback - Callback function for transfers data
         * @param {boolean} forceRefresh - Force API refresh
         */
        get: function(callback, forceRefresh = false) {
            const transfers = !forceRefresh ? 
                AppStorage.get(AppStorage.keys.transfers, AppStorage.cacheExpiry.expenses) : null;
            
            if (transfers && !forceRefresh) {
                callback(transfers);
                return;
            }
            
            // Fetch from API
            fetch('/api/transfers')
                .then(response => response.json())
                .then(data => {
                    AppStorage.set(AppStorage.keys.transfers, data);
                    callback(data);
                })
                .catch(error => {
                    console.error('Error fetching transfers:', error);
                    callback([]);
                });
        },
        
        /**
         * Add a new transfer and update cache
         * @param {Object} transfer - Transfer data
         * @param {Function} callback - Callback on success
         */
        add: function(transfer, callback) {
            fetch('/api/transfers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(transfer)
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // Force refresh transfers data
                    this.get(callback, true);
                } else {
                    callback([]);
                }
            })
            .catch(error => {
                console.error('Error adding transfer:', error);
                callback([]);
            });
        },
        
        /**
         * Delete a transfer and update cache
         * @param {number} id - Transfer ID
         * @param {Function} callback - Callback on success
         */
        delete: function(id, callback) {
            fetch(`/api/transfers/${id}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // Force refresh transfers data
                    this.get(callback, true);
                } else {
                    callback([]);
                }
            })
            .catch(error => {
                console.error('Error deleting transfer:', error);
                callback([]);
            });
        },
        
        /**
         * Invalidate transfers cache
         */
        invalidateCache: function() {
            AppStorage.remove(AppStorage.keys.transfers);
        }
    }
}; 