/**
 * Transfers.js - Account and Transfer Management
 * Retro Money App
 */

// Global variables
let accounts = {};
let transferHistory = [];
let exchangeRate = 0;
let cryptoRate = 0;

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', initTransfersPage);

// Main initialization function
async function initTransfersPage() {
    console.log('Initializing transfers page...');
    
    // First get the exchange rate
    await fetchExchangeRate();
    
    // Load accounts and transfers
    await loadAccounts();
    await loadTransfers();
    
    // Set up event listeners
    setupEventListeners();
    
    // Set an interval to update exchange rate and accounts every 5 minutes
    setInterval(async function() {
        console.log('Updating exchange rate and accounts...');
        await fetchExchangeRate();
        await loadAccounts();
    }, 5 * 60 * 1000); // 5 minutes
}

// Load exchange rate
async function fetchExchangeRate() {
    // Fetch crypto dollar rate directly from the API
    try {
        const cryptoResponse = await fetch('https://dolarapi.com/v1/dolares/cripto');
        if (!cryptoResponse.ok) {
            throw new Error(`HTTP error! status: ${cryptoResponse.status}`);
        }
        const cryptoData = await cryptoResponse.json();
        cryptoRate = cryptoData.venta;
        console.log('Crypto exchange rate updated:', cryptoRate);
    } catch (error) {
        console.error('Error fetching crypto rate:', error);
        cryptoRate = 1230; // Default value if it fails
        console.warn('Using default crypto exchange rate:', cryptoRate);
    }
    
    return cryptoRate;
}

// Load accounts from API
async function loadAccounts() {
    return new Promise((resolve) => {
        // Always get fresh accounts from the API
        AppStorage.accounts.get(function(accountsData) {
            accounts = accountsData;
            
            // Check if we need to manually update the ARS account
            const arsAccount = Object.values(accounts).find(acc => acc.currency === 'ARS');
            const beloAccount = Object.values(accounts).find(acc => acc.name === 'Belo');
            
            if (arsAccount && beloAccount && cryptoRate > 0) {
                // Check if the ARS balance is updated according to the crypto rate
                const expectedArsBalance = beloAccount.balance * cryptoRate;
                const diff = Math.abs(expectedArsBalance - arsAccount.balance);
                
                // If there is a significant difference (>1%), update in the frontend
                if (diff > (arsAccount.balance * 0.01) || arsAccount.balance === 0) {
                    console.log(`Updating ARS account manually: ${arsAccount.balance} -> ${expectedArsBalance}`);
                    arsAccount.balance = expectedArsBalance;
                }
            }
            
            renderAccounts();
            populateAccountSelects();
            resolve(accounts);
        }, true); // Force refresh
    });
}

// Load transfer history
async function loadTransfers() {
    return new Promise((resolve) => {
        AppStorage.transfers.get(function(transfersData) {
            transferHistory = transfersData;
            renderTransfers();
            resolve(transferHistory);
        });
    });
}

// Set up interaction events
function setupEventListeners() {
    // Event for updating account balances
    const updateAccountsBtn = document.getElementById('update-accounts');
    if (updateAccountsBtn) {
        updateAccountsBtn.addEventListener('click', updateAccountBalances);
    }
    
    // Events for transfers
    const transferFromSelect = document.getElementById('transfer-from');
    const transferToSelect = document.getElementById('transfer-to');
    const transferAmountInput = document.getElementById('transfer-amount');
    
    if (transferFromSelect && transferToSelect && transferAmountInput) {
        transferFromSelect.addEventListener('change', calculateFees);
        transferToSelect.addEventListener('change', calculateFees);
        transferAmountInput.addEventListener('input', calculateFees);
    }
    
    // Event for registering transfer
    const registerTransferBtn = document.getElementById('register-transfer');
    if (registerTransferBtn) {
        registerTransferBtn.addEventListener('click', registerTransfer);
    }
    
    // Set current date as default
    const transferDateInput = document.getElementById('transfer-date');
    if (transferDateInput) {
        transferDateInput.value = new Date().toISOString().split('T')[0];
    }
}

// Render account cards
function renderAccounts() {
    const accountCardsContainer = document.getElementById('account-cards');
    if (!accountCardsContainer) return;
    
    accountCardsContainer.innerHTML = '';
    
    // Iterate over each account
    Object.values(accounts).forEach(account => {
        const accountCard = document.createElement('div');
        accountCard.className = 'account-card';
        
        // Format balance according to currency
        const formattedBalance = account.currency === 'ARS' 
            ? `ARS ${formatNumber(account.balance)}` 
            : `$${formatNumber(account.balance, true)}`;
        
        accountCard.innerHTML = `
            <div class="account-card-header">
                <div class="account-name">${account.name}</div>
                <div class="account-currency">${account.currency}</div>
            </div>
            <div class="account-balance">${formattedBalance}</div>
            <div class="account-details">
                <div class="account-fee">Fee: ${(account.fee_percent * 100).toFixed(1)}%</div>
                <div class="account-edit">
                    <input type="number" class="account-balance-input" 
                        data-account-id="${account.id}" 
                        value="${account.balance}" 
                        step="0.01" min="0">
                </div>
            </div>
        `;
        
        accountCardsContainer.appendChild(accountCard);
    });
}

// Populate account selectors
function populateAccountSelects() {
    const fromSelect = document.getElementById('transfer-from');
    const toSelect = document.getElementById('transfer-to');
    
    if (!fromSelect || !toSelect) return;
    
    // Clear existing options
    fromSelect.innerHTML = '';
    toSelect.innerHTML = '';
    
    // Add options for each account
    Object.values(accounts).forEach(account => {
        const option = document.createElement('option');
        option.value = account.name;
        option.textContent = `${account.name} (${account.currency})`;
        
        fromSelect.appendChild(option.cloneNode(true));
        toSelect.appendChild(option.cloneNode(true));
    });
    
    // Select Payoneer as the default source
    const payoneerOption = Array.from(fromSelect.options).find(opt => opt.value === 'Payoneer');
    if (payoneerOption) {
        payoneerOption.selected = true;
    }
    
    // Select Belo as the default destination
    const beloOption = Array.from(toSelect.options).find(opt => opt.value === 'Belo');
    if (beloOption) {
        beloOption.selected = true;
    }
    
    // Calculate initial fees
    calculateFees();
}

// Calculate fees for a transfer
function calculateFees() {
    const amount = parseFloat(document.getElementById('transfer-amount').value) || 0;
    const feePayoneerPercentage = 0.03; // 3%
    const feeBeloPorcentage = 0.01; // 1%
    
    const feePayoneer = amount * feePayoneerPercentage;
    const feeBelo = amount * feeBeloPorcentage;
    const feeTotal = feePayoneer + feeBelo;
    const netAmount = amount - feeTotal;
    
    // Use the global cryptoRate variable instead of a hardcoded value
    const pesoAmount = netAmount * cryptoRate;
    
    // Update the display elements
    document.getElementById('fee-payoneer').textContent = feePayoneer.toFixed(2);
    document.getElementById('fee-belo').textContent = feeBelo.toFixed(2);
    document.getElementById('fee-amount').textContent = feeTotal.toFixed(2);
    document.getElementById('net-amount').textContent = netAmount.toFixed(2);
    document.getElementById('peso-amount').textContent = formatNumber(pesoAmount);
    document.getElementById('crypto-rate').textContent = formatNumber(cryptoRate);
}

// Register a new transfer
async function registerTransfer() {
    // Get form values
    const dateInput = document.getElementById('transfer-date');
    const descriptionInput = document.getElementById('transfer-description');
    const fromSelect = document.getElementById('transfer-from');
    const toSelect = document.getElementById('transfer-to');
    const amountInput = document.getElementById('transfer-amount');
    
    if (!dateInput || !fromSelect || !toSelect || !amountInput) return;
    
    const date = dateInput.value || new Date().toISOString().split('T')[0];
    const description = descriptionInput.value || 'Transfer';
    const fromAccountName = fromSelect.value;
    const toAccountName = toSelect.value;
    const grossAmount = parseFloat(amountInput.value) || 0;
    
    if (grossAmount <= 0) {
        alert('Please enter a valid amount');
        return;
    }
    
    // Find the corresponding accounts
    const fromAccount = Object.values(accounts).find(acc => acc.name === fromAccountName);
    const toAccount = Object.values(accounts).find(acc => acc.name === toAccountName);
    
    if (!fromAccount || !toAccount) {
        alert('Error: No se encontraron las cuentas seleccionadas');
        return;
    }
    
    // Check if the source account has enough balance
    if (fromAccount.balance < grossAmount) {
        alert(`Saldo insuficiente en ${fromAccountName}. Saldo actual: ${fromAccount.balance}`);
        return;
    }
    
    // Calculate fees
    const fromFee = fromAccount.name === 'Payoneer' ? grossAmount * 0.03 : grossAmount * fromAccount.fee_percent;
    const toFee = toAccount.name === 'Belo' ? (grossAmount - fromFee) * 0.01 : (grossAmount - fromFee) * toAccount.fee_percent;
    const totalFees = fromFee + toFee;
    const netAmount = grossAmount - totalFees;
    
    // Ensure we have the latest crypto rate if the transfer involves ARS
    if (fromAccount.currency === 'ARS' || toAccount.currency === 'ARS') {
        await fetchExchangeRate();
    }
    
    // Create transfer object
    const transfer = {
        date,
        from_account: fromAccountName,
        to_account: toAccountName,
        gross_amount: grossAmount,
        amount: netAmount,
        total_fees: totalFees,
        description
    };
    
    // Save the transfer
    AppStorage.transfers.add(transfer, function(updatedTransfers) {
        if (updatedTransfers) {
            transferHistory = updatedTransfers;
            
            // Update account balances
            fromAccount.balance -= grossAmount;
            
            if (toAccount.currency === 'ARS') {
                // For ARS accounts, use crypto rate
                toAccount.balance += netAmount * cryptoRate;
                console.log(`Converted ${netAmount} USD to ${netAmount * cryptoRate} ARS using crypto rate ${cryptoRate}`);
                
                // Ensure ARS account reflects the correct balance
                const arsAccount = Object.values(accounts).find(acc => acc.currency === 'ARS');
                const beloAccount = Object.values(accounts).find(acc => acc.name === 'Belo');
                
                // If Belo is involved in the transfer, update ARS accordingly
                if (fromAccountName === 'Belo' || toAccountName === 'Belo') {
                    console.log('Updating ARS account based on Belo after transfer');
                    arsAccount.balance = beloAccount.balance * cryptoRate;
                }
            } else if (toAccount.name === 'Belo' && fromAccount.currency === 'USD') {
                // For Belo, use USDC value
                toAccount.balance += netAmount;
                console.log(`Transferred ${netAmount} USD to Belo as USDC`);
                
                // Update ARS account if Belo is involved
                const arsAccount = Object.values(accounts).find(acc => acc.currency === 'ARS');
                if (arsAccount) {
                    console.log('Updating ARS account based on Belo after transfer');
                    arsAccount.balance = toAccount.balance * cryptoRate;
                }
            } else {
                toAccount.balance += netAmount;
                console.log(`Transferred ${netAmount} ${fromAccount.currency} to ${toAccount.name}`);
            }
            
            // Register fees as fixed expenses
            addCommissionAsExpense(totalFees, date, `Fee for transfer ${fromAccountName} -> ${toAccountName}`);
            
            // Save updated accounts
            AppStorage.accounts.update(accounts, function(success) {
                if (success) {
                    // Reload data
                    loadAccounts();
                    renderTransfers();
                    
                    // Clear form
                    amountInput.value = '';
                    descriptionInput.value = '';
                    calculateFees();
                    
                    alert('Transfer registered successfully');
                }
            });
        }
    });
}

// Register the fee as a fixed expense
function addCommissionAsExpense(amount, date, description) {
    // If the amount is too small, we don't register it
    if (amount <= 0) return;
    
    const expense = {
        amount: amount,
        date: date,
        description: description,
        category: 'Fixed Expenses',
        currency: 'USD'
    };
    
    // Use the storage API to add the expense
    AppStorage.expenses.add(expense, function() {
        console.log('Fee registered as fixed expense:', expense);
    });
}

// Render transfers
function renderTransfers() {
    const transfersGrid = document.getElementById('transfers-grid-body');
    if (!transfersGrid) return;
    
    transfersGrid.innerHTML = '';
    
    // If no transfers, show message
    if (!transferHistory || transferHistory.length === 0) {
        transfersGrid.innerHTML = `
            <div class="transfers-grid-row">
                <div class="transfers-grid-cell" style="text-align:center; grid-column: 1 / -1;">
                    No transfers found. Register your first transfer using the form above.
                </div>
            </div>
        `;
        return;
    }
    
    // Sort transfers by date (newest first)
    const sortedTransfers = [...transferHistory].sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
    });
    
    // Render each transfer
    sortedTransfers.forEach(transfer => {
        const row = document.createElement('div');
        row.className = 'transfers-grid-row';
        
        row.innerHTML = `
            <div class="transfers-grid-cell">${formatDate(transfer.date)}</div>
            <div class="transfers-grid-cell">${transfer.description}</div>
            <div class="transfers-grid-cell">${transfer.from_account}</div>
            <div class="transfers-grid-cell">${transfer.to_account}</div>
            <div class="transfers-grid-cell">$${formatNumber(transfer.gross_amount, true)}</div>
            <div class="transfers-grid-cell">$${formatNumber(transfer.total_fees, true)}</div>
            <div class="transfers-grid-cell">$${formatNumber(transfer.amount, true)}</div>
            <div class="transfers-grid-cell">
                <span class="transfer-action delete-transfer" data-id="${transfer.id}">Delete</span>
            </div>
        `;
        
        transfersGrid.appendChild(row);
    });
    
    // Add event listeners for delete buttons
    document.querySelectorAll('.delete-transfer').forEach(btn => {
        btn.addEventListener('click', function() {
            const transferId = this.getAttribute('data-id');
            if (confirm('Are you sure you want to delete this transfer?')) {
                deleteTransfer(transferId);
            }
        });
    });
}

// Helper function to format dates for display
function formatDate(dateStr) {
    // If the dateStr is already formatted or not a valid date, return as is
    if (!dateStr) return '';
    
    // Try to parse the date
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    // Format the date as MM/DD/YYYY
    return date.toLocaleDateString();
}

// Delete a transfer
function deleteTransfer(transferId) {
    // First get the transfer to delete
    const transferToDelete = transferHistory.find(t => t.id === parseInt(transferId));
    
    if (!transferToDelete) {
        alert('No se pudo encontrar la transferencia');
        return;
    }
    
    AppStorage.transfers.delete(transferId, function(updatedTransfers) {
        if (updatedTransfers) {
            // Revert account balances
            const fromAccount = Object.values(accounts).find(acc => acc.name === transferToDelete.from_account);
            const toAccount = Object.values(accounts).find(acc => acc.name === transferToDelete.to_account);
            
            if (fromAccount && toAccount) {
                // Return gross amount to the source account
                fromAccount.balance += transferToDelete.gross_amount;
                
                // Remove net amount from the destination account
                if (toAccount.currency === 'ARS' && fromAccount.currency === 'USD') {
                    // If converted to ARS using crypto rate
                    toAccount.balance -= transferToDelete.amount * cryptoRate;
                } else if (toAccount.name === 'Belo' && fromAccount.currency === 'USD') {
                    // If transferred to Belo as USDC
                    toAccount.balance -= transferToDelete.amount;
                } else {
                    // Regular transfer
                    toAccount.balance -= transferToDelete.amount;
                }
                
                // Save account changes
                AppStorage.accounts.update(accounts, function(success) {
                    if (success) {
                        transferHistory = updatedTransfers;
                        loadAccounts();
                        renderTransfers();
                        alert('Transfer deleted successfully and balances updated');
                    } else {
                        alert('Error updating account balances');
                    }
                });
            } else {
                transferHistory = updatedTransfers;
                renderTransfers();
                alert('Transfer deleted, but balances could not be updated');
            }
        }
    });
}

// Update account balances
function updateAccountBalances() {
    // Get all account balance inputs
    const balanceInputs = document.querySelectorAll('.account-balance-input');
    let hasChanges = false;
    
    // Update account balances from inputs
    balanceInputs.forEach(input => {
        const accountId = input.getAttribute('data-account-id');
        const newBalance = parseFloat(input.value) || 0;
        
        if (accounts[accountId] && accounts[accountId].balance !== newBalance) {
            accounts[accountId].balance = newBalance;
            hasChanges = true;
        }
    });
    
    if (hasChanges) {
        saveAccountChanges();
        alert('Account balances updated successfully');
    } else {
        alert('No changes detected');
    }
}

// Utility function to format numbers
function formatNumber(num, isUSD = false) {
    // Ensure it's a number
    num = parseFloat(num);
    
    // Check for invalid values
    if (isNaN(num)) {
        return "0.00";
    }
    
    // Format according to currency
    if (isUSD) {
        // Always show 2 decimals for USD
        return parseFloat(num.toFixed(2)).toFixed(2);
    } else {
        // For ARS, no decimals if it's an integer
        if (Math.abs(num % 1) < 0.001) {
            return Math.round(num).toString();
        } else {
            // Show up to 2 decimals, but remove trailing zeros
            return parseFloat(num.toFixed(2)).toString();
        }
    }
} 