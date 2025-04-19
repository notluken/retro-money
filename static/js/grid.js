// Grid dimensions
const GRID_ROWS = 50;
const GRID_COLS = 15;
const COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];

// Global variables
let selectedCell = null;
let exchangeRate = 0;
let exchangeRateTarjeta = 0;
let monthlySalary = 0;
let gridData = {}; // Will store cell data
let expenses = []; // Will store expense objects
let cellFormulas = {}; // Will store formulas for cells
let columnWidths = {}; // Store custom column widths
let rowHeights = {}; // Store custom row heights
let selectedDolarType = 'blue'; // Default dollar type (blue or tarjeta)

// Default column widths
const DEFAULT_COLUMN_WIDTHS = {
    'A': 60,
    'B': 110,
    'C': 200,  // Description column - wider
    'D': 120,
    'E': 120,
    'F': 100,
    'G': 100
};

// Initialize the grid
function initGrid() {
    const grid = document.getElementById('expense-grid');
    
    // Clear existing content
    grid.innerHTML = '';
    
    // Create cells
    for (let r = 0; r < GRID_ROWS; r++) {
        const row = document.createElement('div');
        row.className = 'grid-row';
        
        // Apply custom row height if exists
        if (rowHeights[r + 1]) {
            row.style.height = rowHeights[r + 1] + 'px';
        }
        
        for (let c = 0; c < GRID_COLS; c++) {
            const colLetter = COL_LETTERS[c];
            const cellId = `${colLetter}${r + 1}`;
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.id = cellId;
            cell.dataset.row = r + 1;
            cell.dataset.col = colLetter;
            cell.textContent = gridData[cellId] || '';
            
            // Apply width from columnWidths or use default
            const width = columnWidths[colLetter] || DEFAULT_COLUMN_WIDTHS[colLetter] || 120;
            cell.style.width = `${width}px`;
            cell.style.minWidth = `${width}px`;
            
            // Add event listeners
            cell.addEventListener('click', () => selectCell(cell));
            cell.addEventListener('dblclick', () => editCell(cell));
            
            row.appendChild(cell);
        }
        
        grid.appendChild(row);
    }
    
    // Initialize fixed header row for expenses table
    setupExpenseHeaders();
    
    // Setup resizing for columns and rows
    setupResizeHandlers();
}

// Set up fixed headers for expenses table
function setupExpenseHeaders() {
    const headers = [
        { cell: 'A1', value: 'Date', style: 'bold' },
        { cell: 'B1', value: 'Description', style: 'bold' },
        { cell: 'C1', value: 'Amount (USD)', style: 'bold' },
        { cell: 'D1', value: 'Amount (ARS)', style: 'bold' },
        { cell: 'E1', value: 'Currency', style: 'bold' },
        { cell: 'F1', value: 'Actions', style: 'bold' }
    ];
    
    headers.forEach(header => {
        const cell = document.getElementById(header.cell);
        if (cell) {
            cell.textContent = header.value;
            cell.classList.add(header.style);
            gridData[header.cell] = header.value;
        }
    });
}

// Set up column and row resize handlers
function setupResizeHandlers() {
    // Column resize
    const columnHeaders = document.querySelectorAll('.column-header');
    
    columnHeaders.forEach((header, index) => {
        const letter = COL_LETTERS[index];
        
        // Apply width from columnWidths or use default
        const width = columnWidths[letter] || DEFAULT_COLUMN_WIDTHS[letter] || 120;
        header.style.width = `${width}px`;
        header.style.minWidth = `${width}px`;
        
        header.addEventListener('mousedown', (e) => {
            // Check if we clicked on the resize handle (right 4px of column header)
            const rect = header.getBoundingClientRect();
            if (e.clientX > rect.right - 4) {
                startColumnResize(letter, e.clientX);
            }
        });
    });
    
    // Row resize
    const rowHeaders = document.querySelectorAll('.row-header');
    
    rowHeaders.forEach((header, index) => {
        const rowNum = index + 1;
        
        // Apply any existing custom height
        if (rowHeights[rowNum]) {
            header.style.height = rowHeights[rowNum] + 'px';
        }
        
        header.addEventListener('mousedown', (e) => {
            // Check if we clicked on the resize handle (bottom 4px of row header)
            const rect = header.getBoundingClientRect();
            if (e.clientY > rect.bottom - 4) {
                startRowResize(rowNum, e.clientY);
            }
        });
    });
    
    // Update corner cell to match row headers
    const cornerCell = document.querySelector('.corner-cell');
    if (cornerCell) {
        cornerCell.style.width = '60px';
        cornerCell.style.minWidth = '60px';
    }
}

// Start column resize operation
function startColumnResize(colLetter, startX) {
    const columnCells = document.querySelectorAll(`.grid-cell[data-col="${colLetter}"]`);
    const columnHeader = document.querySelector(`.column-header:nth-child(${COL_LETTERS.indexOf(colLetter) + 2})`);
    const initialWidth = columnHeader.offsetWidth;
    
    // Create a resize handle indicator
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle-active resize-handle-col';
    resizeHandle.style.left = (startX - 2) + 'px'; // Center the handle on the cursor
    document.body.appendChild(resizeHandle);
    
    const onMouseMove = (e) => {
        const deltaX = e.clientX - startX;
        const newWidth = Math.max(20, initialWidth + deltaX); // Minimum width of 20px
        
        // Update the visual guide
        resizeHandle.style.left = (e.clientX - 2) + 'px';
    };
    
    const onMouseUp = (e) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        // Calculate final width
        const deltaX = e.clientX - startX;
        const newWidth = Math.max(20, initialWidth + deltaX);
        
        // Store the new width
        columnWidths[colLetter] = newWidth;
        
        // Apply to header
        columnHeader.style.width = newWidth + 'px';
        
        // Apply to all cells in this column
        columnCells.forEach(cell => {
            cell.style.width = newWidth + 'px';
        });
        
        // Remove the resize handle
        document.body.removeChild(resizeHandle);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// Start row resize operation
function startRowResize(rowNum, startY) {
    const rowCells = document.querySelectorAll(`.grid-cell[data-row="${rowNum}"]`);
    const rowHeader = document.querySelector(`.row-header:nth-child(${rowNum})`);
    const gridRow = document.querySelector(`.grid-row:nth-child(${rowNum})`);
    const initialHeight = rowHeader.offsetHeight;
    
    // Create a resize handle indicator
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle-active resize-handle-row';
    resizeHandle.style.top = (startY - 2) + 'px'; // Center the handle on the cursor
    document.body.appendChild(resizeHandle);
    
    const onMouseMove = (e) => {
        const deltaY = e.clientY - startY;
        const newHeight = Math.max(15, initialHeight + deltaY); // Minimum height of 15px
        
        // Update the visual guide
        resizeHandle.style.top = (e.clientY - 2) + 'px';
    };
    
    const onMouseUp = (e) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        // Calculate final height
        const deltaY = e.clientY - startY;
        const newHeight = Math.max(15, initialHeight + deltaY);
        
        // Store the new height
        rowHeights[rowNum] = newHeight;
        
        // Apply to header
        rowHeader.style.height = newHeight + 'px';
        
        // Apply to the row
        if (gridRow) {
            gridRow.style.height = newHeight + 'px';
        }
        
        // Apply to all cells in this row
        rowCells.forEach(cell => {
            cell.style.height = newHeight + 'px';
        });
        
        // Remove the resize handle
        document.body.removeChild(resizeHandle);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// Select a cell
function selectCell(cell) {
    // Deselect previous cell
    if (selectedCell) {
        selectedCell.classList.remove('selected');
    }
    
    // Select new cell
    selectedCell = cell;
    cell.classList.add('selected');
    
    // Update formula bar
    const formulaInput = document.getElementById('formula-input');
    const cellId = cell.id;
    formulaInput.value = cellFormulas[cellId] || '';
}

// Edit a cell
function editCell(cell) {
    const cellId = cell.id;
    const value = cellFormulas[cellId] || cell.textContent;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.style.width = '100%';
    input.style.height = '100%';
    input.style.border = 'none';
    input.style.padding = '2px 4px';
    input.style.fontFamily = 'Courier New, monospace';
    
    // Clear cell content
    cell.textContent = '';
    cell.appendChild(input);
    
    // Focus input
    input.focus();
    
    // Handle input events
    input.addEventListener('blur', () => finishEdit(cell, input));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            finishEdit(cell, input);
        }
    });
}

// Finish editing a cell
function finishEdit(cell, input) {
    const cellId = cell.id;
    const value = input.value;
    const row = parseInt(cell.dataset.row);
    const col = cell.dataset.col;
    
    // Check if it's a formula
    if (value.startsWith('=')) {
        cellFormulas[cellId] = value;
        const calculatedValue = calculateFormula(value);
        cell.textContent = calculatedValue !== null ? calculatedValue : '#ERROR';
        gridData[cellId] = calculatedValue;
    } else {
        cell.textContent = value;
        gridData[cellId] = value;
        delete cellFormulas[cellId];
        
        // Check if this is an editable expense cell and save changes
        if (row > 1 && row <= expenses.length + 1) {
            const expenseIndex = row - 2;
            const expense = expenses[expenseIndex];
            
            if (expense) {
                // Map column letters to expense properties
                if (col === 'A') { // Date
                    expense.date = value;
                    saveExpenseChanges(expense);
                } else if (col === 'B') { // Description
                    expense.description = value;
                    saveExpenseChanges(expense);
                } else if (col === 'C') { // Amount (USD)
                    const amount = parseFloat(value.replace(/[$,]/g, ''));
                    if (!isNaN(amount)) {
                        if (expense.currency === 'ARS') {
                            // If expense is in ARS, convert USD back to ARS
                            const rate = expense.currency === 'USD-Blue' ? exchangeRate : 
                                       expense.currency === 'USD-Tarjeta' ? exchangeRateTarjeta :
                                       selectedDolarType === 'blue' ? exchangeRate : exchangeRateTarjeta;
                            expense.amount = amount * rate;
                        } else {
                            expense.amount = amount;
                        }
                        saveExpenseChanges(expense);
                        displayExpenses(); // Refresh to update calculated values
                    }
                } else if (col === 'D') { // Amount (ARS)
                    const amount = parseFloat(value.replace(/[ARS$,\s]/g, ''));
                    if (!isNaN(amount)) {
                        if (expense.currency !== 'ARS') {
                            // If expense is in USD, convert ARS back to USD
                            const rate = expense.currency === 'USD-Blue' ? exchangeRate : 
                                       expense.currency === 'USD-Tarjeta' ? exchangeRateTarjeta :
                                       selectedDolarType === 'blue' ? exchangeRate : exchangeRateTarjeta;
                            expense.amount = amount / rate;
                        } else {
                            expense.amount = amount;
                        }
                        saveExpenseChanges(expense);
                        displayExpenses(); // Refresh to update calculated values
                    }
                }
                // Currency column is not editable directly
            }
        }
    }
    
    // Recalculate formulas in case they depend on this cell
    recalculateFormulas();
}

// Save changes to an expense
async function saveExpenseChanges(expense) {
    try {
        const response = await fetch('/api/expenses/' + expense.id, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                date: expense.date,
                description: expense.description,
                amount: expense.amount,
                currency: expense.currency
            })
        });
        
        if (response.ok) {
            console.log('Expense updated:', expense);
        } else {
            console.error('Failed to update expense');
        }
    } catch (error) {
        console.error('Error updating expense:', error);
    }
}

// Calculate formula result
function calculateFormula(formula) {
    try {
        // Remove equals sign
        const expression = formula.substring(1);
        
        // Replace cell references with values
        let calculatedExpression = expression.replace(/[A-G][1-9][0-9]?/g, (match) => {
            if (gridData[match] !== undefined) {
                const value = parseFloat(gridData[match]);
                return isNaN(value) ? 0 : value;
            }
            return 0;
        });
        
        // Replace SUM function
        calculatedExpression = calculatedExpression.replace(/SUM\(([A-G][1-9][0-9]?):([A-G][1-9][0-9]?)\)/g, (match, start, end) => {
            const startCol = start.charAt(0);
            const startRow = parseInt(start.substring(1));
            const endCol = end.charAt(0);
            const endRow = parseInt(end.substring(1));
            
            let sum = 0;
            
            const startColIndex = COL_LETTERS.indexOf(startCol);
            const endColIndex = COL_LETTERS.indexOf(endCol);
            
            for (let r = startRow; r <= endRow; r++) {
                for (let c = startColIndex; c <= endColIndex; c++) {
                    const cellId = `${COL_LETTERS[c]}${r}`;
                    if (gridData[cellId] !== undefined) {
                        const value = parseFloat(gridData[cellId]);
                        if (!isNaN(value)) {
                            sum += value;
                        }
                    }
                }
            }
            
            return sum;
        });
        
        // Evaluate expression
        return eval(calculatedExpression);
    } catch (e) {
        console.error('Formula error:', e);
        return null;
    }
}

// Recalculate all formulas
function recalculateFormulas() {
    for (const cellId in cellFormulas) {
        const formula = cellFormulas[cellId];
        const calculatedValue = calculateFormula(formula);
        const cell = document.getElementById(cellId);
        
        if (cell) {
            cell.textContent = calculatedValue !== null ? calculatedValue : '#ERROR';
            gridData[cellId] = calculatedValue;
        }
    }
    
    updateTotals();
}

// Format buttons
document.querySelector('.toolbar-button.bold').addEventListener('click', () => {
    if (selectedCell) {
        selectedCell.classList.toggle('bold');
    }
});

document.querySelector('.toolbar-button.italic').addEventListener('click', () => {
    if (selectedCell) {
        selectedCell.classList.toggle('italic');
    }
});

// Format as currency
document.querySelector('.toolbar-button:nth-child(3)').addEventListener('click', () => {
    if (selectedCell && selectedCell.textContent) {
        const value = parseFloat(selectedCell.textContent);
        if (!isNaN(value)) {
            selectedCell.textContent = '$' + value.toFixed(2);
        }
    }
});

// Format as percentage
document.querySelector('.toolbar-button:nth-child(4)').addEventListener('click', () => {
    if (selectedCell && selectedCell.textContent) {
        const value = parseFloat(selectedCell.textContent);
        if (!isNaN(value)) {
            selectedCell.textContent = (value * 100).toFixed(1) + '%';
        }
    }
});

// Formula bar
document.getElementById('formula-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && selectedCell) {
        const formula = e.target.value;
        if (formula.startsWith('=')) {
            cellFormulas[selectedCell.id] = formula;
            const calculatedValue = calculateFormula(formula);
            selectedCell.textContent = calculatedValue !== null ? calculatedValue : '#ERROR';
            gridData[selectedCell.id] = calculatedValue;
            recalculateFormulas();
        } else {
            selectedCell.textContent = formula;
            gridData[selectedCell.id] = formula;
            delete cellFormulas[selectedCell.id];
        }
    }
});

// Fetch exchange rate from API
async function fetchExchangeRate() {
    try {
        // Fetch both exchange rates
        const [blueResponse, tarjetaResponse] = await Promise.all([
            fetch('/api/exchange-rate/blue'),
            fetch('/api/exchange-rate/tarjeta')
        ]);
        
        if (blueResponse.ok && tarjetaResponse.ok) {
            const blueData = await blueResponse.json();
            const tarjetaData = await tarjetaResponse.json();
            
            exchangeRate = blueData.usd_to_ars;
            exchangeRateTarjeta = tarjetaData.usd_to_ars;
            
            // Update UI
            document.getElementById('exchange-rate').textContent = selectedDolarType === 'blue' ? 
                exchangeRate : exchangeRateTarjeta;
            
            // Format date
            const updatedDate = new Date(
                selectedDolarType === 'blue' ? 
                blueData.updated : tarjetaData.updated
            ).toLocaleString();
            document.getElementById('rate-updated').textContent = updatedDate;
            
            console.log('Exchange rates updated - Blue:', exchangeRate, 'Tarjeta:', exchangeRateTarjeta);
            
            // Update ARS values in expenses
            updateExpenses();
        } else {
            throw new Error('Failed to fetch exchange rates');
        }
    } catch (error) {
        console.error('Error fetching exchange rate:', error);
        document.getElementById('exchange-rate').textContent = 'Error';
    }
}

// Switch dollar type
function switchDolarType(type) {
    selectedDolarType = type;
    
    // Update the display rate
    document.getElementById('exchange-rate').textContent = 
        selectedDolarType === 'blue' ? exchangeRate : exchangeRateTarjeta;
    
    // Update the date
    const rateElement = document.getElementById('rate-type');
    rateElement.textContent = selectedDolarType === 'blue' ? 'Blue' : 'Tarjeta';
    
    // Update button active state
    document.getElementById('dolar-blue').classList.toggle('active', selectedDolarType === 'blue');
    document.getElementById('dolar-tarjeta').classList.toggle('active', selectedDolarType === 'tarjeta');
    
    // Update currency dropdown default
    const currencySelect = document.getElementById('expense-currency');
    if (selectedDolarType === 'blue') {
        currencySelect.value = 'USD-Blue';
    } else {
        currencySelect.value = 'USD-Tarjeta';
    }
    
    // Update expenses display and totals
    displayExpenses();
}

// Fetch and save monthly salary
async function fetchSalary() {
    try {
        const response = await fetch('/api/salary');
        const data = await response.json();
        monthlySalary = data.salary;
        
        // Update UI
        document.getElementById('salary-input').value = monthlySalary;
    } catch (error) {
        console.error('Error fetching salary:', error);
    }
}

document.getElementById('save-salary').addEventListener('click', async () => {
    const salaryInput = document.getElementById('salary-input');
    const salary = parseFloat(salaryInput.value);
    
    if (!isNaN(salary)) {
        try {
            const response = await fetch('/api/salary', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ salary })
            });
            
            if (response.ok) {
                monthlySalary = salary;
                updateTotals();
                console.log('Salary saved:', salary);
            }
        } catch (error) {
            console.error('Error saving salary:', error);
        }
    }
});

// Fetch expenses from backend
async function fetchExpenses() {
    try {
        const response = await fetch('/api/expenses');
        expenses = await response.json();
        displayExpenses();
    } catch (error) {
        console.error('Error fetching expenses:', error);
    }
}

// Format a number to display properly
function formatNumber(num, isUSD = false) {
    if (isUSD) {
        return parseFloat(num).toFixed(2);
    } else {
        // For ARS, use no decimal places if the number is whole
        return parseFloat(num) % 1 === 0 ? 
            Math.round(parseFloat(num)).toString() : 
            parseFloat(num).toFixed(2);
    }
}

// Display expenses in the grid
function displayExpenses() {
    // Clear any existing expense data (except headers)
    for (let r = 2; r <= expenses.length + 1; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const cellId = `${COL_LETTERS[c]}${r}`;
            gridData[cellId] = '';
        }
    }
    
    expenses.forEach((expense, index) => {
        const row = index + 2; // Start at row 2 (row 1 is headers)
        
        // Display expense data
        gridData[`A${row}`] = expense.date;
        gridData[`B${row}`] = expense.description;
        
        // Determine the exchange rate to use based on the currency
        let currentRate;
        if (expense.currency === 'USD-Blue' || expense.currency === 'USD-Tarjeta') {
            currentRate = expense.currency === 'USD-Blue' ? exchangeRate : exchangeRateTarjeta;
        } else {
            currentRate = selectedDolarType === 'blue' ? exchangeRate : exchangeRateTarjeta;
        }
        
        if (expense.currency === 'USD-Blue' || expense.currency === 'USD-Tarjeta') {
            gridData[`C${row}`] = formatNumber(expense.amount, true);
            gridData[`D${row}`] = formatNumber(expense.amount * currentRate);
            gridData[`E${row}`] = expense.currency;
        } else if (expense.currency === 'ARS') {
            gridData[`C${row}`] = formatNumber(expense.amount / currentRate, true);
            gridData[`D${row}`] = formatNumber(expense.amount);
            gridData[`E${row}`] = 'ARS';
        } else {
            // Legacy USD handling (for backward compatibility)
            gridData[`C${row}`] = formatNumber(expense.amount, true);
            gridData[`D${row}`] = formatNumber(expense.amount * currentRate);
            gridData[`E${row}`] = selectedDolarType === 'blue' ? 'USD-Blue' : 'USD-Tarjeta';
        }
        
        gridData[`F${row}`] = 'Delete';
        
        // Set delete button
        const cell = document.getElementById(`F${row}`);
        if (cell) {
            cell.style.color = 'red';
            cell.style.cursor = 'pointer';
            
            // Remove any existing event listeners by cloning and replacing the cell
            const newCell = cell.cloneNode(true);
            cell.parentNode.replaceChild(newCell, cell);
            
            // Add new event listener
            newCell.addEventListener('click', () => deleteExpense(expense.id));
        }
    });
    
    // Update grid display
    for (const cellId in gridData) {
        const cell = document.getElementById(cellId);
        if (cell) {
            cell.textContent = gridData[cellId];
            
            // Add styling for Delete text
            if (cell.textContent === 'Delete') {
                cell.style.color = 'red';
                cell.style.cursor = 'pointer';
            }
        }
    }
    
    updateTotals();
}

// Update expenses with current exchange rate
function updateExpenses() {
    displayExpenses();
}

// Add a new expense
document.getElementById('add-expense').addEventListener('click', async () => {
    const dateInput = document.getElementById('expense-date');
    const descInput = document.getElementById('expense-desc');
    const amountInput = document.getElementById('expense-amount');
    const currencySelect = document.getElementById('expense-currency');
    
    const date = dateInput.value || new Date().toISOString().split('T')[0];
    const description = descInput.value || 'Unnamed expense';
    const amount = parseFloat(amountInput.value);
    const currency = currencySelect.value;
    
    if (!isNaN(amount) && amount > 0) {
        try {
            const response = await fetch('/api/expenses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ date, description, amount, currency })
            });
            
            if (response.ok) {
                // Clear form
                dateInput.value = '';
                descInput.value = '';
                amountInput.value = '';
                
                // Fetch updated expenses
                await fetchExpenses();
                
                console.log('Expense added');
            }
        } catch (error) {
            console.error('Error adding expense:', error);
        }
    } else {
        alert('Please enter a valid amount');
    }
});

// Delete an expense
async function deleteExpense(id) {
    if (confirm('Are you sure you want to delete this expense?')) {
        try {
            const response = await fetch('/api/expenses', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id })
            });
            
            if (response.ok) {
                await fetchExpenses();
                console.log('Expense deleted');
            }
        } catch (error) {
            console.error('Error deleting expense:', error);
        }
    }
}

// Update total calculations
function updateTotals() {
    let totalUSD = 0;
    let totalARS = 0;
    
    expenses.forEach(expense => {
        // Determine exchange rate to use based on the currency
        let rate;
        if (expense.currency === 'USD-Blue') {
            rate = exchangeRate;
        } else if (expense.currency === 'USD-Tarjeta') {
            rate = exchangeRateTarjeta;
        } else if (expense.currency === 'ARS') {
            rate = selectedDolarType === 'blue' ? exchangeRate : exchangeRateTarjeta;
        } else {
            // Legacy USD handling
            rate = selectedDolarType === 'blue' ? exchangeRate : exchangeRateTarjeta;
        }
        
        if (expense.currency === 'USD-Blue' || expense.currency === 'USD-Tarjeta' || expense.currency === 'USD') {
            totalUSD += expense.amount;
            totalARS += expense.amount * rate;
        } else {
            totalUSD += expense.amount / rate;
            totalARS += expense.amount;
        }
    });
    
    document.getElementById('total-usd').textContent = `$${formatNumber(totalUSD, true)}`;
    document.getElementById('total-ars').textContent = `ARS ${formatNumber(totalARS)}`;
    
    const remainingUSD = monthlySalary - totalUSD;
    // Use the selected rate for calculating remaining ARS
    const currentRate = selectedDolarType === 'blue' ? exchangeRate : exchangeRateTarjeta;
    const remainingARS = monthlySalary * currentRate - totalARS;
    
    document.getElementById('remaining-usd').textContent = `$${formatNumber(remainingUSD, true)}`;
    document.getElementById('remaining-ars').textContent = `ARS ${formatNumber(remainingARS)}`;
    
    // Update style for negative remaining budget
    if (remainingUSD < 0) {
        document.getElementById('remaining-usd').style.color = 'red';
    } else {
        document.getElementById('remaining-usd').style.color = '';
    }
    
    if (remainingARS < 0) {
        document.getElementById('remaining-ars').style.color = 'red';
    } else {
        document.getElementById('remaining-ars').style.color = '';
    }
    
    // Also color total expenses
    document.getElementById('total-usd').style.color = '';
    document.getElementById('total-ars').style.color = '';
}

// Initialize app
async function initApp() {
    initGrid();
    await fetchExchangeRate();
    await fetchSalary();
    await fetchExpenses();
    
    // Add event listeners for dolar type selection
    document.getElementById('dolar-blue').addEventListener('click', () => switchDolarType('blue'));
    document.getElementById('dolar-tarjeta').addEventListener('click', () => switchDolarType('tarjeta'));
    
    // Initialize currency dropdown with current selected rate
    const currencySelect = document.getElementById('expense-currency');
    currencySelect.value = selectedDolarType === 'blue' ? 'USD-Blue' : 'USD-Tarjeta';
}

// Start the app when the document is loaded
document.addEventListener('DOMContentLoaded', initApp); 