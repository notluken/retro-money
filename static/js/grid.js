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
let touchStartX = 0;
let touchStartY = 0;
let isTouching = false;
let touchTimeout = null;
let budgetAllocations = []; // Will store budget allocations
let budgetChart = null; // Chart.js instance
let pendingExpense = null; // For storing expense that exceeds budget

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
            
            // Add event listeners for mouse
            cell.addEventListener('click', () => selectCell(cell));
            cell.addEventListener('dblclick', () => editCell(cell));
            
            // Add touch event listeners
            cell.addEventListener('touchstart', (e) => handleTouchStart(e, cell));
            cell.addEventListener('touchend', (e) => handleTouchEnd(e, cell));
            
            row.appendChild(cell);
        }
        
        grid.appendChild(row);
    }
    
    // Initialize fixed header row for expenses table
    setupExpenseHeaders();
    
    // Setup resizing for columns and rows
    setupResizeHandlers();
    
    // Add touch scrollable class for iPhone
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        const gridWithRowHeaders = document.querySelector('.grid-with-row-headers');
        if (gridWithRowHeaders) {
            gridWithRowHeaders.classList.add('touch-scrollable');
        }
    }
}

// Touch event handlers
function handleTouchStart(e, cell) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isTouching = true;
    
    // Simulate click after a short delay
    touchTimeout = setTimeout(() => {
        selectCell(cell);
    }, 150);
    
    // For iPhone - ensure parent container is scrollable
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        const gridWithRowHeaders = document.querySelector('.grid-with-row-headers');
        if (gridWithRowHeaders) {
            gridWithRowHeaders.style.overflow = 'auto';
            gridWithRowHeaders.style.webkitOverflowScrolling = 'touch';
        }
    }
}

function handleTouchEnd(e, cell) {
    if (!isTouching) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = Math.abs(touchEndX - touchStartX);
    const deltaY = Math.abs(touchEndY - touchStartY);
    
    // Clear the timeout to prevent single tap action if this was a double tap
    clearTimeout(touchTimeout);
    
    // If the user hasn't moved their finger much (not scrolling)
    if (deltaX < 10 && deltaY < 10) {
        // Double tap detection
        const now = new Date().getTime();
        const lastTap = cell.lastTap || 0;
        const timeDiff = now - lastTap;
        
        if (timeDiff < 300 && timeDiff > 0) {
            // Double tap detected
            editCell(cell);
            e.preventDefault(); // Prevent zoom
        }
        
        cell.lastTap = now;
    }
    
    isTouching = false;
}

// Set up fixed headers for expenses table
function setupExpenseHeaders() {
    const headers = [
        { cell: 'A1', value: 'Date', style: 'bold' },
        { cell: 'B1', value: 'Description', style: 'bold' },
        { cell: 'C1', value: 'Amount (USD)', style: 'bold' },
        { cell: 'D1', value: 'Amount (ARS)', style: 'bold' },
        { cell: 'E1', value: 'Currency', style: 'bold' },
        { cell: 'F1', value: 'Category', style: 'bold' },
        { cell: 'G1', value: 'Actions', style: 'bold' }
    ];
    
    // First, style all row 1 cells with red background
    for (let c = 0; c < GRID_COLS; c++) {
        const colLetter = COL_LETTERS[c];
        const cellId = `${colLetter}1`;
        const cell = document.getElementById(cellId);
        
        if (cell) {
            cell.style.backgroundColor = '#c0c0c0';
            cell.style.color = '#000000';
            cell.style.fontWeight = 'bold';
            cell.style.borderBottom = '2px solid #000000';
            cell.style.borderRight = '2px solid #000000';
            cell.style.height = '35px';
        }
    }
    
    // Then set specific header text
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
        
        // Mouse events
        header.addEventListener('mousedown', (e) => {
            // Check if we clicked on the resize handle (right 4px of column header)
            const rect = header.getBoundingClientRect();
            if (e.clientX > rect.right - 4) {
                startColumnResize(letter, e.clientX);
            }
        });
        
        // Touch events for column resize
        header.addEventListener('touchstart', (e) => {
            const rect = header.getBoundingClientRect();
            const touchX = e.touches[0].clientX;
            
            // If touch is in the resize handle area
            if (touchX > rect.right - 15) {
                e.preventDefault();
                startColumnResize(letter, touchX);
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
        
        // Mouse events
        header.addEventListener('mousedown', (e) => {
            // Check if we clicked on the resize handle (bottom 4px of row header)
            const rect = header.getBoundingClientRect();
            if (e.clientY > rect.bottom - 4) {
                startRowResize(rowNum, e.clientY);
            }
        });
        
        // Touch events for row resize
        header.addEventListener('touchstart', (e) => {
            const rect = header.getBoundingClientRect();
            const touchY = e.touches[0].clientY;
            
            // If touch is in the resize handle area
            if (touchY > rect.bottom - 15) {
                e.preventDefault();
                startRowResize(rowNum, touchY);
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
    
    const onTouchMove = (e) => {
        e.preventDefault();
        const touchX = e.touches[0].clientX;
        const deltaX = touchX - startX;
        const newWidth = Math.max(20, initialWidth + deltaX);
        
        // Update the visual guide
        resizeHandle.style.left = (touchX - 2) + 'px';
    };
    
    const onMouseUp = (e) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onMouseUp);
        
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
    
    const onTouchEnd = (e) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
        
        // Calculate final width
        const touchX = e.changedTouches[0].clientX;
        const deltaX = touchX - startX;
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
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
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
    resizeHandle.style.top = (startY - 2) + 'px';
    document.body.appendChild(resizeHandle);
    
    const onMouseMove = (e) => {
        const deltaY = e.clientY - startY;
        const newHeight = Math.max(18, initialHeight + deltaY);
        
        // Update the visual guide
        resizeHandle.style.top = (e.clientY - 2) + 'px';
    };
    
    const onTouchMove = (e) => {
        e.preventDefault();
        const touchY = e.touches[0].clientY;
        const deltaY = touchY - startY;
        const newHeight = Math.max(18, initialHeight + deltaY);
        
        // Update the visual guide
        resizeHandle.style.top = (touchY - 2) + 'px';
    };
    
    const onMouseUp = (e) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onMouseUp);
        
        // Calculate final height
        const deltaY = e.clientY - startY;
        const newHeight = Math.max(18, initialHeight + deltaY);
        
        // Store the new height
        rowHeights[rowNum] = newHeight;
        
        // Apply to row header
        rowHeader.style.height = newHeight + 'px';
        
        // Apply to grid row
        if (gridRow) {
            gridRow.style.height = newHeight + 'px';
        }
        
        // Remove the resize handle
        document.body.removeChild(resizeHandle);
    };
    
    const onTouchEnd = (e) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
        
        // Calculate final height
        const touchY = e.changedTouches[0].clientY;
        const deltaY = touchY - startY;
        const newHeight = Math.max(18, initialHeight + deltaY);
        
        // Store the new height
        rowHeights[rowNum] = newHeight;
        
        // Apply to row header
        rowHeader.style.height = newHeight + 'px';
        
        // Apply to grid row
        if (gridRow) {
            gridRow.style.height = newHeight + 'px';
        }
        
        // Remove the resize handle
        document.body.removeChild(resizeHandle);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
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
                // Also update budget allocations
                await fetchBudgetAllocations();
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
    // Ensure num is a number
    num = parseFloat(num);
    
    // Check for invalid values
    if (isNaN(num)) {
        return "0.00";
    }
    
    if (isUSD) {
        return num.toFixed(2);
    } else {
        // For ARS, use no decimal places if the number is whole
        return num % 1 === 0 ? 
            Math.round(num).toString() : 
            num.toFixed(2);
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
        
        // Add category to the grid
        gridData[`F${row}`] = expense.category || 'Fixed Expenses';
        
        gridData[`G${row}`] = 'Delete';
        
        // Set delete button
        const cell = document.getElementById(`G${row}`);
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
    const categorySelect = document.getElementById('expense-category');
    
    const date = dateInput.value || new Date().toISOString().split('T')[0];
    const description = descInput.value || 'Unnamed expense';
    const amount = parseFloat(amountInput.value);
    const currency = currencySelect.value;
    const category = categorySelect.value;
    
    if (!isNaN(amount) && amount > 0) {
        // Check if this expense would exceed budget limits
        const current_month = date.split('-').slice(0, 2).join('-');
        
        // Find the matching budget allocation
        const matchingAllocation = budgetAllocations.find(alloc => 
            alloc.name === category
        );
        
        if (matchingAllocation) {
            // Convert amount to USD if it's in ARS
            let amountInUSD = amount;
            if (currency === 'ARS') {
                // Determine the exchange rate to use
                const currentRate = selectedDolarType === 'blue' ? exchangeRate : exchangeRateTarjeta;
                if (currentRate > 0) {
                    amountInUSD = amount / currentRate;
                }
            }
            
            // Now check if the USD amount exceeds the budget limit
            if (matchingAllocation.actual + amountInUSD > matchingAllocation.allocated * 1.2) {
                // This expense would exceed 120% of the budget
                pendingExpense = { date, description, amount, currency, category };
                
                // Show confirmation modal
                document.getElementById('budget-exceed-modal').style.display = 'block';
                return;
            }
        }
        
        await addExpense(date, description, amount, currency, category);
    } else {
        alert('Please enter a valid amount');
    }
});

// Confirm expense that exceeds budget
document.getElementById('confirm-expense').addEventListener('click', async () => {
    if (pendingExpense) {
        const { date, description, amount, currency, category } = pendingExpense;
        await addExpense(date, description, amount, currency, category);
        pendingExpense = null;
    }
    document.getElementById('budget-exceed-modal').style.display = 'none';
});

// Cancel expense that exceeds budget
document.getElementById('cancel-expense').addEventListener('click', () => {
    pendingExpense = null;
    document.getElementById('budget-exceed-modal').style.display = 'none';
});

// Add expense helper function
async function addExpense(date, description, amount, currency, category) {
    try {
        const response = await fetch('/api/expenses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ date, description, amount, currency, category })
        });
        
        if (response.ok) {
            // Clear form
            document.getElementById('expense-date').value = '';
            document.getElementById('expense-desc').value = '';
            document.getElementById('expense-amount').value = '';
            
            // Fetch updated expenses and budget
            await fetchExpenses();
            await fetchBudgetAllocations();
            
            console.log('Expense added');
        }
    } catch (error) {
        console.error('Error adding expense:', error);
    }
}

// Fetch budget allocations from backend
async function fetchBudgetAllocations() {
    try {
        const response = await fetch('/api/budget-allocations');
        const data = await response.json();
        
        console.log("Budget allocations data:", data);
        
        // Store the allocations
        budgetAllocations = data.allocations;
        
        // Display budget allocations
        displayBudgetAllocations(data);
        
        // Update the budget chart
        updateBudgetChart(data);
        
        // Check for budget warnings
        checkBudgetWarnings(data);
    } catch (error) {
        console.error('Error fetching budget allocations:', error);
    }
}

// Display budget allocations in the grid
function displayBudgetAllocations(data) {
    console.log("Displaying budget data:", data);
    
    const budgetGrid = document.getElementById('budget-allocation-body');
    const budgetTotals = document.getElementById('budget-allocation-totals');
    
    // Clear existing content
    budgetGrid.innerHTML = '';
    budgetTotals.innerHTML = '';
    
    // Add each budget category row
    data.allocations.forEach(allocation => {
        const row = document.createElement('div');
        row.className = 'budget-grid-row';
        
        // Category name
        const nameCell = document.createElement('div');
        nameCell.className = 'budget-grid-cell';
        nameCell.textContent = allocation.name;
        row.appendChild(nameCell);
        
        // Percentage
        const percentCell = document.createElement('div');
        percentCell.className = 'budget-grid-cell';
        percentCell.textContent = `${allocation.percentage.toFixed(1)}%`;
        row.appendChild(percentCell);
        
        // Allocated amount
        const allocatedCell = document.createElement('div');
        allocatedCell.className = 'budget-grid-cell';
        allocatedCell.textContent = `$${formatNumber(allocation.allocated, true)}`;
        row.appendChild(allocatedCell);
        
        // Actual spend
        const actualCell = document.createElement('div');
        actualCell.className = 'budget-grid-cell';
        actualCell.textContent = `$${formatNumber(allocation.actual, true)}`;
        row.appendChild(actualCell);
        
        // Remaining balance
        const remainingCell = document.createElement('div');
        remainingCell.className = 'budget-grid-cell';
        if (allocation.remaining < 0) {
            remainingCell.classList.add('over-budget');
        }
        remainingCell.textContent = `$${formatNumber(allocation.remaining, true)}`;
        row.appendChild(remainingCell);
        
        budgetGrid.appendChild(row);
    });
    
    // Manually calculate totals to ensure we have values
    let totalAllocated = 0;
    let totalActual = 0;
    let totalRemaining = 0;
    
    if (data.allocations && data.allocations.length > 0) {
        data.allocations.forEach(allocation => {
            totalAllocated += allocation.allocated || 0;
            totalActual += allocation.actual || 0;
        });
        totalRemaining = totalAllocated - totalActual;
    } else {
        // Use data from API if available
        totalAllocated = data.total_allocated || 0;
        totalActual = data.total_actual || 0;
        totalRemaining = data.total_remaining || 0;
    }
    
    // Instead of creating a separate row, let's directly add cells to the footer
    // This ensures alignment with the header which is also constructed this way
    const nameCell = document.createElement('div');
    nameCell.className = 'budget-grid-cell';
    nameCell.textContent = 'Total';
    budgetTotals.appendChild(nameCell);
    
    const percentCell = document.createElement('div');
    percentCell.className = 'budget-grid-cell';
    percentCell.textContent = '100%';
    budgetTotals.appendChild(percentCell);
    
    const allocatedCell = document.createElement('div');
    allocatedCell.className = 'budget-grid-cell';
    allocatedCell.textContent = `$${formatNumber(totalAllocated, true)}`;
    budgetTotals.appendChild(allocatedCell);
    
    const actualCell = document.createElement('div');
    actualCell.className = 'budget-grid-cell';
    actualCell.textContent = `$${formatNumber(totalActual, true)}`;
    budgetTotals.appendChild(actualCell);
    
    const remainingCell = document.createElement('div');
    remainingCell.className = 'budget-grid-cell';
    if (totalRemaining < 0) {
        remainingCell.classList.add('over-budget');
    }
    remainingCell.textContent = `$${formatNumber(totalRemaining, true)}`;
    budgetTotals.appendChild(remainingCell);
}

// Update budget chart
function updateBudgetChart(data) {
    console.log("Updating budget chart with data:", data);
    
    const ctx = document.getElementById('budget-chart').getContext('2d');
    
    // Prepare data for chart
    const labels = data.allocations.map(a => a.name);
    const allocatedData = data.allocations.map(a => a.allocated);
    const actualData = data.allocations.map(a => a.actual);
    
    console.log("Chart labels:", labels);
    console.log("Allocated data:", allocatedData);
    console.log("Actual data:", actualData);
    
    // Destroy existing chart if exists
    if (budgetChart) {
        budgetChart.destroy();
    }
    
    // Create new chart
    budgetChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Allocated',
                    data: allocatedData,
                    backgroundColor: 'rgba(0, 0, 128, 0.7)',
                    borderColor: 'rgba(0, 0, 128, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Actual',
                    data: actualData,
                    backgroundColor: 'rgba(192, 0, 0, 0.7)',
                    borderColor: 'rgba(192, 0, 0, 1)',
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
                        text: 'Amount (USD)'
                    }
                }
            },
            animation: {
                duration: 1000
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
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
}

// Check for budget warnings
function checkBudgetWarnings(data) {
    const warningElement = document.getElementById('budget-warning');
    
    // Check if any categories exceed their budget
    const overBudget = data.allocations.some(a => a.is_over_budget);
    
    if (overBudget) {
        warningElement.classList.remove('hidden');
    } else {
        warningElement.classList.add('hidden');
    }
}

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

// Function to adjust budget allocations
async function redistributeBudget(adjustments) {
    if (!adjustments || !Array.isArray(adjustments) || adjustments.length === 0) {
        return;
    }
    
    // Validate that percentages sum to 100%
    const totalPercentage = adjustments.reduce((total, adj) => total + adj.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.1) {
        alert('Total percentage must equal 100%');
        return;
    }
    
    try {
        const response = await fetch('/api/budget-allocations/redistribute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ adjustments })
        });
        
        if (response.ok) {
            await fetchBudgetAllocations();
            console.log('Budget redistributed successfully');
        }
    } catch (error) {
        console.error('Error redistributing budget:', error);
    }
}

// Open budget adjustment modal
document.getElementById('adjust-budget').addEventListener('click', () => {
    // Populate the form with current allocations
    const form = document.getElementById('budget-adjustment-form');
    form.innerHTML = '';
    
    // Add inputs for each category
    budgetAllocations.forEach(alloc => {
        const row = document.createElement('div');
        row.className = 'budget-adjustment-row';
        
        const catLabel = document.createElement('div');
        catLabel.className = 'budget-adjustment-category';
        catLabel.textContent = alloc.name;
        
        const percentInput = document.createElement('div');
        percentInput.className = 'budget-adjustment-percentage';
        
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = '100';
        input.step = '0.1';
        input.value = alloc.percentage.toFixed(1);
        input.dataset.id = alloc.id;
        input.addEventListener('input', updateAdjustmentTotal);
        
        percentInput.appendChild(input);
        percentInput.appendChild(document.createTextNode(' %'));
        
        row.appendChild(catLabel);
        row.appendChild(percentInput);
        
        form.appendChild(row);
    });
    
    // Add total row
    const totalRow = document.createElement('div');
    totalRow.className = 'adjustment-total';
    totalRow.id = 'adjustment-total';
    totalRow.textContent = 'Total: 100.0%';
    form.appendChild(totalRow);
    
    // Show the modal
    document.getElementById('budget-adjust-modal').style.display = 'block';
});

// Update total percentage when inputs change
function updateAdjustmentTotal() {
    const inputs = document.querySelectorAll('#budget-adjustment-form input');
    let total = 0;
    
    inputs.forEach(input => {
        const val = parseFloat(input.value) || 0;
        total += val;
    });
    
    const totalElement = document.getElementById('adjustment-total');
    totalElement.textContent = `Total: ${total.toFixed(1)}%`;
    
    // Highlight if not 100%
    if (Math.abs(total - 100) > 0.1) {
        totalElement.classList.add('invalid');
    } else {
        totalElement.classList.remove('invalid');
    }
}

// Save budget adjustments
document.getElementById('save-budget-adjustments').addEventListener('click', async () => {
    const inputs = document.querySelectorAll('#budget-adjustment-form input');
    let total = 0;
    const adjustments = [];
    
    inputs.forEach(input => {
        const val = parseFloat(input.value) || 0;
        total += val;
        
        adjustments.push({
            id: parseInt(input.dataset.id),
            percentage: val
        });
    });
    
    // Validate total
    if (Math.abs(total - 100) > 0.1) {
        alert('Total percentage must equal 100%');
        return;
    }
    
    // Save changes
    await redistributeBudget(adjustments);
    
    // Close modal
    document.getElementById('budget-adjust-modal').style.display = 'none';
});

// Cancel budget adjustments
document.getElementById('cancel-budget-adjustments').addEventListener('click', () => {
    document.getElementById('budget-adjust-modal').style.display = 'none';
});

// Initialize app
async function initApp() {
    initGrid();
    await fetchExchangeRate();
    await fetchSalary();
    await fetchExpenses();
    await fetchBudgetAllocations();
    
    // Add event listeners for dolar type selection
    document.getElementById('dolar-blue').addEventListener('click', () => switchDolarType('blue'));
    document.getElementById('dolar-tarjeta').addEventListener('click', () => switchDolarType('tarjeta'));
    document.getElementById('dolar-blue').addEventListener('touchend', (e) => {
        e.preventDefault();
        switchDolarType('blue');
    });
    document.getElementById('dolar-tarjeta').addEventListener('touchend', (e) => {
        e.preventDefault();
        switchDolarType('tarjeta');
    });
    
    // Initialize currency dropdown with current selected rate
    const currencySelect = document.getElementById('expense-currency');
    currencySelect.value = selectedDolarType === 'blue' ? 'USD-Blue' : 'USD-Tarjeta';
    
    // Set up buttons with touch events
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        if (button.id !== 'dolar-blue' && button.id !== 'dolar-tarjeta') {
            button.addEventListener('touchend', (e) => {
                e.preventDefault();
                button.click();
            });
        }
    });
    
    // iPhone-specific setup for grid navigation
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        // Add touch event listener to the grid container to ensure scrollability
        const gridWithRowHeaders = document.querySelector('.grid-with-row-headers');
        if (gridWithRowHeaders) {
            // Add touch-scrollable class
            gridWithRowHeaders.classList.add('touch-scrollable');
            
            gridWithRowHeaders.addEventListener('touchmove', function(e) {
                // Ensure the event continues to propagate for scrolling
                e.stopPropagation();
            }, { passive: true });
            
            // Make sure the grid is actually visible
            setTimeout(() => {
                const gridContainer = document.querySelector('.grid-container');
                if (gridContainer) {
                    gridContainer.style.display = 'flex';
                    gridContainer.style.flex = '1 0 auto';
                    gridContainer.style.minHeight = '300px';
                }
                
                gridWithRowHeaders.style.overflow = 'auto';
                gridWithRowHeaders.style.webkitOverflowScrolling = 'touch';
            }, 300);
        }
    }
}

// Start the app when the document is loaded
document.addEventListener('DOMContentLoaded', initApp); 