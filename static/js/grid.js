// Grid dimensions
const GRID_ROWS = 15;
const GRID_COLS = 7;
const COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

// Default column widths - percentages of total width
const DEFAULT_COLUMN_WIDTHS = {
    'A': '12%',   // Date
    'B': '22%',   // Description - reduced from 32% to 22%
    'C': '15%',   // Amount USD - increased from 13% to 15%
    'D': '15%',   // Amount ARS - increased from 13% to 15%
    'E': '12%',   // Currency - increased from 10% to 12%
    'F': '16%',   // Category - increased from 12% to 16%
    'G': '8%'     // Actions
};

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

// Initialize the grid
function initGrid() {
    const grid = document.getElementById('expense-grid');
    
    // Clear existing content
    grid.innerHTML = '';
    
    // Create cells
    for (let r = 0; r < GRID_ROWS; r++) {
        const row = document.createElement('div');
        row.className = 'grid-row';
        row.style.width = '100%';
        row.style.display = 'flex';
        
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
            
            // Apply width as percentage to make cells stretch
            cell.style.width = DEFAULT_COLUMN_WIDTHS[colLetter];
            cell.style.minWidth = "0"; // Allow shrinking if needed
            cell.style.flex = "1 1 " + DEFAULT_COLUMN_WIDTHS[colLetter];
            
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
    
    // Fix column headers display
    fixColumnHeadersDisplay();
    
    // Add touch scrollable class for iPhone
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        const gridWithRowHeaders = document.querySelector('.grid-with-row-headers');
        if (gridWithRowHeaders) {
            gridWithRowHeaders.classList.add('touch-scrollable');
        }
    }
}

// Fix column headers display
function fixColumnHeadersDisplay() {
    const columnHeaders = document.querySelectorAll('.column-header');
    const columnHeadersContainer = document.querySelector('.column-headers');
    
    if (columnHeadersContainer) {
        columnHeadersContainer.style.width = '100%';
        columnHeadersContainer.style.display = 'flex';
    }
    
    columnHeaders.forEach((header, index) => {
        if (index < GRID_COLS) {
            const letter = COL_LETTERS[index];
            
            // Set the letter in the header
            header.textContent = letter;
            
            // Apply width as percentage
            header.style.width = DEFAULT_COLUMN_WIDTHS[letter];
            header.style.minWidth = "0";
            header.style.flex = "1 1 " + DEFAULT_COLUMN_WIDTHS[letter];
            header.style.display = 'flex';
            header.style.alignItems = 'center';
            header.style.justifyContent = 'center';
        } else {
            // Hide any extra headers
            header.style.display = 'none';
        }
    });
    
    // Make corner-cell visible
    const cornerCell = document.querySelector('.corner-cell');
    if (cornerCell) {
        cornerCell.style.width = '40px';
        cornerCell.style.minWidth = '40px';
        cornerCell.style.backgroundColor = '#c0c0c0';
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
    
    // For iPhone - ensure parent container is scrollable vertically only
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        const gridWithRowHeaders = document.querySelector('.grid-with-row-headers');
        if (gridWithRowHeaders) {
            gridWithRowHeaders.style.overflowY = 'scroll';
            gridWithRowHeaders.style.overflowX = 'hidden';
            gridWithRowHeaders.style.webkitOverflowScrolling = 'touch';
            gridWithRowHeaders.style.scrollbarWidth = 'none';
            gridWithRowHeaders.style.msOverflowStyle = 'none';
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
    
    // First, style all row 1 cells with proper background
    for (let c = 0; c < GRID_COLS; c++) {
        const colLetter = COL_LETTERS[c];
        const cellId = `${colLetter}1`;
        const cell = document.getElementById(cellId);
        
        if (cell) {
            cell.style.backgroundColor = '#c0c0c0';
            cell.style.color = '#000000';
            cell.style.fontWeight = 'bold';
            cell.style.borderBottom = '1px solid #000000';
            cell.style.borderRight = '1px solid #000000';
            cell.style.height = '25px';
            cell.style.display = 'flex';
            cell.style.alignItems = 'center';
            cell.style.justifyContent = 'center';
            
            // Apply the specific width from DEFAULT_COLUMN_WIDTHS
            cell.style.width = DEFAULT_COLUMN_WIDTHS[colLetter];
            cell.style.minWidth = "0";
            cell.style.flex = "1 1 " + DEFAULT_COLUMN_WIDTHS[colLetter];
        }
    }
    
    // Apply header values
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
        
        // Make letter visible and centered
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.justifyContent = 'center';
        header.style.fontWeight = 'bold';
        
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
                    // Remove currency symbols and commas, then parse as float with fixed precision
                    const amount = parseFloat(parseFloat(value.replace(/[$,]/g, '')).toFixed(2));
                    
                    if (!isNaN(amount)) {
                        console.log(`Editing USD amount: ${value} -> ${amount}`);
                        
                        if (expense.currency === 'ARS') {
                            // If expense is in ARS, convert USD back to ARS
                            const rate = expense.currency === 'USD-Blue' ? exchangeRate : 
                                      expense.currency === 'USD-Tarjeta' ? exchangeRateTarjeta :
                                      selectedDolarType === 'blue' ? exchangeRate : exchangeRateTarjeta;
                            
                            expense.amount = parseFloat((amount * rate).toFixed(2));
                            console.log(`Converting to ARS: ${amount} USD * ${rate} = ${expense.amount} ARS`);
                        } else {
                            expense.amount = amount;
                        }
                        saveExpenseChanges(expense);
                        displayExpenses(); // Refresh to update calculated values
                    }
                } else if (col === 'D') { // Amount (ARS)
                    // Remove currency symbols, spaces, and commas
                    const amount = parseFloat(parseFloat(value.replace(/[ARS$,\s]/g, '')).toFixed(2));
                    
                    if (!isNaN(amount)) {
                        console.log(`Editing ARS amount: ${value} -> ${amount}`);
                        
                        if (expense.currency !== 'ARS') {
                            // If expense is in USD, convert ARS back to USD
                            const rate = expense.currency === 'USD-Blue' ? exchangeRate : 
                                      expense.currency === 'USD-Tarjeta' ? exchangeRateTarjeta :
                                      selectedDolarType === 'blue' ? exchangeRate : exchangeRateTarjeta;
                            
                            expense.amount = parseFloat((amount / rate).toFixed(2));
                            console.log(`Converting to USD: ${amount} ARS / ${rate} = ${expense.amount} USD`);
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
const boldButton = document.querySelector('.toolbar-button.bold');
if (boldButton) {
    boldButton.addEventListener('click', () => {
        if (selectedCell) {
            selectedCell.classList.toggle('bold');
        }
    });
}

const italicButton = document.querySelector('.toolbar-button.italic');
if (italicButton) {
    italicButton.addEventListener('click', () => {
        if (selectedCell) {
            selectedCell.classList.toggle('italic');
        }
    });
}

// Format as currency
const currencyButton = document.querySelector('.toolbar-button:nth-child(3)');
if (currencyButton) {
    currencyButton.addEventListener('click', () => {
        if (selectedCell && selectedCell.textContent) {
            const value = parseFloat(selectedCell.textContent);
            if (!isNaN(value)) {
                selectedCell.textContent = '$' + value.toFixed(2);
            }
        }
    });
}

// Format as percentage
const percentButton = document.querySelector('.toolbar-button:nth-child(4)');
if (percentButton) {
    percentButton.addEventListener('click', () => {
        if (selectedCell && selectedCell.textContent) {
            const value = parseFloat(selectedCell.textContent);
            if (!isNaN(value)) {
                selectedCell.textContent = (value * 100).toFixed(1) + '%';
            }
        }
    });
}

// Fetch expenses from backend
async function fetchExpenses() {
    return new Promise((resolve, reject) => {
        try {
            // Use the storage API instead of direct fetch
            AppStorage.expenses.get(function(data) {
                expenses = data;
                displayExpenses(); // This will call updateTotals()
                resolve(data);
            });
        } catch (error) {
            console.error('Error fetching expenses:', error);
            reject(error);
        }
    });
}

// Format a number to display properly
function formatNumber(num, isUSD = false) {
    // Ensure num is a number
    num = parseFloat(num);
    
    // Check for invalid values
    if (isNaN(num)) {
        return "0.00";
    }
    
    // Make sure we have the right precision
    if (isUSD) {
        // Always show 2 decimal places for USD
        // Using parseFloat to handle potential floating point issues
        return parseFloat(num.toFixed(2)).toFixed(2);
    } else {
        // For ARS, use no decimal places if the number is whole
        if (Math.abs(num % 1) < 0.001) { // Check if it's very close to a whole number
            return Math.round(num).toString();
        } else {
            // Show up to 2 decimal places, but trim trailing zeros
            return parseFloat(num.toFixed(2)).toString();
        }
    }
}

// Display expenses in the grid
function displayExpenses() {
    // Clear old expense data (starting from row 2)
    for (let r = 1; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const cellId = `${COL_LETTERS[c]}${r + 1}`;
            const cell = document.getElementById(cellId);
            if (cell) {
                cell.textContent = '';
                cell.innerHTML = '';
                gridData[cellId] = '';
            }
        }
    }
    
    // Sort expenses by date, newest first
    expenses.sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
    });
    
    // Populate expenses into grid
    for (let i = 0; i < expenses.length; i++) {
        const expense = expenses[i];
        const rowNum = i + 2; // Start from row 2
        
        // Format date
        const dateObj = new Date(expense.date);
        const formattedDate = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;
        
        // Format amounts
        let amountUSD = expense.amount;
        let amountARS = 0;
        
        if (expense.currency === 'ARS') {
            // If in ARS, convert to USD
            amountUSD = exchangeRate > 0 ? expense.amount / exchangeRate : 0;
            amountARS = expense.amount;
        } else if (expense.currency === 'USD-Blue' || expense.currency === 'USD') {
            // If in USD, convert to ARS
            amountUSD = expense.amount;
            amountARS = expense.amount * exchangeRate;
        } else if (expense.currency === 'USD-Tarjeta') {
            // If in USD-Tarjeta, use tarjeta rate
            amountUSD = expense.amount;
            amountARS = expense.amount * exchangeRateTarjeta;
        }
        
        // Set cell values
        setCellValue(`A${rowNum}`, formattedDate);
        setCellValue(`B${rowNum}`, expense.description);
        setCellValue(`C${rowNum}`, formatNumber(amountUSD, true));
        setCellValue(`D${rowNum}`, formatNumber(amountARS));
        setCellValue(`E${rowNum}`, expense.currency);
        setCellValue(`F${rowNum}`, expense.category);
        
        // Add a delete link
        const deleteCell = document.getElementById(`G${rowNum}`);
        if (deleteCell) {
            deleteCell.innerHTML = '';
            const deleteLink = document.createElement('a');
            deleteLink.href = '#';
            deleteLink.textContent = 'Delete';
            deleteLink.addEventListener('click', function(e) {
                e.preventDefault();
                deleteExpense(expense.id);
            });
            deleteCell.appendChild(deleteLink);
            gridData[`G${rowNum}`] = 'Delete';
        }
    }
    
    // Update totals
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
        // Ensure amount has proper precision
        const preciseAmount = parseFloat(parseFloat(amount).toFixed(2));
        console.log(`Adding expense: ${description}, Amount: ${amount} -> ${preciseAmount} ${currency}`);
        
        const expenseData = { 
            date, 
            description, 
            amount: preciseAmount, // Use precise amount
            currency, 
            category 
        };
        
        // Use the storage API instead of direct fetch
        AppStorage.expenses.add(expenseData, function(data) {
            // Reset form fields
            document.getElementById('expense-date').value = '';
            document.getElementById('expense-desc').value = '';
            document.getElementById('expense-amount').value = '';
            
            // Update expenses and totals, then refresh budgets
            expenses = data;
            displayExpenses();
            
            // Refresh budgets after the totals are updated
            setTimeout(() => {
                fetchBudgetAllocations();
            }, 50);
        });
    } catch (error) {
        console.error('Error adding expense:', error);
    }
}

// Fetch budget allocations from backend
async function fetchBudgetAllocations() {
    try {
        // First, ensure we have the most accurate expense data
        // Build a category map of our expenses for precise comparisons
        const categoryMap = {};
        let totalFromExpenses = 0;
        
        expenses.forEach(expense => {
            // Determine the correct USD amount
            let usdAmount;
            
            if (expense.currency === 'ARS') {
                // Convert ARS to USD
                const rate = selectedDolarType === 'blue' ? exchangeRate : exchangeRateTarjeta;
                usdAmount = parseFloat((expense.amount / rate).toFixed(2));
            } else {
                // Already in USD
                usdAmount = parseFloat(expense.amount.toFixed(2));
            }
            
            const category = expense.category || 'Fixed Expenses';
            
            // Add to category map
            if (!categoryMap[category]) {
                categoryMap[category] = 0;
            }
            categoryMap[category] = parseFloat((categoryMap[category] + usdAmount).toFixed(2));
            
            // Add to total
            totalFromExpenses = parseFloat((totalFromExpenses + usdAmount).toFixed(2));
        });
        
        console.log('Local expense totals by category:', categoryMap);
        console.log('Total expenses from local data:', totalFromExpenses);
        
        // Use the storage API
        AppStorage.budget.getAllocations(function(data) {
            if (data) {
                budgetAllocations = data.allocations || [];
                
                // Get the total from the UI for verification
                const totalUSDElement = document.getElementById('total-usd');
                let displayedTotal = 0;
                
                if (totalUSDElement) {
                    // Extract the numeric value from the total-usd element
                    const totalUSDStr = totalUSDElement.textContent.replace(/[$,]/g, '');
                    displayedTotal = parseFloat(totalUSDStr);
                    
                    if (!isNaN(displayedTotal)) {
                        console.log('Displayed total from UI:', displayedTotal);
                        
                        // Check if there's a meaningful difference between totals
                        if (Math.abs(displayedTotal - totalFromExpenses) > 0.01) {
                            console.warn('Discrepancy between UI total and calculated total:', 
                                        {ui: displayedTotal, calculated: totalFromExpenses});
                        }
                    }
                }
                
                // Force the API data to use our locally calculated values
                // This ensures complete consistency between the table and chart
                if (data.allocations && data.allocations.length > 0) {
                    data.allocations.forEach(alloc => {
                        // Use our precise category values from local calculations
                        if (categoryMap[alloc.name] !== undefined) {
                            const oldValue = alloc.actual;
                            alloc.actual = categoryMap[alloc.name];
                            alloc.remaining = parseFloat((alloc.allocated - alloc.actual).toFixed(2));
                            alloc.is_over_budget = alloc.remaining < 0;
                            
                            console.log(`Adjusting ${alloc.name}: API value ${oldValue} → Local value ${alloc.actual}`);
                        } else {
                            // Category with no expenses
                            alloc.actual = 0;
                            alloc.remaining = alloc.allocated;
                            alloc.is_over_budget = false;
                        }
                    });
                    
                    // Update the total actual
                    data.total_actual = totalFromExpenses;
                    data.total_remaining = parseFloat((data.total_allocated - data.total_actual).toFixed(2));
                    
                    console.log('Updated budget data with local calculations:', data);
                }
                
                displayBudgetAllocations(data);
            }
        });
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
    
    // Add these calls to update budget chart and warnings
    updateBudgetChart(data);
    checkBudgetWarnings(data);
}

// Update budget chart
function updateBudgetChart(data) {
    console.log("Updating budget chart with data:", data);
    
    // Check if Chart.js is available
    if (typeof Chart === 'undefined') {
        console.error("Chart.js is not loaded. Cannot update budget chart.");
        return;
    }
    
    const chartCanvas = document.getElementById('budget-chart');
    if (!chartCanvas) {
        console.error("Budget chart canvas element not found.");
        return;
    }
    
    const ctx = chartCanvas.getContext('2d');
    if (!ctx) {
        console.error("Could not get 2D context from canvas.");
        return;
    }
    
    // Prepare data for chart
    const labels = data.allocations.map(a => a.name);
    
    // Ensure we have precise numbers for the chart data
    const allocatedData = data.allocations.map(a => parseFloat(parseFloat(a.allocated).toFixed(2)));
    const actualData = data.allocations.map(a => parseFloat(parseFloat(a.actual).toFixed(2)));
    
    console.log("Chart labels:", labels);
    console.log("Allocated data:", allocatedData);
    console.log("Actual data:", actualData);
    
    // Verify total matches what we expect
    const chartTotal = actualData.reduce((sum, val) => sum + val, 0);
    const displayedTotal = parseFloat(document.getElementById('total-usd').textContent.replace(/[$,]/g, ''));
    
    console.log("Chart total:", parseFloat(chartTotal.toFixed(2)), "Displayed total:", displayedTotal);
    
    if (Math.abs(chartTotal - displayedTotal) > 0.01) {
        console.warn("Chart total doesn't match displayed total!", {
            chartTotal: chartTotal.toFixed(2),
            displayedTotal: displayedTotal.toFixed(2)
        });
    }
    
    // Destroy existing chart if exists
    if (budgetChart) {
        budgetChart.destroy();
    }
    
    // Create new chart
    try {
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
                                // Use exact numeric value, formatted consistently with the grid
                                label += '$' + formatNumber(context.raw, true);
                                return label;
                            }
                        }
                    }
                }
            }
        });
        console.log("Budget chart created successfully");
    } catch (error) {
        console.error("Error creating budget chart:", error);
    }
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

// Delete an expense by ID
async function deleteExpense(id) {
    if (confirm('Are you sure you want to delete this expense?')) {
        try {
            // Use the storage API instead of direct fetch
            AppStorage.expenses.delete(id, function(data) {
                // Update expenses and totals
                expenses = data;
                displayExpenses();
                
                // Refresh budgets after the totals are updated
                setTimeout(() => {
                    fetchBudgetAllocations();
                }, 50);
            });
        } catch (error) {
            console.error('Error deleting expense:', error);
        }
    }
}

// Update total calculations
function updateTotals() {
    // Use a more precise approach to prevent floating point errors
    let totalUSD = 0;
    let totalARS = 0;
    
    // Create a map to track category totals
    const categoryTotals = {};
    
    console.log("Calculando totales para", expenses.length, "gastos");
    
    expenses.forEach((expense, index) => {
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
        
        // Ensure we're working with a numeric value, precisely rounded
        const amount = parseFloat(parseFloat(expense.amount).toFixed(2));
        
        // Get category (default to Fixed Expenses if not specified)
        const category = expense.category || 'Fixed Expenses';
        
        // Initialize category total if needed
        if (!categoryTotals[category]) {
            categoryTotals[category] = 0;
        }
        
        // Use parseFloat and toFixed to avoid floating point errors
        if (expense.currency === 'USD-Blue' || expense.currency === 'USD-Tarjeta' || expense.currency === 'USD') {
            // Add USD amount with proper precision handling
            totalUSD = parseFloat((totalUSD + amount).toFixed(2));
            totalARS = parseFloat((totalARS + amount * rate).toFixed(2));
            
            // Add to category total
            categoryTotals[category] = parseFloat((categoryTotals[category] + amount).toFixed(2));
            
            // Log for debugging
            console.log(`Gasto ${index + 1}: ${amount} USD (${expense.currency}) -> Total USD: ${totalUSD}`);
        } else {
            // For ARS, convert to USD with proper precision handling
            const usdAmount = parseFloat((amount / rate).toFixed(2));
            totalUSD = parseFloat((totalUSD + usdAmount).toFixed(2));
            totalARS = parseFloat((totalARS + amount).toFixed(2));
            
            // Add to category total
            categoryTotals[category] = parseFloat((categoryTotals[category] + usdAmount).toFixed(2));
            
            // Log for debugging
            console.log(`Gasto ${index + 1}: ${amount} ARS -> ${usdAmount} USD -> Total USD: ${totalUSD}`);
        }
    });
    
    console.log("Total final USD:", totalUSD);
    console.log("Category totals (USD):", categoryTotals);
    
    document.getElementById('total-usd').textContent = `$${formatNumber(totalUSD, true)}`;
    document.getElementById('total-ars').textContent = `ARS ${formatNumber(totalARS)}`;
    
    const remainingUSD = parseFloat((monthlySalary - totalUSD).toFixed(2));
    // Use the selected rate for calculating remaining ARS
    const currentRate = selectedDolarType === 'blue' ? exchangeRate : exchangeRateTarjeta;
    const remainingARS = parseFloat((monthlySalary * currentRate - totalARS).toFixed(2));
    
    document.getElementById('remaining-usd').textContent = `$${formatNumber(remainingUSD, true)}`;
    document.getElementById('remaining-ars').textContent = `ARS ${formatNumber(remainingARS)}`;
    
    // Update style for negative remaining budget
    const remainingUsdElement = document.getElementById('remaining-usd');
    const remainingArsElement = document.getElementById('remaining-ars');
    
    if (remainingUSD < 0) {
        remainingUsdElement.classList.add('negative');
    } else {
        remainingUsdElement.classList.remove('negative');
    }
    
    if (remainingARS < 0) {
        remainingArsElement.classList.add('negative');
    } else {
        remainingArsElement.classList.remove('negative');
    }
    
    // Also color total expenses
    document.getElementById('total-usd').style.color = '';
    document.getElementById('total-ars').style.color = '';
    
    // Store category totals for later use with budget charts
    window.categoryTotals = categoryTotals;
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

// Fetch exchange rate
async function fetchExchangeRate() {
    try {
        // Use the storage API for exchange rates
        const type = selectedDolarType || 'blue';
        
        AppStorage.exchangeRate.get(type, function(data) {
            if (data) {
                if (type === 'blue') {
                    exchangeRate = data.usd_to_ars;
                } else {
                    exchangeRateTarjeta = data.usd_to_ars;
                }
                updateExpenses();
            }
        });
    } catch (error) {
        console.error('Error fetching exchange rate:', error);
    }
}

// Switch dolar type
function switchDolarType(type) {
    selectedDolarType = type;
    
    // Update the storage
    AppStorage.exchangeRate.setActiveType(type);
    
    // Update UI - removed button toggle
    document.getElementById('rate-type').textContent = type === 'blue' ? 'Blue' : 'Tarjeta';
    
    // Update currency select
    const currencySelect = document.getElementById('expense-currency');
    currencySelect.value = type === 'blue' ? 'USD-Blue' : 'USD-Tarjeta';
    
    // Fetch rate if needed
    fetchExchangeRate();
}

// Fetch salary from backend
async function fetchSalary() {
    try {
        // Use the storage API
        AppStorage.salary.get(function(salaryAmount) {
            monthlySalary = salaryAmount || 0;
            document.getElementById('salary-input').value = monthlySalary;
        });
    } catch (error) {
        console.error('Error fetching salary:', error);
    }
}

// Save salary changes
document.getElementById('save-salary').addEventListener('click', async () => {
    const salaryInput = document.getElementById('salary-input');
    const salary = parseFloat(salaryInput.value);
    
    if (!isNaN(salary) && salary >= 0) {
        try {
            // Use the storage API
            AppStorage.salary.save(salary, function(success) {
                if (success) {
                    monthlySalary = salary;
                    fetchBudgetAllocations(); // Refresh allocations
                }
            });
        } catch (error) {
            console.error('Error saving salary:', error);
        }
    }
});

// Update monthly budget
function updateMonthlyBudget() {
    const salaryInput = document.getElementById('salary-input');
    let salary = parseFloat(salaryInput.value || 0).toFixed(2);
    
    // Get the current currency
    const currencySelector = document.getElementById('currency-selector');
    const currency = currencySelector.value;
    
    // Store the updated salary
    AppStorage.updateMonthlySalary(salary, currency);
    
    // Update the budget dashboard
    updateBudgetDashboard();
    
    console.log(`Monthly budget updated: ${salary} ${currency}`);
}

// Add event listener to salary input
function setupBudgetListeners() {
    const salaryInput = document.getElementById('salary-input');
    salaryInput.addEventListener('change', updateMonthlyBudget);
    
    // Ensure the currency selector also triggers an update
    const currencySelector = document.getElementById('currency-selector');
    currencySelector.addEventListener('change', function() {
        // When currency changes, we need to recalculate the dashboard
        updateBudgetDashboard();
    });
}

// Initialize app
async function initApp() {
    initGrid();
    
    // Ensure column headers are visible
    setTimeout(fixColumnHeadersDisplay, 100);
    
    // Wait for Chart.js to load if needed
    let chartAttemptsLeft = 10;
    while (typeof Chart === 'undefined' && chartAttemptsLeft > 0) {
        console.log(`Waiting for Chart.js to load... (${chartAttemptsLeft} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 200));
        chartAttemptsLeft--;
    }
    
    if (typeof Chart === 'undefined') {
        console.error("Chart.js failed to load after multiple attempts");
    } else {
        console.log("Chart.js loaded successfully");
    }
    
    await fetchExchangeRate();
    await fetchSalary();
    
    // Important: load expenses first and update totals before loading budget
    await fetchExpenses(); // This will also call updateTotals()
    
    // Then load budget allocations which will use the totals
    await fetchBudgetAllocations();
    
    // Force another refresh after everything is loaded to ensure data consistency
    setTimeout(async () => {
        console.log("Performing final data consistency check...");
        await fetchBudgetAllocations();
    }, 500);
    
    // Removed event listeners for dolar type selection buttons
    
    // Initialize currency dropdown with current selected rate
    const currencySelect = document.getElementById('expense-currency');
    currencySelect.value = selectedDolarType === 'blue' ? 'USD-Blue' : 'USD-Tarjeta';
    
    // Setup refresh button for exchange rate
    const refreshRateButton = document.getElementById('refresh-rate');
    if (refreshRateButton) {
        refreshRateButton.addEventListener('click', () => {
            fetchExchangeRate();
            // Make sure to update expenses before refreshing budget data
            fetchExpenses().then(() => {
                fetchBudgetAllocations();
            });
        });
    }
    
    // Set up buttons with touch events
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        // Removed dolar-blue and dolar-tarjeta exceptions
        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            button.click();
        });
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
    
    setupBudgetListeners();
}

// Start the app when the document is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Convert between currencies
function convertCurrency(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) {
        return parseFloat(amount);
    }
    
    // Get the latest exchange rates from the global variable
    const rates = window.exchangeRates || { USD_ARS: 945, ARS_USD: 1/945 };
    
    let result;
    // Converting from USD to ARS
    if (fromCurrency === 'USD' && toCurrency === 'ARS') {
        result = parseFloat(amount) * rates.USD_ARS;
    } 
    // Converting from ARS to USD
    else if (fromCurrency === 'ARS' && toCurrency === 'USD') {
        result = parseFloat(amount) * rates.ARS_USD;
    } 
    else {
        console.error('Unsupported currency conversion:', fromCurrency, 'to', toCurrency);
        return parseFloat(amount);
    }
    
    // Return with 2 decimal precision for calculations
    return parseFloat(result.toFixed(2));
}

// Update budget dashboard with current expenses and salary
function updateBudgetDashboard() {
    const salaryInput = document.getElementById('salary-input');
    const currencySelector = document.getElementById('currency-selector');
    
    // Get current currency and salary
    const currentCurrency = currencySelector.value;
    let monthlySalary = parseFloat(salaryInput.value || 0);
    
    // Calculate total expenses for the current month
    const expenses = calculateMonthlyExpenses();
    const totalExpenses = expenses.total;
    
    // Calculate remaining budget
    const remaining = monthlySalary - totalExpenses;
    
    // Update dashboard UI
    document.getElementById('total-expenses').textContent = `${totalExpenses.toFixed(2)} ${currentCurrency}`;
    document.getElementById('remaining-budget').textContent = `${remaining.toFixed(2)} ${currentCurrency}`;
    
    // Update progress bar
    const progressBar = document.getElementById('budget-progress');
    if (progressBar) {
        const percentUsed = monthlySalary > 0 ? (totalExpenses / monthlySalary) * 100 : 0;
        progressBar.style.width = `${Math.min(percentUsed, 100)}%`;
        
        // Change color based on budget status
        if (percentUsed > 90) {
            progressBar.className = 'progress-bar progress-bar-danger';
        } else if (percentUsed > 70) {
            progressBar.className = 'progress-bar progress-bar-warning';
        } else {
            progressBar.className = 'progress-bar progress-bar-success';
        }
    }
    
    console.log(`Budget dashboard updated: ${totalExpenses.toFixed(2)} spent, ${remaining.toFixed(2)} remaining`);
}

// Calculate total expenses for the current month
function calculateMonthlyExpenses() {
    const currencySelector = document.getElementById('currency-selector');
    const currentCurrency = currencySelector.value;
    
    // Get all expense cells from the grid
    const expenseCells = document.querySelectorAll('.expense-cell');
    
    let total = 0;
    let categories = {};
    
    // Process each expense cell
    expenseCells.forEach(cell => {
        const value = parseFloat(cell.textContent || 0);
        const currency = cell.dataset.currency || currentCurrency;
        const category = cell.dataset.category || 'Uncategorized';
        
        if (!isNaN(value) && value > 0) {
            // Convert to current currency if needed
            const convertedValue = convertCurrency(value, currency, currentCurrency);
            
            total += convertedValue;
            
            // Add to category total
            if (!categories[category]) {
                categories[category] = 0;
            }
            categories[category] += convertedValue;
        }
    });
    
    return {
        total,
        categories
    };
}

// Set cell value (helper function for grid updates)
function setCellValue(cellId, value) {
    const cell = document.getElementById(cellId);
    if (cell) {
        cell.textContent = value;
        gridData[cellId] = value;
    }
} 