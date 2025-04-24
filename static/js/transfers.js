/**
 * Transfers.js - Gestión de transferencias y cuentas
 * Retro Money App
 */

// Variables globales
let accounts = {};
let transferHistory = [];
let exchangeRate = 0;
let cryptoRate = 0;

// Inicializar la página cuando se carga el DOM
document.addEventListener('DOMContentLoaded', initTransfersPage);

// Función principal de inicialización
async function initTransfersPage() {
    console.log('Inicializando página de transferencias...');
    
    // Primero obtener la tasa de cambio
    await fetchExchangeRate();
    
    // Cargar cuentas y transferencias
    await loadAccounts();
    await loadTransfers();
    
    // Configurar eventos
    setupEventListeners();
    
    // Establecer un intervalo para actualizar la tasa de cambio y las cuentas cada 5 minutos
    setInterval(async function() {
        console.log('Actualizando tasa de cambio y cuentas...');
        await fetchExchangeRate();
        await loadAccounts();
    }, 5 * 60 * 1000); // 5 minutos
}

// Cargar la tasa de cambio
async function fetchExchangeRate() {
    // Fetch crypto dollar rate directly from the API
    try {
        const cryptoResponse = await fetch('https://dolarapi.com/v1/dolares/cripto');
        if (!cryptoResponse.ok) {
            throw new Error(`HTTP error! status: ${cryptoResponse.status}`);
        }
        const cryptoData = await cryptoResponse.json();
        cryptoRate = cryptoData.venta;
        console.log('Tasa de cambio cripto actualizada:', cryptoRate);
    } catch (error) {
        console.error('Error fetching crypto rate:', error);
        cryptoRate = 1230; // Valor por defecto si falla
        console.warn('Usando tasa de cambio cripto predeterminada:', cryptoRate);
    }
    
    return cryptoRate;
}

// Cargar cuentas desde el API
async function loadAccounts() {
    return new Promise((resolve) => {
        // Siempre obtener las cuentas frescas del API
        AppStorage.accounts.get(function(accountsData) {
            accounts = accountsData;
            
            // Verificar si necesitamos actualizar manualmente la cuenta ARS
            const arsAccount = Object.values(accounts).find(acc => acc.currency === 'ARS');
            const beloAccount = Object.values(accounts).find(acc => acc.name === 'Belo');
            
            if (arsAccount && beloAccount && cryptoRate > 0) {
                // Verificar si el balance de ARS está actualizado según la tasa cripto
                const expectedArsBalance = beloAccount.balance * cryptoRate;
                const diff = Math.abs(expectedArsBalance - arsAccount.balance);
                
                // Si hay una diferencia significativa (>1%), actualizar en el frontend
                if (diff > (arsAccount.balance * 0.01) || arsAccount.balance === 0) {
                    console.log(`Actualizando cuenta ARS manualmente: ${arsAccount.balance} -> ${expectedArsBalance}`);
                    arsAccount.balance = expectedArsBalance;
                }
            }
            
            renderAccounts();
            populateAccountSelects();
            resolve(accounts);
        }, true); // Forzar refresco
    });
}

// Cargar historial de transferencias
async function loadTransfers() {
    return new Promise((resolve) => {
        AppStorage.transfers.get(function(transfersData) {
            transferHistory = transfersData;
            renderTransfers();
            resolve(transferHistory);
        });
    });
}

// Configurar eventos de interacción
function setupEventListeners() {
    // Evento para actualizar saldos de cuentas
    const updateAccountsBtn = document.getElementById('update-accounts');
    if (updateAccountsBtn) {
        updateAccountsBtn.addEventListener('click', updateAccountBalances);
    }
    
    // Eventos para la transferencia
    const transferFromSelect = document.getElementById('transfer-from');
    const transferToSelect = document.getElementById('transfer-to');
    const transferAmountInput = document.getElementById('transfer-amount');
    
    if (transferFromSelect && transferToSelect && transferAmountInput) {
        transferFromSelect.addEventListener('change', calculateFees);
        transferToSelect.addEventListener('change', calculateFees);
        transferAmountInput.addEventListener('input', calculateFees);
    }
    
    // Evento para registrar transferencia
    const registerTransferBtn = document.getElementById('register-transfer');
    if (registerTransferBtn) {
        registerTransferBtn.addEventListener('click', registerTransfer);
    }
    
    // Establecer la fecha actual por defecto
    const transferDateInput = document.getElementById('transfer-date');
    if (transferDateInput) {
        transferDateInput.value = new Date().toISOString().split('T')[0];
    }
}

// Renderizar tarjetas de cuentas
function renderAccounts() {
    const accountCardsContainer = document.getElementById('account-cards');
    if (!accountCardsContainer) return;
    
    accountCardsContainer.innerHTML = '';
    
    // Iterar sobre cada cuenta
    Object.values(accounts).forEach(account => {
        const accountCard = document.createElement('div');
        accountCard.className = 'account-card';
        
        // Formatear saldo según la moneda
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
                <div class="account-fee">Comisión: ${(account.fee_percent * 100).toFixed(1)}%</div>
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

// Poblar los selectores de cuentas
function populateAccountSelects() {
    const fromSelect = document.getElementById('transfer-from');
    const toSelect = document.getElementById('transfer-to');
    
    if (!fromSelect || !toSelect) return;
    
    // Limpiar opciones existentes
    fromSelect.innerHTML = '';
    toSelect.innerHTML = '';
    
    // Agregar opciones para cada cuenta
    Object.values(accounts).forEach(account => {
        const option = document.createElement('option');
        option.value = account.name;
        option.textContent = `${account.name} (${account.currency})`;
        
        fromSelect.appendChild(option.cloneNode(true));
        toSelect.appendChild(option.cloneNode(true));
    });
    
    // Seleccionar Payoneer como origen por defecto
    const payoneerOption = Array.from(fromSelect.options).find(opt => opt.value === 'Payoneer');
    if (payoneerOption) {
        payoneerOption.selected = true;
    }
    
    // Seleccionar Belo como destino por defecto
    const beloOption = Array.from(toSelect.options).find(opt => opt.value === 'Belo');
    if (beloOption) {
        beloOption.selected = true;
    }
    
    // Calcular comisiones iniciales
    calculateFees();
}

// Calcular comisiones para una transferencia
function calculateFees() {
    const fromSelect = document.getElementById('transfer-from');
    const toSelect = document.getElementById('transfer-to');
    const amountInput = document.getElementById('transfer-amount');
    const feePayoneerSpan = document.getElementById('fee-payoneer');
    const feeBeloSpan = document.getElementById('fee-belo');
    const feeAmountSpan = document.getElementById('fee-amount');
    const netAmountSpan = document.getElementById('net-amount');
    
    if (!fromSelect || !toSelect || !amountInput || !feeAmountSpan || !netAmountSpan) return;
    
    const fromAccountName = fromSelect.value;
    const toAccountName = toSelect.value;
    const grossAmount = parseFloat(amountInput.value) || 0;
    
    // Encontrar las cuentas correspondientes
    const fromAccount = Object.values(accounts).find(acc => acc.name === fromAccountName);
    const toAccount = Object.values(accounts).find(acc => acc.name === toAccountName);
    
    if (!fromAccount || !toAccount) return;
    
    // Calcular comisiones
    const fromFee = fromAccount.name === 'Payoneer' ? grossAmount * 0.03 : grossAmount * fromAccount.fee_percent;
    const toFee = toAccount.name === 'Belo' ? (grossAmount - fromFee) * 0.01 : (grossAmount - fromFee) * toAccount.fee_percent;
    const totalFees = fromFee + toFee;
    const netAmount = grossAmount - totalFees;
    
    // Actualizar la interfaz
    if (feePayoneerSpan) feePayoneerSpan.textContent = fromAccount.name === 'Payoneer' ? fromFee.toFixed(2) : '0.00';
    if (feeBeloSpan) feeBeloSpan.textContent = toAccount.name === 'Belo' ? toFee.toFixed(2) : '0.00';
    feeAmountSpan.textContent = totalFees.toFixed(2);
    netAmountSpan.textContent = netAmount.toFixed(2);
}

// Registrar una nueva transferencia
async function registerTransfer() {
    // Obtener valores del formulario
    const dateInput = document.getElementById('transfer-date');
    const descriptionInput = document.getElementById('transfer-description');
    const fromSelect = document.getElementById('transfer-from');
    const toSelect = document.getElementById('transfer-to');
    const amountInput = document.getElementById('transfer-amount');
    
    if (!dateInput || !fromSelect || !toSelect || !amountInput) return;
    
    const date = dateInput.value || new Date().toISOString().split('T')[0];
    const description = descriptionInput.value || 'Transferencia';
    const fromAccountName = fromSelect.value;
    const toAccountName = toSelect.value;
    const grossAmount = parseFloat(amountInput.value) || 0;
    
    if (grossAmount <= 0) {
        alert('Por favor ingrese un monto válido');
        return;
    }
    
    // Encontrar las cuentas correspondientes
    const fromAccount = Object.values(accounts).find(acc => acc.name === fromAccountName);
    const toAccount = Object.values(accounts).find(acc => acc.name === toAccountName);
    
    if (!fromAccount || !toAccount) {
        alert('Error: No se encontraron las cuentas seleccionadas');
        return;
    }
    
    // Verificar saldo suficiente
    if (fromAccount.balance < grossAmount) {
        alert(`Saldo insuficiente en ${fromAccountName}. Saldo actual: ${fromAccount.balance}`);
        return;
    }
    
    // Calcular comisiones
    const fromFee = fromAccount.name === 'Payoneer' ? grossAmount * 0.03 : grossAmount * fromAccount.fee_percent;
    const toFee = toAccount.name === 'Belo' ? (grossAmount - fromFee) * 0.01 : (grossAmount - fromFee) * toAccount.fee_percent;
    const totalFees = fromFee + toFee;
    const netAmount = grossAmount - totalFees;
    
    // Asegurarse de tener la tasa de cripto actualizada si la transferencia involucra ARS
    if (fromAccount.currency === 'ARS' || toAccount.currency === 'ARS') {
        await fetchExchangeRate();
    }
    
    // Crear objeto de transferencia
    const transfer = {
        date,
        from_account: fromAccountName,
        to_account: toAccountName,
        gross_amount: grossAmount,
        amount: netAmount,
        total_fees: totalFees,
        description
    };
    
    // Guardar la transferencia
    AppStorage.transfers.add(transfer, function(updatedTransfers) {
        if (updatedTransfers) {
            transferHistory = updatedTransfers;
            
            // Actualizar saldos de cuentas
            fromAccount.balance -= grossAmount;
            
            if (toAccount.currency === 'ARS') {
                // Para cuentas en ARS, usar el precio del dólar cripto
                toAccount.balance += netAmount * cryptoRate;
                console.log(`Convertido ${netAmount} USD a ${netAmount * cryptoRate} ARS usando tasa cripto ${cryptoRate}`);
                
                // Asegurarse de que la cuenta ARS refleje el saldo correcto
                const arsAccount = Object.values(accounts).find(acc => acc.currency === 'ARS');
                const beloAccount = Object.values(accounts).find(acc => acc.name === 'Belo');
                
                // Si Belo está involucrado en la transferencia, actualizar ARS en consecuencia
                if (fromAccountName === 'Belo' || toAccountName === 'Belo') {
                    console.log('Actualizando cuenta ARS basada en Belo después de transferencia');
                    arsAccount.balance = beloAccount.balance * cryptoRate;
                }
            } else if (toAccount.name === 'Belo' && fromAccount.currency === 'USD') {
                // Para Belo, usar valor de USDC
                toAccount.balance += netAmount;
                console.log(`Transferido ${netAmount} USD a Belo como USDC`);
                
                // Actualizar cuenta ARS si Belo está involucrado
                const arsAccount = Object.values(accounts).find(acc => acc.currency === 'ARS');
                if (arsAccount) {
                    console.log('Actualizando cuenta ARS basada en Belo después de transferencia');
                    arsAccount.balance = toAccount.balance * cryptoRate;
                }
            } else {
                toAccount.balance += netAmount;
                console.log(`Transferido ${netAmount} ${fromAccount.currency} a ${toAccount.name}`);
            }
            
            // Registrar comisiones como gastos fijos
            addCommissionAsExpense(totalFees, date, `Comisión por transferencia ${fromAccountName} -> ${toAccountName}`);
            
            // Guardar cuentas actualizadas
            AppStorage.accounts.update(accounts, function(success) {
                if (success) {
                    // Recargar datos
                    loadAccounts();
                    renderTransfers();
                    
                    // Limpiar formulario
                    amountInput.value = '';
                    descriptionInput.value = '';
                    calculateFees();
                    
                    alert('Transferencia registrada correctamente');
                }
            });
        }
    });
}

// Registrar la comisión como un gasto fijo
function addCommissionAsExpense(amount, date, description) {
    // Si el monto es muy pequeño, no lo registramos
    if (amount <= 0) return;
    
    const expense = {
        amount: amount,
        date: date,
        description: description,
        category: 'Fixed Expenses',
        currency: 'USD'
    };
    
    // Usar el API de almacenamiento para agregar el gasto
    AppStorage.expenses.add(expense, function() {
        console.log('Comisión registrada como gasto fijo:', expense);
    });
}

// Renderizar historial de transferencias
function renderTransfers() {
    const transfersBody = document.getElementById('transfers-grid-body');
    if (!transfersBody) return;
    
    transfersBody.innerHTML = '';
    
    if (!transferHistory || transferHistory.length === 0) {
        const emptyRow = document.createElement('div');
        emptyRow.className = 'transfers-grid-row';
        emptyRow.innerHTML = '<div class="transfers-grid-cell" style="flex: 8; text-align: center;">No hay transferencias registradas</div>';
        transfersBody.appendChild(emptyRow);
        return;
    }
    
    // Crear filas para cada transferencia
    transferHistory.forEach(transfer => {
        const row = document.createElement('div');
        row.className = 'transfers-grid-row';
        
        // Formatear fecha
        const formattedDate = new Date(transfer.date).toLocaleDateString();
        
        row.innerHTML = `
            <div class="transfers-grid-cell">${formattedDate}</div>
            <div class="transfers-grid-cell">${transfer.description}</div>
            <div class="transfers-grid-cell">${transfer.from_account}</div>
            <div class="transfers-grid-cell">${transfer.to_account}</div>
            <div class="transfers-grid-cell">$${formatNumber(transfer.gross_amount, true)}</div>
            <div class="transfers-grid-cell">$${formatNumber(transfer.total_fees, true)}</div>
            <div class="transfers-grid-cell">$${formatNumber(transfer.amount, true)}</div>
            <div class="transfers-grid-cell transfer-delete" data-transfer-id="${transfer.id}">Eliminar</div>
        `;
        
        transfersBody.appendChild(row);
    });
    
    // Agregar eventos a los botones de eliminar
    const deleteButtons = document.querySelectorAll('.transfer-delete');
    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const transferId = this.getAttribute('data-transfer-id');
            if (transferId && confirm('¿Estás seguro de eliminar esta transferencia?')) {
                deleteTransfer(transferId);
            }
        });
    });
}

// Eliminar una transferencia
function deleteTransfer(transferId) {
    // Primero obtenemos la transferencia a eliminar
    const transferToDelete = transferHistory.find(t => t.id === parseInt(transferId));
    
    if (!transferToDelete) {
        alert('No se pudo encontrar la transferencia');
        return;
    }
    
    AppStorage.transfers.delete(transferId, function(updatedTransfers) {
        if (updatedTransfers) {
            // Revertir los saldos de las cuentas
            const fromAccount = Object.values(accounts).find(acc => acc.name === transferToDelete.from_account);
            const toAccount = Object.values(accounts).find(acc => acc.name === transferToDelete.to_account);
            
            if (fromAccount && toAccount) {
                // Devolver el monto bruto a la cuenta de origen
                fromAccount.balance += transferToDelete.gross_amount;
                
                // Quitar el monto neto de la cuenta de destino
                if (toAccount.currency === 'ARS' && fromAccount.currency === 'USD') {
                    // Si fue convertido a ARS usando cripto rate
                    toAccount.balance -= transferToDelete.amount * cryptoRate;
                } else if (toAccount.name === 'Belo' && fromAccount.currency === 'USD') {
                    // Si fue transferido a Belo como USDC
                    toAccount.balance -= transferToDelete.amount;
                } else {
                    // Transferencia regular
                    toAccount.balance -= transferToDelete.amount;
                }
                
                // Guardar los cambios en las cuentas
                AppStorage.accounts.update(accounts, function(success) {
                    if (success) {
                        transferHistory = updatedTransfers;
                        loadAccounts();
                        renderTransfers();
                        alert('Transferencia eliminada correctamente y saldos actualizados');
                    } else {
                        alert('Error al actualizar los saldos de las cuentas');
                    }
                });
            } else {
                transferHistory = updatedTransfers;
                renderTransfers();
                alert('Transferencia eliminada, pero no se pudieron actualizar los saldos');
            }
        }
    });
}

// Actualizar saldos de cuentas manualmente
function updateAccountBalances() {
    // Recopilar valores de los inputs
    const balanceInputs = document.querySelectorAll('.account-balance-input');
    
    // Guardar saldo original de Belo
    const beloAccount = Object.values(accounts).find(acc => acc.name === 'Belo');
    const arsAccount = Object.values(accounts).find(acc => acc.currency === 'ARS');
    let originalBeloBalance = beloAccount ? beloAccount.balance : 0;
    
    balanceInputs.forEach(input => {
        const accountId = input.getAttribute('data-account-id');
        const newBalance = parseFloat(input.value) || 0;
        
        // Encontrar la cuenta y actualizar su saldo
        const accountToUpdate = Object.values(accounts).find(acc => acc.id === parseInt(accountId));
        if (accountToUpdate) {
            accountToUpdate.balance = newBalance;
        }
    });
    
    // Actualizar la cuenta ARS según el saldo de Belo y la tasa cripto
    const beloUpdatedAccount = Object.values(accounts).find(acc => acc.name === 'Belo');
    
    // Asegurarse de tener el valor correcto de la tasa cripto
    if (beloUpdatedAccount && arsAccount) {
        // Obtener la tasa cripto fresca
        fetchExchangeRate().then(() => {
            // Calcular el balance ARS basado en la tasa cripto y el saldo de Belo
            const newArsBalance = beloUpdatedAccount.balance * cryptoRate;
            
            console.log(`Actualizando cuenta ARS: ${arsAccount.balance} -> ${newArsBalance} (Belo: ${beloUpdatedAccount.balance} * Rate: ${cryptoRate})`);
            
            // Actualizar el balance de la cuenta ARS
            arsAccount.balance = newArsBalance;
            
            // Buscar el input de la cuenta ARS y actualizarlo
            const arsInput = document.querySelector(`.account-balance-input[data-account-id="${arsAccount.id}"]`);
            if (arsInput) {
                arsInput.value = newArsBalance;
            }
            
            // Guardar todos los cambios
            saveAccountChanges();
        });
    } else {
        saveAccountChanges();
    }
    
    function saveAccountChanges() {
        // Guardar cambios
        AppStorage.accounts.update(accounts, function(success) {
            if (success) {
                // Recargar cuentas para asegurar que todo está actualizado
                loadAccounts();
                alert('Saldos actualizados correctamente');
            } else {
                alert('Error al actualizar saldos');
            }
        });
    }
}

// Función de utilidad para formatear números
function formatNumber(num, isUSD = false) {
    // Asegurar que sea un número
    num = parseFloat(num);
    
    // Verificar valores inválidos
    if (isNaN(num)) {
        return "0.00";
    }
    
    // Formatear según moneda
    if (isUSD) {
        // Siempre mostrar 2 decimales para USD
        return parseFloat(num.toFixed(2)).toFixed(2);
    } else {
        // Para ARS, sin decimales si es número entero
        if (Math.abs(num % 1) < 0.001) {
            return Math.round(num).toString();
        } else {
            // Mostrar hasta 2 decimales, pero eliminar ceros finales
            return parseFloat(num.toFixed(2)).toString();
        }
    }
} 