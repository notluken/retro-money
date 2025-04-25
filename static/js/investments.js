// Investment tracker functionality

// Global variables
let accessToken = null;
let portfolioData = null;
let portfolioChart = null;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Setup event listeners
    document.getElementById('connect-broker-btn').addEventListener('click', showLoginModal);
    document.getElementById('close-login-btn').addEventListener('click', closeLoginModal);
    document.getElementById('cancel-login-btn').addEventListener('click', closeLoginModal);
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('refresh-investments-btn').addEventListener('click', fetchPortfolioData);
    
    // Check if user is already logged in
    if (localStorage.getItem('investment_token')) {
        accessToken = localStorage.getItem('investment_token');
        showDashboard();
        fetchPortfolioData();
    } else {
        // Show login modal automatically on page load
        showLoginModal();
    }
});

// Show login modal
function showLoginModal() {
    document.getElementById('login-modal').style.display = 'flex';
    
    // Focus on username field
    setTimeout(function() {
        document.getElementById('username').focus();
    }, 100);
}

// Close login modal
function closeLoginModal() {
    document.getElementById('login-modal').style.display = 'none';
}

// Handle login
function handleLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    
    if (!username || !password) {
        alert('Please enter your username and password');
        return;
    }
    
    // Show loading state
    const loginBtn = document.getElementById('login-btn');
    const originalBtnText = loginBtn.textContent;
    loginBtn.disabled = true;
    loginBtn.textContent = 'Connecting...';
    
    // Use our backend as a proxy to avoid CORS issues
    fetch('/api/broker/auth', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: username,
            password: password
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Authentication failed (${response.status})`);
        }
        return response.json();
    })
    .then(data => {
        if (data.token) {
            // Store the token
            accessToken = data.token;
            localStorage.setItem('investment_token', accessToken);
            
            // Hide login modal
            closeLoginModal();
            
            // Show dashboard
            showDashboard();
            
            // Fetch data
            fetchPortfolioData();
        } else {
            throw new Error('Authentication failed - no token received');
        }
    })
    .catch(error => {
        alert('Login failed: ' + error.message);
    })
    .finally(() => {
        // Reset button
        loginBtn.disabled = false;
        loginBtn.textContent = originalBtnText;
    });
}

// Handle logout
function handleLogout() {
    // Clear token
    accessToken = null;
    localStorage.removeItem('investment_token');
    
    // Show main screen
    document.getElementById('investments-main').style.display = 'block';
    document.getElementById('investments-dashboard').style.display = 'none';
    
    // Clear data
    portfolioData = null;
    
    // If chart exists, destroy it
    if (portfolioChart) {
        portfolioChart.destroy();
        portfolioChart = null;
    }
}

// Show dashboard
function showDashboard() {
    document.getElementById('investments-main').style.display = 'none';
    document.getElementById('investments-dashboard').style.display = 'block';
}

// Fetch portfolio data
function fetchPortfolioData() {
    if (!accessToken) {
        showLoginModal();
        return;
    }
    
    // Show loading state
    document.getElementById('portfolio-tbody').innerHTML = '<tr><td colspan="8" style="text-align:center;">Loading portfolio data...</td></tr>';
    
    // Use our backend as a proxy to avoid CORS issues
    fetch('/api/broker/portfolio', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication failed or token expired');
            } else {
                throw new Error(`API error: ${response.status}`);
            }
        }
        return response.json();
    })
    .then(data => {
        portfolioData = data;
        renderPortfolioData(data);
    })
    .catch(error => {
        console.error('Error fetching portfolio data:', error);
        document.getElementById('portfolio-tbody').innerHTML = 
            `<tr><td colspan="8" style="text-align:center;">Error loading data: ${error.message}. Please try again.</td></tr>`;
        
        if (error.message.includes('Authentication failed') || error.message.includes('token expired')) {
            // Token expired, show login
            handleLogout();
            showLoginModal();
        }
    });
}

// Render portfolio data
function renderPortfolioData(data) {
    if (!data || !data.activos || !Array.isArray(data.activos)) {
        document.getElementById('portfolio-tbody').innerHTML = 
            '<tr><td colspan="8" style="text-align:center;">No portfolio data available.</td></tr>';
        return;
    }
    
    const activos = data.activos;
    const tbody = document.getElementById('portfolio-tbody');
    tbody.innerHTML = '';
    
    // Calculate totals
    let totalValue = 0;
    let totalGain = 0;
    
    // Render each asset row
    activos.forEach(activo => {
        const row = document.createElement('tr');
        
        // Symbol
        const symbolCell = document.createElement('td');
        symbolCell.textContent = activo.titulo.simbolo;
        row.appendChild(symbolCell);
        
        // Description
        const descCell = document.createElement('td');
        descCell.textContent = activo.titulo.descripcion;
        row.appendChild(descCell);
        
        // Quantity
        const quantityCell = document.createElement('td');
        quantityCell.textContent = activo.cantidad.toLocaleString();
        row.appendChild(quantityCell);
        
        // Last Price
        const priceCell = document.createElement('td');
        priceCell.textContent = formatCurrency(activo.ultimoPrecio);
        row.appendChild(priceCell);
        
        // Total Value
        const valueCell = document.createElement('td');
        valueCell.textContent = formatCurrency(activo.valorizado);
        row.appendChild(valueCell);
        
        // Purchase Price
        const purchaseCell = document.createElement('td');
        purchaseCell.textContent = formatCurrency(activo.ppc);
        row.appendChild(purchaseCell);
        
        // Profit/Loss
        const plCell = document.createElement('td');
        plCell.textContent = formatCurrency(activo.gananciaDinero);
        plCell.className = activo.gananciaDinero >= 0 ? 'profit' : 'loss';
        row.appendChild(plCell);
        
        // Profit/Loss Percentage
        const plPercentCell = document.createElement('td');
        plPercentCell.textContent = activo.gananciaPorcentaje.toFixed(2) + '%';
        plPercentCell.className = activo.gananciaPorcentaje >= 0 ? 'profit' : 'loss';
        row.appendChild(plPercentCell);
        
        tbody.appendChild(row);
        
        // Add to totals
        totalValue += activo.valorizado;
        totalGain += activo.gananciaDinero;
    });
    
    // Update summary
    document.getElementById('total-value').innerHTML = `
        <div style="margin-bottom: 10px;">
            <strong>Total Value:</strong> ${formatCurrency(totalValue)}
        </div>
    `;
    
    document.getElementById('total-profit').innerHTML = `
        <div style="margin-bottom: 10px;">
            <strong>Total Profit/Loss:</strong> 
            <span class="${totalGain >= 0 ? 'profit' : 'loss'}">
                ${formatCurrency(totalGain)}
            </span>
        </div>
    `;
    
    document.getElementById('total-assets').innerHTML = `
        <div style="margin-bottom: 10px;">
            <strong>Total Assets:</strong> ${activos.length}
        </div>
    `;
    
    // Update chart
    updatePortfolioChart(data.activos);
}

// Update portfolio chart
function updatePortfolioChart(assets) {
    const chartCanvas = document.getElementById('portfolio-chart');
    
    // Prepare data for chart
    const labels = assets.map(asset => asset.titulo.simbolo);
    const data = assets.map(asset => asset.valorizado);
    const backgroundColors = [
        'rgba(255, 99, 132, 0.7)',
        'rgba(54, 162, 235, 0.7)',
        'rgba(255, 206, 86, 0.7)',
        'rgba(75, 192, 192, 0.7)',
        'rgba(153, 102, 255, 0.7)',
        'rgba(255, 159, 64, 0.7)',
        'rgba(199, 199, 199, 0.7)'
    ];
    
    // Destroy previous chart if it exists
    if (portfolioChart) {
        portfolioChart.destroy();
    }
    
    // Create new chart
    portfolioChart = new Chart(chartCanvas, {
        type: 'pie',
            data: {
                labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors.slice(0, assets.length),
                borderColor: 'white',
                        borderWidth: 1
            }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 15,
                        font: {
                            family: 'Courier New',
                            size: 12
                        }
                    }
                },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                            const value = context.raw;
                            const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Format currency
function formatCurrency(value) {
    return '$' + parseFloat(value).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
} 