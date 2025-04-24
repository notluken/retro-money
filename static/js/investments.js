// Investment tracker functionality

// Global variables
let investments = [];
let investmentChart = null;

// Initialize investments functionality
document.addEventListener('DOMContentLoaded', function() {
    initInvestments();
});

// Initialize investments
function initInvestments() {
    // Fetch investments data
    fetchInvestments();
    
    // Set up event listeners
    document.getElementById('add-investment').addEventListener('click', openAddInvestmentModal);
    document.getElementById('refresh-investments').addEventListener('click', () => fetchInvestments(true));
    document.getElementById('investment-form').addEventListener('submit', saveInvestment);
    document.getElementById('cancel-investment').addEventListener('click', closeInvestmentModal);
    
    // Close modal when clicking the X
    const closeButtons = document.querySelectorAll('.close-button');
    closeButtons.forEach(button => {
        button.addEventListener('click', closeInvestmentModal);
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('investment-modal');
        if (event.target === modal) {
            closeInvestmentModal();
        }
    });
}

// Fetch investments from API
function fetchInvestments(forceRefresh = false) {
    AppStorage.investments.get(function(data) {
        if (data) {
            investments = data.investments || [];
            displayInvestments(data);
            updateInvestmentSummary(data);
            updateInvestmentChart(data);
        }
    }, forceRefresh);
}

// Display investments in the grid
function displayInvestments(data) {
    const gridBody = document.getElementById('investments-grid-body');
    
    // Clear existing content
    gridBody.innerHTML = '';
    
    if (!data.investments || data.investments.length === 0) {
        const emptyRow = document.createElement('div');
        emptyRow.className = 'investments-grid-row';
        emptyRow.innerHTML = '<div class="investments-grid-cell" style="text-align:center; grid-column: 1 / -1;">No investments found. Click "Add Investment" to get started.</div>';
        gridBody.appendChild(emptyRow);
        return;
    }
    
    // Add each investment row
    data.investments.forEach(inv => {
        const row = document.createElement('div');
        row.className = 'investments-grid-row';
        
        // Name
        const nameCell = document.createElement('div');
        nameCell.className = 'investments-grid-cell';
        nameCell.textContent = inv.name;
        row.appendChild(nameCell);
        
        // Purchase Date
        const purchaseDateCell = document.createElement('div');
        purchaseDateCell.className = 'investments-grid-cell';
        purchaseDateCell.textContent = formatDate(inv.purchase_date);
        row.appendChild(purchaseDateCell);
        
        // Purchase Price
        const purchasePriceCell = document.createElement('div');
        purchasePriceCell.className = 'investments-grid-cell';
        purchasePriceCell.textContent = `$${formatNumber(inv.purchase_price, true)}`;
        row.appendChild(purchasePriceCell);
        
        // Quantity
        const quantityCell = document.createElement('div');
        quantityCell.className = 'investments-grid-cell';
        quantityCell.textContent = formatNumber(inv.quantity, false);
        row.appendChild(quantityCell);
        
        // Current Price
        const currentPriceCell = document.createElement('div');
        currentPriceCell.className = 'investments-grid-cell';
        currentPriceCell.textContent = `$${formatNumber(inv.current_price || inv.purchase_price, true)}`;
        row.appendChild(currentPriceCell);
        
        // Value
        const valueCell = document.createElement('div');
        valueCell.className = 'investments-grid-cell';
        valueCell.textContent = `$${formatNumber(inv.total_value, true)}`;
        row.appendChild(valueCell);
        
        // Profit/Loss
        const profitLossCell = document.createElement('div');
        profitLossCell.className = `investments-grid-cell ${inv.profit_loss >= 0 ? 'profit' : 'loss'}`;
        profitLossCell.textContent = `$${formatNumber(inv.profit_loss, true)}`;
        if (inv.profit_loss > 0) {
            profitLossCell.textContent = `+${profitLossCell.textContent}`;
        }
        row.appendChild(profitLossCell);
        
        // Actions
        const actionsCell = document.createElement('div');
        actionsCell.className = 'investments-grid-cell actions';
        
        // Edit button
        const editButton = document.createElement('button');
        editButton.className = 'action-button edit';
        editButton.innerHTML = '✏️';
        editButton.title = 'Edit';
        editButton.addEventListener('click', () => openEditInvestmentModal(inv));
        actionsCell.appendChild(editButton);
        
        // Update price button
        const updateButton = document.createElement('button');
        updateButton.className = 'action-button update';
        updateButton.innerHTML = '💰';
        updateButton.title = 'Update Price';
        updateButton.addEventListener('click', () => openUpdatePriceModal(inv));
        actionsCell.appendChild(updateButton);
        
        // Delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'action-button delete';
        deleteButton.innerHTML = '🗑️';
        deleteButton.title = 'Delete';
        deleteButton.addEventListener('click', () => confirmDeleteInvestment(inv.id));
        actionsCell.appendChild(deleteButton);
        
        row.appendChild(actionsCell);
        
        gridBody.appendChild(row);
    });
}

// Update investment summary
function updateInvestmentSummary(data) {
    document.getElementById('total-invested').textContent = `$${formatNumber(data.total_invested, true)}`;
    document.getElementById('total-current-value').textContent = `$${formatNumber(data.total_current_value, true)}`;
    
    const profitLossElement = document.getElementById('total-profit-loss');
    profitLossElement.textContent = `$${formatNumber(Math.abs(data.total_profit_loss), true)}`;
    
    if (data.total_profit_loss > 0) {
        profitLossElement.classList.add('positive');
        profitLossElement.classList.remove('negative');
        profitLossElement.textContent = `+${profitLossElement.textContent}`;
    } else if (data.total_profit_loss < 0) {
        profitLossElement.classList.add('negative');
        profitLossElement.classList.remove('positive');
        profitLossElement.textContent = `-${profitLossElement.textContent}`;
    } else {
        profitLossElement.classList.remove('positive', 'negative');
    }
    
    document.getElementById('investment-budget').textContent = `$${formatNumber(data.budget_amount, true)}`;
}

// Update investment chart
function updateInvestmentChart(data) {
    // Check if Chart.js is available
    if (typeof Chart === 'undefined') {
        console.error("Chart.js is not loaded. Cannot update investment chart.");
        return;
    }
    
    const chartCanvas = document.getElementById('investments-chart');
    if (!chartCanvas) {
        console.error("Investment chart canvas element not found.");
        return;
    }
    
    const ctx = chartCanvas.getContext('2d');
    if (!ctx) {
        console.error("Could not get 2D context from canvas.");
        return;
    }
    
    // Prepare data for chart
    const investments = data.investments || [];
    const labels = investments.map(inv => inv.name);
    const purchaseValues = investments.map(inv => parseFloat((inv.purchase_price * inv.quantity).toFixed(2)));
    const currentValues = investments.map(inv => parseFloat(inv.total_value.toFixed(2)));
    
    // Destroy existing chart if exists
    if (investmentChart) {
        investmentChart.destroy();
    }
    
    // Create new chart
    try {
        investmentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Purchase Value',
                        data: purchaseValues,
                        backgroundColor: 'rgba(54, 162, 235, 0.7)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Current Value',
                        data: currentValues,
                        backgroundColor: 'rgba(75, 192, 192, 0.7)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Value (USD)'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += '$' + formatNumber(context.raw, true);
                                return label;
                            }
                        }
                    }
                }
            }
        });
        console.log("Investment chart created successfully");
    } catch (error) {
        console.error("Error creating investment chart:", error);
    }
}

// Open add investment modal
function openAddInvestmentModal() {
    // Clear form
    document.getElementById('investment-id').value = '';
    document.getElementById('investment-name').value = '';
    document.getElementById('investment-type').value = 'stock';
    document.getElementById('investment-purchase-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('investment-purchase-price').value = '';
    document.getElementById('investment-quantity').value = '';
    document.getElementById('investment-current-price').value = '';
    document.getElementById('investment-notes').value = '';
    
    // Update modal title
    document.getElementById('investment-modal-title').textContent = 'Add Investment';
    
    // Show modal
    document.getElementById('investment-modal').style.display = 'block';
}

// Open edit investment modal
function openEditInvestmentModal(investment) {
    // Fill form with investment data
    document.getElementById('investment-id').value = investment.id;
    document.getElementById('investment-name').value = investment.name;
    document.getElementById('investment-type').value = investment.investment_type || 'stock';
    document.getElementById('investment-purchase-date').value = investment.purchase_date;
    document.getElementById('investment-purchase-price').value = investment.purchase_price;
    document.getElementById('investment-quantity').value = investment.quantity;
    document.getElementById('investment-current-price').value = investment.current_price || investment.purchase_price;
    document.getElementById('investment-notes').value = investment.notes || '';
    
    // Update modal title
    document.getElementById('investment-modal-title').textContent = 'Edit Investment';
    
    // Show modal
    document.getElementById('investment-modal').style.display = 'block';
}

// Open update price modal
function openUpdatePriceModal(investment) {
    // Fill form with minimal data
    document.getElementById('investment-id').value = investment.id;
    document.getElementById('investment-name').value = investment.name;
    document.getElementById('investment-type').value = investment.investment_type || 'stock';
    document.getElementById('investment-purchase-date').value = investment.purchase_date;
    document.getElementById('investment-purchase-price').value = investment.purchase_price;
    document.getElementById('investment-quantity').value = investment.quantity;
    document.getElementById('investment-current-price').value = investment.current_price || investment.purchase_price;
    document.getElementById('investment-notes').value = investment.notes || '';
    
    // Update modal title
    document.getElementById('investment-modal-title').textContent = 'Update Price';
    
    // Show modal
    document.getElementById('investment-modal').style.display = 'block';
}

// Close investment modal
function closeInvestmentModal() {
    document.getElementById('investment-modal').style.display = 'none';
}

// Save investment
function saveInvestment(event) {
    event.preventDefault();
    
    const id = document.getElementById('investment-id').value;
    const investment = {
        name: document.getElementById('investment-name').value,
        purchase_date: document.getElementById('investment-purchase-date').value,
        purchase_price: parseFloat(document.getElementById('investment-purchase-price').value),
        quantity: parseFloat(document.getElementById('investment-quantity').value),
        current_price: parseFloat(document.getElementById('investment-current-price').value || document.getElementById('investment-purchase-price').value),
        investment_type: document.getElementById('investment-type').value,
        notes: document.getElementById('investment-notes').value
    };
    
    if (id) {
        // Update existing investment
        AppStorage.investments.update(id, investment, function(data) {
            if (data) {
                closeInvestmentModal();
                
                // Invalidate caches to ensure data consistency
                // Also invalidate expenses cache since we might have updated an expense
                if (AppStorage.expenses && typeof AppStorage.expenses.invalidateCache === 'function') {
                    AppStorage.expenses.invalidateCache();
                }
                
                // Also invalidate budget allocations
                if (AppStorage.budget && typeof AppStorage.budget.invalidateCache === 'function') {
                    AppStorage.budget.invalidateCache();
                }
                
                fetchInvestments(true); // Force refresh
            }
        });
    } else {
        // Add new investment
        AppStorage.investments.add(investment, function(data) {
            if (data) {
                closeInvestmentModal();
                
                // Show success message
                const totalAmount = investment.purchase_price * investment.quantity;
                alert(`Investment added successfully. A corresponding expense of $${formatNumber(totalAmount, true)} has been added to your Investments budget category.`);
                
                // Invalidate caches to ensure data consistency
                // Also invalidate expenses cache since we've added an expense
                if (AppStorage.expenses && typeof AppStorage.expenses.invalidateCache === 'function') {
                    AppStorage.expenses.invalidateCache();
                }
                
                // Also invalidate budget allocations
                if (AppStorage.budget && typeof AppStorage.budget.invalidateCache === 'function') {
                    AppStorage.budget.invalidateCache();
                }
                
                fetchInvestments(true); // Force refresh
            }
        });
    }
}

// Confirm delete investment
function confirmDeleteInvestment(id) {
    if (confirm('Are you sure you want to delete this investment? This will also remove the corresponding expense from your budget.')) {
        AppStorage.investments.delete(id, function(data) {
            if (data) {
                // Invalidate caches to ensure data consistency
                // Also invalidate expenses cache since we've removed an expense
                if (AppStorage.expenses && typeof AppStorage.expenses.invalidateCache === 'function') {
                    AppStorage.expenses.invalidateCache();
                }
                
                // Also invalidate budget allocations
                if (AppStorage.budget && typeof AppStorage.budget.invalidateCache === 'function') {
                    AppStorage.budget.invalidateCache();
                }
                
                fetchInvestments(true); // Force refresh
            }
        });
    }
}

// Utility function to format date
function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return dateString; // Return as-is if invalid
    }
    
    return date.toLocaleDateString();
}

// Utility function to format number
function formatNumber(number, decimals = false) {
    if (typeof number !== 'number') {
        return '0.00';
    }
    
    const options = {
        minimumFractionDigits: decimals ? 2 : 0,
        maximumFractionDigits: decimals ? 2 : 2
    };
    
    return number.toLocaleString('en-US', options);
} 