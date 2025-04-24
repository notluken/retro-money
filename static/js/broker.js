/**
 * broker.js - InvertirOnline API Integration
 * RetroMoney App
 */

// Global variables
let brokerPortfolio = null;
let isAuthenticated = false;

// Broker API Integration
let brokerAccessToken = null;
let brokerRefreshToken = null;
let brokerTokenExpiry = null;

// Initialize the broker integration
document.addEventListener('DOMContentLoaded', initBrokerIntegration);

// Function to initialize broker integration
async function initBrokerIntegration() {
    console.log('Initializing broker integration...');
    
    // Configure event listeners
    setupEventListeners();
    
    // Check if we have an authentication token already
    try {
        const response = await fetch('/api/broker/portfolio');
        if (response.ok) {
            isAuthenticated = true;
            showPortfolioSection();
            fetchPortfolioData();
        } else {
            throw new Error('Not authenticated');
        }
    } catch (error) {
        console.error('Error checking broker authentication:', error);
        showAuthForm();
    }
}

// Setup event listeners
function setupEventListeners() {
    // Auth form submission
    const authForm = document.getElementById('broker-auth-form');
    if (authForm) {
        authForm.addEventListener('submit', function(e) {
            e.preventDefault();
            authenticateBroker();
        });
    }
    
    // Refresh portfolio button
    const refreshPortfolioBtn = document.getElementById('refresh-portfolio');
    if (refreshPortfolioBtn) {
        refreshPortfolioBtn.addEventListener('click', fetchPortfolioData);
    }
    
    // Toggle sections buttons
    const toggleBtns = document.querySelectorAll('.toggle-section');
    if (toggleBtns) {
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const targetId = this.getAttribute('data-target');
                toggleSection(targetId);
            });
        });
    }

    // Set up event listeners
    document.getElementById('broker-connect').addEventListener('click', authenticateBroker);
    document.getElementById('disconnect-broker').addEventListener('click', disconnectBroker);
    document.getElementById('refresh-broker-data').addEventListener('click', refreshBrokerData);
    document.getElementById('sync-selected-investments').addEventListener('click', syncSelectedInvestments);
    
    // Initialize select all checkbox functionality
    const selectAllCheckbox = document.getElementById('select-all-investments');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            const checkboxes = document.querySelectorAll('#broker-investments-grid-body .investment-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
        });
    }
    
    // Check if we have stored credentials
    checkStoredBrokerCredentials();

    // Add event listeners
    const logoutBtn = document.getElementById('broker-logout');
    const brokerRefreshBtn = document.getElementById('broker-refresh');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    if (brokerRefreshBtn) {
        brokerRefreshBtn.addEventListener('click', fetchPortfolioData);
    }
    
    // Add event listeners for investment buttons
    const addInvestmentBtn = document.getElementById('add-broker-investment');
    
    if (addInvestmentBtn) {
        addInvestmentBtn.addEventListener('click', function() {
            // Implement functionality to add a broker investment
            alert('Add broker investment functionality coming soon');
        });
    }
}

// Show authentication form
function showAuthForm() {
    const authSection = document.getElementById('broker-auth-section');
    const portfolioSection = document.getElementById('broker-portfolio-section');
    
    if (authSection && portfolioSection) {
        authSection.style.display = 'block';
        portfolioSection.style.display = 'none';
    }
}

// Show portfolio section
function showPortfolioSection() {
    const authSection = document.getElementById('broker-auth-section');
    const portfolioSection = document.getElementById('broker-portfolio-section');
    
    if (authSection && portfolioSection) {
        authSection.style.display = 'none';
        portfolioSection.style.display = 'block';
    }
}

// Toggle a collapsible section
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        const isVisible = section.style.display !== 'none';
        section.style.display = isVisible ? 'none' : 'block';
        
        // Update button text
        const button = document.querySelector(`[data-target="${sectionId}"]`);
        if (button) {
            const icon = button.querySelector('i');
            if (icon) {
                icon.className = isVisible ? 'fa fa-chevron-down' : 'fa fa-chevron-up';
            }
        }
    }
}

// Authenticate with the broker API
async function authenticateBroker() {
    const usernameInput = document.getElementById('broker-username');
    const passwordInput = document.getElementById('broker-password');
    
    if (!usernameInput || !passwordInput) {
        showError('Authentication form elements not found');
        return;
    }
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (!username || !password) {
        showError('Username and password are required');
        return;
    }
    
    let originalText = '';
    const authButton = document.querySelector('#broker-auth-form button') || document.getElementById('broker-connect');
    
    if (authButton) {
        originalText = authButton.textContent;
        authButton.disabled = true;
        authButton.textContent = 'Authenticating...';
    }
    
    try {
        const response = await fetch('/api/broker/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });
        
        if (authButton) {
            authButton.disabled = false;
            authButton.textContent = originalText;
        }
        
        const data = await response.json();
        
        if (data.success) {
            isAuthenticated = true;
            showPortfolioSection();
            fetchPortfolioData();
            showNotification('Successfully authenticated with InvertirOnline', 'success');
        } else {
            showError('Authentication failed: ' + data.message);
        }
    } catch (error) {
        showError('Error during authentication: ' + error.message);
    } finally {
        const authButton = document.querySelector('#broker-auth-form button') || document.getElementById('broker-connect');
        if (authButton) {
            authButton.disabled = false;
            authButton.textContent = originalText || 'Connect';
        }
    }
}

// Load broker portfolio data
async function loadBrokerPortfolio() {
    // This function has been replaced by fetchPortfolioData
    return fetchPortfolioData();
}

// Render portfolio data
function renderPortfolio() {
    const portfolioContainer = document.getElementById('broker-portfolio-data');
    if (!portfolioContainer || !brokerPortfolio) {
        return;
    }
    
    // Clear container
    portfolioContainer.innerHTML = '';
    
    // Add summary
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'portfolio-summary';
    
    const totalValue = formatCurrency(brokerPortfolio.total_value);
    const totalInvested = formatCurrency(brokerPortfolio.total_invested);
    const totalPL = formatCurrency(brokerPortfolio.total_profit_loss);
    const plPercent = (brokerPortfolio.total_profit_loss / brokerPortfolio.total_invested * 100).toFixed(2);
    const plClass = brokerPortfolio.total_profit_loss >= 0 ? 'positive' : 'negative';
    
    summaryDiv.innerHTML = `
        <div class="summary-row">
            <div class="summary-label">Total Value:</div>
            <div class="summary-value">${totalValue}</div>
        </div>
        <div class="summary-row">
            <div class="summary-label">Total Invested:</div>
            <div class="summary-value">${totalInvested}</div>
        </div>
        <div class="summary-row">
            <div class="summary-label">Profit/Loss:</div>
            <div class="summary-value ${plClass}">${totalPL} (${plPercent}%)</div>
        </div>
    `;
    
    portfolioContainer.appendChild(summaryDiv);
    
    // Add accounts
    brokerPortfolio.accounts.forEach(account => {
        const accountDiv = document.createElement('div');
        accountDiv.className = 'portfolio-account';
        
        const accountId = `account-${account.number.replace(/\s+/g, '-')}`;
        
        accountDiv.innerHTML = `
            <div class="account-header">
                <h3>${account.name} (${account.number})</h3>
                <div class="account-value">${formatCurrency(account.total_value)}</div>
                <button class="toggle-section" data-target="${accountId}-assets">
                    <i class="fa fa-chevron-down"></i>
                </button>
            </div>
            <div id="${accountId}-assets" class="account-assets" style="display: none;">
                <table class="assets-table">
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Description</th>
                            <th>Quantity</th>
                            <th>Purchase Price</th>
                            <th>Current Price</th>
                            <th>Current Value</th>
                            <th>P/L</th>
                            <th>P/L %</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${renderAssets(account.assets)}
                    </tbody>
                </table>
            </div>
        `;
        
        portfolioContainer.appendChild(accountDiv);
    });
    
    // Add event listeners for new toggle buttons
    const toggleBtns = portfolioContainer.querySelectorAll('.toggle-section');
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            toggleSection(targetId);
        });
    });
}

// Render assets as table rows
function renderAssets(assets) {
    if (!assets || assets.length === 0) {
        return '<tr><td colspan="8" class="empty-assets">No assets in this account</td></tr>';
    }
    
    return assets.map(asset => {
        const plClass = asset.profit_loss >= 0 ? 'positive' : 'negative';
        
        return `
            <tr>
                <td>${asset.ticker}</td>
                <td>${asset.description}</td>
                <td>${asset.quantity.toFixed(2)}</td>
                <td>${formatCurrency(asset.purchase_price)}</td>
                <td>${formatCurrency(asset.current_price)}</td>
                <td>${formatCurrency(asset.current_value)}</td>
                <td class="${plClass}">${formatCurrency(asset.profit_loss)}</td>
                <td class="${plClass}">${asset.profit_loss_percent.toFixed(2)}%</td>
            </tr>
        `;
    }).join('');
}

// Helper function to format currency
function formatCurrency(value) {
    return '$' + parseFloat(value).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

// Show error message
function showError(message) {
    console.error(message);
    showNotification(message, 'error');
}

function checkStoredBrokerCredentials() {
    // Check local storage for broker credentials
    const storedToken = localStorage.getItem('brokerAccessToken');
    const storedExpiry = localStorage.getItem('brokerTokenExpiry');
    
    if (storedToken && storedExpiry) {
        // Check if token is still valid
        if (new Date(storedExpiry) > new Date()) {
            brokerAccessToken = storedToken;
            brokerTokenExpiry = storedExpiry;
            
            // Show portfolio section
            document.getElementById('broker-auth-section').style.display = 'none';
            document.getElementById('broker-portfolio-section').style.display = 'block';
            
            // Load portfolio data
            loadBrokerPortfolio();
        } else {
            // Token expired, clear storage
            clearBrokerCredentials();
        }
    }
}

function disconnectBroker() {
    // Clear credentials
    clearBrokerCredentials();
    
    // Update UI
    document.getElementById('broker-auth-section').style.display = 'block';
    document.getElementById('broker-portfolio-section').style.display = 'none';
    document.getElementById('broker-username').value = '';
    document.getElementById('broker-password').value = '';
    document.getElementById('broker-investments-grid-body').innerHTML = '';
    
    showNotification('Disconnected from broker', 'info');
}

function clearBrokerCredentials() {
    brokerAccessToken = null;
    brokerRefreshToken = null;
    brokerTokenExpiry = null;
    
    localStorage.removeItem('brokerAccessToken');
    localStorage.removeItem('brokerTokenExpiry');
}

function refreshBrokerData() {
    // Implement refresh functionality
    console.log('Refreshing broker data...');
    
    // Reload portfolio data
    fetchPortfolioData();
    
    // Refresh any other components
    // ...
}

function loadBrokerPortfolio(isRefresh = false) {
    // This function has been replaced by fetchPortfolioData
    return fetchPortfolioData();
}

function displayBrokerInvestments(investments) {
    const gridBody = document.getElementById('broker-investments-grid-body');
    if (!gridBody) return;
    
    gridBody.innerHTML = '';
    
    // Calculate totals for summary
    let totalValue = 0;
    let totalCost = 0;
    
    investments.forEach((investment, index) => {
        // Calculate value and profit/loss
        const value = investment.price * investment.quantity;
        const costBasisTotal = investment.costBasis * investment.quantity;
        const profitLoss = value - costBasisTotal;
        const profitLossClass = profitLoss >= 0 ? 'profit' : 'loss';
        
        // Update totals
        totalValue += value;
        totalCost += costBasisTotal;
        
        const row = document.createElement('div');
        row.className = 'investments-grid-row';
        row.dataset.investment = JSON.stringify(investment);
        
        // Checkbox cell
        const checkboxCell = document.createElement('div');
        checkboxCell.className = 'investments-grid-cell checkbox-cell';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'investment-checkbox';
        checkbox.dataset.index = index;
        checkboxCell.appendChild(checkbox);
        row.appendChild(checkboxCell);
        
        // Name
        const nameCell = document.createElement('div');
        nameCell.className = 'investments-grid-cell';
        nameCell.textContent = investment.name;
        row.appendChild(nameCell);
        
        // Ticker
        const tickerCell = document.createElement('div');
        tickerCell.className = 'investments-grid-cell';
        tickerCell.textContent = investment.ticker;
        row.appendChild(tickerCell);
        
        // Quantity
        const quantityCell = document.createElement('div');
        quantityCell.className = 'investments-grid-cell';
        quantityCell.textContent = investment.quantity;
        row.appendChild(quantityCell);
        
        // Current Price
        const priceCell = document.createElement('div');
        priceCell.className = 'investments-grid-cell';
        priceCell.textContent = '$' + investment.price.toFixed(2);
        row.appendChild(priceCell);
        
        // Value
        const valueCell = document.createElement('div');
        valueCell.className = 'investments-grid-cell';
        valueCell.textContent = '$' + value.toFixed(2);
        row.appendChild(valueCell);
        
        // Profit/Loss
        const plCell = document.createElement('div');
        plCell.className = `investments-grid-cell ${profitLossClass}`;
        plCell.textContent = (profitLoss >= 0 ? '+' : '') + '$' + profitLoss.toFixed(2);
        row.appendChild(plCell);
        
        // Actions
        const actionsCell = document.createElement('div');
        actionsCell.className = 'investments-grid-cell actions';
        
        const addButton = document.createElement('button');
        addButton.className = 'action-button add';
        addButton.innerHTML = '➕';
        addButton.title = 'Add to Portfolio';
        addButton.addEventListener('click', () => addBrokerInvestmentToPortfolio(investment));
        actionsCell.appendChild(addButton);
        
        row.appendChild(actionsCell);
        
        gridBody.appendChild(row);
    });
    
    // Update broker summary if elements exist
    const brokerSummaryValue = document.getElementById('broker-summary-value');
    const brokerSummaryProfit = document.getElementById('broker-summary-profit');
    
    if (brokerSummaryValue) {
        brokerSummaryValue.textContent = '$' + totalValue.toFixed(2);
    }
    
    if (brokerSummaryProfit) {
        const totalProfit = totalValue - totalCost;
        brokerSummaryProfit.textContent = (totalProfit >= 0 ? '+' : '') + '$' + totalProfit.toFixed(2);
        brokerSummaryProfit.className = totalProfit >= 0 ? 'profit' : 'loss';
    }
}

function addBrokerInvestmentToPortfolio(investment) {
    // Create new investment object for the portfolio
    const newInvestment = {
        id: Date.now().toString(),
        name: investment.name + ' (' + investment.ticker + ')',
        type: 'stock',
        purchase_date: new Date().toISOString().split('T')[0],
        purchase_price: investment.costBasis,
        quantity: investment.quantity,
        current_price: investment.price,
        notes: 'Imported from broker'
    };
    
    // Add investment to the portfolio
    AppStorage.investments.get(function(data) {
        if (!data) {
            data = { investments: [] };
        }
        
        // Add the new investment
        data.investments.push(newInvestment);
        
        // Calculate total values
        calculateTotals(data);
        
        // Save data back to storage
        AppStorage.investments.set(data, function() {
            showNotification('Investment added to portfolio!', 'success');
            // Refresh the investments display
            fetchInvestments();
        });
    });
}

function syncSelectedInvestments() {
    const checkboxes = document.querySelectorAll('#broker-investments-grid-body .investment-checkbox:checked');
    
    if (checkboxes.length === 0) {
        showNotification('Please select at least one investment to sync', 'warning');
        return;
    }
    
    const selectedInvestments = [];
    
    checkboxes.forEach(checkbox => {
        const row = checkbox.closest('.investments-grid-row');
        const investment = JSON.parse(row.dataset.investment);
        selectedInvestments.push(investment);
    });
    
    AppStorage.investments.get(function(data) {
        if (!data) {
            data = { investments: [] };
        }
        
        // Add each selected investment
        selectedInvestments.forEach(investment => {
            const newInvestment = {
                id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
                name: investment.name + ' (' + investment.ticker + ')',
                type: 'stock',
                purchase_date: new Date().toISOString().split('T')[0],
                purchase_price: investment.costBasis,
                quantity: investment.quantity,
                current_price: investment.price,
                notes: 'Synced from broker'
            };
            
            data.investments.push(newInvestment);
        });
        
        // Calculate total values
        calculateTotals(data);
        
        // Save data back to storage
        AppStorage.investments.set(data, function() {
            showNotification(`${selectedInvestments.length} investment(s) added to portfolio!`, 'success');
            // Refresh the investments display
            fetchInvestments();
            
            // Uncheck all checkboxes
            document.getElementById('select-all-investments').checked = false;
            const allCheckboxes = document.querySelectorAll('#broker-investments-grid-body .investment-checkbox');
            allCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
        });
    });
}

function calculateTotals(data) {
    let totalInvested = 0;
    let totalCurrentValue = 0;
    
    data.investments.forEach(inv => {
        const invested = inv.purchase_price * inv.quantity;
        const currentValue = (inv.current_price || inv.purchase_price) * inv.quantity;
        
        totalInvested += invested;
        totalCurrentValue += currentValue;
        
        // Calculate profit/loss for each investment
        inv.total_value = currentValue;
        inv.profit_loss = currentValue - invested;
    });
    
    data.total_invested = totalInvested;
    data.total_current_value = totalCurrentValue;
    data.total_profit_loss = totalCurrentValue - totalInvested;
    
    // Calculate budget amount and percent used if relevant properties exist
    if (data.hasOwnProperty('budget_amount')) {
        data.budget_percent_used = (totalInvested / data.budget_amount) * 100;
    }
}

// Display a notification message
function showNotification(message, type = 'info') {
    // Check if the showNotification function exists in the global scope (from another file)
    if (typeof window.showNotification === 'function') {
        // Use the global function if it exists
        window.showNotification(message, type);
        return;
    }
    
    console.log(`Notification (${type}): ${message}`);
    
    // Create notification container if it doesn't exist
    let notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.style.position = 'fixed';
        notificationContainer.style.top = '20px';
        notificationContainer.style.right = '20px';
        notificationContainer.style.zIndex = '9999';
        document.body.appendChild(notificationContainer);
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.margin = '10px';
    notification.style.padding = '15px';
    notification.style.borderRadius = '5px';
    notification.style.maxWidth = '300px';
    notification.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
    
    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#4CAF50';
            notification.style.color = 'white';
            break;
        case 'error':
            notification.style.backgroundColor = '#F44336';
            notification.style.color = 'white';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ff9800';
            notification.style.color = 'white';
            break;
        default:
            notification.style.backgroundColor = '#2196F3';
            notification.style.color = 'white';
    }
    
    // Add message to notification
    notification.textContent = message;
    
    // Add close button
    const closeBtn = document.createElement('span');
    closeBtn.textContent = '×';
    closeBtn.style.float = 'right';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.marginLeft = '10px';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.addEventListener('click', () => {
        notification.remove();
    });
    notification.prepend(closeBtn);
    
    // Add to container
    notificationContainer.appendChild(notification);
    
    // Auto remove after delay
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Initialize broker integration on page load
document.addEventListener('DOMContentLoaded', function() {
    initBrokerIntegration();
});

// Process the portfolio data
function processPortfolioData(data) {
    const portfolioContainer = document.getElementById('broker-portfolio-container');
    
    if (!portfolioContainer) {
        showError('Portfolio container not found');
        return;
    }
    
    // Clear the container
    portfolioContainer.innerHTML = '';
    
    try {
        // Check if the response is valid
        if (!data.portfolio || !data.accounts) {
            showError('Invalid portfolio data');
            return;
        }
        
        // Portfolio summary
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'portfolio-summary';
        summaryDiv.innerHTML = `
            <h3>Portfolio Summary</h3>
            <div class="summary-info">
                <div class="summary-item">
                    <span class="label">Total Value:</span>
                    <span class="value">$${data.portfolio.totalValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Total Securities:</span>
                    <span class="value">${data.portfolio.securities.length}</span>
                </div>
            </div>
        `;
        portfolioContainer.appendChild(summaryDiv);
        
        // Account information
        data.accounts.forEach(account => {
            const accountDiv = document.createElement('div');
            accountDiv.className = 'account-info';
            accountDiv.innerHTML = `
                <h3>Account: ${account.name}</h3>
                <div class="account-details">
                    <div class="account-item">
                        <span class="label">Type:</span>
                        <span class="value">${account.type}</span>
                    </div>
                    <div class="account-item">
                        <span class="label">Balance:</span>
                        <span class="value">$${account.balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                </div>
            `;
            portfolioContainer.appendChild(accountDiv);
        });
        
        // Securities table
        const securitiesTable = document.createElement('div');
        securitiesTable.className = 'securities-table';
        
        let tableHTML = `
            <h3>Securities</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Symbol</th>
                        <th>Description</th>
                        <th>Quantity</th>
                        <th>Last Price</th>
                        <th>Market Value</th>
                        <th>Gain/Loss</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        data.portfolio.securities.forEach(security => {
            const gainLossClass = security.unrealizedPL >= 0 ? 'positive' : 'negative';
            const gainLossValue = security.unrealizedPL >= 0 ? '+' : '';
            
            tableHTML += `
                <tr>
                    <td>${security.symbol}</td>
                    <td>${security.description}</td>
                    <td>${security.quantity}</td>
                    <td>$${security.lastPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td>$${security.marketValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td class="${gainLossClass}">${gainLossValue}${security.unrealizedPL.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${security.unrealizedPLPercent.toFixed(2)}%)</td>
                </tr>
            `;
        });
        
        tableHTML += `
                </tbody>
            </table>
        `;
        
        securitiesTable.innerHTML = tableHTML;
        portfolioContainer.appendChild(securitiesTable);
        
    } catch (error) {
        showError('Error processing portfolio data');
    }
}

// Check authentication status on page load
async function checkAuthStatus() {
    try {
        const storedToken = localStorage.getItem('brokerAccessToken');
        const storedExpiry = localStorage.getItem('brokerTokenExpiry');
        
        if (storedToken && storedExpiry) {
            // Check if token is still valid
            const expiryTime = new Date(storedExpiry);
            if (expiryTime > new Date()) {
                brokerAccessToken = storedToken;
                brokerTokenExpiry = storedExpiry;
                isAuthenticated = true;
                document.getElementById('broker-auth-section').style.display = 'none';
                showPortfolioSection();
                fetchPortfolioData();
                return;
            }
            // Token expired, clear storage
        }
        
        // No valid token, show login form
        showAuthForm();
        document.getElementById('broker-portfolio-container').innerHTML = '';
        document.getElementById('broker-investments-grid-body').innerHTML = '';
        document.getElementById('broker-password').value = '';
        
    } catch (error) {
        showError('Error checking authentication status');
        showAuthForm();
    }
}

// Logout function
function logout() {
    isAuthenticated = false;
    brokerAccessToken = null;
    brokerRefreshToken = null;
    brokerTokenExpiry = null;
    
    localStorage.removeItem('brokerAccessToken');
    localStorage.removeItem('brokerTokenExpiry');
    
    showAuthForm();
    document.getElementById('broker-portfolio-container').innerHTML = '';
}

// Fetch portfolio data
async function fetchPortfolioData() {
    const portfolioContainer = document.getElementById('broker-portfolio-container');
    
    if (!portfolioContainer) {
        showError('Portfolio container not found');
        return;
    }
    
    // Show loading message
    portfolioContainer.innerHTML = '<div class="loading">Loading portfolio data...</div>';
    
    try {
        const response = await fetch('/api/broker/portfolio');
        
        if (!response.ok) {
            const data = await response.json();
            
            // If unauthorized, show auth form
            if (response.status === 401) {
                isAuthenticated = false;
                showAuthForm();
                showError('Authentication required. Please log in again.');
                return;
            }
            
            showError('Error loading portfolio: ' + (data.message || 'Unknown error'));
            return;
        }
        
        const data = await response.json();
        processPortfolioData(data);
        
    } catch (error) {
        showError('Error loading portfolio data');
        // Show auth form as fallback
        isAuthenticated = false;
        showAuthForm();
    }
} 